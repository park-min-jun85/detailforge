import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { exclusive, getAssetContext } from "@/features/assets/service";
import { AssetError, assetRowSchema, assertAssetScope, MAX_PRODUCT_ASSETS, parseId, storagePath } from "@/features/assets/schemas";
import type { Asset } from "@/types/domain";
import { ExtractionError } from "./errors";
import { withExtractionSlot } from "./execution";
import { decodeSource, imageTiles, tileDataUrl, planCrop, encodeCrop, sourceFingerprint, type CropPlan } from "./images";
import { assertSourceRect, manualCropRect, validatedDerivedRect } from "./crop-geometry";
import { candidateId, normalizeCandidates } from "./geometry";
import { cropRectKey } from "./crop-identity";
import { bounded, loadSource } from "./source";
import { getExtractionProvider, getExtractionModel, EXTRACTION_PROMPT, RELEVANCE_PROMPT, type ExtractionProvider } from "./provider";
import { POLICY_VERSION, RUN_TIMEOUT_MS, TILE_TIMEOUT_MS, PRODUCT_REGIONS } from "./policy";
import { loadExtractionProductContext } from "./product-context";
import { derivationSchema, isExtractionActive, isSaveActive, readExtraction, resultSchema, saveRequestSchema, tileOutputSchema,
  type ExtractionState, type Candidate, type Region, type ManualInsets } from "./schemas";
import { readExtractionAsset as readAsset, compareExtractionState as compareAndSave, updateExtractionRun as finish, persistTileCheckpoint } from "./persistence";
import { buildCheckpointInput, checkpointInputFingerprint, createCheckpoint, completedTileCheckpoint, failedTileCheckpoint,
  failureCheckpoint, CheckpointError, type TileCheckpoint } from "./checkpoint";

type Client = ReturnType<typeof createSupabaseServerClient>;
const timeout = () => AbortSignal.timeout(10_000);
const safeError = (e: unknown) => e instanceof ExtractionError ? e : new ExtractionError(e instanceof AssetError ? e.status === 404 ? "not_found" : e.status === 409 ? "busy" : "database" : "unexpected");
async function context(client: Client, projectId: string, assetId: string) {
  try { projectId = parseId(projectId); assetId = parseId(assetId); } catch { throw new ExtractionError("not_found"); }
  const value = await getAssetContext(projectId, client).catch(error => {
    if (error instanceof AssetError && error.status === 409) throw new ExtractionError("ownership");
    throw error;
  });
  if (!value.product) throw new ExtractionError("ownership");
  return { projectId, productId: value.product.id, assetId };
}

export async function analyzeProductShots(projectId: string, assetId: string, force = false, providerFactory: () => ExtractionProvider = getExtractionProvider) {
  return withExtractionSlot(async () => { try {
    const client = createSupabaseServerClient({ requestTimeoutMs: 30_000 }), scope = await context(client, projectId, assetId);
    return await exclusive(scope.productId, async () => {
      const source = await readAsset(client, scope), previous = readExtraction(source.metadata);
      if (isExtractionActive(previous) || isSaveActive(previous)) throw new ExtractionError("busy");
      const image = await decodeSource(await loadSource(client, source), source.mimeType);
      const productContext = await loadExtractionProductContext(client, scope);
      let provider: ExtractionProvider | undefined;
      const model = providerFactory === getExtractionProvider ? getExtractionModel() : (provider = providerFactory()).model;
      const tiles = await imageTiles(image);
      const checkpointInput = buildCheckpointInput(image, productContext.fingerprint, model, tiles, `${EXTRACTION_PROMPT}\n${RELEVANCE_PROMPT}`);
      const inputFingerprint = checkpointInputFingerprint(checkpointInput);
      if (!force && previous?.latestResult?.schemaVersion === 2 && previous.latestResult.sourceFingerprint === image.fingerprint
        && previous.latestResult.policyVersion === POLICY_VERSION && previous.latestResult.productContextFingerprint === productContext.fingerprint
        && previous.latestResult.model === model && (previous.schemaVersion === 1 || previous.latestResultInputFingerprint === inputFingerprint)) return { asset: source, reused: true };
      provider ??= providerFactory();
      const activeProvider = provider;
      const runId = randomUUID();
      const state: ExtractionState = { schemaVersion: 2, revision: randomUUID(), saveLease: null,
        checkpoint: createCheckpoint(checkpointInput, tiles, runId), checkpointWriteError: null,
        latestResultInputFingerprint: previous?.schemaVersion === 2 ? previous.latestResultInputFingerprint ?? null : null,
        attempt: { status: "analyzing", runId, startedAt: new Date().toISOString(), finishedAt: null, errorCode: null }, latestResult: previous?.latestResult ?? null };
      if (!await compareAndSave(client, source, state)) throw new ExtractionError("conflict");
      try {
        const started = Date.now(), entries: { region: Region; tile: typeof tiles[number] }[] = [], failedTiles: number[] = [];
        let lastFailure = new ExtractionError("provider");
        let checkpointDisabled = false;
        for (const tile of tiles) {
          let checkpoint: TileCheckpoint;
          let phase: "local" | "provider" | "validation" = "local", dispatched = false;
          try {
            const remaining = RUN_TIMEOUT_MS - (Date.now() - started);
            if (remaining <= 0) throw new ExtractionError("timeout");
            const dataUrl = await tileDataUrl(image, tile);
            const budget = RUN_TIMEOUT_MS - (Date.now() - started);
            if (budget <= 0) throw new ExtractionError("timeout");
            phase = "provider"; dispatched = true;
            const raw = await bounded(signal => activeProvider.analyze(dataUrl, signal, productContext.context), Math.min(budget, TILE_TIMEOUT_MS));
            phase = "validation";
            const parsed = tileOutputSchema.safeParse(raw);
            if (!parsed.success) throw new ExtractionError("invalid_response");
            // Validate geometry before accepting ANY regions from this tile.
            normalizeCandidates(parsed.data.regions.map(region => ({ region, tile })), image.dimensions, image.fingerprint);
            entries.push(...parsed.data.regions.map(region => ({ region, tile })));
            checkpoint = completedTileCheckpoint(checkpointInput, tile, parsed.data);
          } catch (error) {
            failedTiles.push(tile.index); lastFailure = safeError(error);
            checkpoint = failedTileCheckpoint(checkpointInput, tile, failureCheckpoint(error, phase, dispatched));
          }
          if (!checkpointDisabled) {
            try { await persistTileCheckpoint(client, scope, source, runId, inputFingerprint, checkpoint); }
            catch (error) {
              if (error instanceof CheckpointError) {
                // Candidate analysis may still succeed. Keep the last durable cache, never truncate it.
                await finish(client, scope, source, runId, latest => latest.schemaVersion === 2
                  ? { ...latest, checkpointWriteError: error.code } : latest);
                checkpointDisabled = true;
              } else {
                // Do not spend on further tiles after loss of durability/ownership.
                if (!(error instanceof ExtractionError && error.code === "conflict")) {
                  try { await finish(client, scope, source, runId, latest => latest.schemaVersion === 2
                    ? { ...latest, checkpointWriteError: "database" } : latest); } catch { /* previous durable checkpoint remains */ }
                }
                throw error;
              }
            }
          }
        }
        if (failedTiles.length === tiles.length) throw lastFailure;
        const normalized = normalizeCandidates(entries, image.dimensions, image.fingerprint);
        const result = resultSchema.parse({ schemaVersion: 2, policyVersion: POLICY_VERSION, productContextFingerprint: productContext.fingerprint, sourceFingerprint: image.fingerprint, sourceDimensions: image.dimensions,
          coordinateSpace: "orientation_normalized_pixels", sourceOrientation: image.orientation, provider: "openai", model: provider.model,
          analyzedAt: new Date().toISOString(), tileCount: tiles.length, completedTiles: tiles.length - failedTiles.length, failedTiles,
          partialAnalysis: failedTiles.length > 0, ...normalized });
        const asset = await finish(client, scope, source, runId, latest => ({ ...latest, latestResult: result,
          ...(latest.schemaVersion === 2 ? { latestResultInputFingerprint: inputFingerprint } : {}),
          attempt: { ...latest.attempt, status: "completed", finishedAt: new Date().toISOString(), errorCode: null } }));
        return { asset, reused: false };
      } catch (error) {
        const failure = safeError(error);
        await finish(client, scope, source, runId, latest => ({ ...latest,
          attempt: { ...latest.attempt, status: "failed", finishedAt: new Date().toISOString(), errorCode: failure.code } }));
        throw failure;
      }
    });
  } catch (error) { throw safeError(error); } });
}

async function removeObject(client: Client, path: string) { try { return !(await client.storage.from("product-assets").remove([path])).error; } catch { return false; } }
async function persistCrop(client: Client, source: Asset, candidate: Candidate, image: Awaited<ReturnType<typeof decodeSource>>, model: string, sortOrder: number,
  plan: CropPlan, manualInsets: ManualInsets | undefined, beforeWrite: () => Promise<void>) {
  const crop = await encodeCrop(image, plan), id = randomUUID(), path = storagePath(source.projectId, source.productId, id, crop.mime);
  const suggestedRole = { product_photo: "product", usage_photo: "usage", detail_closeup: "detail", variant_photo: "option", mixed: "mixed" }[candidate.regionType as "product_photo" | "usage_photo" | "detail_closeup" | "variant_photo" | "mixed"];
  const derivation = derivationSchema.parse({ kind: "detail_image_crop", parentAssetId: source.id, sourceFingerprint: image.fingerprint,
    candidateId: candidate.id, sourceRect: candidate.rect, sourceDimensions: image.dimensions, coordinateSpace: "orientation_normalized_pixels", suggestedRole,
    confidence: candidate.confidence, extractedAt: new Date().toISOString(), provider: "openai", model,
    ...(manualInsets !== undefined ? { schemaVersion: 2, adjustment: { mode: "manual", insets: manualInsets } }
      : { schemaVersion: 1, ...(crop.trim ? { trim: crop.trim } : {}) }) });
  let uploaded = false;
  await beforeWrite();
  try { uploaded = !(await client.storage.from("product-assets").upload(path, crop.bytes, { contentType: crop.mime, upsert: false, cacheControl: "60" })).error; } catch { /* safe cleanup below */ }
  if (!uploaded) throw new ExtractionError(await removeObject(client, path) ? "upload" : "recovery");
  const row = { id, project_id: source.projectId, product_id: source.productId, storage_path: path, original_filename: `product-shot-${candidate.id.slice(0, 12)}.${path.split(".").at(-1)}`,
    mime_type: crop.mime, size_bytes: crop.bytes.length, width: crop.width, height: crop.height, asset_type: "unclassified", sort_order: sortOrder, metadata: { derivation } };
  try { const saved = await client.from("assets").insert(row).select("*").abortSignal(timeout()).single(); if (!saved.error) return assetRowSchema.parse(saved.data); } catch { /* acknowledge lost? */ }
  try {
    const check = await client.from("assets").select("*").eq("id", id).abortSignal(timeout()).maybeSingle();
    if (check.error) throw new Error("unknown");
    if (check.data) { const actual = assetRowSchema.parse(check.data); assertAssetScope(actual, source.projectId, source.productId); if (actual.storagePath !== path) throw new Error("unknown"); return actual; }
  } catch { throw new ExtractionError("recovery"); } // Never remove a file whose DB commit is uncertain.
  throw new ExtractionError(await removeObject(client, path) ? "database" : "recovery");
}

export async function saveProductShots(projectId: string, assetId: string, body: unknown) {
  const parsed = saveRequestSchema.safeParse(body); if (!parsed.success) throw new ExtractionError("invalid_input");
  const request = parsed.data;
  const items: { candidateId: string; manualInsets?: ManualInsets }[] = "items" in request
    ? request.items : request.candidateIds.map(candidateId => ({ candidateId }));
  try {
    const client = createSupabaseServerClient({ requestTimeoutMs: 30_000 }), scope = await context(client, projectId, assetId);
    return await exclusive(scope.productId, async () => {
      const source = await readAsset(client, scope), state = readExtraction(source.metadata);
      if (isExtractionActive(state) || isSaveActive(state)) throw new ExtractionError("busy");
      const result = state?.latestResult; if (!state || !result) throw new ExtractionError("stale");
      if ("expectedRevision" in request && request.expectedRevision !== state.revision) throw new ExtractionError("conflict");
      const selected = result.candidates.filter(c => items.some(item => item.candidateId === c.id))
        .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x || a.id.localeCompare(b.id));
      if (selected.length !== items.length || selected.some(c => !c.saveAllowed
        || !(PRODUCT_REGIONS.some(role => role === c.regionType) || c.regionType === "mixed")
        || c.id !== candidateId(result.sourceFingerprint, c.rect, c.regionType))) throw new ExtractionError("stale");
      const bytes = await loadSource(client, source);
      if (sourceFingerprint(bytes) !== result.sourceFingerprint) throw new ExtractionError("source_changed");
      const image = await decodeSource(bytes, source.mimeType);
      if (!isDeepStrictEqual(image.dimensions, result.sourceDimensions) || image.orientation !== result.sourceOrientation) throw new ExtractionError("source_changed");
      // All geometric input errors reject the batch before lease/upload/INSERT.
      for (const candidate of selected) {
        assertSourceRect(candidate.rect, image.dimensions);
        const insets = items.find(item => item.candidateId === candidate.id)!.manualInsets;
        if (insets !== undefined) manualCropRect(candidate.rect, image.dimensions, insets);
      }
      const existing = await client.from("assets").select("*").eq("project_id", scope.projectId).eq("product_id", scope.productId).abortSignal(timeout());
      if (existing.error) throw new ExtractionError("database");
      const assets = existing.data.map(row => assetRowSchema.parse(row)); assets.forEach(a => assertAssetScope(a, scope.projectId, scope.productId));
      const duplicates = new Map<string, Asset>();
      const automaticDefaults = new Map<string, { asset: Asset; plan: CropPlan }>();
      for (const asset of [...assets].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
        const d = derivationSchema.safeParse(asset.metadata.derivation);
        if (!d.success || d.data.parentAssetId !== source.id || d.data.sourceFingerprint !== result.sourceFingerprint
          || !isDeepStrictEqual(d.data.sourceDimensions, image.dimensions)) continue;
        const rect = validatedDerivedRect(d.data, asset);
        if (!rect || asset.width === null || asset.height === null) continue;
        const key = cropRectKey(rect), baseKey = cropRectKey(d.data.sourceRect);
        if (!duplicates.has(key)) duplicates.set(key, asset);
        if (d.data.schemaVersion === 1 && !automaticDefaults.has(baseKey)) automaticDefaults.set(baseKey, { asset,
          plan: { rect, ...(d.data.trim ? { trim: d.data.trim } : {}) } });
      }
      const planned: { candidate: Candidate; manualInsets?: ManualInsets; plan?: CropPlan; existing?: Asset; error?: ExtractionError }[] = [];
      for (const candidate of selected) {
        const manualInsets = items.find(item => item.candidateId === candidate.id)!.manualInsets;
        // Preserve approved legacy automatic crops even after detector policy changes.
        const previous = manualInsets === undefined ? automaticDefaults.get(cropRectKey(candidate.rect)) : undefined;
        try { planned.push({ candidate, manualInsets, plan: previous?.plan ?? await planCrop(image, candidate.rect, manualInsets), existing: previous?.asset }); }
        catch (error) { planned.push({ candidate, manualInsets, error: safeError(error) }); }
      }
      const available = Math.max(0, MAX_PRODUCT_ASSETS - assets.length), needed = new Set(planned.flatMap(item =>
        item.plan && !item.existing && !duplicates.has(cropRectKey(item.plan.rect)) ? [cropRectKey(item.plan.rect)] : [])).size;
      if (needed > available) throw new ExtractionError("asset_limit", available);
      const lease = { id: randomUUID(), startedAt: new Date().toISOString() };
      const claimed = await compareAndSave(client, source, { ...state, saveLease: lease });
      if (!claimed) throw new ExtractionError("conflict");
      const cursor = readExtraction(claimed.metadata)!;
      const assertCursor = async () => {
        const current = await readAsset(client, scope), latest = readExtraction(current.metadata);
        if (current.storagePath !== source.storagePath || latest?.revision !== cursor.revision || latest.saveLease?.id !== lease.id
          || latest.attempt.runId !== state.attempt.runId || !isDeepStrictEqual(latest.latestResult, result)) throw new ExtractionError("conflict");
      };
      const saved: { candidateId: string; asset: Asset; existing: boolean }[] = [], failed: { candidateId: string; code: import("./errors").ExtractionCode; message: string }[] = [];
      let order = Math.max(-1, ...assets.map(a => a.sortOrder)) + 1;
      const saveStarted = Date.now();
      let stopped: ExtractionError | undefined;
      const uncertain = new Set<string>();
      try {
        for (const item of planned) {
          const { candidate, plan, manualInsets } = item;
          try {
            if (stopped) throw stopped;
            await assertCursor();
            if (item.error) throw item.error;
            if (uncertain.has(cropRectKey(plan!.rect))) throw new ExtractionError("recovery");
            const duplicate = item.existing ?? duplicates.get(cropRectKey(plan!.rect));
            if (duplicate) { saved.push({ candidateId: candidate.id, asset: duplicate, existing: true }); continue; }
            if (Date.now() - saveStarted >= 240_000) throw new ExtractionError("timeout");
            if (order > 2147483647) throw new ExtractionError("database");
            const asset = await persistCrop(client, source, candidate, image, result.model, order++, plan!, manualInsets, assertCursor);
            duplicates.set(cropRectKey(plan!.rect), asset);
            saved.push({ candidateId: candidate.id, asset, existing: false });
          } catch (error) { const failure = safeError(error);
            if (failure.code === "conflict") stopped = failure;
            if (failure.code === "recovery" && plan) uncertain.add(cropRectKey(plan.rect));
            failed.push({ candidateId: candidate.id, code: failure.code, message: failure.message }); }
        }
      } finally {
        await finish(client, scope, source, state.attempt.runId, latest => {
          if (latest.saveLease?.id !== lease.id) throw new ExtractionError("conflict");
          return { ...latest, saveLease: null };
        });
      }
      return { saved, failed, available: Math.max(0, available - saved.filter(s => !s.existing).length) };
    });
  } catch (error) { throw safeError(error); }
}

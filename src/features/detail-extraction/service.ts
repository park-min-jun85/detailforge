import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { exclusive, getAssetContext } from "@/features/assets/service";
import { AssetError, assetRowSchema, assertAssetScope, MAX_PRODUCT_ASSETS, parseId, storagePath } from "@/features/assets/schemas";
import { metadataUpdate } from "@/features/assets/metadata";
import type { Asset } from "@/types/domain";
import { ExtractionError } from "./errors";
import { decodeSource, imageTiles, tileDataUrl, cropImage, sourceFingerprint } from "./images";
import { candidateId, normalizeCandidates } from "./geometry";
import { bounded, loadSource } from "./source";
import { getExtractionProvider, type ExtractionProvider } from "./provider";
import { POLICY_VERSION, RUN_TIMEOUT_MS, TILE_TIMEOUT_MS } from "./policy";
import { loadExtractionProductContext } from "./product-context";
import { derivationSchema, isDerived, isExtractionActive, isSaveActive, readExtraction, resultSchema, saveRequestSchema, tileOutputSchema,
  type ExtractionState, type Candidate, type Region } from "./schemas";

type Client = ReturnType<typeof createSupabaseServerClient>;
type Scope = { projectId: string; productId: string; assetId: string };
const timeout = () => AbortSignal.timeout(10_000);
const running = new Set<string>();
const safeError = (e: unknown) => e instanceof ExtractionError ? e : new ExtractionError(e instanceof AssetError ? e.status === 404 ? "not_found" : e.status === 409 ? "busy" : "database" : "unexpected");
async function readAsset(client: Client, scope: Scope) {
  const row = await client.from("assets").select("*").eq("id", scope.assetId).eq("project_id", scope.projectId).eq("product_id", scope.productId).abortSignal(timeout()).maybeSingle();
  if (row.error) throw new ExtractionError("database");
  if (!row.data) throw new ExtractionError("not_found");
  const asset = assetRowSchema.parse(row.data);
  try { assertAssetScope(asset, scope.projectId, scope.productId); } catch { throw new ExtractionError("ownership"); }
  if (isDerived(asset.metadata)) throw new ExtractionError("recursive");
  return asset;
}
async function context(client: Client, projectId: string, assetId: string) {
  try { projectId = parseId(projectId); assetId = parseId(assetId); } catch { throw new ExtractionError("not_found"); }
  const value = await getAssetContext(projectId, client);
  if (!value.product) throw new ExtractionError("ownership");
  return { projectId, productId: value.product.id, assetId };
}
async function compareAndSave(client: Client, asset: Asset, state: ExtractionState) {
  const saved = await metadataUpdate(client, asset, { ...asset.metadata, detailExtraction: state }).select("*").abortSignal(timeout()).maybeSingle();
  if (!saved.error) return saved.data ? assetRowSchema.parse(saved.data) : null;
  const actual = await readAsset(client, { projectId: asset.projectId, productId: asset.productId, assetId: asset.id });
  const read = readExtraction(actual.metadata);
  if (actual.storagePath === asset.storagePath && read && isDeepStrictEqual({ ...read, revision: state.revision }, state)) return actual;
  throw new ExtractionError("database");
}
async function finish(client: Client, scope: Scope, original: Asset, runId: string, update: (state: ExtractionState) => ExtractionState) {
  for (let index = 0; index < 3; index++) {
    const latest = await readAsset(client, scope), state = readExtraction(latest.metadata);
    if (latest.storagePath !== original.storagePath || !state || state.attempt.runId !== runId) throw new ExtractionError("conflict");
    const saved = await compareAndSave(client, latest, update(state)); if (saved) return saved;
  }
  throw new ExtractionError("conflict");
}

export async function analyzeProductShots(projectId: string, assetId: string, force = false, providerFactory: () => ExtractionProvider = getExtractionProvider) {
  if (running.size >= 1) throw new ExtractionError("busy");
  running.add(assetId);
  try {
    const client = createSupabaseServerClient({ requestTimeoutMs: 30_000 }), scope = await context(client, projectId, assetId);
    return await exclusive(scope.productId, async () => {
      const source = await readAsset(client, scope), previous = readExtraction(source.metadata);
      if (isExtractionActive(previous) || isSaveActive(previous)) throw new ExtractionError("busy");
      const image = await decodeSource(await loadSource(client, source), source.mimeType);
      const productContext = await loadExtractionProductContext(client, scope);
      if (!force && previous?.latestResult?.schemaVersion === 2 && previous.latestResult.sourceFingerprint === image.fingerprint
        && previous.latestResult.policyVersion === POLICY_VERSION && previous.latestResult.productContextFingerprint === productContext.fingerprint) return { asset: source, reused: true };
      const tiles = await imageTiles(image), provider = providerFactory(), runId = randomUUID();
      const state: ExtractionState = { schemaVersion: 1, revision: randomUUID(), saveLease: null,
        attempt: { status: "analyzing", runId, startedAt: new Date().toISOString(), finishedAt: null, errorCode: null }, latestResult: previous?.latestResult ?? null };
      if (!await compareAndSave(client, source, state)) throw new ExtractionError("conflict");
      try {
        const started = Date.now(), entries: { region: Region; tile: typeof tiles[number] }[] = [], failedTiles: number[] = [];
        let lastFailure = new ExtractionError("provider");
        for (const tile of tiles) {
          const remaining = RUN_TIMEOUT_MS - (Date.now() - started);
          if (remaining <= 0) { failedTiles.push(tile.index); lastFailure = new ExtractionError("timeout"); continue; }
          try {
            const dataUrl = await tileDataUrl(image, tile);
            const budget = RUN_TIMEOUT_MS - (Date.now() - started);
            if (budget <= 0) throw new ExtractionError("timeout");
            const raw = await bounded(signal => provider.analyze(dataUrl, signal, productContext.context), Math.min(budget, TILE_TIMEOUT_MS));
            const parsed = tileOutputSchema.safeParse(raw);
            if (!parsed.success) throw new ExtractionError("invalid_response");
            // Validate geometry before accepting ANY regions from this tile.
            normalizeCandidates(parsed.data.regions.map(region => ({ region, tile })), image.dimensions, image.fingerprint);
            entries.push(...parsed.data.regions.map(region => ({ region, tile })));
          } catch (error) { failedTiles.push(tile.index); lastFailure = safeError(error); }
        }
        if (failedTiles.length === tiles.length) throw lastFailure;
        const normalized = normalizeCandidates(entries, image.dimensions, image.fingerprint);
        const result = resultSchema.parse({ schemaVersion: 2, policyVersion: POLICY_VERSION, productContextFingerprint: productContext.fingerprint, sourceFingerprint: image.fingerprint, sourceDimensions: image.dimensions,
          coordinateSpace: "orientation_normalized_pixels", sourceOrientation: image.orientation, provider: "openai", model: provider.model,
          analyzedAt: new Date().toISOString(), tileCount: tiles.length, completedTiles: tiles.length - failedTiles.length, failedTiles,
          partialAnalysis: failedTiles.length > 0, ...normalized });
        const asset = await finish(client, scope, source, runId, latest => ({ ...latest, latestResult: result,
          attempt: { ...latest.attempt, status: "completed", finishedAt: new Date().toISOString(), errorCode: null } }));
        return { asset, reused: false };
      } catch (error) {
        const failure = safeError(error);
        await finish(client, scope, source, runId, latest => ({ ...latest,
          attempt: { ...latest.attempt, status: "failed", finishedAt: new Date().toISOString(), errorCode: failure.code } }));
        throw failure;
      }
    });
  } catch (error) { throw safeError(error); } finally { running.delete(assetId); }
}

async function removeObject(client: Client, path: string) { try { return !(await client.storage.from("product-assets").remove([path])).error; } catch { return false; } }
async function persistCrop(client: Client, source: Asset, candidate: Candidate, image: Awaited<ReturnType<typeof decodeSource>>, model: string, sortOrder: number) {
  const crop = await cropImage(image, candidate.rect), id = randomUUID(), path = storagePath(source.projectId, source.productId, id, crop.mime);
  const suggestedRole = { product_photo: "product", usage_photo: "usage", detail_closeup: "detail", variant_photo: "option", mixed: "mixed" }[candidate.regionType as "product_photo" | "usage_photo" | "detail_closeup" | "variant_photo" | "mixed"];
  const derivation = derivationSchema.parse({ schemaVersion: 1, kind: "detail_image_crop", parentAssetId: source.id, sourceFingerprint: image.fingerprint,
    candidateId: candidate.id, sourceRect: candidate.rect, sourceDimensions: image.dimensions, coordinateSpace: "orientation_normalized_pixels", suggestedRole,
    confidence: candidate.confidence, extractedAt: new Date().toISOString(), provider: "openai", model, ...(crop.trim ? { trim: crop.trim } : {}) });
  let uploaded = false;
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
  try {
    const client = createSupabaseServerClient({ requestTimeoutMs: 30_000 }), scope = await context(client, projectId, assetId);
    return await exclusive(scope.productId, async () => {
      const source = await readAsset(client, scope), state = readExtraction(source.metadata);
      if (isExtractionActive(state) || isSaveActive(state)) throw new ExtractionError("busy");
      const result = state?.latestResult; if (!state || !result) throw new ExtractionError("stale");
      const selected = result.candidates.filter(c => parsed.data.candidateIds.includes(c.id));
      if (selected.length !== parsed.data.candidateIds.length || selected.some(c => !c.saveAllowed || c.id !== candidateId(result.sourceFingerprint, c.rect, c.regionType))) throw new ExtractionError("stale");
      const bytes = await loadSource(client, source);
      if (sourceFingerprint(bytes) !== result.sourceFingerprint) throw new ExtractionError("source_changed");
      const image = await decodeSource(bytes, source.mimeType);
      if (!isDeepStrictEqual(image.dimensions, result.sourceDimensions)) throw new ExtractionError("source_changed");
      const existing = await client.from("assets").select("*").eq("project_id", scope.projectId).eq("product_id", scope.productId).abortSignal(timeout());
      if (existing.error) throw new ExtractionError("database");
      const assets = existing.data.map(row => assetRowSchema.parse(row)); assets.forEach(a => assertAssetScope(a, scope.projectId, scope.productId));
      const duplicates = new Map<string, Asset>();
      for (const asset of assets) { const d = derivationSchema.safeParse(asset.metadata.derivation);
        if (d.success && d.data.parentAssetId === source.id && d.data.sourceFingerprint === result.sourceFingerprint) duplicates.set(d.data.candidateId, asset); }
      const available = Math.max(0, MAX_PRODUCT_ASSETS - assets.length), needed = selected.filter(c => !duplicates.has(c.id)).length;
      if (needed > available) throw new ExtractionError("asset_limit", available);
      const lease = { id: randomUUID(), startedAt: new Date().toISOString() };
      if (!await compareAndSave(client, source, { ...state, saveLease: lease })) throw new ExtractionError("conflict");
      const saved: { candidateId: string; asset: Asset; existing: boolean }[] = [], failed: { candidateId: string; code: import("./errors").ExtractionCode; message: string }[] = [];
      let order = Math.max(-1, ...assets.map(a => a.sortOrder)) + 1;
      const saveStarted = Date.now();
      try {
        for (const candidate of selected) {
          const duplicate = duplicates.get(candidate.id);
          if (duplicate) { saved.push({ candidateId: candidate.id, asset: duplicate, existing: true }); continue; }
          try {
            if (Date.now() - saveStarted >= 240_000) throw new ExtractionError("timeout");
            if (order > 2147483647) throw new ExtractionError("database");
            const current = await readAsset(client, scope), latest = readExtraction(current.metadata);
            if (current.storagePath !== source.storagePath || latest?.saveLease?.id !== lease.id || latest.latestResult?.sourceFingerprint !== result.sourceFingerprint) throw new ExtractionError("conflict");
            const asset = await persistCrop(client, source, candidate, image, result.model, order++);
            saved.push({ candidateId: candidate.id, asset, existing: false });
          } catch (error) { const failure = safeError(error); failed.push({ candidateId: candidate.id, code: failure.code, message: failure.message }); }
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

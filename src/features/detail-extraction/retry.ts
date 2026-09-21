import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { exclusive, getAssetContext } from "@/features/assets/service";
import { AssetError, parseId } from "@/features/assets/schemas";
import type { Asset } from "@/types/domain";
import { ExtractionError } from "./errors";
import { withExtractionSlot } from "./execution";
import { decodeSource, imageTiles, tileDataUrl, sourceFingerprint } from "./images";
import { bounded, loadSource } from "./source";
import { loadExtractionProductContext } from "./product-context";
import { getExtractionModel, getExtractionProvider, EXTRACTION_PROMPT, RELEVANCE_PROMPT, type ExtractionProvider } from "./provider";
import { MAX_TILE_COUNT, RUN_TIMEOUT_MS, TILE_TIMEOUT_MS } from "./policy";
import { isExtractionActive, isSaveActive, readExtraction, resultSchema, tileOutputSchema, type ExtractionState } from "./schemas";
import { normalizeCandidates } from "./geometry";
import { buildCheckpointInput, checkpointCompatible, checkpointInputFingerprint, checkpointRunStatus, CheckpointError,
  completedTileCheckpoint, failedTileCheckpoint, failureCheckpoint, readCheckpoint, recordTileCheckpoint, type TileCheckpointCache } from "./checkpoint";
import { compareExtractionState, readExtractionAsset } from "./persistence";

export const retryRequestSchema = z.strictObject({ expectedRevision: z.uuid(),
  requestedTileIds: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(MAX_TILE_COUNT)
    .refine(ids => new Set(ids).size === ids.length).optional() });

export type RetryResult = {
  code: "retry_completed" | "provider_failure" | "no_retryable_tiles";
  attemptedTileCount: number; succeededTileCount: number; failedTileCount: number; remainingFailedTileCount: number;
  runStatus: ReturnType<typeof checkpointRunStatus>; candidateCount: number; revision: string;
  latestResultUpdated: boolean; billingUncertain: boolean;
};

export function aggregateCheckpoint(cache: TileCheckpointCache, analyzedAt: string) {
  const successful = cache.tiles.filter(tile => tile.status === "completed");
  if (!successful.length) return null;
  const failedTiles = cache.tiles.filter(tile => tile.status === "failed").map(tile => tile.index);
  const normalized = normalizeCandidates(successful.flatMap(tile => tile.result.regions.map(region => ({ region,
    tile: { index: tile.index, ...tile.geometry } }))), cache.input.sourceDimensions, cache.input.sourceFingerprint);
  return resultSchema.parse({ schemaVersion: 2, policyVersion: cache.input.policyVersion,
    productContextFingerprint: cache.input.productContextFingerprint, sourceFingerprint: cache.input.sourceFingerprint,
    sourceDimensions: cache.input.sourceDimensions, sourceOrientation: cache.input.sourceOrientation,
    coordinateSpace: cache.input.coordinateSpace, provider: "openai", model: cache.input.model, analyzedAt,
    tileCount: cache.layout.length, completedTiles: successful.length, failedTiles, partialAnalysis: failedTiles.length > 0, ...normalized });
}
type Processing = { prepareTile: typeof tileDataUrl; aggregate: typeof aggregateCheckpoint };
const processingDefaults: Processing = { prepareTile: tileDataUrl, aggregate: aggregateCheckpoint };
const safeFailure = (error: unknown) => error instanceof CheckpointError ? new ExtractionError("persistence_failure")
  : error instanceof ExtractionError ? error.code === "database" ? new ExtractionError("persistence_failure") : error
  : error instanceof AssetError ? new ExtractionError(error.status === 404 ? "not_found" : error.status === 409 ? "busy" : "persistence_failure")
  : new ExtractionError("unexpected");

// Explicit entry only. Processing injection is server/test-only, never request-controlled.
export async function retryProductShots(projectId: string, assetId: string, body: unknown,
  providerFactory: () => ExtractionProvider = getExtractionProvider, processing: Processing = processingDefaults) {
  const request = retryRequestSchema.safeParse(body);
  if (!request.success) throw new ExtractionError("invalid_input");
  try { projectId = parseId(projectId); assetId = parseId(assetId); } catch { throw new ExtractionError("not_found"); }
  return withExtractionSlot(async () => { try {
    const client = createSupabaseServerClient({ requestTimeoutMs: 30_000 }), context = await getAssetContext(projectId, client);
    if (!context.product) throw new ExtractionError("ownership");
    const scope = { projectId, productId: context.product.id, assetId };
    return await exclusive(scope.productId, async () => {
      let cursor = await readExtractionAsset(client, scope), state = readExtraction(cursor.metadata);
      if (isExtractionActive(state) || isSaveActive(state)) throw new ExtractionError("busy");
      const initial = readCheckpoint(state?.schemaVersion === 2 ? state.checkpoint : undefined);
      if (initial.status === "missing") throw new ExtractionError("checkpoint_missing");
      if (!state || state.schemaVersion !== 2 || !initial.checkpoint || state.checkpointWriteError
        || initial.checkpoint.runId !== state.attempt.runId) throw new ExtractionError("checkpoint_invalid");
      if (state.revision !== request.data.expectedRevision) throw new ExtractionError("conflict");
      let cache = initial.checkpoint;
      if (checkpointRunStatus(cache) === "incomplete") throw new ExtractionError("checkpoint_incomplete");
      // Fresh source hash, product identity, current policy and actual layout before any provider dispatch.
      const bytes = await loadSource(client, cursor);
      if (sourceFingerprint(bytes) !== cache.input.sourceFingerprint) throw new ExtractionError("checkpoint_stale");
      const image = await decodeSource(bytes, cursor.mimeType), product = await loadExtractionProductContext(client, scope);
      let provider: ExtractionProvider | undefined;
      const model = providerFactory === getExtractionProvider ? getExtractionModel() : (provider = providerFactory()).model;
      const current = buildCheckpointInput(image, product.fingerprint, model, await imageTiles(image), `${EXTRACTION_PROMPT}\n${RELEVANCE_PROMPT}`);
      if (!checkpointCompatible(cache, current)) throw new ExtractionError("checkpoint_stale");
      const inputFingerprint = checkpointInputFingerprint(current);
      const eligible = cache.tiles.filter(tile => tile.status === "failed" && tile.failure.retryable);
      if (request.data.requestedTileIds?.some(id => !eligible.some(tile => tile.tileId === id))) throw new ExtractionError("invalid_retry_target");
      const targets = eligible.filter(tile => !request.data.requestedTileIds || request.data.requestedTileIds.includes(tile.tileId)).sort((a, b) => a.index - b.index);
      let attempted = 0, succeeded = 0, failed = 0, latestResultUpdated = false;
      const response = (): RetryResult => ({ code: targets.length ? succeeded ? "retry_completed" : "provider_failure" : "no_retryable_tiles",
        attemptedTileCount: attempted, succeededTileCount: succeeded, failedTileCount: failed,
        remainingFailedTileCount: cache.tiles.filter(tile => tile.status === "failed").length,
        runStatus: checkpointRunStatus(cache), candidateCount: state?.latestResult?.candidates.length ?? 0,
        revision: state!.revision, latestResultUpdated, billingUncertain: attempted > 0 });

      // Strict operation cursor: a concurrent revision change aborts, rather than silently adopting another writer.
      async function assertCursor() {
        const latest = await readExtractionAsset(client, scope), actual = readExtraction(latest.metadata);
        const read = readCheckpoint(actual?.schemaVersion === 2 ? actual.checkpoint : undefined);
        if (latest.storagePath !== cursor.storagePath || actual?.revision !== state!.revision
          || actual?.attempt.runId !== cache.runId || !read.checkpoint
          || checkpointInputFingerprint(read.checkpoint.input) !== inputFingerprint) throw new ExtractionError("conflict");
      }
      async function write(next: ExtractionState) {
        await assertCursor();
        const saved: Asset | null = await compareExtractionState(client, cursor, next);
        if (!saved) throw new ExtractionError("conflict");
        cursor = saved; state = readExtraction(saved.metadata)!;
      }
      async function assertFreshInputs() {
        await assertCursor();
        const latestProduct = await loadExtractionProductContext(client, scope);
        const latestModel = providerFactory === getExtractionProvider ? getExtractionModel() : provider!.model;
        if (latestProduct.fingerprint !== current.productContextFingerprint || latestModel !== current.model
          || sourceFingerprint(await loadSource(client, cursor)) !== current.sourceFingerprint) throw new ExtractionError("checkpoint_stale");
      }
      await assertCursor();
      // An explicit no-target request can repair a prior interrupted final aggregation, without AI.
      if (!targets.length) {
        const result = processing.aggregate(cache, state.latestResult?.analyzedAt ?? new Date().toISOString());
        if (result && (!isDeepStrictEqual(result, state.latestResult) || state.attempt.status !== "completed"
          || state.latestResultInputFingerprint !== inputFingerprint)) {
          await assertFreshInputs();
          await write({ ...state, latestResult: { ...result, analyzedAt: new Date().toISOString() }, latestResultInputFingerprint: inputFingerprint,
            attempt: { ...state.attempt, status: "completed", finishedAt: new Date().toISOString(), errorCode: null } });
          latestResultUpdated = true;
        }
        return response();
      }
      provider ??= providerFactory();
      const activeProvider = provider, started = Date.now(), runId = randomUUID();
      const claimedCache = { ...cache, runId };
      await write({ ...state, checkpoint: claimedCache, checkpointWriteError: null,
        attempt: { status: "analyzing", runId, startedAt: new Date().toISOString(), finishedAt: null, errorCode: null } });
      cache = claimedCache;
      try {
        for (const target of targets) {
          await assertCursor();
          if (Date.now() - started >= RUN_TIMEOUT_MS) throw new ExtractionError("timeout");
          const tile = cache.layout[target.index];
          // Only selected failed geometries are encoded. Local preparation failure leaves the original failure intact.
          const dataUrl = await processing.prepareTile(image, tile);
          await assertFreshInputs();
          // Before dispatch, an old "not_dispatched" summary must no longer promise zero billing if this process dies.
          if (target.status === "failed" && target.failure.billing === "not_dispatched") {
            const dispatchedCache = recordTileCheckpoint(cache, { ...target, failure: { ...target.failure, billing: "unknown" } });
            await write({ ...state!, checkpoint: dispatchedCache });
            cache = dispatchedCache;
          }
          const budget = RUN_TIMEOUT_MS - (Date.now() - started);
          if (budget <= 0) throw new ExtractionError("timeout");
          let entry, phase: "provider" | "validation" = "provider";
          attempted++;
          try {
            const raw = await bounded(signal => activeProvider.analyze(dataUrl, signal, product.context), Math.min(budget, TILE_TIMEOUT_MS));
            phase = "validation";
            const parsed = tileOutputSchema.safeParse(raw);
            if (!parsed.success) throw new ExtractionError("invalid_response");
            normalizeCandidates(parsed.data.regions.map(region => ({ region, tile })), image.dimensions, image.fingerprint);
            entry = completedTileCheckpoint(current, tile, parsed.data);
          } catch (error) { entry = failedTileCheckpoint(current, tile, failureCheckpoint(error, phase, true)); }
          const nextCache = recordTileCheckpoint(cache, entry);
          await write({ ...state!, checkpoint: nextCache });
          cache = nextCache;
          if (entry.status === "completed") succeeded++; else failed++;
        }
        const result = succeeded ? processing.aggregate(cache, new Date().toISOString()) : null;
        await assertFreshInputs();
        // If every selected retry failed, retain the exact previous latestResult (including its timestamp).
        await write({ ...state!, ...(result ? { latestResult: result, latestResultInputFingerprint: inputFingerprint } : {}),
          attempt: { ...state!.attempt, status: result ? "completed" : "failed", finishedAt: new Date().toISOString(), errorCode: result ? null : "provider" } });
        latestResultUpdated = result !== null;
        return response();
      } catch (error) {
        const safe = safeFailure(error);
        // Best effort only while still owning the exact cursor. Do not overwrite a competing run or undo durable successes.
        try { await write({ ...state!, attempt: { ...state!.attempt, status: "failed", finishedAt: new Date().toISOString(), errorCode: safe.code } }); }
        catch { /* Leave the last acknowledged state intact; a later explicit request may recover after lease expiry. */ }
        throw safe;
      }
    });
  } catch (error) { throw safeFailure(error); } });
}

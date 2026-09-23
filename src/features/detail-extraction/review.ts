import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAssetContext, listAssets } from "@/features/assets/service";
import { AssetError, parseId } from "@/features/assets/schemas";
import { readExtractionAsset } from "./persistence";
import { derivationSchema, isExtractionActive, isSaveActive, readExtraction } from "./schemas";
import { buildCheckpointInput, checkpointCompatible, checkpointRunStatus, readCheckpoint } from "./checkpoint";
import { decodeSource, imageTiles, sourceFingerprint } from "./images";
import { loadSource } from "./source";
import { loadExtractionProductContext } from "./product-context";
import { EXTRACTION_PROMPT, RELEVANCE_PROMPT, getExtractionModel } from "./provider";
import { cropRectKey } from "./crop-identity";
import { validatedDerivedRect } from "./crop-geometry";
import { ExtractionError } from "./errors";
import type { ExtractionReview } from "./review-model";
import { defaultExclusionReason } from "./selection";
import { MAX_PRODUCT_ASSETS } from "@/features/assets/schemas";

export async function getExtractionReview(projectId: string, assetId: string): Promise<ExtractionReview> {
  try {
    try { projectId = parseId(projectId); assetId = parseId(assetId); } catch { throw new ExtractionError("not_found"); }
    const client = createSupabaseServerClient({ requestTimeoutMs: 30_000 });
    const context = await getAssetContext(projectId, client);
    if (!context.product) throw new ExtractionError("ownership");
    const scope = { projectId, productId: context.product.id, assetId };
    const asset = await readExtractionAsset(client, scope), state = readExtraction(asset.metadata);
    const active = isExtractionActive(state) || isSaveActive(state);
    const read = readCheckpoint(state?.schemaVersion === 2 ? state.checkpoint : undefined), cache = read.checkpoint;
    let status: ExtractionReview["status"] = read.status === "available" ? checkpointRunStatus(cache!) : read.status;
    if (!state && asset.metadata.detailExtraction !== undefined) status = "invalid";
    if (cache && (cache.runId !== state?.attempt.runId || state?.schemaVersion === 2 && state.checkpointWriteError)) status = "invalid";
    if (cache && status !== "invalid") {
      const bytes = await loadSource(client, asset);
      if (sourceFingerprint(bytes) !== cache.input.sourceFingerprint) status = "stale";
      else {
        const source = await decodeSource(bytes, asset.mimeType);
        const product = await loadExtractionProductContext(client, scope);
        const current = buildCheckpointInput(source, product.fingerprint, getExtractionModel(), await imageTiles(source), `${EXTRACTION_PROMPT}\n${RELEVANCE_PROMPT}`);
        if (!checkpointCompatible(cache, current)) status = "stale";
      }
    }
    const result = state?.latestResult;
    const assets = result ? (await listAssets(projectId)).items : [];
    const saved = assets.flatMap(({ asset }) => {
      const parsed = derivationSchema.safeParse(asset.metadata.derivation);
      if (!parsed.success || parsed.data.parentAssetId !== assetId || parsed.data.sourceFingerprint !== result?.sourceFingerprint
        || parsed.data.sourceDimensions.width !== result.sourceDimensions.width || parsed.data.sourceDimensions.height !== result.sourceDimensions.height
        || asset.width === null || asset.height === null) return [];
      const finalRect = validatedDerivedRect(parsed.data, asset);
      return finalRect ? [{ assetId: asset.id, finalRect, derivation: parsed.data }] : [];
    }).slice(0, MAX_PRODUCT_ASSETS);
    const savedRects = new Set(saved.filter(item => item.derivation.schemaVersion === 1).map(item => cropRectKey(item.derivation.sourceRect)));
    return {
      revision: state?.revision ?? null, active, hasAttempt: asset.metadata.detailExtraction !== undefined, status,
      total: cache?.layout.length ?? 0,
      successful: cache?.tiles.filter(tile => tile.status === "completed").length ?? 0,
      failed: cache?.tiles.filter(tile => tile.status === "failed").length ?? 0,
      retryable: !active && (status === "partial" || status === "failed")
        ? cache!.tiles.filter(tile => tile.status === "failed" && tile.failure.retryable).length : 0,
      result: result ? { candidates: result.candidates.map(candidate => ({
        id: candidate.id, rect: candidate.rect, regionType: candidate.regionType,
        defaultSelected: candidate.defaultSelected, saveAllowed: candidate.saveAllowed,
        confidence: candidate.confidence, textDensity: candidate.textDensity, rationale: candidate.rationale,
        edgeTruncated: candidate.edgeTruncated, exclusion: defaultExclusionReason(candidate),
        basisKey: createHash("sha256").update(JSON.stringify([projectId, scope.productId, assetId, result.sourceFingerprint,
          candidate.id, candidate.rect, result.sourceDimensions, result.sourceOrientation, result.coordinateSpace])).digest("hex"),
        ...("visualKind" in candidate ? { visualKind: candidate.visualKind, targetProductRelevance: candidate.targetProductRelevance } : {}),
      })), sourceDimensions: result.sourceDimensions, sourceOrientation: result.sourceOrientation,
        coordinateSpace: result.coordinateSpace, truncatedCandidates: result.truncatedCandidates } : null,
      savedCandidateIds: result?.candidates.filter(candidate => savedRects.has(cropRectKey(candidate.rect))).map(candidate => candidate.id) ?? [],
      savedCrops: saved.map(({ assetId, finalRect, derivation }) => ({ assetId, finalRect, adjustmentMode: derivation.schemaVersion === 2 ? "manual" : "automatic" })),
    };
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    if (error instanceof AssetError && error.status === 404) throw new ExtractionError("not_found");
    throw new ExtractionError("unexpected");
  }
}

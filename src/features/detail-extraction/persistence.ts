import "server-only";
import { isDeepStrictEqual } from "node:util";
import { assetRowSchema, assertAssetScope } from "@/features/assets/schemas";
import { metadataUpdate } from "@/features/assets/metadata";
import type { Asset } from "@/types/domain";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExtractionError } from "./errors";
import { isDerived, readExtraction, type ExtractionState } from "./schemas";
import { checkpointInputFingerprint, readCheckpoint, recordTileCheckpoint, serializeCheckpoint, type TileCheckpoint } from "./checkpoint";

export type ExtractionClient = ReturnType<typeof createSupabaseServerClient>;
export type ExtractionScope = { projectId: string; productId: string; assetId: string };
const timeout = () => AbortSignal.timeout(10_000);
export async function readExtractionAsset(client: ExtractionClient, scope: ExtractionScope) {
  const row = await client.from("assets").select("*").eq("id", scope.assetId).eq("project_id", scope.projectId).eq("product_id", scope.productId).abortSignal(timeout()).maybeSingle();
  if (row.error) throw new ExtractionError("database");
  if (!row.data) throw new ExtractionError("not_found");
  const asset = assetRowSchema.parse(row.data);
  try { assertAssetScope(asset, scope.projectId, scope.productId); } catch { throw new ExtractionError("ownership"); }
  if (isDerived(asset.metadata)) throw new ExtractionError("recursive");
  return asset;
}
export async function compareExtractionState(client: ExtractionClient, asset: Asset, state: ExtractionState) {
  const previous = readExtraction(asset.metadata);
  if (state.schemaVersion === 2 && state.checkpoint != null && !isDeepStrictEqual(state.checkpoint,
    previous?.schemaVersion === 2 ? previous.checkpoint : undefined)) serializeCheckpoint(state.checkpoint);
  const saved = await metadataUpdate(client, asset, { ...asset.metadata, detailExtraction: state }).select("*").abortSignal(timeout()).maybeSingle();
  if (!saved.error) return saved.data ? assetRowSchema.parse(saved.data) : null;
  const actual = await readExtractionAsset(client, { projectId: asset.projectId, productId: asset.productId, assetId: asset.id });
  const read = readExtraction(actual.metadata);
  if (actual.storagePath === asset.storagePath && read && isDeepStrictEqual({ ...read, revision: state.revision }, state)) return actual;
  throw new ExtractionError("database");
}
export async function updateExtractionRun(client: ExtractionClient, scope: ExtractionScope, original: Asset, runId: string,
  update: (state: ExtractionState) => ExtractionState) {
  for (let index = 0; index < 3; index++) {
    const latest = await readExtractionAsset(client, scope), state = readExtraction(latest.metadata);
    if (latest.storagePath !== original.storagePath || !state || state.attempt.runId !== runId) throw new ExtractionError("conflict");
    const saved = await compareExtractionState(client, latest, update(state)); if (saved) return saved;
  }
  throw new ExtractionError("conflict");
}
export async function persistTileCheckpoint(client: ExtractionClient, scope: ExtractionScope, original: Asset,
  runId: string, inputFingerprint: string, tile: TileCheckpoint) {
  return updateExtractionRun(client, scope, original, runId, state => {
    const read = readCheckpoint(state.schemaVersion === 2 ? state.checkpoint : undefined);
    if (state.schemaVersion !== 2 || state.attempt.status !== "analyzing" || state.checkpointWriteError
      || !read.checkpoint || read.checkpoint.runId !== runId || checkpointInputFingerprint(read.checkpoint.input) !== inputFingerprint)
      throw new ExtractionError("conflict");
    return { ...state, checkpoint: recordTileCheckpoint(read.checkpoint, tile) };
  });
}

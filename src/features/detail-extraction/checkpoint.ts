import "server-only";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { normalizeCandidates, type TileRect } from "./geometry";
import { ExtractionError } from "./errors";
import { tileOutputSchema, type ExtractionState } from "./schemas";
import { MAX_CHECKPOINT_BYTES, MAX_TILE_COUNT, MAX_SOURCE_WIDTH, MAX_SOURCE_HEIGHT, MAX_INPUT_PIXELS,
  TILE_HEIGHT, TILE_OVERLAP, SNAP_WINDOW, TILE_LAYOUT_VERSION, EXTRACTION_PROMPT_VERSION, NORMALIZATION_VERSION, POLICY_VERSION } from "./policy";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const integer = z.number().int().nonnegative();
const geometrySchema = z.strictObject({ x: integer, y: integer, width: z.number().int().positive(), height: z.number().int().positive() });
const layoutTileSchema = geometrySchema.extend({ index: integer.max(MAX_TILE_COUNT - 1) });
export const checkpointInputSchema = z.strictObject({
  sourceFingerprint: hash, productContextFingerprint: hash,
  sourceDimensions: z.strictObject({ width: z.number().int().positive().max(MAX_SOURCE_WIDTH), height: z.number().int().positive().max(MAX_SOURCE_HEIGHT) }),
  sourceOrientation: z.number().int().min(1).max(8), coordinateSpace: z.literal("orientation_normalized_pixels"),
  model: z.string().min(1).max(200), tileOutputSchemaVersion: z.literal(2),
  tilingVersion: z.number().int().positive(), promptVersion: z.number().int().positive(),
  policyVersion: z.number().int().positive(), normalizationVersion: z.number().int().positive(),
  promptFingerprint: hash, layoutFingerprint: hash, layoutPolicyFingerprint: hash,
});
const failureCodes = ["provider", "timeout", "invalid_response", "invalid_rect", "decode", "crop", "unexpected", "not_configured"] as const;
export const checkpointFailureSchema = z.strictObject({
  kind: z.enum(["provider_error", "timeout", "structured_output_invalid", "local_processing_error"]),
  code: z.enum(failureCodes), retryable: z.boolean(), billing: z.enum(["not_dispatched", "unknown"]),
}).superRefine((failure, ctx) => {
  const expected = failure.code === "provider" ? "provider_error" : failure.code === "timeout" ? "timeout"
    : failure.code === "invalid_response" ? "structured_output_invalid" : "local_processing_error";
  if (failure.kind !== expected || (expected === "local_processing_error" && failure.retryable))
    ctx.addIssue({ code: "custom", message: "Invalid failure policy" });
});
const tileBase = { tileId: hash, index: integer.max(MAX_TILE_COUNT - 1), geometry: geometrySchema };
export const tileCheckpointSchema = z.discriminatedUnion("status", [
  z.strictObject({ ...tileBase, status: z.literal("completed"), result: tileOutputSchema }),
  z.strictObject({ ...tileBase, status: z.literal("failed"), failure: checkpointFailureSchema }),
]);
const checkpointSchema = z.strictObject({ schemaVersion: z.literal(1), runId: z.uuid(), input: checkpointInputSchema,
  layout: z.array(layoutTileSchema).min(1).max(MAX_TILE_COUNT), tiles: z.array(tileCheckpointSchema).max(MAX_TILE_COUNT) });
export type CheckpointInput = z.infer<typeof checkpointInputSchema>;
export type TileCheckpoint = z.infer<typeof tileCheckpointSchema>;
export type TileCheckpointCache = z.infer<typeof checkpointSchema>;
export type CheckpointFailure = z.infer<typeof checkpointFailureSchema>;
export class CheckpointError extends Error {
  readonly code: "oversized" | "invalid" | "unsafe" | "jsonb";
  constructor(code: CheckpointError["code"]) { super("Tile checkpoint unavailable"); this.code = code; }
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const tuple = (tile: TileRect) => [tile.index, tile.x, tile.y, tile.width, tile.height];
export function tileIdentity(input: Pick<CheckpointInput, "sourceFingerprint" | "productContextFingerprint">, tile: TileRect) {
  return digest(["detailforge.tile", 1, input.sourceFingerprint, input.productContextFingerprint, ...tuple(tile)]);
}
export function tileLayoutFingerprint(layout: TileRect[], version = TILE_LAYOUT_VERSION) {
  return digest(["detailforge.layout", version, layout.map(tuple)]);
}
export function checkpointInputFingerprint(input: CheckpointInput) {
  return digest(["detailforge.checkpoint.input", 1, input.sourceFingerprint, input.productContextFingerprint,
    input.sourceDimensions.width, input.sourceDimensions.height, input.sourceOrientation, input.coordinateSpace,
    input.model, input.tileOutputSchemaVersion, input.tilingVersion, input.promptVersion, input.policyVersion,
    input.normalizationVersion, input.promptFingerprint, input.layoutFingerprint, input.layoutPolicyFingerprint]);
}
export function buildCheckpointInput(source: { fingerprint: string; dimensions: { width: number; height: number }; orientation: number },
  productContextFingerprint: string, model: string, layout: TileRect[], prompt: string): CheckpointInput {
  return checkpointInputSchema.parse({ sourceFingerprint: source.fingerprint, productContextFingerprint,
    sourceDimensions: source.dimensions, sourceOrientation: source.orientation, coordinateSpace: "orientation_normalized_pixels",
    model, tileOutputSchemaVersion: 2, tilingVersion: TILE_LAYOUT_VERSION, promptVersion: EXTRACTION_PROMPT_VERSION,
    policyVersion: POLICY_VERSION, normalizationVersion: NORMALIZATION_VERSION,
    promptFingerprint: digest(prompt), layoutFingerprint: tileLayoutFingerprint(layout),
    layoutPolicyFingerprint: digest([TILE_HEIGHT, TILE_OVERLAP, SNAP_WINDOW, MAX_TILE_COUNT]) });
}
function jsonText(value: unknown) {
  try { const text = JSON.stringify(value); if (text === undefined) throw new Error(); return text; }
  catch { throw new CheckpointError("invalid"); }
}
function inspectStrings(value: unknown): void {
  if (typeof value === "string") {
    // PostgreSQL JSONB rejects NUL and unmatched UTF-16 surrogates. Never silently alter evidence.
    if (value.includes("\0") || !value.isWellFormed()) throw new CheckpointError("jsonb");
    if (/https?:\/\/|data:image|(?:authorization\s*:|bearer\s+)|\b(?:OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|DOMEGGOOK_API_KEY)\b|sk-[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{15,}\.|[A-Za-z]:[\\/]|(?:^|\s)\/(?:home|Users|tmp|var)\//i.test(value)) throw new CheckpointError("unsafe");
  } else if (Array.isArray(value)) value.forEach(inspectStrings);
  else if (value && typeof value === "object") Object.values(value).forEach(inspectStrings);
}
export function validateCheckpoint(value: unknown): TileCheckpointCache {
  if (Buffer.byteLength(jsonText(value), "utf8") > MAX_CHECKPOINT_BYTES) throw new CheckpointError("oversized");
  const parsed = checkpointSchema.safeParse(value);
  if (!parsed.success) throw new CheckpointError("invalid");
  const cache = parsed.data, { width, height } = cache.input.sourceDimensions;
  if (width * height > MAX_INPUT_PIXELS) throw new CheckpointError("invalid");
  if (cache.input.layoutFingerprint !== tileLayoutFingerprint(cache.layout, cache.input.tilingVersion)) throw new CheckpointError("invalid");
  cache.layout.forEach((tile, index) => {
    const previous = cache.layout[index - 1];
    if (tile.index !== index || tile.x !== 0 || tile.width !== width || tile.y + tile.height > height
      || (!previous ? tile.y !== 0 : tile.y <= previous.y || tile.y > previous.y + previous.height)) throw new CheckpointError("invalid");
  });
  const last = cache.layout.at(-1)!;
  if (last.y + last.height !== height) throw new CheckpointError("invalid");
  let previousIndex = -1;
  for (const tile of cache.tiles) {
    const layoutTile = cache.layout[tile.index];
    if (!layoutTile || tile.index <= previousIndex || tile.tileId !== tileIdentity(cache.input, layoutTile)
      || JSON.stringify(tuple({ index: tile.index, ...tile.geometry })) !== JSON.stringify(tuple(layoutTile))) throw new CheckpointError("invalid");
    previousIndex = tile.index;
    if (tile.status === "completed") {
      try { normalizeCandidates(tile.result.regions.map(region => ({ region, tile: layoutTile })), cache.input.sourceDimensions, cache.input.sourceFingerprint); }
      catch { throw new CheckpointError("invalid"); }
    }
  }
  inspectStrings(cache);
  return cache;
}
export function serializeCheckpoint(value: unknown) { return jsonText(validateCheckpoint(value)); }
export function readCheckpoint(value: unknown) {
  if (value === undefined || value === null) return { status: "missing" as const, checkpoint: null };
  try { return { status: "available" as const, checkpoint: validateCheckpoint(value) }; }
  catch { return { status: "invalid" as const, checkpoint: null }; }
}
export function createCheckpoint(input: CheckpointInput, layout: TileRect[], runId: string) {
  return validateCheckpoint({ schemaVersion: 1, runId, input, layout, tiles: [] });
}
export function completedTileCheckpoint(input: CheckpointInput, tile: TileRect, result: z.infer<typeof tileOutputSchema>): TileCheckpoint {
  const { index, ...geometry } = tile;
  return { tileId: tileIdentity(input, tile), index, geometry, status: "completed", result };
}
export function failureCheckpoint(error: unknown, phase: "provider" | "validation" | "local", dispatched: boolean): CheckpointFailure {
  const known = error instanceof ExtractionError ? error.code : null;
  const code = known && failureCodes.some(code => code === known) ? known as CheckpointFailure["code"]
    : phase === "provider" ? "provider" : phase === "validation" ? "invalid_response" : "unexpected";
  const kind = code === "provider" ? "provider_error" : code === "timeout" ? "timeout"
    : code === "invalid_response" ? "structured_output_invalid" : "local_processing_error";
  return { kind, code, retryable: kind !== "local_processing_error", billing: dispatched ? "unknown" : "not_dispatched" };
}
export function failedTileCheckpoint(input: CheckpointInput, tile: TileRect, failure: CheckpointFailure): TileCheckpoint {
  const { index, ...geometry } = tile;
  return { tileId: tileIdentity(input, tile), index, geometry, status: "failed", failure };
}
// Domain transition only; no provider selection, retry endpoint or persistence here.
export function recordTileCheckpoint(value: TileCheckpointCache, entry: TileCheckpoint) {
  const cache = validateCheckpoint(value), existing = cache.tiles.find(tile => tile.index === entry.index);
  if (existing?.status === "completed" && !isDeepStrictEqual(existing, entry)) throw new CheckpointError("invalid");
  return validateCheckpoint({ ...cache, tiles: [...cache.tiles.filter(tile => tile.index !== entry.index), entry].sort((a, b) => a.index - b.index) });
}
export function checkpointRunStatus(cache: TileCheckpointCache) {
  if (cache.tiles.length < cache.layout.length) return "incomplete" as const;
  const success = cache.tiles.filter(tile => tile.status === "completed").length;
  return success === cache.layout.length ? "complete" as const : success ? "partial" as const : "failed" as const;
}
export function checkpointCompatible(cache: TileCheckpointCache, current: CheckpointInput) {
  return checkpointInputFingerprint(cache.input) === checkpointInputFingerprint(current);
}
export function checkpointReadModel(state: ExtractionState | null, current?: CheckpointInput) {
  const raw = state?.schemaVersion === 2 ? state.checkpoint : undefined, read = readCheckpoint(raw);
  const cache = read.checkpoint, error = state?.schemaVersion === 2 ? state.checkpointWriteError ?? null : null;
  const compatibility = !cache || !current ? "unknown" : checkpointCompatible(cache, current) ? "compatible" : "stale";
  const owned = cache?.runId === state?.attempt.runId;
  return { hasCheckpoint: read.status !== "missing", availability: read.status, compatibility,
    runStatus: cache ? checkpointRunStatus(cache) : null, successfulTileCount: cache?.tiles.filter(tile => tile.status === "completed").length ?? 0,
    failedTileCount: cache?.tiles.filter(tile => tile.status === "failed").length ?? 0,
    pendingTileCount: cache ? cache.layout.length - cache.tiles.length : 0, persistenceError: error,
    retryableTileIds: cache && owned && compatibility === "compatible" && !error && state?.attempt.status !== "analyzing"
      ? cache.tiles.filter(tile => tile.status === "failed" && tile.failure.retryable).map(tile => tile.tileId) : [] };
}

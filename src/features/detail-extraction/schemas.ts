import { z } from "zod";
import { MAX_CANDIDATES, MAX_TILE_COUNT, MAX_REGIONS_PER_TILE, LEASE_MS } from "./policy";
import { EXTRACTION_MESSAGES } from "./errors";
const score = z.number().min(0).max(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const regionTypeSchema = z.enum(["product_photo", "usage_photo", "detail_closeup", "variant_photo", "mixed", "text_or_spec", "shipping_or_notice", "promotional_banner", "other"]);
export const boxSchema = z.strictObject({ xMin: z.number().int().min(0).max(1000), yMin: z.number().int().min(0).max(1000),
  xMax: z.number().int().min(0).max(1000), yMax: z.number().int().min(0).max(1000) });
export const regionSchema = z.strictObject({ regionType: regionTypeSchema, confidence: score, productVisibility: score,
  standaloneUsability: score, textDensity: z.enum(["none", "low", "medium", "high"]), box: boxSchema, rationale: z.string().trim().min(1).max(180) });
// Refinements run separately after Structured Outputs (JSON Schema cannot express these comparisons).
export const visualKindSchema = z.enum(["photo", "illustration", "diagram", "graphic", "mixed", "unknown"]);
export const relevanceRegionSchema = regionSchema.extend({ visualKind: visualKindSchema, targetProductRelevance: score,
  containsTargetProduct: z.boolean(), relevanceReason: z.string().trim().min(1).max(120) });
export const tileOutputSchema = z.strictObject({ schemaVersion: z.literal(2), regions: z.array(relevanceRegionSchema).max(MAX_REGIONS_PER_TILE) });
export const rectSchema = z.strictObject({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative(), width: z.number().int().positive(), height: z.number().int().positive() });
export const dimensionsSchema = z.strictObject({ width: z.number().int().positive(), height: z.number().int().positive() });
export const legacyCandidateSchema = regionSchema.omit({ box: true }).extend({ id: hash, rect: rectSchema,
  defaultSelected: z.boolean(), saveAllowed: z.boolean(), edgeTruncated: z.boolean(), tileIndices: z.array(z.number().int().nonnegative()).min(1).max(MAX_TILE_COUNT) });
export const relevanceCandidateSchema = legacyCandidateSchema.extend(relevanceRegionSchema.omit({ box: true }).shape);
export const candidateSchema = z.union([relevanceCandidateSchema, legacyCandidateSchema]);
export const legacyResultSchema = z.strictObject({ schemaVersion: z.literal(1), policyVersion: z.literal(1), sourceFingerprint: hash,
  sourceDimensions: dimensionsSchema, coordinateSpace: z.literal("orientation_normalized_pixels"), sourceOrientation: z.number().int().min(1).max(8),
  provider: z.literal("openai"), model: z.string().min(1).max(200), analyzedAt: z.iso.datetime({ offset: true }),
  tileCount: z.number().int().min(1).max(MAX_TILE_COUNT), completedTiles: z.number().int().min(1).max(MAX_TILE_COUNT),
  failedTiles: z.array(z.number().int().nonnegative()).max(MAX_TILE_COUNT), partialAnalysis: z.boolean(), truncatedCandidates: z.boolean(),
  candidates: z.array(legacyCandidateSchema).max(MAX_CANDIDATES) });
export const relevanceResultSchema = legacyResultSchema.extend({ schemaVersion: z.literal(2), policyVersion: z.literal(2),
  productContextFingerprint: hash, candidates: z.array(relevanceCandidateSchema).max(MAX_CANDIDATES) });
export const resultSchema = z.discriminatedUnion("schemaVersion", [legacyResultSchema, relevanceResultSchema]);
const codeSchema = z.enum(Object.keys(EXTRACTION_MESSAGES) as [keyof typeof EXTRACTION_MESSAGES, ...(keyof typeof EXTRACTION_MESSAGES)[]]);
const legacyExtractionStateSchema = z.strictObject({ schemaVersion: z.literal(1), revision: z.uuid(),
  saveLease: z.strictObject({ id: z.uuid(), startedAt: z.iso.datetime({ offset: true }) }).nullable().default(null),
  attempt: z.strictObject({ status: z.enum(["analyzing", "completed", "failed"]), runId: z.uuid(), startedAt: z.iso.datetime({ offset: true }),
    finishedAt: z.iso.datetime({ offset: true }).nullable(), errorCode: codeSchema.nullable() }), latestResult: resultSchema.nullable() });
export const checkpointWriteErrorSchema = z.enum(["oversized", "invalid", "unsafe", "jsonb", "database"]);
// The cache has its own server-side validator. A damaged cache must not hide valid candidates.
// Preserve the opaque subtree on unrelated writes; never repair/delete it during a read.
export const checkpointExtractionStateSchema = legacyExtractionStateSchema.extend({ schemaVersion: z.literal(2),
  checkpoint: z.unknown().optional(), checkpointWriteError: checkpointWriteErrorSchema.nullable().optional(),
  latestResultInputFingerprint: hash.nullable().optional() });
export const extractionStateSchema = z.discriminatedUnion("schemaVersion", [legacyExtractionStateSchema, checkpointExtractionStateSchema]);
export const analyzeRequestSchema = z.strictObject({ force: z.boolean().default(false) });
export const saveRequestSchema = z.strictObject({ candidateIds: z.array(hash).min(1).max(MAX_CANDIDATES) }).refine(x=>new Set(x.candidateIds).size===x.candidateIds.length);
export type Region = z.infer<typeof regionSchema> | z.infer<typeof relevanceRegionSchema>;
export type Rect = z.infer<typeof rectSchema>;
export type Dimensions = z.infer<typeof dimensionsSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type ExtractionResult = z.infer<typeof resultSchema>;
export type ExtractionState = z.infer<typeof extractionStateSchema>;
export function readExtraction(metadata: Record<string, unknown>) { const p=extractionStateSchema.safeParse(metadata.detailExtraction); return p.success?p.data:null; }
export function isExtractionActive(state: ExtractionState|null, now=Date.now()) { const age=now-Date.parse(state?.attempt.startedAt??"");return state?.attempt.status==="analyzing"&&age>=0&&age<LEASE_MS; }
export function isSaveActive(state: ExtractionState|null, now=Date.now()) { const age=now-Date.parse(state?.saveLease?.startedAt??"");return Boolean(state?.saveLease && age>=0 && age<LEASE_MS); }
export function isDerived(metadata: Record<string, unknown>) { const d=metadata.derivation;return Boolean(d&&typeof d==="object"&&"kind" in d&&d.kind==="detail_image_crop"); }
export const trimSchema = z.strictObject({ policyVersion: z.union([z.literal(1), z.literal(2)]), insets: z.strictObject({ top:z.number().int().nonnegative(), right:z.number().int().nonnegative(), bottom:z.number().int().nonnegative(), left:z.number().int().nonnegative() }), postTrimDimensions: dimensionsSchema });
export const derivationSchema = z.strictObject({ schemaVersion:z.literal(1),kind:z.literal("detail_image_crop"),parentAssetId:z.uuid(),sourceFingerprint:hash,candidateId:hash, trim:trimSchema.optional(),
  sourceRect:rectSchema,sourceDimensions:dimensionsSchema,coordinateSpace:z.literal("orientation_normalized_pixels"),suggestedRole:z.enum(["product","usage","detail","option","mixed"]),
  confidence:score,extractedAt:z.iso.datetime({offset:true}),provider:z.literal("openai"),model:z.string().min(1).max(200) });

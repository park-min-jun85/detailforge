import { z } from "zod";
import { analysisResultSchema } from "@/features/asset-analysis/schemas";

export const PRODUCT_ANALYSIS_STALE_MS = 180_000;
const text = (max: number) => z.string().min(1).max(max);
const evidenceId = z.string().regex(/^[FVS][1-9][0-9]{0,2}$/);
const evidenceIds = z.array(evidenceId).min(1).max(12);
const strategy = { rationale: text(400), confidence: z.number().min(0).max(1), evidenceIds };
export const productAnalysisSchema = z.strictObject({
  schemaVersion: z.literal(1),
  summary: z.strictObject({ text: text(600), evidenceIds }),
  valuePropositions: z.array(z.strictObject({ title: text(100), ...strategy })).max(5),
  audienceHypotheses: z.array(z.strictObject({ label: text(100), ...strategy })).max(4),
  useCaseHypotheses: z.array(z.strictObject({ title: text(100), ...strategy })).max(5),
  messagingAngles: z.array(z.strictObject({ angle: text(100), ...strategy })).max(5),
  contentPriorities: z.strictObject({ emphasize: z.array(text(160)).max(6), deEmphasize: z.array(text(160)).max(6) }),
  cautions: z.array(z.strictObject({ message: text(300), evidenceIds: z.array(evidenceId).max(12) })).max(8),
});
export type ProductAnalysis = z.infer<typeof productAnalysisSchema>;

export const evidenceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ id: z.string().regex(/^F[1-9][0-9]{0,2}$/), kind: z.literal("product_fact"), label: text(100), value: text(500) }),
  z.strictObject({ id: z.string().regex(/^V[1-9][0-9]{0,2}$/), kind: z.literal("visual_observation"), label: text(100), assetId: z.uuid(), observation: analysisResultSchema }),
  z.strictObject({ id: z.literal("S1"), kind: z.literal("unverified_source_statement"), label: z.literal("UNVERIFIED SOURCE DESCRIPTION"), value: text(5000) }),
]);
export const evidenceSnapshotSchema = z.array(evidenceSchema).min(1).max(84);
export type Evidence = z.infer<typeof evidenceSchema>;
export const PRODUCT_ANALYSIS_ERROR_CODES = ["not_configured", "provider", "timeout", "invalid_response", "not_found",
  "product_required", "facts_required", "invalid_input", "ownership", "database", "busy", "conflict", "forbidden", "unexpected"] as const;
export type ProductAnalysisErrorCode = (typeof PRODUCT_ANALYSIS_ERROR_CODES)[number];
export const latestResultSchema = z.strictObject({
  provider: z.literal("openai"), model: text(200), analyzedAt: z.iso.datetime({ offset: true }),
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/), evidenceSnapshot: evidenceSnapshotSchema,
  analysis: productAnalysisSchema,
});
export const productAnalysisStateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  attempt: z.strictObject({ status: z.enum(["analyzing", "completed", "failed"]), runId: z.uuid(),
    startedAt: z.iso.datetime({ offset: true }), finishedAt: z.iso.datetime({ offset: true }).nullable(),
    errorCode: z.enum(PRODUCT_ANALYSIS_ERROR_CODES).nullable() }),
  latestResult: latestResultSchema.nullable(),
}).superRefine((state, ctx) => {
  const { status, finishedAt, errorCode } = state.attempt;
  if ((status === "analyzing" && (finishedAt !== null || errorCode !== null))
    || (status === "completed" && (!finishedAt || errorCode !== null || !state.latestResult))
    || (status === "failed" && (!finishedAt || !errorCode))) ctx.addIssue({ code: "custom", message: "Invalid attempt state" });
  if (state.latestResult && !validEvidenceReferences(state.latestResult.analysis, state.latestResult.evidenceSnapshot))
    ctx.addIssue({ code: "custom", message: "Invalid evidence references" });
});
export type ProductAnalysisState = z.infer<typeof productAnalysisStateSchema>;
export type LatestProductAnalysis = z.infer<typeof latestResultSchema>;

export function validEvidenceReferences(result: ProductAnalysis, evidence: Evidence[]): boolean {
  const registry = new Map(evidence.map((item) => [item.id, item]));
  if (registry.size !== evidence.length) return false;
  const groups = [result.summary, ...result.valuePropositions, ...result.audienceHypotheses, ...result.useCaseHypotheses, ...result.messagingAngles];
  const exists = (ids: string[]) => new Set(ids).size === ids.length && ids.every((id) => registry.has(id));
  if (![...groups, ...result.cautions].every((item) => exists(item.evidenceIds))) return false;
  if (!result.summary.evidenceIds.some((id) => registry.get(id)?.kind === "product_fact")) return false;
  return groups.every((item) => item.evidenceIds.some((id) => registry.get(id)?.kind !== "unverified_source_statement"));
}

export function validateProductAnalysis(input: unknown, evidence: Evidence[]): ProductAnalysis {
  const result = productAnalysisSchema.parse(input);
  if (!validEvidenceReferences(result, evidence)) throw new Error("Invalid evidence references");
  // Reject whitespace-only output without silently rewriting the provider response.
  const nonblank = (value: unknown): boolean => typeof value === "string" ? Boolean(value.trim())
    : Array.isArray(value) ? value.every(nonblank) : value !== null && typeof value === "object" ? Object.values(value).every(nonblank) : true;
  if (!nonblank(result)) throw new Error("Empty analysis text");
  return result;
}
export function isProductAnalysisActive(state: ProductAnalysisState | null, now: number): boolean {
  if (state?.attempt.status !== "analyzing") return false;
  const age = now - Date.parse(state.attempt.startedAt);
  return age >= 0 && age < PRODUCT_ANALYSIS_STALE_MS;
}
export function isProductAnalysisStale(state: ProductAnalysisState | null, fingerprint: string): boolean {
  return Boolean(state?.latestResult && state.latestResult.inputFingerprint !== fingerprint);
}

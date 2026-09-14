import { z } from "zod";
import { PRODUCT_ANALYSIS_ERROR_CODES } from "@/features/product-analysis/schemas";

export const VALIDATION_STATUSES = ["supported", "insufficient", "conflict", "needs_review"] as const;
export const validationStatusSchema = z.enum(VALIDATION_STATUSES);
export const STATUS_LABELS = { supported: "검증 완료", insufficient: "근거 부족", conflict: "충돌", needs_review: "검토 필요" };
const text = (max: number) => z.string().min(1).max(max);
export const targetFactSchema = z.strictObject({ factId: z.string().regex(/^F[1-9][0-9]{0,2}$/), label: text(100), value: text(500) });
export type TargetFact = z.infer<typeof targetFactSchema>;
export const validationEvidenceSchema = z.strictObject({
  id: z.string().regex(/^[SVH][1-9][0-9]{0,2}$/),
  kind: z.enum(["source_snapshot", "visual_observation", "historical_observation", "historical_source"]),
  label: text(100), value: text(60000),
});
export type ValidationEvidence = z.infer<typeof validationEvidenceSchema>;
export const validationOutputSchema = z.strictObject({
  schemaVersion: z.literal(1),
  facts: z.array(targetFactSchema.extend({ status: validationStatusSchema, confidence: z.number().min(0).max(1),
    evidenceIds: z.array(z.string().regex(/^[SVH][1-9][0-9]{0,2}$/)).max(12), reason: text(400) })).min(1).max(53),
  warnings: z.array(text(300)).max(8),
});
export type ValidationOutput = z.infer<typeof validationOutputSchema>;
export function validateFactOutput(value: unknown, targets: TargetFact[], evidence: ValidationEvidence[]): ValidationOutput {
  const output = validationOutputSchema.parse(value);
  const registry = new Map(evidence.map((item) => [item.id, item]));
  const facts = new Map(targets.map((fact) => [fact.factId, fact]));
  if (registry.size !== evidence.length || facts.size !== targets.length || output.facts.length !== targets.length
    || new Set(output.facts.map((fact) => fact.factId)).size !== targets.length) throw new Error("Invalid fact coverage");
  for (const fact of output.facts) {
    const target = facts.get(fact.factId);
    if (!target || target.label !== fact.label || target.value !== fact.value) throw new Error("Fact changed");
    if (!fact.reason.trim() || new Set(fact.evidenceIds).size !== fact.evidenceIds.length
      || fact.evidenceIds.some((id) => !registry.has(id))) throw new Error("Invalid evidence references");
    // Observations and old snapshots can flag uncertainty, never establish a factual verdict alone.
    if ((fact.status === "supported" || fact.status === "conflict")
      && !fact.evidenceIds.some((id) => registry.get(id)?.kind === "source_snapshot")) throw new Error("Source comparison required");
  }
  if (output.warnings.some((warning) => !warning.trim())) throw new Error("Empty warning");
  return { ...output, facts: targets.map((target) => output.facts.find((fact) => fact.factId === target.factId)!) };
}
export function summarizeValidation(facts: ValidationOutput["facts"]) {
  const counts = { supported: 0, insufficient: 0, conflict: 0, needs_review: 0 };
  facts.forEach((fact) => counts[fact.status]++);
  const status = counts.conflict ? "conflict" : counts.needs_review ? "needs_review" : counts.insufficient ? "insufficient" : "supported";
  return { counts, status: validationStatusSchema.parse(status) };
}
const count = z.number().int().min(0).max(53);
export const validationResultSchema = validationOutputSchema.extend({
  warnings: z.array(text(300)).max(16),
  status: validationStatusSchema,
  counts: z.strictObject({ supported: count, insufficient: count, conflict: count, needs_review: count }),
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/), validatedAt: z.iso.datetime({ offset: true }),
  provider: z.literal("openai"), model: text(200), evidenceSnapshot: z.array(validationEvidenceSchema).max(62),
}).superRefine((result, ctx) => {
  try {
    validateFactOutput({ schemaVersion: 1, facts: result.facts, warnings: [] }, result.facts, result.evidenceSnapshot);
    if (result.warnings.some((warning) => !warning.trim())) throw new Error("Empty warning");
    const summary = summarizeValidation(result.facts);
    if (summary.status !== result.status || VALIDATION_STATUSES.some((status) => summary.counts[status] !== result.counts[status])) throw new Error("Invalid counts");
  } catch { ctx.addIssue({ code: "custom", message: "Invalid validation result" }); }
});
export const validationStateSchema = z.strictObject({ schemaVersion: z.literal(1),
  attempt: z.strictObject({ status: z.enum(["analyzing", "completed", "failed"]), runId: z.uuid(),
    startedAt: z.iso.datetime({ offset: true }), finishedAt: z.iso.datetime({ offset: true }).nullable(),
    errorCode: z.enum(PRODUCT_ANALYSIS_ERROR_CODES).nullable() }),
  latestResult: validationResultSchema.nullable(),
}).superRefine(({ attempt, latestResult }, ctx) => {
  if ((attempt.status === "analyzing" && (attempt.finishedAt || attempt.errorCode))
    || (attempt.status === "completed" && (!attempt.finishedAt || attempt.errorCode || !latestResult))
    || (attempt.status === "failed" && (!attempt.finishedAt || !attempt.errorCode))) ctx.addIssue({ code: "custom", message: "Invalid attempt" });
});
export type ValidationState = z.infer<typeof validationStateSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export function isValidationStale(state: ValidationState | null, fingerprint: string) {
  return Boolean(state?.latestResult && state.latestResult.inputFingerprint !== fingerprint);
}
export function isValidationActive(state: ValidationState | null, now: number) {
  const age = now - Date.parse(state?.attempt.startedAt ?? "");
  return state?.attempt.status === "analyzing" && age >= 0 && age < 180_000;
}

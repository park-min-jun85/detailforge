import { confirmedOptionsSchema, type ConfirmedOptions } from "@/features/product-options/section-snapshot";
import { z } from "zod";
import { SECTION_TYPES, DETAIL_PAGE_STATUSES } from "@/types/domain";
import { analysisResultSchema, type AnalysisResult } from "@/features/asset-analysis/schemas";
import { validationOutputSchema } from "@/features/fact-validation/schemas";
import { productAnalysisSchema } from "@/features/product-analysis/schemas";

import { visualPolicySchema, visualAvailable, heroEligible, placementOnly, hasHeroQuality, validateVisualComposition } from "@/features/visual-assets/policy";

const text = (max: number) => z.string().min(1).max(max);
export const PLANNER_WARNINGS = ["insufficient_content_evidence", "no_suitable_hero", "restricted_facts_excluded", "product_strategy_unavailable", "partial_asset_analysis", "visual_observations_not_facts"] as const;
export const pagePlanSchema = z.strictObject({
  schemaVersion: z.literal(1),
  narrative: z.strictObject({ strategy: text(400), rationale: text(600) }),
  heroAssetId: z.uuid().nullable(), heroRationale: text(400),
  sections: z.array(z.strictObject({ key: z.string().regex(/^[a-z][a-z0-9-]{0,59}$/), type: z.enum(SECTION_TYPES),
    purpose: text(240), contentBrief: text(500), evidenceIds: z.array(z.string().regex(/^[FV][1-9][0-9]{0,2}$/)).max(16),
    assetIds: z.array(z.uuid()).max(8), priority: z.enum(["primary", "secondary", "supporting"]) })).min(5).max(12),
  warnings: z.array(z.enum(PLANNER_WARNINGS)).max(6),
});
export type PagePlan = z.infer<typeof pagePlanSchema>;
export const plannerEvidenceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ id: z.string().regex(/^F[1-9][0-9]{0,2}$/), kind: z.literal("supported_fact"), label: text(100), value: text(500) }),
  z.strictObject({ id: z.string().regex(/^V[1-9][0-9]{0,2}$/), kind: z.literal("visual_observation"), assetId: z.uuid(), observation: analysisResultSchema }),
]);
export type PlannerEvidence = z.infer<typeof plannerEvidenceSchema>;
export const plannerAssetSchema = z.strictObject({ assetId: z.uuid(), analysis: analysisResultSchema.nullable(), visual: visualPolicySchema.optional() });
export type PlannerAsset = z.infer<typeof plannerAssetSchema>;
export const factPolicySchema = z.strictObject({ supported: validationOutputSchema.shape.facts, restricted: z.array(validationOutputSchema.shape.facts.element).max(53) });
// A plan may have only visual structure; it must not invent supported facts to satisfy a minimum.
export const plannerFactPolicySchema = factPolicySchema.extend({ supported: z.array(validationOutputSchema.shape.facts.element).max(53) });
export type FactPolicy = z.infer<typeof plannerFactPolicySchema>;

export function isHeroCandidate(analysis: AnalysisResult | null): boolean {
  return hasHeroQuality(analysis);
}
export function validatePagePlan(value: unknown, evidence: PlannerEvidence[], assets: PlannerAsset[], options?: ConfirmedOptions): PagePlan {
  const plan = pagePlanSchema.parse(value);
  if (options && plan.sections.filter(section => section.type === "option").length !== (options.state === "present" ? 1 : 0)) throw new Error("Confirmed option section count");
  const registry = new Map(evidence.map((item) => [item.id, item]));
  const available = new Map(assets.filter(visualAvailable).map((asset) => [asset.assetId, asset]));
  if (registry.size !== evidence.length || new Set(assets.map((asset) => asset.assetId)).size !== assets.length) throw new Error("Duplicate input IDs");
  if (new Set(plan.sections.map((section) => section.key)).size !== plan.sections.length) throw new Error("Duplicate section keys");
  if (new Set(plan.sections.map((section) => section.purpose.trim().normalize("NFC"))).size !== plan.sections.length) throw new Error("Repeated purpose");
  if (plan.heroAssetId && (!available.has(plan.heroAssetId) || !heroEligible(available.get(plan.heroAssetId)!))) throw new Error("Invalid hero");
  const heroes = plan.sections.filter((section) => section.type === "hero");
  if (heroes.length > 1 || (heroes.length && plan.sections[0].type !== "hero")) throw new Error("Hero order");
  if (plan.heroAssetId && (heroes.length !== 1 || !heroes[0].assetIds.includes(plan.heroAssetId))) throw new Error("Hero reference mismatch");
  if (!plan.heroAssetId && heroes.some((section) => section.assetIds.length)) throw new Error("Unexpected hero image");
  validateVisualComposition(plan.sections, assets);
  for (const section of plan.sections) {
    if (new Set(section.evidenceIds).size !== section.evidenceIds.length || section.evidenceIds.some((id) => !registry.has(id))) throw new Error("Invalid evidence ID");
    if (section.assetIds.some((id) => !available.has(id))) throw new Error("Invalid asset ID");
    // Visual evidence cannot stand in for factual benefits/specifications/options/use cases.
    if (options && section.type === "option" && (section.evidenceIds.some(id => registry.get(id)?.kind !== "visual_observation") || section.assetIds.some(id => available.get(id)?.visual?.role !== "option"))) throw new Error("Options are separate from Facts and visual evidence");
    if (!(options && section.type === "option") && ["keyBenefits", "feature", "useCase", "specification", "option"].includes(section.type)
      && !section.evidenceIds.some((id) => registry.get(id)?.kind === "supported_fact")) throw new Error("Supported fact required");
    if (section.evidenceIds.some((id) => { const item = registry.get(id); return item?.kind === "visual_observation" && !section.assetIds.includes(item.assetId); })) throw new Error("Visual evidence asset mismatch");
    if (section.assetIds.some((id) => !placementOnly(available.get(id)!) && !section.evidenceIds.some((ref) => { const item = registry.get(ref); return item?.kind === "visual_observation" && item.assetId === id; }))) throw new Error("Missing visual evidence");
    section.assetIds = [...new Set(section.assetIds)];
  }
  const nonblank = (item: unknown): boolean => typeof item === "string" ? Boolean(item.trim()) : Array.isArray(item) ? item.every(nonblank)
    : item && typeof item === "object" ? Object.values(item).every(nonblank) : true;
  if (!nonblank(plan)) throw new Error("Empty plan text");
  if (plan.sections.length < 8) plan.warnings.push("insufficient_content_evidence");
  if (!plan.heroAssetId) plan.warnings.push("no_suitable_hero");
  plan.warnings = [...new Set(plan.warnings)];
  return pagePlanSchema.parse(plan);
}
export const PLANNER_ERROR_CODES = ["not_found", "product_required", "facts_required", "validation_required", "content_required", "invalid_input", "ownership", "database", "busy", "conflict", "input_changed", "not_configured", "provider", "invalid_response", "timeout", "forbidden", "unexpected"] as const;
export type PlannerErrorCode = (typeof PLANNER_ERROR_CODES)[number];
export const latestPlanSchema = z.strictObject({ provider: z.literal("openai"), model: text(200), plannedAt: z.iso.datetime({ offset: true }),
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/), evidenceSnapshot: z.array(plannerEvidenceSchema).max(83),
  factPolicySnapshot: plannerFactPolicySchema, assetSnapshot: z.array(plannerAssetSchema).max(30),
  strategySnapshot: productAnalysisSchema.nullable(), optionsSnapshot: confirmedOptionsSchema.optional(), plan: pagePlanSchema,
}).superRefine((result, ctx) => {
  try {
    validatePagePlan(result.plan, result.evidenceSnapshot, result.assetSnapshot, result.optionsSnapshot);
    const policy = result.factPolicySnapshot;
    if (policy.supported.some((fact) => fact.status !== "supported") || policy.restricted.some((fact) => fact.status === "supported")) throw new Error("Invalid policy");
    if (new Set([...policy.supported, ...policy.restricted].map((fact) => fact.factId)).size !== policy.supported.length + policy.restricted.length) throw new Error("Duplicate policy facts");
    const facts = result.evidenceSnapshot.filter((item) => item.kind === "supported_fact");
    if (facts.length !== policy.supported.length || facts.some((item) => !policy.supported.some((fact) => fact.factId === item.id && fact.label === item.label && fact.value === item.value))) throw new Error("Fact policy mismatch");
    for (const item of result.evidenceSnapshot) if (item.kind === "visual_observation") {
      const asset = result.assetSnapshot.find((asset) => asset.assetId === item.assetId);
      if (!asset?.analysis || JSON.stringify(asset.analysis) !== JSON.stringify(item.observation)) throw new Error("Observation mismatch");
    }
  } catch { ctx.addIssue({ code: "custom", message: "Invalid plan provenance" }); }
});
export const plannerStateSchema = z.strictObject({ schemaVersion: z.literal(1),
  attempt: z.strictObject({ status: z.enum(["planning", "completed", "failed"]), runId: z.uuid(), startedAt: z.iso.datetime({ offset: true }),
    finishedAt: z.iso.datetime({ offset: true }).nullable(), errorCode: z.enum(PLANNER_ERROR_CODES).nullable() }),
  latestResult: latestPlanSchema.nullable(),
}).superRefine(({ attempt, latestResult }, ctx) => {
  if ((attempt.status === "planning" && (attempt.finishedAt || attempt.errorCode))
    || (attempt.status === "completed" && (!attempt.finishedAt || attempt.errorCode || !latestResult))
    || (attempt.status === "failed" && (!attempt.finishedAt || !attempt.errorCode))) ctx.addIssue({ code: "custom", message: "Invalid attempt" });
});
export type PlannerState = z.infer<typeof plannerStateSchema>;
export type LatestPlan = z.infer<typeof latestPlanSchema>;
export const detailPageRowSchema = z.object({ id: z.uuid(), project_id: z.uuid(), status: z.enum(DETAIL_PAGE_STATUSES), width: z.number().int().positive(),
  theme_id: z.string().nullable(), settings: z.record(z.string(), z.json()), plan: z.record(z.string(), z.json()).default({}),
  created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }) });
export function isPlannerActive(state: PlannerState | null, now: number) {
  const age = now - Date.parse(state?.attempt.startedAt ?? "");
  return state?.attempt.status === "planning" && age >= 0 && age < 180000;
}
export function isPlanStale(state: PlannerState | null, fingerprint: string | null) {
  return Boolean(state?.latestResult && state.latestResult.inputFingerprint !== fingerprint);
}

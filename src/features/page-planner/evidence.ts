import { COMMERCE_COPY_VERSION } from "@/features/page-quality/commerce";
import "server-only";
import { PRESENTATION_VERSION } from "@/features/page-quality/policy";
import { buildVisualAssetInventory, visualAvailable, type AssetInspection } from "@/features/visual-assets/policy";
import type { ConfirmedOptions } from "@/features/product-options/section-snapshot";
import { buildValidationEvidence, canonicalValidationJson, validationFingerprint } from "@/features/fact-validation/evidence";
import { validationStateSchema, isValidationStale, validateFactOutput } from "@/features/fact-validation/schemas";
import { buildEvidenceRegistry, normalizeInput } from "@/features/product-analysis/evidence";
import { productAnalysisStateSchema, isProductAnalysisStale, type ProductAnalysis, type LatestProductAnalysis } from "@/features/product-analysis/schemas";
import type { Asset } from "@/types/domain";
import { plannerEvidenceSchema, type FactPolicy, type PlannerEvidence, type PlannerAsset } from "./schemas";
import type { PlannerContextInput } from "./types";
import { PlannerError } from "./errors";

function usableStrategy(latest: LatestProductAnalysis, evidence: PlannerEvidence[], policy: FactPolicy): ProductAnalysis | null {
  const old = new Map(latest.evidenceSnapshot.map((item) => [item.id, item]));
  const mapRef = (id: string): string | null => {
    const item = old.get(id);
    if (!item || item.kind === "unverified_source_statement") return null;
    if (item.kind === "visual_observation") return evidence.find((candidate) => candidate.kind === "visual_observation" && candidate.assetId === item.assetId)?.id ?? null;
    // TASK-009 sorts specs; TASK-010 retains source order. Never equate their F IDs by position.
    const matches = (fact: { label: string; value: string }) => normalizeInput(fact.label) === item.label && normalizeInput(fact.value) === item.value;
    if (policy.restricted.some(matches)) return null;
    return evidence.find((candidate) => candidate.kind === "supported_fact" && matches(candidate))?.id ?? null;
  };
  const convert = <T extends { evidenceIds: string[] }>(item: T): T | null => {
    if (item.evidenceIds.some((id) => old.get(id)?.kind === "product_fact" && !mapRef(id))) return null;
    const refs = [...new Set(item.evidenceIds.map(mapRef).filter((id): id is string => Boolean(id)))];
    return refs.length ? { ...item, evidenceIds: refs } : null;
  };
  const analysis = latest.analysis, summary = convert(analysis.summary);
  if (!summary?.evidenceIds.some((id) => id.startsWith("F"))) return null;
  const convertAll = <T extends { evidenceIds: string[] }>(items: T[]) => items.map(convert).filter((item): item is T => item !== null);
  return { ...analysis, summary, valuePropositions: convertAll(analysis.valuePropositions), audienceHypotheses: convertAll(analysis.audienceHypotheses),
    useCaseHypotheses: convertAll(analysis.useCaseHypotheses), messagingAngles: convertAll(analysis.messagingAngles),
    contentPriorities: policy.restricted.length ? { emphasize: [], deEmphasize: [] } : analysis.contentPriorities,
    cautions: convertAll(analysis.cautions) };
}

export function buildPlannerInput(input: { projectId: string; productId: string; facts: unknown; sourceSnapshot: unknown; validation: unknown;
  description: string | null; productAnalysis: unknown; assets: Asset[]; inspections?: Record<string, AssetInspection>; confirmedOptions?: ConfirmedOptions }): PlannerContextInput {
  try {
    const validationInput = buildValidationEvidence(input);
    const validation = validationStateSchema.safeParse(input.validation);
    const latest = validation.success ? validation.data.latestResult : null;
    const empty = input.validation && typeof input.validation === "object" && !Object.keys(input.validation).length;
    let validationStatus: PlannerContextInput["validationStatus"] = latest ? isValidationStale(validation.success ? validation.data : null, validationInput.inputFingerprint) ? "stale" : "ready" : empty || validation.success ? "missing" : "invalid";
    if (latest && validationStatus === "ready") {
      try { validateFactOutput({ schemaVersion: 1, facts: latest.facts, warnings: [] }, validationInput.targets, latest.evidenceSnapshot); }
      catch { validationStatus = "invalid"; }
    }
    const assessed = validationStatus === "ready" && latest ? latest.facts : validationInput.targets.map((target) => ({ ...target,
      status: "needs_review" as const, confidence: 0, evidenceIds: [], reason: "최신 사실 검증이 필요합니다." }));
    const factPolicy: FactPolicy = { supported: assessed.filter((fact) => fact.status === "supported"), restricted: assessed.filter((fact) => fact.status !== "supported") };
    const current = buildEvidenceRegistry({ ...input, description: input.description });
    const visual = current.evidence.filter((item) => item.kind === "visual_observation");
    const assets: PlannerAsset[] = buildVisualAssetInventory(input.assets, input.projectId, input.productId, input.inspections);
    const evidence = [...factPolicy.supported.map((fact) => ({ id: fact.factId, kind: "supported_fact", label: fact.label, value: fact.value })),
      ...visual.filter(item => assets.some(asset => asset.assetId === item.assetId && visualAvailable(asset))).map((item) => ({ id: item.id, kind: "visual_observation", assetId: item.assetId, observation: item.observation }))].map((item) => plannerEvidenceSchema.parse(item));
    const productAnalysis = productAnalysisStateSchema.safeParse(input.productAnalysis);
    const productLatest = productAnalysis.success ? productAnalysis.data.latestResult : null;
    const productEmpty = input.productAnalysis && typeof input.productAnalysis === "object" && !Object.keys(input.productAnalysis).length;
    const productAnalysisStatus: PlannerContextInput["productAnalysisStatus"] = productLatest ? isProductAnalysisStale(productAnalysis.success ? productAnalysis.data : null, current.inputFingerprint) ? "stale" : "ready" : productEmpty || productAnalysis.success ? "missing" : "invalid";
    const strategy = productLatest && productAnalysisStatus === "ready" ? usableStrategy(productLatest, evidence, factPolicy) : null;
    const warnings = ["visual_observations_not_facts", ...(factPolicy.restricted.length ? ["restricted_facts_excluded"] : []),
      ...(!strategy ? ["product_strategy_unavailable"] : []), ...(current.coverage.completed < current.coverage.total ? ["partial_asset_analysis"] : [])];
    const providerInput = { ...(input.confirmedOptions ? { confirmedOptions: input.confirmedOptions } : {}), evidence, assets: assets.filter(visualAvailable), strategy,
      restrictedFacts: factPolicy.restricted.map(({ factId, label, status }) => ({ factId, label, status })), warnings };
    if (canonicalValidationJson(providerInput).length > 180000) throw new PlannerError("invalid_input");
    const inputFingerprint = validationFingerprint({ commerceCopyVersion:COMMERCE_COPY_VERSION, presentationVersion:PRESENTATION_VERSION, ...(input.confirmedOptions ? { optionsFingerprint: input.confirmedOptions.fingerprint } : {}), facts: input.facts, validation: validation.success ? validation.data : input.validation,
      validationInputFingerprint: validationInput.inputFingerprint, supported: factPolicy.supported, assets,
      productAnalysis: productAnalysisStatus === "ready" ? productLatest : null, productAnalysisStatus });
    return { input: providerInput, inputFingerprint, factPolicy, assetSnapshot: assets, validationStatus, productAnalysisStatus, coverage: current.coverage };
  } catch (error) {
    if (error instanceof PlannerError) throw error;
    if (error && typeof error === "object" && "code" in error && error.code === "ownership") throw new PlannerError("ownership");
    throw new PlannerError("invalid_input");
  }
}

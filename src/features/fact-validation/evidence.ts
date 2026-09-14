import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { manualFactsSchema } from "@/features/products/schemas";
import { buildEvidenceRegistry } from "@/features/product-analysis/evidence";
import { productAnalysisStateSchema } from "@/features/product-analysis/schemas";
import type { Asset } from "@/types/domain";
import { targetFactSchema, validationEvidenceSchema, type ValidationEvidence } from "./schemas";
import { FactValidationError } from "./errors";

// Preserve exact Fact/source strings: even whitespace edits must invalidate their saved assessment.
export function canonicalValidationJson(value: unknown): string {
  const sort = (item: unknown): unknown => Array.isArray(item) ? item.map(sort)
    : item !== null && typeof item === "object" ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, sort(child)])) : item;
  return JSON.stringify(sort(value));
}
export function validationFingerprint(value: unknown) { return createHash("sha256").update(canonicalValidationJson(value)).digest("hex"); }
export function buildValidationEvidence(input: { projectId: string; productId: string; facts: unknown; sourceSnapshot: unknown; assets: Asset[]; productAnalysis: unknown }) {
  try {
    const facts = manualFactsSchema.strict().extend({ specifications: z.array(z.strictObject({ name: z.string().min(1).max(100), value: z.string().min(1).max(500) })).max(50) }).parse(input.facts);
    const targets = [{ factId: "F1", label: "상품명", value: facts.productName },
      ...(facts.brand ? [{ factId: "F2", label: "브랜드", value: facts.brand }] : []),
      ...(facts.category ? [{ factId: "F3", label: "카테고리", value: facts.category }] : []),
      ...facts.specifications.map((spec, index) => ({ factId: `F${index + 4}`, label: spec.name, value: spec.value }))].map((fact) => targetFactSchema.parse(fact));
    const source = z.record(z.string(), z.json()).parse(input.sourceSnapshot);
    const current = buildEvidenceRegistry({ ...input, description: null });
    const evidence: ValidationEvidence[] = [];
    const warnings = ["supported는 입력된 근거 범위의 일관성입니다. 외부 진위나 인증을 입증하지 않습니다."];
    if (Object.keys(source).length) {
      evidence.push({ id: "S1", kind: "source_snapshot", label: "입력 원본 snapshot · 미검증 자료", value: canonicalValidationJson(source) });
      warnings.push("입력 원본은 Facts와 같은 입력에서 복사됐을 수 있으며 독립적인 증명이 아닙니다.");
    } else warnings.push("입력 원본 snapshot이 없어 직접 비교 근거가 부족합니다.");
    for (const item of current.evidence) if (item.kind === "visual_observation") evidence.push({ id: item.id,
      kind: "visual_observation", label: item.label, value: canonicalValidationJson({ assetId: item.assetId, observation: item.observation }) });
    if (current.coverage.completed < current.coverage.total || !current.coverage.completed) warnings.push("완료된 이미지 관찰만 사용하며 시각 관찰은 사실 증명이 아닙니다.");
    const parsed = productAnalysisStateSchema.safeParse(input.productAnalysis);
    const snapshot = parsed.success ? parsed.data.latestResult?.evidenceSnapshot : undefined;
    // Use only the evidence snapshot, never summary/strategy/hypothesis text or duplicated Fact copies.
    if (snapshot) {
      for (const item of snapshot) {
        if (item.kind === "product_fact") continue;
        evidence.push({ id: `H${evidence.filter((entry) => entry.id.startsWith("H")).length + 1}`,
          kind: item.kind === "visual_observation" ? "historical_observation" : "historical_source",
          label: `과거 상품 분석 근거 · ${item.id}`, value: canonicalValidationJson(item) });
      }
      warnings.push("과거 상품 분석 근거는 현재와 다를 수 있는 참고 자료이며 독립적인 사실 근거가 아닙니다.");
    } else if (input.productAnalysis && typeof input.productAnalysis === "object" && Object.keys(input.productAnalysis).length) {
      warnings.push("사용 가능한 상품 분석 evidence snapshot이 없어 제외했습니다.");
    }
    const registry = z.array(validationEvidenceSchema).max(62).parse(evidence);
    const providerInput = { targets, evidence: registry, coverage: current.coverage, warnings };
    if (canonicalValidationJson(providerInput).length > 240000) throw new Error("Input too large");
    return { ...providerInput, inputFingerprint: validationFingerprint(providerInput) };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ownership") throw new FactValidationError("ownership");
    throw new FactValidationError("invalid_input");
  }
}

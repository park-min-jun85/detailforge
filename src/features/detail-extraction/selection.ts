import type { Candidate, ExtractionResult } from "./schemas";
import { MIN_PRODUCT_RELEVANCE, PRODUCT_REGIONS } from "./policy";

export const VISUAL_KIND_LABELS = { photo: "사진", illustration: "일러스트", diagram: "도식", graphic: "그래픽", mixed: "혼합 시각물", unknown: "종류 미확인" };
export const EXCLUSION_LABELS = {
  not_saveable: "저장 기준 미충족", non_product_role: "제품 사진 유형 아님", not_photo: "실제 사진 아님",
  target_absent: "대상 상품 미확인", low_relevance: "상품 관련도 낮음", edge: "구간 경계에 걸림",
  low_confidence: "분류 신뢰도 낮음", low_visibility: "제품 식별 어려움", low_usability: "단독 활용도 낮음", text: "텍스트 비중 높음",
};
export type ExclusionReason = keyof typeof EXCLUSION_LABELS;
// Shared deterministic policy. Legacy inputs keep their original quality rules; no fabricated relevance.
export function defaultExclusionReason(candidate: Candidate): ExclusionReason | null {
  if (!candidate.saveAllowed) return "not_saveable";
  if (!PRODUCT_REGIONS.some(role => role === candidate.regionType)) return "non_product_role";
  if ("visualKind" in candidate) {
    if (candidate.visualKind !== "photo") return "not_photo";
    if (!candidate.containsTargetProduct) return "target_absent";
    if (candidate.targetProductRelevance < MIN_PRODUCT_RELEVANCE) return "low_relevance";
  }
  if (candidate.edgeTruncated) return "edge";
  if (candidate.confidence < 0.7) return "low_confidence";
  if (candidate.productVisibility < 0.65) return "low_visibility";
  if (candidate.standaloneUsability < 0.65) return "low_usability";
  if (!["none", "low"].includes(candidate.textDensity)) return "text";
  return null;
}
export function extractionContextStatus(result: ExtractionResult, currentFingerprint?: string | null) {
  if (result.schemaVersion === 1) return "legacy";
  if (!currentFingerprint) return "unknown";
  return result.productContextFingerprint === currentFingerprint ? "current" : "stale";
}

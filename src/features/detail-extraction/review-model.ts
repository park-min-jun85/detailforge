import type { Candidate } from "./schemas";
import type { RetryResult } from "./retry";
import type { ExclusionReason } from "./selection";

export type ReviewCandidate = Pick<Candidate, "id" | "rect" | "regionType" | "defaultSelected" | "saveAllowed" | "confidence" | "textDensity" | "rationale" | "edgeTruncated"> & {
  visualKind?: "photo" | "illustration" | "diagram" | "graphic" | "mixed" | "unknown";
  targetProductRelevance?: number;
  exclusion: ExclusionReason | null;
};
type SelectableCandidate = Pick<Candidate, "id" | "defaultSelected" | "saveAllowed">;

export function retryFeedback(reply: Pick<RetryResult, "code" | "attemptedTileCount" | "succeededTileCount" | "failedTileCount" | "remainingFailedTileCount">) {
  return reply.code === "no_retryable_tiles" ? "다시 분석할 실패 구간이 없습니다. 최신 상태를 확인합니다."
    : `재시도 ${reply.attemptedTileCount}개 · 성공 ${reply.succeededTileCount}개 · 재실패 ${reply.failedTileCount}개 · 남은 실패 ${reply.remainingFailedTileCount}개. 기존 성공 후보와 저장 이미지는 유지됩니다.`;
}

export type ExtractionReview = {
  revision: string | null;
  active: boolean;
  hasAttempt: boolean;
  status: "complete" | "partial" | "failed" | "incomplete" | "missing" | "invalid" | "stale";
  total: number;
  successful: number;
  failed: number;
  retryable: number;
  result: {
    candidates: ReviewCandidate[];
    sourceDimensions: { width: number; height: number };
    truncatedCandidates: boolean;
  } | null;
  savedCandidateIds: string[];
};

// Full selection map: explicit false is as important as explicit true.
export function reconcileSelection(previous: Readonly<Record<string, boolean>>, candidates: readonly SelectableCandidate[]) {
  return Object.fromEntries(candidates.map(candidate => [candidate.id,
    Object.hasOwn(previous, candidate.id) ? previous[candidate.id] : candidate.defaultSelected]));
}

export function selectedCandidateIds(selection: Readonly<Record<string, boolean>>, candidates: readonly SelectableCandidate[], saved: readonly string[]) {
  const existing = new Set(saved);
  return candidates.filter(candidate => candidate.saveAllowed && selection[candidate.id] && !existing.has(candidate.id)).map(candidate => candidate.id);
}

export type ExtractionDisplay = { hasAttempt: boolean; hasResult: boolean; active: boolean; revision: string | null };
export function extractionDisplay(metadata: Record<string, unknown>): ExtractionDisplay | null {
  const value = metadata.extractionDisplay as ExtractionDisplay | undefined;
  return value && typeof value.hasAttempt === "boolean" && typeof value.active === "boolean" ? value : null;
}

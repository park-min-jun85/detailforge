import type { ExtractionReview } from "../review-model";

export function RetryStatus({ review, busy, pending, retry, reanalyze }: {
  review: ExtractionReview; busy: boolean; pending: boolean; retry: () => void; reanalyze: () => void;
}) {
  if (review.status === "complete" || !review.hasAttempt) return null;
  const reason = ({ stale: "원본·상품정보 또는 분석 기준이 변경되어 이전 실패 구간을 재사용할 수 없습니다.",
    missing: "이전 분석에는 구간별 저장 정보가 없습니다.", invalid: "구간별 저장 정보를 확인할 수 없습니다.",
    incomplete: "중단된 분석에 완료되지 않은 구간이 있어 전체 재분석이 필요합니다.",
    partial: "일부 구간 분석이 실패했습니다. 성공한 구간의 후보는 검토하고 저장할 수 있습니다.",
    failed: "분석에 성공한 구간이 없습니다." } as const)[review.status];
  const fallback = ["stale", "missing", "invalid", "incomplete"].includes(review.status);
  return <div className="mt-4 min-w-0 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4" aria-label="구간 분석 상태">
    <p role="status" className="break-words text-sm leading-6 text-amber-950">{reason}</p>
    {review.total > 0 && <p className="text-sm">전체 {review.total}개 · 성공 {review.successful}개 · 실패 {review.failed}개 · 재시도 가능 {review.retryable}개</p>}
    {review.retryable > 0 && <button type="button" className="button-secondary max-w-full whitespace-normal" disabled={busy || review.active} onClick={retry}>
      {pending ? "실패 구간 분석 중…" : `실패한 ${review.retryable}개 영역 다시 분석`}</button>}
    {fallback && <button type="button" className="button-secondary max-w-full whitespace-normal" disabled={busy || review.active} onClick={reanalyze}>전체 제품컷 재분석 (AI 재호출)</button>}
    {!fallback && !review.active && review.retryable === 0 && <p className="text-sm">다시 분석할 수 있는 실패 구간이 없습니다. 필요하면 전체 제품컷 재분석을 실행하세요.</p>}
    <p className="text-xs leading-5 text-zinc-600">자동 재시도는 하지 않습니다. 다시 분석하면 AI 비용이 발생할 수 있습니다. 기존 성공 후보와 저장 이미지는 유지됩니다.</p>
  </div>;
}

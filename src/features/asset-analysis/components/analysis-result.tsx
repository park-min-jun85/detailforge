import type { Asset, AssetType } from "@/types/domain";
import { ANALYSIS_ERRORS } from "../errors";
import { isActiveAnalysis, previousResult, readAnalysis } from "../schemas";

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  unclassified: "미분류", hero: "대표 이미지 (기존 지정)", product: "제품", detail: "디테일", usage: "사용 장면",
  specification: "스펙", option: "옵션", notice: "안내", other: "기타",
};
const warningLabels = { blurry: "흐림", cropped: "잘림", low_visibility: "낮은 가시성", heavy_text: "많은 텍스트",
  watermark_like_overlay: "워터마크 유사 겹침", ambiguous_subject: "불명확한 피사체" };

export function AnalysisResultCard({ asset, now, pending, disabled, error, onAnalyze }: {
  asset: Asset; now: number; pending: boolean; disabled: boolean; error?: string; onAnalyze: () => void;
}) {
  const state = readAnalysis(asset.metadata);
  const result = previousResult(state);
  const active = pending || isActiveAnalysis(state, now);
  const stale = state?.status === "analyzing" && !active;
  const message = error || (state?.status === "failed" ? ANALYSIS_ERRORS[state.errorCode].message : undefined);
  const label = active ? "분석 중" : message ? "분석 실패" : stale ? "분석 중단 · 재시도 가능" : state?.status === "completed" ? "분석 완료" : "미분석";
  return <div className="space-y-3 border-t border-zinc-100 pt-3 text-xs" aria-label={`${asset.originalFilename} 분석 결과`}>
    <p className={`font-medium ${message || stale ? "text-amber-800" : "text-zinc-600"}`} aria-live="polite">{label}</p>
    {result && <>
      {state?.status !== "completed" || error ? <p className="text-zinc-500">이전 성공 결과를 표시합니다.</p> : null}
      <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-2 text-zinc-600">
        <dt>시각적 분류</dt><dd className="font-medium text-zinc-900">{ASSET_TYPE_LABELS[result.role]}</dd>
        <dt>신뢰도</dt><dd>{Math.round(result.confidence * 100)}%</dd>
        <dt>대표 이미지 적합도</dt><dd>{Math.round(result.heroSuitability * 100)}%</dd>
      </dl>
      <p className="break-words leading-5 text-zinc-600">{result.visualSummary}</p>
      {result.warnings.length > 0 && <p className="leading-5 text-amber-800">확인 필요: {result.warnings.map((warning) => warningLabels[warning]).join(" · ")}</p>}
    </>}
    {message && <p role="alert" className="break-words leading-5 text-red-700">{message}</p>}
    {stale && <p className="leading-5 text-zinc-500">진행 상태가 오래되었습니다. 분석을 다시 요청할 수 있습니다.</p>}
    <button type="button" className="button-secondary w-full" disabled={disabled || active} onClick={onAnalyze}
      aria-label={`${asset.originalFilename} ${result ? "재분석" : "분석"}`}>
      {active ? "분석 중…" : result ? "재분석" : state ? "분석 재시도" : "이미지 분석"}
    </button>
  </div>;
}

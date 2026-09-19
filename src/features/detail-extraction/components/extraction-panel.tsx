"use client";
import { useState } from "react";
import type { Asset } from "@/types/domain";
import { requestCropSave, requestExtraction } from "../client";
import { EXTRACTION_MESSAGES, ExtractionError } from "../errors";
import { REGION_LABELS } from "../policy";
import { defaultExclusionReason, EXCLUSION_LABELS, extractionContextStatus, VISUAL_KIND_LABELS } from "../selection";
import { derivationSchema, isExtractionActive, isSaveActive, readExtraction, type Candidate, type ExtractionResult } from "../schemas";

type Props = { projectId: string; asset: Asset; previewUrl: string | null; assets: Asset[]; busy: boolean; currentContextFingerprint?: string;
  begin: () => boolean; end: () => void; refresh: () => Promise<void>; update: (asset: Asset) => void; close: () => void };

function CandidateReview({ result, ...props }: Props & { result: ExtractionResult }) {
  const [selected, setSelected] = useState(() => new Set(result.candidates.filter(c => c.defaultSelected).map(c => c.id)));
  const [showExcluded, setShowExcluded] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState(""), [stale, setStale] = useState(false);
  const existing = new Set(props.assets.flatMap(asset => { const d = derivationSchema.safeParse(asset.metadata.derivation);
    return d.success && d.data.parentAssetId === props.asset.id && d.data.sourceFingerprint === result.sourceFingerprint ? [d.data.candidateId] : []; }));
  const selectedIds = [...selected].filter(id => !existing.has(id));
  const available = Math.max(0, 30 - props.assets.length);
  const candidates: Candidate[] = result.candidates;
  const shown = candidates.filter(c => c.saveAllowed || showExcluded);
  async function save() {
    if (!props.begin()) return;
    setMessage(""); setError("");
    try {
      const reply = await requestCropSave(props.projectId, props.asset.id, selectedIds);
      setSelected(current => new Set([...current].filter(id => !reply.saved.some(s => s.candidateId === id))));
      setMessage(`추출 이미지 ${reply.saved.filter(s => !s.existing).length}개를 저장했습니다. · 기존 이미지 ${reply.saved.filter(s => s.existing).length}개 · 실패 ${reply.failed.length}개`);
      if (reply.failed.length) setError(reply.failed.map(f => `${result.candidates.findIndex(c => c.id === f.candidateId) + 1}번 후보: ${EXTRACTION_MESSAGES[f.code]}`).join(" / "));
    } catch (cause) {
      setError(cause instanceof ExtractionError ? cause.message + (cause.available !== undefined ? ` 남은 슬롯: ${cause.available}개.` : "") : EXTRACTION_MESSAGES.unexpected);
      if (cause instanceof ExtractionError && ["source_changed", "stale"].includes(cause.code)) setStale(true);
    } finally { try { await props.refresh(); } catch { setError("목록 갱신에 실패했습니다. 다시 저장하기 전에 목록을 새로고침해 주세요."); } props.end(); }
  }
  return <div className="mt-5 space-y-5">
    <p className="text-sm text-zinc-600">후보 {result.candidates.length}개 · 분석 {result.completedTiles}/{result.tileCount}구간 · 원본 {result.sourceDimensions.width} × {result.sourceDimensions.height}px</p>
    {result.partialAnalysis && <p role="status" className="text-sm text-amber-800">일부 구간 분석 실패: {result.failedTiles.map(i => i + 1).join(", ")}. 현재 후보는 분석에 성공한 구간만 포함합니다. 필요한 경우 명시적으로 재분석하세요.</p>}
    {result.truncatedCandidates && <p className="text-sm text-amber-800">품질 순위가 높은 최대 24개 후보를 원본 순서로 표시합니다.</p>}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showExcluded} onChange={e => setShowExcluded(e.target.checked)} />제외 후보 보기</label>
    {!shown.length && <p className="py-6 text-sm text-zinc-500">저장 가능한 제품컷 후보가 없습니다. 제외 후보를 확인하거나 원본 이미지를 사용하세요.</p>}
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {shown.map(candidate => { const number = candidates.indexOf(candidate) + 1, rect = candidate.rect, saved = existing.has(candidate.id);
        const exclusion = defaultExclusionReason(candidate);
        return <li key={candidate.id} className="min-w-0 rounded-lg border border-zinc-200 p-3">
          <div className="flex h-64 items-center justify-center overflow-hidden rounded bg-zinc-100">
            {props.previewUrl ? <svg role="img" aria-label={`후보 ${number} 미리보기`} viewBox={`${rect.x} ${rect.y} ${rect.width} ${rect.height}`} className="h-full w-full overflow-hidden" preserveAspectRatio="xMidYMid meet">
              <defs><clipPath id={`crop-${candidate.id}`} clipPathUnits="userSpaceOnUse"><rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} /></clipPath></defs>
              <image clipPath={`url(#crop-${candidate.id})`} href={props.previewUrl} x="0" y="0" width={result.sourceDimensions.width} height={result.sourceDimensions.height} preserveAspectRatio="none" />
            </svg> : <span className="text-sm">미리보기 갱신이 필요합니다.</span>}
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm font-medium"><input type="checkbox" className="mt-1" disabled={props.busy || saved || stale || !candidate.saveAllowed}
            checked={saved || selected.has(candidate.id)} onChange={e => setSelected(current => { const next = new Set(current); if (e.target.checked) next.add(candidate.id); else next.delete(candidate.id); return next; })} />
            {number}. {REGION_LABELS[candidate.regionType]}{saved ? " · 저장됨" : !candidate.saveAllowed ? " · 저장 제외" : ""}</label>
          {"visualKind" in candidate && <p className="mt-2 text-xs leading-5 text-zinc-600">{VISUAL_KIND_LABELS[candidate.visualKind]} · 제품 관련도 {Math.round(candidate.targetProductRelevance * 100)}%</p>}
          {!candidate.defaultSelected && exclusion && <p className="mt-1 text-xs leading-5 text-zinc-500">기본 제외 · {EXCLUSION_LABELS[exclusion]}{candidate.saveAllowed ? " · 직접 선택 가능" : ""}</p>}
          <p className="mt-2 text-xs leading-5 text-zinc-500">{rect.width} × {rect.height}px · 신뢰도 {Math.round(candidate.confidence * 100)}% · 텍스트 {({ none: "없음", low: "적음", medium: "보통", high: "많음" })[candidate.textDensity]}</p>
          {candidate.edgeTruncated && <p className="mt-1 text-xs text-amber-800">구간 경계에 닿아 있습니다. 제품이 잘리지 않았는지 확인하세요.</p>}
          <p className="mt-2 break-words text-xs leading-5 text-zinc-600">{candidate.rationale}</p>
        </li>;
      })}
    </ul>
    <p className="text-sm text-zinc-600">새로 저장할 선택 {selectedIds.length}개 · 남은 이미지 슬롯 {available}개</p>
    {selectedIds.length > available && <p role="alert" className="text-sm text-red-700">선택 수가 남은 슬롯을 초과합니다. 일부만 저장하지 않으므로 선택을 줄여 주세요.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm">{message}</p>}
    <button type="button" className="button-primary" disabled={props.busy || stale || !selectedIds.length || selectedIds.length > available || !props.previewUrl} onClick={save}>선택한 제품컷 저장 ({selectedIds.length})</button>
    <p className="text-xs leading-5 text-zinc-500">원본은 유지됩니다. 선택한 영역만 별도 이미지로 저장하며 처음에는 미분류 상태입니다. AI 이미지 분석은 저장 후 별도로 실행하세요.</p>
  </div>;
}

export function ExtractionPanel(props: Props) {
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const state = readExtraction(props.asset.metadata), result = state?.latestResult;
  const active = isExtractionActive(state) || isSaveActive(state);
  const freshness = result ? extractionContextStatus(result, props.currentContextFingerprint) : null;
  async function analyze(force: boolean) {
    if (!props.begin()) return;
    setError(""); setMessage("제품컷 후보를 분석하고 있습니다. 잠시 기다려 주세요.");
    try { const reply = await requestExtraction(props.projectId, props.asset.id, force); props.update(reply.asset); setMessage(reply.reused ? "같은 원본의 저장된 분석 결과를 불러왔습니다." : "후보 분석을 완료했습니다. 미리보기를 확인하고 저장할 이미지를 선택하세요."); }
    catch (cause) { setError(cause instanceof ExtractionError ? cause.message : EXTRACTION_MESSAGES.unexpected); setMessage(""); }
    finally { try { await props.refresh(); } catch { setError("목록 갱신에 실패했습니다. 목록을 새로고침해 주세요."); } props.end(); }
  }
  return <section className="panel min-w-0 p-4 sm:p-6" aria-labelledby="extraction-title" aria-busy={props.busy}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="extraction-title" className="text-lg font-semibold">상세이미지에서 제품컷 추출</h2>
      <p className="mt-1 break-all text-sm text-zinc-500">{props.asset.originalFilename}</p></div><button type="button" className="button-secondary" disabled={props.busy} onClick={props.close}>닫기</button></div>
    <p className="mt-3 text-sm leading-6 text-zinc-600">AI가 원본 사진 영역을 제안합니다. 배경 제거·사진 생성은 하지 않습니다. 제품이 잘리지 않았는지 직접 확인한 뒤 선택해 주세요.</p>
    {freshness === "legacy" && <p role="status" className="mt-3 text-sm leading-6 text-amber-800">이전 분석 결과입니다. 제품 관련도 검사를 적용하려면 다시 분석하세요. 기존 선택과 저장 이미지는 유지됩니다.</p>}
    {freshness === "stale" && <p role="status" className="mt-3 text-sm leading-6 text-amber-800">상품정보가 변경되어 제품 관련도 분석을 다시 실행하는 것을 권장합니다. 저장한 이미지는 유지됩니다.</p>}
    <div className="mt-4 flex flex-wrap gap-3">
      {!result && <button type="button" className="button-primary" disabled={props.busy || active} onClick={() => analyze(false)}>제품컷 후보 분석</button>}
      {result && <button type="button" className="button-secondary" disabled={props.busy || active} onClick={() => analyze(true)}>제품컷 재분석 (AI 재호출)</button>}
    </div>
    {active && <p role="status" className="mt-3 text-sm">추출 작업 진행 중입니다. 이 작업은 몇 분 걸릴 수 있습니다.</p>}
    {state?.attempt.status === "failed" && <p className="mt-3 text-sm text-amber-800">최근 분석 실패: {EXTRACTION_MESSAGES[state.attempt.errorCode ?? "unexpected"]}{result ? " 이전 성공 후보는 유지됩니다." : ""}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mt-3 text-sm">{message}</p>}
    {result && <CandidateReview key={result.analyzedAt} {...props} result={result} busy={props.busy || active} />}
  </section>;
}

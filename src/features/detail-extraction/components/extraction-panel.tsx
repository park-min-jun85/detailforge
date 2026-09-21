"use client";
import { useEffect, useRef, useState } from "react";
import type { Asset } from "@/types/domain";
import { requestCropSave, requestExtraction, requestExtractionReview, requestExtractionRetry } from "../client";
import { EXTRACTION_MESSAGES, ExtractionError } from "../errors";
import { REGION_LABELS } from "../policy";
import { cropRectKey } from "../crop-identity";
import { EXCLUSION_LABELS, VISUAL_KIND_LABELS } from "../selection";
import { retryFeedback, reconcileSelection, selectedCandidateIds, extractionDisplay, type ExtractionReview } from "../review-model";
import { RetryStatus } from "./retry-status";

type Props = { projectId: string; asset: Asset; previewUrl: string | null; assets: Asset[]; busy: boolean;
  begin: () => boolean; end: () => void; refresh: () => Promise<void>; update: (asset: Asset) => void; close: () => void };

function CandidateReview({ result, selected, setSelected, existingIds, ...props }: Props & {
  result: NonNullable<ExtractionReview["result"]>; selected: Record<string, boolean>;
  setSelected: React.Dispatch<React.SetStateAction<Record<string, boolean>>>; existingIds: string[];
}) {
  const [showExcluded, setShowExcluded] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState(""), [blockedRevision, setBlockedRevision] = useState<string | null>(null);
  const stale = blockedRevision !== null && blockedRevision === extractionDisplay(props.asset.metadata)?.revision;
  const saving = useRef(false);
  const existing = new Set(existingIds);
  const selectedIds = selectedCandidateIds(selected, result.candidates, existingIds);
  const selectedCropCount = new Set(result.candidates.filter(c => selectedIds.includes(c.id)).map(c => cropRectKey(c.rect))).size;
  const available = Math.max(0, 30 - props.assets.length);
  const candidates = result.candidates;
  const shown = candidates.filter(c => c.saveAllowed || showExcluded);
  async function save() {
    if (saving.current || !props.begin()) return;
    saving.current = true;
    setMessage(""); setError("");
    try {
      const reply = await requestCropSave(props.projectId, props.asset.id, selectedIds);
      setSelected(current => Object.fromEntries(Object.entries(current).map(([id, checked]) => [id, reply.saved.some(s => s.candidateId === id) ? false : checked])));
      setMessage(`추출 이미지 ${reply.saved.filter(s => !s.existing).length}개를 저장했습니다. · 기존 이미지 ${reply.saved.filter(s => s.existing).length}개 · 실패 ${reply.failed.length}개`);
      if (reply.failed.length) setError(reply.failed.map(f => `${result.candidates.findIndex(c => c.id === f.candidateId) + 1}번 후보: ${EXTRACTION_MESSAGES[f.code]}`).join(" / "));
    } catch (cause) {
      setError(cause instanceof ExtractionError ? cause.message + (cause.available !== undefined ? ` 남은 슬롯: ${cause.available}개.` : "") : EXTRACTION_MESSAGES.unexpected);
      if (cause instanceof ExtractionError && ["source_changed", "stale"].includes(cause.code)) setBlockedRevision(extractionDisplay(props.asset.metadata)?.revision ?? null);
    } finally { try { await props.refresh(); } catch { setError("목록 갱신에 실패했습니다. 다시 저장하기 전에 목록을 새로고침해 주세요."); } saving.current = false; props.end(); }
  }
  return <div className="mt-5 space-y-5">
    <p className="text-sm text-zinc-600">후보 {result.candidates.length}개 · 원본 {result.sourceDimensions.width} × {result.sourceDimensions.height}px</p>
    {result.truncatedCandidates && <p className="text-sm text-amber-800">품질 순위가 높은 최대 24개 후보를 원본 순서로 표시합니다.</p>}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showExcluded} onChange={e => setShowExcluded(e.target.checked)} />제외 후보 보기</label>
    {!shown.length && <p className="py-6 text-sm text-zinc-500">저장 가능한 제품컷 후보가 없습니다. 제외 후보를 확인하거나 원본 이미지를 사용하세요.</p>}
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {shown.map(candidate => { const number = candidates.indexOf(candidate) + 1, rect = candidate.rect, saved = existing.has(candidate.id);
        const exclusion = candidate.exclusion;
        return <li key={candidate.id} className="min-w-0 rounded-lg border border-zinc-200 p-3">
          <div className="flex h-64 items-center justify-center overflow-hidden rounded bg-zinc-100">
            {props.previewUrl ? <svg role="img" aria-label={`후보 ${number} 미리보기`} viewBox={`${rect.x} ${rect.y} ${rect.width} ${rect.height}`} className="h-full w-full overflow-hidden" preserveAspectRatio="xMidYMid meet">
              <defs><clipPath id={`crop-${candidate.id}`} clipPathUnits="userSpaceOnUse"><rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} /></clipPath></defs>
              <image clipPath={`url(#crop-${candidate.id})`} href={props.previewUrl} x="0" y="0" width={result.sourceDimensions.width} height={result.sourceDimensions.height} preserveAspectRatio="none" />
            </svg> : <span className="text-sm">미리보기 갱신이 필요합니다.</span>}
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm font-medium"><input type="checkbox" className="mt-1" disabled={props.busy || saved || stale || !candidate.saveAllowed}
            checked={saved || !!selected[candidate.id]} onChange={e => setSelected(current => ({ ...current, [candidate.id]: e.target.checked }))} />
            {number}. {REGION_LABELS[candidate.regionType]}{saved ? " · 저장됨" : !candidate.saveAllowed ? " · 저장 제외" : ""}</label>
          {candidate.visualKind && <p className="mt-2 text-xs leading-5 text-zinc-600">{VISUAL_KIND_LABELS[candidate.visualKind]} · 제품 관련도 {Math.round((candidate.targetProductRelevance ?? 0) * 100)}%</p>}
          {!candidate.defaultSelected && exclusion && <p className="mt-1 text-xs leading-5 text-zinc-500">기본 제외 · {EXCLUSION_LABELS[exclusion]}{candidate.saveAllowed ? " · 직접 선택 가능" : ""}</p>}
          <p className="mt-2 text-xs leading-5 text-zinc-500">{rect.width} × {rect.height}px · 신뢰도 {Math.round(candidate.confidence * 100)}% · 텍스트 {({ none: "없음", low: "적음", medium: "보통", high: "많음" })[candidate.textDensity]}</p>
          {candidate.edgeTruncated && <p className="mt-1 text-xs text-amber-800">구간 경계에 닿아 있습니다. 제품이 잘리지 않았는지 확인하세요.</p>}
          <p className="mt-2 break-words text-xs leading-5 text-zinc-600">{candidate.rationale}</p>
        </li>;
      })}
    </ul>
    <p className="text-sm text-zinc-600">새로 저장할 이미지 {selectedCropCount}개 · 선택 후보 {selectedIds.length}개 · 남은 이미지 슬롯 {available}개</p>
    {selectedCropCount > available && <p role="alert" className="text-sm text-red-700">선택 수가 남은 슬롯을 초과합니다. 일부만 저장하지 않으므로 선택을 줄여 주세요.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm">{message}</p>}
    <button type="button" className="button-primary" disabled={props.busy || stale || !selectedIds.length || selectedCropCount > available || !props.previewUrl} onClick={save}>선택한 제품컷 저장 ({selectedIds.length})</button>
    <p className="text-xs leading-5 text-zinc-500">원본은 유지됩니다. 선택한 영역만 별도 이미지로 저장하며 처음에는 미분류 상태입니다. AI 이미지 분석은 저장 후 별도로 실행하세요.</p>
  </div>;
}

export function ExtractionPanel(props: Props) {
  const [review, setReview] = useState<ExtractionReview | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [pending, setPending] = useState(false), [refreshFailed, setRefreshFailed] = useState(false);
  const locked = useRef(false), sequence = useRef(0);
  const { projectId, asset } = props;
  const revision = extractionDisplay(asset.metadata)?.revision;
  async function load() {
    const request = ++sequence.current;
    try {
      const next = await requestExtractionReview(projectId, asset.id);
      if (request !== sequence.current) return false;
      setSelected(current => reconcileSelection(current, next.result?.candidates ?? []));
      setReview(next); setRefreshFailed(false); return true;
    } catch (cause) { if (request === sequence.current) setRefreshFailed(true); throw cause; }
  }
  useEffect(() => {
    let disposed = false;
    const request = ++sequence.current;
    requestExtractionReview(projectId, asset.id).then(next => {
      if (disposed || request !== sequence.current) return;
      setSelected(current => reconcileSelection(current, next.result?.candidates ?? []));
      setReview(next); setRefreshFailed(false);
    }).catch(() => { if (!disposed && request === sequence.current) setRefreshFailed(true); });
    return () => { disposed = true; };
  }, [projectId, asset.id, revision]);
  async function refresh() { await props.refresh(); if (!await load()) throw new ExtractionError("conflict"); }
  async function run(action: "retry" | "analyze", force = false) {
    if (locked.current || !props.begin()) return;
    locked.current = true; setPending(action === "retry"); setError("");
    setMessage(action === "retry" ? "실패 구간을 분석하고 있습니다. 성공 구간은 다시 요청하지 않습니다." : "제품컷 후보를 분석하고 있습니다.");
    let conflict = false;
    try {
      if (action === "retry") {
        if (!review?.revision) throw new ExtractionError("checkpoint_missing");
        const reply = await requestExtractionRetry(projectId, asset.id, review.revision);
        setMessage(retryFeedback(reply));
      } else {
        const reply = await requestExtraction(projectId, asset.id, force);
        props.update(reply.asset);
        setMessage(reply.reused ? "저장된 분석 결과를 불러왔습니다." : "분석 요청이 끝났습니다. 구간 상태와 후보를 확인하세요.");
      }
    } catch (cause) {
      conflict = cause instanceof ExtractionError && cause.code === "conflict";
      setError(cause instanceof ExtractionError ? cause.message : EXTRACTION_MESSAGES.unexpected); setMessage("");
    } finally {
      try { await refresh(); if (conflict) setMessage("충돌 후 최신 상태를 불러왔습니다. 선택을 확인한 뒤 필요한 작업을 직접 실행하세요."); }
      catch { setRefreshFailed(true); setError("최신 상태를 불러오지 못했습니다. 현재 후보와 선택은 보존했습니다. 상태 새로고침 후 다시 진행하세요."); }
      locked.current = false; setPending(false); props.end();
    }
  }
  const disabled = props.busy || !!review?.active || refreshFailed || !review;
  return <section className="panel min-w-0 p-4 sm:p-6" aria-labelledby="extraction-title" aria-busy={props.busy}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="extraction-title" className="text-lg font-semibold">상세이미지에서 제품컷 추출</h2>
      <p className="mt-1 break-all text-sm text-zinc-500">{asset.originalFilename}</p></div><button type="button" className="button-secondary" disabled={props.busy} onClick={props.close}>닫기</button></div>
    <p className="mt-3 text-sm leading-6 text-zinc-600">AI가 원본 사진 영역을 제안합니다. 제품이 잘리지 않았는지 직접 확인한 뒤 선택해 주세요.</p>
    {review && <RetryStatus review={review} busy={disabled} pending={pending} retry={() => run("retry")} reanalyze={() => run("analyze", true)} />}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" className="button-secondary max-w-full whitespace-normal" disabled={disabled} onClick={() => run("analyze", !!review?.hasAttempt)}>{review?.hasAttempt ? "제품컷 재분석 (AI 재호출)" : "제품컷 후보 분석"}</button>
      <button type="button" className="button-secondary" disabled={props.busy} onClick={async () => {
        if (locked.current || !props.begin()) return; locked.current = true;
        try { await refresh(); setError(""); setMessage("최신 상태를 불러왔습니다."); }
        catch { setRefreshFailed(true); setError("최신 상태를 불러오지 못했습니다. 현재 선택은 보존했습니다."); }
        finally { locked.current = false; props.end(); }
      }}>상태 새로고침</button>
    </div>
    {review?.active && <p role="status" className="mt-3 text-sm">추출 작업 진행 중입니다. 이 작업은 몇 분 걸릴 수 있습니다.</p>}
    {refreshFailed && <p role="alert" className="mt-3 text-sm text-red-700">상태 확인이 필요합니다. 상태 새로고침을 실행하세요.</p>}
    {!review && !refreshFailed && <p role="status">분석 상태를 불러오는 중입니다.</p>}
    <div aria-live="polite">{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mt-3 text-sm">{message}</p>}</div>
    {review?.result && <CandidateReview {...props} result={review.result} selected={selected} setSelected={setSelected}
      existingIds={review.savedCandidateIds} busy={disabled} refresh={refresh} />}
  </section>;
}

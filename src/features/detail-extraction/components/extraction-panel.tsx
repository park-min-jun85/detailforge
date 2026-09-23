"use client";
import { useEffect, useRef, useState } from "react";
import type { Asset } from "@/types/domain";
import type { ManualInsets } from "../schemas";
import { requestCropSaveV2, requestExtraction, requestExtractionReview, requestExtractionRetry } from "../client";
import { EXTRACTION_MESSAGES, ExtractionError } from "../errors";
import { REGION_LABELS } from "../policy";
import { cropRectKey } from "../crop-identity";
import { insetRect } from "../crop-geometry";
import { EXCLUSION_LABELS, VISUAL_KIND_LABELS } from "../selection";
import { retryFeedback, extractionDisplay, type ReviewCandidate } from "../review-model";
import { applyManualDraft, buildCropSaveRequest, cropAlreadySaved, draftMatches, emptyCropWorkspace, reconcileCropWorkspace,
  removeManualDraft, settleCropSave, ZERO_INSETS } from "../manual-crop-client";
import { RetryStatus } from "./retry-status";
import { CropEditor } from "./crop-editor";

type Props = { projectId: string; asset: Asset; previewUrl: string | null; assets: Asset[]; busy: boolean;
  begin: () => boolean; end: () => void; refresh: () => Promise<void>; update: (asset: Asset) => void; close: () => void;
  onDirtyChange?: (dirty: boolean) => void };
type Editing = { candidate: ReviewCandidate; initial: ManualInsets; dimensions: { width: number; height: number } };

export function ExtractionPanel(props: Props) {
  const [workspace, setWorkspace] = useState(emptyCropWorkspace), [editor, setEditor] = useState<Editing | null>(null);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [showExcluded, setShowExcluded] = useState(false);
  const [pending, setPending] = useState(false), [working, setWorking] = useState(false), [refreshFailed, setRefreshFailed] = useState(false);
  const [imageState, setImageState] = useState<{ key: string; status: "loaded" | "error" } | null>(null);
  const locked = useRef(false), sequence = useRef(0);
  const { projectId, asset } = props, { review, selected, drafts } = workspace;
  const revision = extractionDisplay(asset.metadata)?.revision, result = review?.result;
  const previewKey = JSON.stringify([props.previewUrl, result?.sourceDimensions]);
  const imageReady = imageState?.key === previewKey && imageState.status === "loaded";
  const dirty = Object.keys(drafts).length > 0 || !!editor;
  const onDirtyChange = props.onDirtyChange;
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", leave); return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  const sourceWidth = result?.sourceDimensions.width, sourceHeight = result?.sourceDimensions.height;
  useEffect(() => {
    if (!props.previewUrl || !sourceWidth || !sourceHeight) return;
    let disposed = false; const image = new window.Image();
    image.onload = () => { if (!disposed) setImageState({ key: previewKey, status: image.naturalWidth === sourceWidth && image.naturalHeight === sourceHeight ? "loaded" : "error" }); };
    image.onerror = () => { if (!disposed) setImageState({ key: previewKey, status: "error" }); }; image.src = props.previewUrl;
    return () => { disposed = true; image.onload = null; image.onerror = null; };
  }, [props.previewUrl, previewKey, sourceWidth, sourceHeight]);
  async function load() {
    const request = ++sequence.current;
    try { const next = await requestExtractionReview(projectId, asset.id);
      if (request !== sequence.current) return;
      setWorkspace(current => reconcileCropWorkspace(current, next)); setRefreshFailed(false);
    } catch (cause) { if (request === sequence.current) setRefreshFailed(true); throw cause; }
  }
  useEffect(() => {
    let disposed = false; const request = ++sequence.current;
    requestExtractionReview(projectId, asset.id).then(next => {
      if (disposed || request !== sequence.current) return;
      setWorkspace(current => reconcileCropWorkspace(current, next)); setRefreshFailed(false);
    }).catch(() => { if (!disposed && request === sequence.current) setRefreshFailed(true); });
    return () => { disposed = true; };
  }, [projectId, asset.id, revision]);
  async function refresh() { await props.refresh(); await load(); }
  async function finish() {
    try { await refresh(); } catch { setRefreshFailed(true); setError("최신 상태를 불러오지 못했습니다. 현재 선택과 자르기 조정은 보존했습니다. 상태 새로고침 후 다시 진행하세요."); }
    locked.current = false; setWorking(false); setPending(false); props.end();
  }
  async function run(action: "retry" | "analyze", force = false) {
    if (editor || locked.current || !props.begin()) return;
    locked.current = true; setWorking(true); setPending(action === "retry"); setError("");
    setMessage(action === "retry" ? "실패 구간을 분석하고 있습니다. 성공 구간은 다시 요청하지 않습니다." : "제품컷 후보를 분석하고 있습니다.");
    try {
      if (action === "retry") {
        if (!review?.revision) throw new ExtractionError("checkpoint_missing");
        setMessage(retryFeedback(await requestExtractionRetry(projectId, asset.id, review.revision)));
      } else { const reply = await requestExtraction(projectId, asset.id, force); props.update(reply.asset);
        setMessage(reply.reused ? "저장된 분석 결과를 불러왔습니다." : "분석 요청이 끝났습니다. 구간 상태와 후보를 확인하세요."); }
    } catch (cause) { setError(cause instanceof ExtractionError ? cause.message : EXTRACTION_MESSAGES.unexpected); setMessage(""); }
    finally { await finish(); }
  }
  const revisionPending = !!revision && !!review && revision !== review.revision;
  const disabled = props.busy || working || !!review?.active || refreshFailed || !review || revisionPending;
  const request = buildCropSaveRequest(workspace), selectedItems = request?.items ?? [];
  async function save() {
    if (disabled || editor || !imageReady || !request?.items.length || locked.current || !props.begin()) return;
    locked.current = true; setWorking(true); setError(""); setMessage("");
    try {
      const reply = await requestCropSaveV2(projectId, asset.id, request);
      setWorkspace(current => settleCropSave(current, reply.saved.map(saved => saved.candidateId)));
      setMessage(`추출 이미지 ${reply.saved.filter(s => !s.existing).length}개를 저장했습니다. · 기존 이미지 ${reply.saved.filter(s => s.existing).length}개 · 실패 ${reply.failed.length}개`);
      if (reply.failed.length) setError(reply.failed.map(f => `${result!.candidates.findIndex(c => c.id === f.candidateId) + 1}번 후보: ${f.code === "crop_too_small" ? "저장 영역이 너무 작습니다. 자르기 영역을 다시 조정해 주세요." : EXTRACTION_MESSAGES[f.code]}`).join(" / "));
    } catch (cause) { const stale = cause instanceof ExtractionError && ["stale", "source_changed", "conflict"].includes(cause.code);
      setError(stale ? "이미지 분석 결과가 변경되어 자르기 조정을 다시 확인해 주세요. 자동으로 다시 저장하지 않습니다."
        : cause instanceof ExtractionError ? cause.message + (cause.available !== undefined ? ` 남은 슬롯: ${cause.available}개.` : "") : EXTRACTION_MESSAGES.unexpected);
    } finally { await finish(); }
  }
  const available = Math.max(0, 30 - props.assets.length);
  const count = new Set(selectedItems.map(item => { const candidate = result!.candidates.find(c => c.id === item.candidateId)!;
    return cropRectKey(item.manualInsets ? insetRect(candidate.rect, item.manualInsets) : candidate.rect); })).size;
  const openCandidate = editor && result?.candidates.find(c => c.id === editor.candidate.id);
  const editorStale = !!editor && (!openCandidate || openCandidate.basisKey !== editor.candidate.basisKey || cropRectKey(openCandidate.rect) !== cropRectKey(editor.candidate.rect) || !openCandidate.saveAllowed);
  return <section className="panel min-w-0 p-4 sm:p-6" aria-labelledby="extraction-title" aria-busy={props.busy || working}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="extraction-title" className="text-lg font-semibold">상세이미지에서 제품컷 추출</h2>
      <p className="mt-1 break-all text-sm text-zinc-500">{asset.originalFilename}</p></div><button type="button" className="button-secondary" disabled={props.busy || working || !!editor} onClick={() => {
        if (!dirty || window.confirm("저장하지 않은 자르기 조정을 버리고 닫을까요?")) props.close(); }}>닫기</button></div>
    <p className="mt-3 text-sm leading-6 text-zinc-600">AI가 원본 사진 영역을 제안합니다. 제품이 잘리지 않았는지 직접 확인한 뒤 선택해 주세요.</p>
    <p className="mt-2 text-sm leading-6 text-zinc-600">프레임이나 불필요한 여백이 보이면 저장 전에 자르기 영역을 조정할 수 있습니다.</p>
    {review && <RetryStatus review={review} busy={disabled || !!editor} pending={pending} retry={() => run("retry")} reanalyze={() => run("analyze", true)} />}
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" className="button-secondary max-w-full whitespace-normal" disabled={disabled || !!editor} onClick={() => run("analyze", !!review?.hasAttempt)}>{review?.hasAttempt ? "제품컷 재분석 (AI 재호출)" : "제품컷 후보 분석"}</button>
      <button type="button" className="button-secondary" disabled={props.busy || working || !!editor} onClick={async () => {
        if (locked.current || !props.begin()) return; locked.current = true; setWorking(true);
        try { await refresh(); setError(""); setMessage("최신 상태를 불러왔습니다. 선택과 자르기 조정을 확인해 주세요."); }
        catch { setRefreshFailed(true); setError("최신 상태를 불러오지 못했습니다. 현재 선택과 자르기 조정은 보존했습니다."); }
        finally { locked.current = false; setWorking(false); props.end(); }
      }}>상태 새로고침</button></div>
    {review?.active && <p role="status" className="mt-3 text-sm">추출 작업 진행 중입니다.</p>}
    {refreshFailed && <p role="alert" className="mt-3 text-sm text-red-700">상태 확인이 필요합니다. 상태 새로고침을 실행하세요.</p>}
    {!review && !refreshFailed && <p role="status">분석 상태를 불러오는 중입니다.</p>}
    <div aria-live="polite">{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mt-3 text-sm">{message}</p>}{workspace.notice && <p role="status" className="mt-3 text-sm text-amber-800">{workspace.notice}</p>}</div>
    {result && <div className="mt-5 space-y-5">
      <p className="text-sm text-zinc-600">후보 {result.candidates.length}개 · 원본 {result.sourceDimensions.width} × {result.sourceDimensions.height}px</p>
      {result.truncatedCandidates && <p className="text-sm text-amber-800">품질 순위가 높은 최대 24개 후보를 원본 순서로 표시합니다.</p>}
      {!imageReady && <p role="status" className="text-sm text-amber-800">{imageState?.key === previewKey && imageState.status === "error" ? "미리보기를 불러오지 못했거나 크기가 일치하지 않습니다. 상태 새로고침으로 다시 불러와 주세요." : "이미지 미리보기를 불러오는 중입니다."}</p>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showExcluded} onChange={e => setShowExcluded(e.target.checked)} />제외 후보 보기</label>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{result.candidates.filter(c => c.saveAllowed || showExcluded).map(candidate => {
        const number = result.candidates.indexOf(candidate) + 1, draft = drafts[candidate.id], saved = cropAlreadySaved(workspace, candidate);
        const validDraft = draft && draftMatches(draft, candidate, result.sourceDimensions);
        const rect = validDraft ? insetRect(candidate.rect, draft.insets) : workspace.receipts[candidate.id]?.finalRect ?? candidate.rect;
        return <li key={candidate.id} data-candidate-id={candidate.id} className="min-w-0 rounded-lg border border-zinc-200 p-3">
          <div className="flex h-64 items-center justify-center overflow-hidden rounded bg-zinc-100">{props.previewUrl && <svg role="img" aria-label={`후보 ${number} 미리보기`} viewBox={`${rect.x} ${rect.y} ${rect.width} ${rect.height}`} className="h-full w-full overflow-hidden" preserveAspectRatio="xMidYMid meet">
            <defs><clipPath id={`crop-${candidate.id}`}><rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} /></clipPath></defs>
            <image clipPath={`url(#crop-${candidate.id})`} href={props.previewUrl} x="0" y="0" width={result.sourceDimensions.width} height={result.sourceDimensions.height} preserveAspectRatio="none" /></svg>}</div>
          <label className="mt-3 flex items-start gap-2 text-sm font-medium"><input type="checkbox" className="mt-1" disabled={disabled || saved || !candidate.saveAllowed} checked={!!selected[candidate.id]}
            onChange={e => { const checked = e.target.checked; setWorkspace(current => ({ ...current, selected: { ...current.selected, [candidate.id]: checked } })); }} />
            {number}. {REGION_LABELS[candidate.regionType]}{saved ? " · 저장됨" : !candidate.saveAllowed ? " · 저장 제외" : ""}</label>
          {candidate.saveAllowed && <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="button-secondary" disabled={disabled || !imageReady} onClick={() => setEditor({ candidate, initial: validDraft ? draft.insets : ZERO_INSETS, dimensions: result.sourceDimensions })}>자르기 조정</button>
            {draft && <button type="button" className="button-secondary" disabled={disabled} onClick={() => setWorkspace(current => removeManualDraft(current, candidate.id))}>수동 조정 해제</button>}</div>}
          {draft && <p className="mt-2 text-sm text-zinc-600">{validDraft ? "자르기 조정됨" : "후보가 변경되었습니다. 자르기 조정을 다시 확인해 주세요."}{validDraft && !selected[candidate.id] && !saved ? " · 저장하려면 후보를 선택하세요." : ""}</p>}
          {candidate.visualKind && <p className="mt-2 text-xs leading-5 text-zinc-600">{VISUAL_KIND_LABELS[candidate.visualKind]} · 제품 관련도 {Math.round((candidate.targetProductRelevance ?? 0) * 100)}%</p>}
          {!candidate.defaultSelected && candidate.exclusion && <p className="mt-1 text-xs leading-5 text-zinc-500">기본 제외 · {EXCLUSION_LABELS[candidate.exclusion]}{candidate.saveAllowed ? " · 직접 선택 가능" : ""}</p>}
          <p className="mt-2 text-xs leading-5 text-zinc-500">{rect.width} × {rect.height}px · 신뢰도 {Math.round(candidate.confidence * 100)}% · 텍스트 {({ none: "없음", low: "적음", medium: "보통", high: "많음" })[candidate.textDensity]}</p>
          {candidate.edgeTruncated && <p className="mt-1 text-xs text-amber-800">구간 경계에 닿아 있습니다. 제품이 잘리지 않았는지 확인하세요.</p>}
          <p className="mt-2 break-words text-xs leading-5 text-zinc-600">{candidate.rationale}</p>
        </li>;
      })}</ul>
      <p className="text-sm text-zinc-600">새로 저장할 이미지 최대 {count}개 · 선택 후보 {selectedItems.length}개 · 남은 이미지 슬롯 {available}개</p>
      {count > available && <p className="text-sm text-amber-800">남은 슬롯이 부족할 수 있습니다. 중복 이미지를 제외한 실제 저장 수는 저장할 때 확인합니다.</p>}
      <button type="button" className="button-primary" disabled={disabled || !imageReady || !selectedItems.length || !!editor} onClick={save}>선택한 제품컷 저장 ({selectedItems.length})</button>
      <p className="text-xs leading-5 text-zinc-500">원본은 유지됩니다. 선택한 영역만 별도 이미지로 저장하며 처음에는 미분류 상태입니다. 수동 조정이 없으면 저장 시 자동 경계 정리가 적용될 수 있습니다.</p>
    </div>}
    {editor && <CropEditor base={editor.candidate.rect} dimensions={editor.dimensions} number={(result?.candidates.findIndex(c => c.id === editor.candidate.id) ?? 0) + 1}
      initial={editor.initial} previewUrl={props.previewUrl} ready={imageReady} loadError={imageState?.key === previewKey && imageState.status === "error"} blocked={disabled || editorStale} cancel={() => setEditor(null)}
      apply={insets => { if (disabled || editorStale || !imageReady) return; setWorkspace(current => applyManualDraft(current, openCandidate!, insets)); setEditor(null); }} />}
  </section>;
}

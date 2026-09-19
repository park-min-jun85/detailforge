"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QualitySummary } from "@/features/page-quality/summary";
import { assetProvenanceLabel } from "@/features/visual-assets/policy";
import { fetchAssets } from "@/features/assets/client";
import { draftOf, isDirty, previewContent, type EditDraft, type EditorSection } from "../schemas";
import { SECTION_LABELS } from "../fields";
import { requestSave, requestEditorView } from "../client";
import { requestReorder } from "@/features/section-reorder/client";
import { moveSection, orderIsDirty, needsDraftGuard } from "@/features/section-reorder/draft";
import { sameIds } from "@/features/section-reorder/schemas";
import { SectionNavigator } from "./section-navigator";
import type { EditorView } from "../types";
import { OptionInspector } from "./option-inspector";
import { Inspector } from "./inspector";
import { SectionPreview } from "../preview/section-preview";
import styles from "./editor.module.css";
import { requestCandidate, requestApplyCandidate } from "@/features/section-regeneration/client";
import { MANUAL_REGEN_WARNING, type SignedCandidate } from "@/features/section-regeneration/schemas";
import { CandidateComparison } from "@/features/section-regeneration/components/candidate-comparison";
type Pending = { sectionId: string } | { href: string } | { move: { from: string; to: string } } | { saveOrder: true } | { refresh: true } | { options: true };

export function DetailEditor({ initialView }: { initialView: EditorView }) {
  const [optionOpen, setOptionOpen] = useState(0);
  const [view, setView] = useState(initialView);
  const onPlanStale = useCallback((stale: boolean) => setView(previous => previous.stale === stale ? previous : { ...previous, stale }), []);
  const [sections, setSections] = useState(initialView.sections);
  const [orderDraft, setOrderDraft] = useState(initialView.sections.map(section => section.id));
  const orderDirty = orderIsDirty(sections.map(section => section.id), orderDraft);
  const [selectedId, setSelectedId] = useState(initialView.sections[0]?.id ?? "");
  const [draft, setDraft] = useState<EditDraft | null>(initialView.sections[0] ? draftOf(initialView.sections[0]) : null);
  const [assets, setAssets] = useState(initialView.assets);
  const [previewWarning, setPreviewWarning] = useState(initialView.previewWarning);
  const [pending, setPending] = useState<Pending | null>(null);
  const [candidate, setCandidate] = useState<SignedCandidate | null>(null);
  const [aiAction, setAiAction] = useState<"generate" | "apply" | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [tab, setTab] = useState("preview"), [scale, setScale] = useState(1);
  const previewContainer = useRef<HTMLDivElement>(null), saving = useRef(false), guard = useRef(false);
  const confirmation = useRef<HTMLElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  const selected = sections.find(section => section.id === selectedId);
  const dirty = !!selected && !!draft && isDirty(selected, draft);
  useEffect(() => {
    guard.current = needsDraftGuard(dirty, orderDirty, "leave") || busy || !!candidate;
    function unload(event: BeforeUnloadEvent) { if (guard.current) { event.preventDefault(); event.returnValue = ""; } }
    function navigate(event: MouseEvent) {
      const anchor = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!guard.current || !anchor || anchor.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || anchor.hasAttribute("download") || anchor.href === location.href
        || (anchor.pathname === location.pathname && anchor.search === location.search && !!anchor.hash)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (candidate) { setError("AI 후보를 적용하거나 기존 내용 유지를 선택한 뒤 이동해 주세요."); return; }
      if (!saving.current) { returnFocus.current = anchor; setPending({ href: anchor.href }); }
    }
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty, orderDirty, busy, candidate]);
  useEffect(() => { if (pending) confirmation.current?.focus(); }, [pending]);
  useEffect(() => {
    const element = previewContainer.current; if (!element) return;
    const observer = new ResizeObserver(entries => { const width = entries[0]?.contentRect.width; if (width) setScale(Math.min(1, width / 860)); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let alive = true, refreshing = false;
    async function refresh() {
      if (refreshing || document.visibilityState !== "visible") return; refreshing = true;
      try { const result = await fetchAssets(initialView.projectId); if (alive) { setAssets(previous=>result.items.map(item => ({ id: item.asset.id, name: item.asset.originalFilename, previewUrl: item.previewUrl, width:item.asset.width??previous.find(a=>a.id===item.asset.id)?.width, height:item.asset.height??previous.find(a=>a.id===item.asset.id)?.height, provenanceLabel:assetProvenanceLabel(item.asset,result.items.map(i=>i.asset)) }))); setPreviewWarning(false); } }
      catch { if (alive) setPreviewWarning(true); }
      finally { refreshing = false; }
    }
    const timer = window.setInterval(refresh, 240000);
    document.addEventListener("visibilitychange", refresh);
    return () => { alive = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [initialView.projectId]);
  function canonicalRows(rows: EditorSection[], resetOrder = false) {
    setSections(rows);
    const section = rows.find(item => item.id === selectedId) ?? rows[0];
    setSelectedId(section?.id ?? ""); setDraft(section ? draftOf(section) : null);
    if (resetOrder) setOrderDraft(rows.map(item => item.id));
  }
  async function loadLatest() {
    const latest = await requestEditorView(view.projectId); setView(latest); canonicalRows(latest.sections, true); setAssets(latest.assets); setPreviewWarning(latest.previewWarning); setMessage("최신 섹션을 불러왔습니다.");
  }
  async function refresh() {
    if (saving.current) return; saving.current = true; setBusy(true); setError("");
    try { await loadLatest(); }
    catch { setError("최신 섹션을 불러오지 못했습니다. 변경사항은 유지됩니다."); }
    finally { saving.current = false; setBusy(false); }
  }
  function proceed(target: Pending, discard = false) {
    setPending(null); setError("");
    if ("options" in target) { if (discard) { if (selected) setDraft(draftOf(selected)); setOrderDraft(sections.map(row => row.id)); } setOptionOpen(value => value + 1); return; }
    if ("href" in target) { guard.current = false; window.location.assign(target.href); return; }
    if ("refresh" in target) { void refresh(); return; }
    if ("move" in target) { if (discard && selected) setDraft(draftOf(selected)); setOrderDraft(current => moveSection(current, target.move.from, target.move.to)); setMessage("섹션 순서가 변경되었습니다."); return; }
    if ("saveOrder" in target) { if (discard && selected) setDraft(draftOf(selected)); return; }
    const section = sections.find(item => item.id === target.sectionId);
    if (section) { setOptionOpen(0); setSelectedId(section.id); setDraft(draftOf(section)); setMessage(""); }
  }
  function ask(target: Pending) { returnFocus.current = document.activeElement as HTMLElement | null; setPending(target); }
  function move(from: string, to: string) {
    if (saving.current || candidate || view.blocked || from === to) return;
    if (needsDraftGuard(dirty, orderDirty, "move")) ask({ move: { from, to } }); else proceed({ move: { from, to } });
  }
  function select(sectionId: string) {
    if (saving.current || candidate || sectionId === selectedId) return;
    if (needsDraftGuard(dirty, orderDirty, "select")) ask({ sectionId }); else proceed({ sectionId });
  }
  async function save(next: Pending | null = null) {
    if (!selected || !draft || saving.current || view.blocked) return;
    saving.current = true; setBusy(true); setError(""); setMessage("");
    try {
      let current = sections;
      if (dirty) {
        const result = await requestSave(view.projectId, selected.id, selected.updated_at, draft);
        if (!result.ok) { setError(result.message); return; }
        current = sections.map(section => section.id === result.section.id ? result.section : section);
        setSections(current); setDraft(draftOf(result.section)); setMessage("저장되었습니다.");
      }
      if (orderDirty && next && ("saveOrder" in next || "href" in next || "refresh" in next || "options" in next) && view.detailPageId) {
        const result = await requestReorder(view.projectId, { detailPageId: view.detailPageId, orderedSectionIds: orderDraft, expectedSections: current.map(row => ({ id: row.id, updatedAt: row.updated_at })) });
        if (!result.ok) {
          if (result.sections && sameIds(result.sections.map(row => row.id), orderDraft)) canonicalRows(result.sections);
          if (result.code === "recovery_required") setView(previous => ({ ...previous, blocked: true }));
          setError(result.message); return;
        }
        canonicalRows(result.sections, true); setView(previous => ({ ...previous, manualOrder: true })); setMessage("섹션 순서를 저장했습니다.");
      }
      if (next && "refresh" in next) {
        try { await loadLatest(); setPending(null); } catch { setError("최신 섹션을 불러오지 못했습니다. 다시 시도해 주세요."); }
      } else if (next && !("saveOrder" in next)) proceed(next); else setPending(null);
    } finally { saving.current = false; setBusy(false); }
  }
  async function recover() {
    if (!view.detailPageId || saving.current) return; saving.current = true; setBusy(true); setError("");
    try {
      const result = await requestReorder(view.projectId, { detailPageId: view.detailPageId, recover: true });
      if (!result.ok) { setError(result.message); return; }
      canonicalRows(result.sections, !sameIds(orderDraft, result.sections.map(row => row.id)));
      setView(previous => ({ ...previous, blocked: false, reorderRecovery: false })); setMessage("이전 순서를 복구했습니다. 변경한 순서를 다시 저장할 수 있습니다.");
    } finally { saving.current = false; setBusy(false); }
  }
  async function generateCandidate() {
    if (!selected || saving.current || candidate || dirty || orderDirty || view.blocked || view.stale) return;
    saving.current = true; setBusy(true); setAiAction("generate"); setError(""); setMessage("");
    try {
      const result = await requestCandidate(view.projectId, selected.id, selected.updated_at);
      if (!result.ok) { setError(result.message); return; }
      setCandidate(result.value); setMessage("AI 후보를 생성했습니다. 비교 후 적용해 주세요.");
    } finally { saving.current = false; setBusy(false); setAiAction(null); }
  }
  async function applyCandidate() {
    if (!selected || !candidate || saving.current) return;
    saving.current = true; setBusy(true); setAiAction("apply"); setError("");
    try {
      const result = await requestApplyCandidate(view.projectId, selected.id, candidate);
      if (!result.ok) { setError(result.message); return; }
      canonicalRows(sections.map(section => section.id === result.section.id ? result.section : section));
      setCandidate(null); setMessage("선택한 섹션에 새 AI 결과를 적용했습니다.");
    } finally { saving.current = false; setBusy(false); setAiAction(null); }
  }
  const ordered = orderDraft.flatMap(id => sections.find(section => section.id === id) ?? []);
  const displayed = ordered.map(section => section.id === selectedId && draft ? { ...section, content: previewContent(section, draft), style: draft.style } : section);
  return <div className={styles.editor}>
    <header className="space-y-4 border-b border-zinc-200 bg-white p-5 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><Link className="text-link text-xs" href={`/projects/${initialView.projectId}/sections`}>← 상세페이지 생성</Link>
        <h1 className="mt-3 text-xl font-semibold">상세페이지 편집</h1><p className="mt-1 break-words text-sm text-zinc-500">{initialView.projectName} · {initialView.productName}</p></div>
        <div className="flex flex-wrap items-center gap-3"><p role="status" className="text-sm text-zinc-600">{aiAction === "generate" ? "AI가 이 섹션을 다시 작성하고 있습니다." : busy ? "저장 중…" : dirty ? "저장되지 않은 변경사항" : orderDirty ? "저장되지 않은 순서 변경" : message || "저장된 상태"}</p>
          <Link prefetch={false} className="button-secondary" href={`/projects/${view.projectId}/render`}>최종 미리보기</Link>
          <button type="button" className="button-primary" disabled={!dirty || busy || view.blocked} onClick={() => save()}>저장</button>
          <button type="button" className="button-secondary" disabled={busy || !!candidate} onClick={() => needsDraftGuard(dirty, orderDirty, "leave") ? ask({ refresh: true }) : refresh()}>최신 섹션 다시 불러오기</button></div></div>
      {!!sections.length && <div className="flex flex-wrap items-center gap-3"><p role="status" className="text-sm text-zinc-600">{orderDirty ? "저장되지 않은 순서 변경 · 섹션 순서가 변경되었습니다." : "저장된 섹션 순서"}</p>
        <button type="button" className="button-primary" disabled={!orderDirty || busy || view.blocked} onClick={() => dirty ? ask({ saveOrder: true }) : save({ saveOrder: true })}>순서 저장</button>
        <button type="button" className="button-secondary" disabled={!orderDirty || busy} onClick={() => { setOrderDraft(sections.map(section => section.id)); setMessage("마지막 저장 순서로 되돌렸습니다."); }}>순서 되돌리기</button></div>}
      <p className="text-xs text-zinc-500">미리보기 860px · 명시적 저장 · AI 재생성은 버튼 실행 시에만 호출</p>
      {!sections.some(section => section.type === "option") && <p role="status" className="text-sm text-zinc-600">현재 상세페이지에 옵션 섹션이 없습니다. 페이지 설계와 상세페이지 생성에서 옵션을 포함해 주세요. <Link className="text-link" href={`/projects/${view.projectId}/planner`}>페이지 설계</Link></p>}
      {view.stale && <p role="status" className="rounded bg-amber-50 p-3 text-sm leading-6 text-amber-900">페이지 설계가 변경되었습니다. 현재 상세페이지는 이전 설계를 기준으로 생성되었습니다.</p>}
      {view.blocked && <p role="status" className="text-sm text-amber-900">저장·생성·복구 상태를 확인해야 합니다. 최신 섹션을 다시 불러온 뒤 순서 복구 또는 상세페이지 생성 화면의 복구를 진행해 주세요.</p>}
      {view.reorderRecovery && <button type="button" className="button-secondary" disabled={busy} onClick={recover}>이전 순서 복구</button>}
      <QualitySummary sections={sections} assets={assets} additionalWarnings={view.qualityWarnings} />
      {previewWarning && <p role="status" className="text-sm text-amber-900">이미지 미리보기를 불러오지 못했습니다. 문구와 선택한 이미지 ID는 유지됩니다.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!!sections.length && <section aria-label="선택한 섹션 AI 재생성" className="space-y-2 border-t border-zinc-200 pt-3">
        <button type="button" className="button-secondary" disabled={busy || !!candidate || !!pending || dirty || orderDirty || view.blocked || view.stale} onClick={generateCandidate}>AI로 다시 생성</button>
        <p className="text-xs leading-5 text-zinc-500">선택한 섹션의 문구 후보만 생성합니다. 적용 전까지 기존 내용은 유지됩니다.</p>
        {(dirty || orderDirty) && <p className="text-sm text-amber-900">먼저 문구·스타일과 순서 변경을 저장하거나 되돌려 주세요.</p>}
        {selected?.content.meta.manualEdit && <p role="status" className="text-sm text-amber-900">{MANUAL_REGEN_WARNING}</p>}
        <div className="flex flex-wrap gap-4 text-xs"><Link className="text-link" href={`/projects/${view.projectId}/planner`}>페이지 설계 확인</Link><Link className="text-link" href={`/projects/${view.projectId}/validation`}>사실 검증 확인</Link></div>
      </section>}
    </header>
    {candidate && selected && <CandidateComparison current={selected} candidate={candidate.candidate} busy={busy} onApply={applyCandidate} onKeep={() => { setCandidate(null); setError(""); setMessage("AI 후보를 버리고 기존 내용을 유지했습니다."); }} />}
    {pending && <section ref={confirmation} tabIndex={-1} role="group" aria-label="저장되지 않은 변경사항 확인" className="space-y-3 border-b border-amber-200 bg-amber-50 p-5">
      <p className="text-sm">저장되지 않은 변경사항이 있습니다. {"move" in pending || "saveOrder" in pending ? "순서를 변경하기 전에 현재 문구·스타일을 처리해 주세요." : "이동하기 전에 처리해 주세요."}</p><div className="flex flex-wrap gap-3">
        <button type="button" className="button-primary" disabled={busy || view.blocked} onClick={() => save(pending)}>변경사항 저장 후 계속</button>
        <button type="button" className="button-secondary" disabled={busy} onClick={() => proceed(pending, true)}>변경사항 버리기</button>
        <button type="button" className="button-secondary" disabled={busy} onClick={() => { setPending(null); returnFocus.current?.focus(); }}>취소</button></div></section>}
    {!sections.length ? <section className="m-5 space-y-5 rounded-xl border border-zinc-200 bg-white p-10 text-center"><h2 className="font-semibold">먼저 상세페이지를 생성해 주세요.</h2><Link href={`/projects/${initialView.projectId}/sections`} className="button-primary">상세페이지 생성으로 이동</Link></section> : <>
      <div className={styles.tabs} role="group" aria-label="편집 패널">{[["preview", "미리보기"], ["sections", "섹션"], ["properties", "속성"]].map(([key, label]) => <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
      <div className={styles.panels} data-tab={tab}>
        <SectionNavigator sections={ordered} selectedId={selectedId} disabled={busy || !!candidate || view.blocked} canDrag={!dirty && !pending} onSelect={select} onMove={move} />
        <section className={styles.preview} aria-label="상세페이지 미리보기"><h2 className={styles.panelTitle}>미리보기 <span className="font-normal text-zinc-500">{Math.round(scale * 100)}%</span></h2>
          <div className={styles.previewScroll}><div ref={previewContainer} className={styles.previewContainer}><div className={styles.canvas} style={{ zoom: scale }}>
            {displayed.map((section, i) => <div key={section.id} className={styles.sectionFrame} data-selected={section.id === selectedId} onClick={() => select(section.id)}>
              <button type="button" className={styles.selectSection} disabled={busy || !!candidate} aria-label={`${i + 1}. ${SECTION_LABELS[section.type]} 선택`} onClick={event => { event.stopPropagation(); select(section.id); }}>{i + 1}. {SECTION_LABELS[section.type]}</button>
              <SectionPreview section={section} assets={assets} />
            </div>)}
          </div></div></div>
        </section>
        <aside className={styles.inspector} aria-label="Property Inspector"><h2 className={styles.panelTitle}>속성 <span className="font-normal text-zinc-500">{selected && SECTION_LABELS[selected.type]}</span></h2>
          {selected && draft && <div className="p-4">{selected.type === "option" && <OptionInspector key={selected.id} projectId={view.projectId} section={selected} disabled={busy || !!candidate || view.blocked} onPlanStale={onPlanStale} hasUnsaved={dirty || orderDirty} openRequest={optionOpen} onOpen={() => needsDraftGuard(dirty, orderDirty, "leave") ? ask({ options: true }) : proceed({ options: true })} onBusy={value => { saving.current = value; setBusy(value); }} onSaved={(row, text) => { setOptionOpen(0); canonicalRows(sections.map(section => section.id === row.id ? row : section)); setMessage(text); }} />}<Inspector section={selected} draft={draft} assets={assets} disabled={busy || !!candidate || view.blocked} onChange={next => { setDraft(next); setMessage(""); }} /></div>}
        </aside>
      </div>
    </>}
  </div>;
}

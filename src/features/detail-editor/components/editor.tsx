"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchAssets } from "@/features/assets/client";
import { draftOf, isDirty, previewContent, type EditDraft } from "../schemas";
import { SECTION_LABELS, sectionTitle } from "../fields";
import { requestSave } from "../client";
import type { EditorView } from "../types";
import { Inspector } from "./inspector";
import { SectionPreview } from "../preview/section-preview";
import styles from "./editor.module.css";
type Pending = { sectionId: string } | { href: string };

export function DetailEditor({ initialView }: { initialView: EditorView }) {
  const [sections, setSections] = useState(initialView.sections);
  const [selectedId, setSelectedId] = useState(initialView.sections[0]?.id ?? "");
  const [draft, setDraft] = useState<EditDraft | null>(initialView.sections[0] ? draftOf(initialView.sections[0]) : null);
  const [assets, setAssets] = useState(initialView.assets);
  const [previewWarning, setPreviewWarning] = useState(initialView.previewWarning);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [tab, setTab] = useState("preview"), [scale, setScale] = useState(1);
  const previewContainer = useRef<HTMLDivElement>(null), saving = useRef(false), guard = useRef(false);
  const confirmation = useRef<HTMLElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  const selected = sections.find(section => section.id === selectedId);
  const dirty = !!selected && !!draft && isDirty(selected, draft);
  useEffect(() => {
    guard.current = dirty || busy;
    function unload(event: BeforeUnloadEvent) { if (guard.current) { event.preventDefault(); event.returnValue = ""; } }
    function navigate(event: MouseEvent) {
      const anchor = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!guard.current || !anchor || anchor.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || anchor.hasAttribute("download") || anchor.href === location.href
        || (anchor.pathname === location.pathname && anchor.search === location.search && !!anchor.hash)) return;
      event.preventDefault(); event.stopImmediatePropagation(); if (!saving.current) { returnFocus.current = anchor; setPending({ href: anchor.href }); }
    }
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty, busy]);
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
      try { const result = await fetchAssets(initialView.projectId); if (alive) { setAssets(result.items.map(item => ({ id: item.asset.id, name: item.asset.originalFilename, previewUrl: item.previewUrl }))); setPreviewWarning(false); } }
      catch { if (alive) setPreviewWarning(true); }
      finally { refreshing = false; }
    }
    const timer = window.setInterval(refresh, 240000);
    document.addEventListener("visibilitychange", refresh);
    return () => { alive = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [initialView.projectId]);
  function proceed(target: Pending) {
    setPending(null); setError("");
    if ("href" in target) { guard.current = false; window.location.assign(target.href); return; }
    const section = sections.find(item => item.id === target.sectionId);
    if (section) { setSelectedId(section.id); setDraft(draftOf(section)); setMessage(""); }
  }
  function select(sectionId: string) {
    if (saving.current || sectionId === selectedId) return;
    if (dirty) { returnFocus.current = document.activeElement as HTMLElement | null; setPending({ sectionId }); } else proceed({ sectionId });
  }
  async function save(next: Pending | null = null) {
    if (!selected || !draft || saving.current || initialView.blocked) return;
    saving.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const result = await requestSave(initialView.projectId, selected.id, selected.updated_at, draft);
      if (!result.ok) { setError(result.message); return; }
      setSections(current => current.map(section => section.id === result.section.id ? result.section : section));
      setDraft(draftOf(result.section)); setMessage("저장되었습니다.");
      if (next) proceed(next);
    } finally { saving.current = false; setBusy(false); }
  }
  const displayed = sections.map(section => section.id === selectedId && draft ? { ...section, content: previewContent(section, draft), style: draft.style } : section);
  return <div className={styles.editor}>
    <header className="space-y-4 border-b border-zinc-200 bg-white p-5 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><Link className="text-link text-xs" href={`/projects/${initialView.projectId}/sections`}>← 상세페이지 생성</Link>
        <h1 className="mt-3 text-xl font-semibold">상세페이지 편집</h1><p className="mt-1 break-words text-sm text-zinc-500">{initialView.projectName} · {initialView.productName}</p></div>
        <div className="flex flex-wrap items-center gap-3"><p role="status" className="text-sm text-zinc-600">{busy ? "저장 중…" : dirty ? "저장되지 않은 변경사항" : message || "저장된 상태"}</p>
          <button type="button" className="button-primary" disabled={!dirty || busy || initialView.blocked} onClick={() => save()}>저장</button></div></div>
      <p className="text-xs text-zinc-500">미리보기 860px · 명시적 저장 · 편집 중 AI 호출 없음</p>
      {initialView.stale && <p role="status" className="rounded bg-amber-50 p-3 text-sm leading-6 text-amber-900">페이지 설계가 변경되었습니다. 현재 상세페이지는 이전 설계를 기준으로 생성되었습니다.</p>}
      {initialView.blocked && <p role="status" className="text-sm text-amber-900">생성·복구 중에는 보관된 콘텐츠를 표시합니다. 상세페이지 화면에서 작업을 완료한 뒤 편집기를 다시 열어 주세요.</p>}
      {previewWarning && <p role="status" className="text-sm text-amber-900">이미지 미리보기를 불러오지 못했습니다. 문구와 선택한 이미지 ID는 유지됩니다.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </header>
    {pending && <section ref={confirmation} tabIndex={-1} role="group" aria-label="저장되지 않은 변경사항 확인" className="space-y-3 border-b border-amber-200 bg-amber-50 p-5">
      <p className="text-sm">저장되지 않은 변경사항이 있습니다. 이동하기 전에 처리해 주세요.</p><div className="flex flex-wrap gap-3">
        <button type="button" className="button-primary" disabled={busy} onClick={() => save(pending)}>변경사항 저장 후 이동</button>
        <button type="button" className="button-secondary" disabled={busy} onClick={() => proceed(pending)}>변경사항 버리기</button>
        <button type="button" className="button-secondary" disabled={busy} onClick={() => { setPending(null); returnFocus.current?.focus(); }}>취소</button></div></section>}
    {!sections.length ? <section className="m-5 space-y-5 rounded-xl border border-zinc-200 bg-white p-10 text-center"><h2 className="font-semibold">먼저 상세페이지를 생성해 주세요.</h2><Link href={`/projects/${initialView.projectId}/sections`} className="button-primary">상세페이지 생성으로 이동</Link></section> : <>
      <div className={styles.tabs} role="group" aria-label="편집 패널">{[["preview", "미리보기"], ["sections", "섹션"], ["properties", "속성"]].map(([key, label]) => <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
      <div className={styles.panels} data-tab={tab}>
        <nav className={styles.navigator} aria-label="Section Navigator"><h2 className={styles.panelTitle}>섹션 <span className="font-normal text-zinc-500">{sections.length}</span></h2>
          <ol className="space-y-2 p-3">{sections.map((section, i) => <li key={section.id}><button type="button" className={styles.navItem} aria-current={selectedId === section.id ? "true" : undefined} disabled={busy} onClick={() => select(section.id)}>
            <span className="block text-xs text-zinc-500">{i + 1}. {SECTION_LABELS[section.type]}</span><span className="mt-1 block truncate text-sm font-medium">{sectionTitle(section.content)}</span></button></li>)}</ol>
        </nav>
        <section className={styles.preview} aria-label="상세페이지 미리보기"><h2 className={styles.panelTitle}>미리보기 <span className="font-normal text-zinc-500">{Math.round(scale * 100)}%</span></h2>
          <div className={styles.previewScroll}><div ref={previewContainer} className={styles.previewContainer}><div className={styles.canvas} style={{ zoom: scale }}>
            {displayed.map((section, i) => <div key={section.id} className={styles.sectionFrame} data-selected={section.id === selectedId} onClick={() => select(section.id)}>
              <button type="button" className={styles.selectSection} disabled={busy} aria-label={`${i + 1}. ${SECTION_LABELS[section.type]} 선택`} onClick={event => { event.stopPropagation(); select(section.id); }}>{i + 1}. {SECTION_LABELS[section.type]}</button>
              <SectionPreview section={section} assets={assets} />
            </div>)}
          </div></div></div>
        </section>
        <aside className={styles.inspector} aria-label="Property Inspector"><h2 className={styles.panelTitle}>속성 <span className="font-normal text-zinc-500">{selected && SECTION_LABELS[selected.type]}</span></h2>
          {selected && draft && <div className="p-4"><Inspector section={selected} draft={draft} assets={assets} disabled={busy || initialView.blocked} onChange={next => { setDraft(next); setMessage(""); }} /></div>}
        </aside>
      </div>
    </>}
  </div>;
}

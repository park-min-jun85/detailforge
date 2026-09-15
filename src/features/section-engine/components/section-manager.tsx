"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fetchAssets } from "@/features/assets/client";
import type { AssetPreview } from "@/features/assets/types";
import { requestSections } from "../client";
import { SECTION_ERRORS } from "../errors";
import type { SectionView } from "../types";
import { SectionPreview } from "./section-preview";
export function SectionManager({ initialView }: { initialView: SectionView }) {
  const [view, setView] = useState(initialView), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState(""), [previews, setPreviews] = useState<AssetPreview[]>([]), [now, setNow] = useState(() => Date.now());
  const [previewError, setPreviewError] = useState(false), locked = useRef(false);
  const age = now - Date.parse(view.generation?.startedAt ?? ""), active = view.generation?.status === "generating" && age >= 0 && age < 300000;
  const assetKey = view.assets.map(asset => asset.assetId).join(",");
  useEffect(() => {
    let alive = true;
    async function load() { try { const result = assetKey ? await fetchAssets(initialView.projectId) : { items: [] }; if (alive) { setPreviews(result.items); setPreviewError(false); } }
      catch { if (alive) { setPreviews([]); setPreviewError(true); } } }
    void load(); const timer = window.setInterval(load, 240000); return () => { alive = false; window.clearInterval(timer); };
  }, [assetKey, initialView.projectId]);
  async function refresh() {
    if (locked.current) return; locked.current = true;
    try { const result = await requestSections(view.projectId); if (result.ok) { setView(result.view); setError(""); setConfirm(null); } else setError(result.message); setNow(Date.now()); }
    finally { locked.current = false; }
  }
  useEffect(() => {
    async function poll() {
      setNow(Date.now()); if (locked.current || document.visibilityState !== "visible") return; locked.current = true;
      try { const result = await requestSections(initialView.projectId); if (result.ok) setView(result.view); else setError(result.message); }
      finally { locked.current = false; }
    }
    const timer = window.setInterval(poll, active ? 5000 : 30000); document.addEventListener("visibilitychange", poll);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", poll); };
  }, [active, initialView.projectId]);
  async function generate(replaceExisting: boolean, expectedRevision = view.revision) {
    if (locked.current || active) return; locked.current = true; setBusy(true); setError(""); setConfirm(null);
    try {
      const result = await requestSections(view.projectId, { replaceExisting, expectedRevision });
      if (result.ok) setView(result.view); else setError(result.message);
      const latest = await requestSections(view.projectId); if (latest.ok) setView(latest.view); else if (result.ok) setError(latest.message);
      setNow(Date.now());
    } finally { locked.current = false; setBusy(false); }
  }
  const generationError = view.generation?.errorCode;
  const message = error || (generationError && generationError in SECTION_ERRORS ? SECTION_ERRORS[generationError as keyof typeof SECTION_ERRORS].message : "");
  return <div className="space-y-6">
    <section className="panel space-y-4 p-6 sm:p-8" aria-busy={busy || active}>
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-lg font-semibold">AI 상세페이지 생성</h2><div className="flex flex-wrap gap-3">
        <button className="button-secondary" type="button" disabled={busy} onClick={refresh}>콘텐츠 새로고침</button>
        <button className="button-primary" type="button" disabled={busy || active || (!view.planReady && !view.recoveryNeeded)} onClick={() => view.recoveryNeeded ? generate(false) : view.sections.length ? setConfirm(view.revision) : generate(false)}>
          {busy || active ? "처리 중…" : view.recoveryNeeded ? "기존 콘텐츠 복구" : view.sections.length ? "전체 다시 생성" : "AI 상세페이지 생성"}</button></div></div>
      <p className="text-sm leading-6 text-zinc-600">설계된 순서와 근거에 맞춰 콘텐츠를 생성합니다. 아래는 Section 구조와 문구 확인용 미리보기입니다.</p>
      <p role="status" className="text-sm">페이지 설계: {view.planReady ? "최신" : "최신 설계 필요"} · 설계 {view.planSectionCount}개 / 저장 콘텐츠 {view.sections.length}개</p>
      <p role="status" className="text-sm text-zinc-600">콘텐츠 상태: {busy || active ? "생성 중" : view.recoveryNeeded ? "복구 필요" : view.generation?.status === "failed" ? "생성 실패 · 기존 결과 유지" : view.sections.length ? "생성 완료" : "미생성"}</p>
      {!view.planReady && <div role="status" className="space-y-2 rounded bg-amber-50 p-4 text-sm text-amber-900"><p>최신 페이지 설계를 먼저 생성해 주세요.</p><Link className="text-link" href={`/projects/${view.projectId}/planner`}>페이지 설계 확인 →</Link></div>}
      {view.stale && <p role="status" className="rounded bg-amber-50 p-4 text-sm leading-6 text-amber-900">페이지 설계가 변경되었습니다. 상세페이지 콘텐츠를 다시 생성하는 것을 권장합니다. 아래는 이전 생성 결과입니다.</p>}
      {message && <p role="alert" className="text-sm leading-6 text-red-700">{message}</p>}
      {(busy || active || view.recoveryNeeded) && !!view.sections.length && <p className="text-sm text-zinc-600">보관된 기존 콘텐츠를 계속 표시합니다.</p>}
      {confirm && <div role="group" aria-label="전체 재생성 확인" className="space-y-3 rounded border border-amber-200 bg-amber-50 p-4"><p className="text-sm leading-6">기존 Section 콘텐츠 전체가 새 결과로 교체됩니다. AI 또는 검증 실패 시 기존 결과는 유지됩니다.</p><div className="flex flex-wrap gap-3"><button type="button" className="button-primary" onClick={() => generate(true, confirm)}>확인 후 전체 다시 생성</button><button type="button" className="button-secondary" onClick={() => setConfirm(null)}>취소</button></div></div>}
    </section>
    {!!view.sections.length && <div className="flex justify-end"><Link href={`/projects/${view.projectId}/editor`} className="button-primary">상세페이지 편집 →</Link></div>}
    {previewError && <p className="text-sm text-amber-800">이미지 미리보기를 불러오지 못했습니다. 저장된 콘텐츠는 유지됩니다.</p>}
    {!!view.sections.length && <p className="text-xs leading-6 text-zinc-500">게시 전 실제 상품과 문구를 확인해 주세요. supported는 입력 근거 안의 일관성이며 외부 진위 증명이 아닙니다.</p>}
    {view.sections.length ? <SectionPreview rows={view.sections} previews={previews} /> : <section className="panel p-12 text-center text-sm text-zinc-500">아직 생성된 상세페이지 콘텐츠가 없습니다.</section>}
  </div>;
}

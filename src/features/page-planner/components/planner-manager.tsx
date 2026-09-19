"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchAssets } from "@/features/assets/client";
import type { AssetPreview } from "@/features/assets/types";
import { requestPagePlan } from "../client";
import { isPlannerActive, isHeroCandidate } from "../schemas";
import { PLANNER_ERRORS } from "../errors";
import type { PlannerView } from "../types";
import { AssetThumbnail, PlanResult } from "./plan-result";

export function PlannerManager({ initialView }: { initialView: PlannerView }) {
  const [view, setView] = useState(initialView), [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [previews, setPreviews] = useState<AssetPreview[]>([]), [previewError, setPreviewError] = useState(false);
  const locked = useRef(false), active = isPlannerActive(view.state, now);
  const previous = view.state?.latestResult, interrupted = view.state?.attempt.status === "planning" && !active;
  const assetKey = view.assets.map((asset) => asset.assetId).join(",");
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!assetKey) { setPreviews([]); setPreviewError(false); return; }
      try { const result = await fetchAssets(initialView.projectId); if (alive) { setPreviews(result.items); setPreviewError(false); } }
      catch { if (alive) { setPreviewError(true); setPreviews([]); } }
    }
    void load(); const timer = window.setInterval(load, 240000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [assetKey, initialView.projectId]);
  async function refresh() {
    if (locked.current) return;
    locked.current = true;
    try { const result = await requestPagePlan(view.projectId, "GET"); if (result.ok) { setView(result.view); setError(""); } else setError(result.message); setNow(Date.now()); }
    finally { locked.current = false; }
  }
  useEffect(() => {
    async function poll() {
      setNow(Date.now()); if (locked.current || document.visibilityState !== "visible") return;
      locked.current = true;
      try { const result = await requestPagePlan(initialView.projectId, "GET"); if (result.ok) setView(result.view); else setError(result.message); }
      finally { locked.current = false; }
    }
    const timer = window.setInterval(poll, active ? 5000 : 30000); document.addEventListener("visibilitychange", poll);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", poll); };
  }, [active, initialView.projectId]);
  async function plan() {
    if (locked.current || active || view.prerequisite !== "ready") return;
    locked.current = true; setBusy(true); setError("");
    try {
      const result = await requestPagePlan(view.projectId, "POST"); if (result.ok) setView(result.view); else setError(result.message);
      const latest = await requestPagePlan(view.projectId, "GET"); if (latest.ok) setView(latest.view); else if (result.ok) setError(latest.message);
      setNow(Date.now());
    } finally { locked.current = false; setBusy(false); }
  }
  const status = busy || active ? "설계 중" : interrupted ? "설계 중단 · 재시도 가능" : view.state?.attempt.status === "failed" ? "설계 실패" : previous ? "계획 완료" : "미설계";
  const counts = { supported: view.factPolicy.supported.length, insufficient: 0, conflict: 0, needs_review: 0 };
  view.factPolicy.restricted.forEach((fact) => counts[fact.status]++);
  const candidates = view.assets.filter((asset) => asset.visual ? asset.visual.heroEligible && asset.visual.available : isHeroCandidate(asset.analysis));
  const derived = view.assets.filter(a => a.visual?.kind === "derived");
  const sources = view.assets.filter(a => a.visual?.kind === "long_source");
  const newDerived = derived.some(a => !previous?.assetSnapshot.some(old => old.assetId === a.assetId));
  const rawUses = previous?.plan.sections.flatMap(s => s.assetIds).filter(id => previous.assetSnapshot.find(a => a.assetId === id)?.visual?.kind === "long_source").length ?? 0;
  return <div className="space-y-6">
    <section className="panel p-6 sm:p-8" aria-busy={busy || active}>
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-lg font-semibold">AI 페이지 설계</h2><div className="flex flex-wrap gap-3">
        <button type="button" className="button-secondary" disabled={busy} onClick={refresh}>설계 결과 새로고침</button>
        <button type="button" className="button-primary" disabled={busy || active || view.prerequisite !== "ready"} onClick={plan}>{busy || active ? "설계 중…" : previous ? "페이지 설계 다시 생성" : "AI 페이지 설계"}</button></div></div>
      <p className="mt-4 text-sm leading-6 text-zinc-600">지원된 Fact와 완료된 이미지 관찰로 Section의 목적·순서·근거를 설계합니다. 실제 콘텐츠나 광고 문구를 생성하지 않습니다.</p>
      <p role="status" className="mt-4 text-sm font-medium">상태: {status}</p>
      {view.prerequisite !== "ready" && <div role="status" className="mt-4 space-y-3 rounded-md bg-amber-50 p-4 text-sm text-amber-900"><p>{PLANNER_ERRORS[view.prerequisite].message}</p><Link href={`/projects/${view.projectId}/validation`} className="text-link">사실 검증 확인 →</Link></div>}
      {previous && !previous.optionsSnapshot && <p role="status" className="mt-3 text-sm text-amber-900">이전 Plan은 확정 옵션과 연결되지 않았습니다. 옵션을 포함하려면 페이지 설계를 다시 생성해 주세요.</p>}
      {view.stale && <p role="status" className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">입력 정보가 변경되어 페이지 설계를 다시 생성하는 것을 권장합니다. 아래는 이전 입력의 Plan입니다.</p>}
      {(error || view.state?.attempt.errorCode) && <p role="alert" className="mt-3 text-sm leading-6 text-red-700">{error || (view.state?.attempt.errorCode && PLANNER_ERRORS[view.state.attempt.errorCode].message)}</p>}
      {previous && <p className="mt-3 text-xs text-zinc-500">{busy || view.state?.attempt.status !== "completed" ? "이전 성공 Plan을 유지하고 있습니다. " : ""}마지막 성공: {new Date(previous.plannedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>}
    </section>
    <section className="panel space-y-3 p-6"><h2 className="font-semibold">재구성에 사용할 이미지</h2>
      <p className="text-sm">추출 이미지 {derived.length}개 · 긴 원본 {sources.length}개 · 원본 사용 제외 {sources.filter(a => a.visual?.suppressed).length}개</p>
      {view.extraction?.map((source, index) => <p key={source.assetId} className="text-xs text-zinc-500">긴 원본 {index + 1}: {source.hasCandidates ? "추출 후보 있음" : "추출 미분석"} · 저장된 추출 이미지 {source.derivedCount}개</p>)}
      {!!derived.filter(a => !a.analysis).length && <p className="text-sm text-zinc-600">추출 이미지 {derived.filter(a => !a.analysis).length}개가 아직 AI 분석되지 않았습니다. 저장 시 역할 힌트는 배치에만 사용하며 사실 근거가 아닙니다.</p>}
      {sources.some(a => !a.visual?.suppressed) && <p className="text-sm text-zinc-600">긴 상세이미지에서 제품컷을 추출하면 더 나은 상세페이지를 만들 수 있습니다.</p>}
      {previous && view.stale && newDerived && <p role="status" className="text-sm text-amber-900">긴 상세이미지에서 새 제품컷이 추출되었습니다. 페이지 설계를 다시 생성하면 추출 이미지를 활용할 수 있습니다.</p>}
      {!!rawUses && <p className="text-sm text-zinc-600">추출 제품컷으로 대체할 수 없는 원본 상세이미지 {rawUses}개를 보조 이미지로 사용합니다.</p>}
      <Link href={`/projects/${view.projectId}/images`} className="text-link text-sm">이미지 추출·분석 확인 →</Link>
    </section>
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="panel p-6"><h2 className="font-semibold">사실 검증</h2><p className="mt-3 text-sm">{view.validationStatus === "ready" ? "최신 검증 사용" : "최신 검증 필요"}</p>
        <p className="mt-3 text-sm leading-6">지원됨 {counts.supported} / 근거 부족 {counts.insufficient}<br />충돌 {counts.conflict} / 검토 필요 {counts.needs_review}</p>
        <p className="mt-3 text-xs leading-5 text-zinc-500">supported는 입력 근거 범위의 일관성입니다. 외부 진위 증명이 아닙니다.</p></section>
      <section className="panel p-6"><h2 className="font-semibold">이미지 분석</h2><p className="mt-3 text-sm">{view.coverage.completed} / {view.assets.length}개 완료</p><p className="mt-3 text-xs leading-5 text-zinc-500">관찰 근거에는 완료된 분석만 사용합니다. 원본 이미지를 AI에 다시 전송하지 않습니다. 형식 오류 제외 {view.coverage.invalid}개.</p></section>
      <section className="panel p-6"><h2 className="font-semibold">상품 분석</h2><p className="mt-3 text-sm">{view.productAnalysisStatus === "ready" ? "최신 전략 · 사용 가능한 근거만 반영" : view.productAnalysisStatus === "stale" ? "오래된 전략 · 입력에서 제외" : "사용 가능한 전략 없음"}</p><p className="mt-3 text-xs leading-5 text-zinc-500">전략과 가설은 구조를 위한 참고이며 사실 근거가 아닙니다.</p><Link href={`/projects/${view.projectId}/analysis`} className="text-link mt-3 inline-block text-sm">상품 분석 확인 →</Link></section>
    </div>
    {!!view.factPolicy.restricted.length && <details className="panel p-6"><summary className="cursor-pointer text-sm font-semibold">주장에 사용하지 않는 Fact {view.factPolicy.restricted.length}개</summary>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-600">{view.factPolicy.restricted.map((fact) => <li key={fact.factId} className="break-words">{fact.label}: {fact.value} · {fact.status === "conflict" ? "충돌" : fact.status === "insufficient" ? "근거 부족" : "검토 필요"}</li>)}</ul></details>}
    <section className="panel p-6 sm:p-8"><h2 className="text-lg font-semibold">현재 Hero 후보</h2><p className="mt-2 text-xs leading-5 text-zinc-500">후보 {candidates.length}개 · Hero 선택은 이 Plan에만 적용되며 이미지 분류는 변경하지 않습니다.</p>
      {previewError && <p className="mt-3 text-sm text-amber-800">이미지 미리보기를 불러오지 못했습니다. 이미지 화면에서 확인해 주세요. 저장된 설계는 유지됩니다.</p>}
      {candidates.length ? <div className="mt-5 grid max-h-96 gap-5 overflow-y-auto sm:grid-cols-2 xl:grid-cols-4">{candidates.map((asset) => <div key={asset.assetId} className="min-w-0"><AssetThumbnail id={asset.assetId} previews={previews} /><p className="mt-2 text-xs text-zinc-500">{asset.visual?.kind === "derived" ? "추출 이미지" : "일반 원본"} · 배치 점수 {asset.visual?.heroScore ?? Math.round((asset.analysis?.heroSuitability ?? 0) * 100)}</p></div>)}</div> : <p className="mt-4 text-sm text-zinc-500">현재 조건을 충족하는 후보가 없습니다. 이미지 없이 설계할 수 있습니다.</p>}</section>
    {previous ? <PlanResult result={previous} previews={previews} stale={view.stale} /> : <section className="panel py-12 text-center text-sm text-zinc-500">아직 저장된 페이지 설계가 없습니다.</section>}
  </div>;
}

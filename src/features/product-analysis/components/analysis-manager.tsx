"use client";

import { useEffect, useRef, useState } from "react";
import { requestProductAnalysis } from "../client";
import { isProductAnalysisActive, isProductAnalysisStale } from "../schemas";
import { PRODUCT_ANALYSIS_ERRORS } from "../errors";
import type { ProductAnalysisView } from "../types";
import { StrategyResult } from "./strategy-result";

export function ProductAnalysisManager({ initialView }: { initialView: ProductAnalysisView }) {
  const [view, setView] = useState(initialView);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const active = isProductAnalysisActive(view.state, now);
  const stale = isProductAnalysisStale(view.state, view.inputFingerprint);
  const interrupted = view.state?.attempt.status === "analyzing" && !active;
  const previous = view.state?.latestResult;
  async function refresh() {
    if (locked.current) return;
    locked.current = true;
    try {
      const reply = await requestProductAnalysis(view.projectId, "GET");
      if (reply.ok) { setView(reply.view); setError(""); } else setError(reply.message);
      setNow(Date.now());
    } finally { locked.current = false; }
  }
  useEffect(() => {
    async function poll() {
      setNow(Date.now());
      if (locked.current || document.visibilityState !== "visible") return;
      locked.current = true;
      try {
        const reply = await requestProductAnalysis(initialView.projectId, "GET");
        if (reply.ok) setView(reply.view); else setError(reply.message);
      } finally { locked.current = false; }
    }
    const timer = window.setInterval(poll, active ? 5000 : 30000);
    document.addEventListener("visibilitychange", poll);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", poll); };
  }, [active, initialView.projectId]);
  async function analyze() {
    if (locked.current || active) return;
    locked.current = true; setBusy(true); setError("");
    try {
      const reply = await requestProductAnalysis(view.projectId, "POST");
      if (reply.ok) setView(reply.view); else setError(reply.message);
      // Failure can still have persisted an attempt; always read authoritative state.
      const latest = await requestProductAnalysis(view.projectId, "GET");
      if (latest.ok) setView(latest.view); else if (reply.ok) setError(latest.message);
      setNow(Date.now());
    } finally { locked.current = false; setBusy(false); }
  }
  const status = busy || active ? "분석 중" : interrupted ? "분석 중단 · 재시도 가능"
    : view.state?.attempt.status === "failed" ? "분석 실패" : stale ? "업데이트 필요" : previous ? "분석 완료" : "미분석";
  const facts = view.evidence.filter((item) => item.kind === "product_fact");
  return <div className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel min-w-0 p-6 sm:p-8"><h2 className="text-lg font-semibold">Product Facts 요약</h2>
        <p className="mt-2 text-xs leading-5 text-zinc-500">상품정보의 사실 근거입니다. 이번 AI 분석은 사실 검증을 수행하지 않습니다.</p>
        <dl className="mt-5 max-h-80 space-y-3 overflow-y-auto text-sm">{facts.map((fact) => <div key={fact.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
          <dt className="break-words text-zinc-500">{fact.label}</dt><dd className="break-words">{fact.value}</dd></div>)}</dl></section>
      <section className="panel p-6 sm:p-8"><h2 className="text-lg font-semibold">이미지 근거 분석 현황</h2>
        <p className="mt-5 text-2xl font-semibold">{view.coverage.completed} / {view.coverage.total} <span className="text-sm font-normal text-zinc-500">근거 대상 분석 완료</span></p>
        <p className="mt-3 text-xs text-zinc-500">미분석 추출 이미지는 배치 자료로 분리하므로 이 근거 집계에서 제외됩니다. 이미지 화면에서 별도로 분석할 수 있습니다.</p>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{view.coverage.total === 0 ? "분석 근거 대상 이미지가 없습니다. 상품정보만으로 분석하며 시각 근거는 없습니다."
          : view.coverage.completed === 0 ? "사용할 수 있는 완료된 이미지 분석이 없습니다. 시각 근거 없이 상품정보로 분석합니다."
            : `${view.coverage.total}개 이미지 중 ${view.coverage.completed}개의 분석 결과만 사용됩니다.`}</p>
        {view.coverage.invalid > 0 && <p className="mt-2 text-sm text-amber-800">형식을 확인할 수 없는 이미지 분석 {view.coverage.invalid}개는 제외했습니다.</p>}
        <p className="mt-3 text-xs leading-5 text-zinc-500">저장된 시각적 관찰을 사용합니다. 원본 이미지는 다시 전송하지 않습니다.</p></section>
    </div>
    <section className="panel p-6 sm:p-8" aria-busy={busy || active}>
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-lg font-semibold">AI 상품 분석</h2>
        <div className="flex flex-wrap gap-3"><button type="button" className="button-secondary" disabled={busy} onClick={refresh}>결과 새로고침</button>
          <button type="button" className="button-primary" disabled={busy || active} onClick={analyze}>{busy || active ? "분석 중…" : previous ? "상품 재분석" : "AI 상품 분석"}</button></div></div>
      <p className="mt-4 text-sm leading-6 text-zinc-600">AI 상품 분석은 입력된 상품정보와 이미지의 시각적 분석을 바탕으로 만든 전략적 해석입니다. 사실 검증 결과나 최종 광고 문구가 아닙니다.</p>
      <p role="status" className="mt-4 text-sm font-medium">상태: {status}</p>
      {stale && <p role="status" className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">상품정보 또는 이미지 분석 결과가 변경되었습니다. 상품 분석을 다시 실행하는 것을 권장합니다.</p>}
      {interrupted && <p className="mt-2 text-sm text-zinc-600">이전 분석이 중단되었을 수 있습니다. 저장 결과를 확인한 뒤 다시 실행해 주세요.</p>}
      {(error || view.state?.attempt.errorCode) && <p role="alert" className="mt-3 text-sm leading-6 text-red-700">{error || (view.state?.attempt.errorCode && PRODUCT_ANALYSIS_ERRORS[view.state.attempt.errorCode].message)}</p>}
      {previous && <p className="mt-3 text-xs text-zinc-500">{busy || view.state?.attempt.status !== "completed" ? "이전 성공 결과를 유지하고 있습니다. " : ""}
        마지막 성공: {new Date(previous.analyzedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>}
    </section>
    {previous ? <StrategyResult result={previous} /> : <section className="panel px-6 py-12 text-center text-sm text-zinc-500">아직 저장된 상품 분석 결과가 없습니다.</section>}
  </div>;
}

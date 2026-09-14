"use client";

import { useEffect, useRef, useState } from "react";
import { requestFactValidation } from "../client";
import { isValidationActive, isValidationStale } from "../schemas";
import { FACT_VALIDATION_ERRORS } from "../errors";
import type { ValidationView } from "../types";
import { ValidationResult } from "./validation-result";

export function ValidationManager({ initialView }: { initialView: ValidationView }) {
  const [view, setView] = useState(initialView);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const active = isValidationActive(view.state, now);
  const stale = isValidationStale(view.state, view.inputFingerprint);
  const interrupted = view.state?.attempt.status === "analyzing" && !active;
  const previous = view.state?.latestResult;
  async function refresh() {
    if (locked.current) return;
    locked.current = true;
    try {
      const reply = await requestFactValidation(view.projectId, "GET");
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
        const reply = await requestFactValidation(initialView.projectId, "GET");
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
      const reply = await requestFactValidation(view.projectId, "POST");
      if (reply.ok) setView(reply.view); else setError(reply.message);
      // Failure can still have persisted an attempt; always read authoritative state.
      const latest = await requestFactValidation(view.projectId, "GET");
      if (latest.ok) setView(latest.view); else if (reply.ok) setError(latest.message);
      setNow(Date.now());
    } finally { locked.current = false; setBusy(false); }
  }
  const status = busy || active ? "검증 중" : interrupted ? "검증 중단 · 재시도 가능"
    : view.state?.attempt.status === "failed" ? "검증 실패" : previous ? "검증 실행 완료" : "미검증";
  return <div className="space-y-6">
    <section className="panel p-6 sm:p-8" aria-busy={busy || active}>
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-lg font-semibold">Fact Validation</h2>
        <div className="flex flex-wrap gap-3"><button type="button" className="button-secondary" disabled={busy} onClick={refresh}>검증 결과 새로고침</button>
          <button type="button" className="button-primary" disabled={busy || active} onClick={analyze}>{busy || active ? "검증 중…" : previous ? "Fact 재검증" : "Fact 검증 실행"}</button></div></div>
      <p className="mt-4 text-sm leading-6 text-zinc-600">기존 Fact와 입력 근거의 일관성·충돌·근거 부족을 평가합니다. ‘검증 완료’는 입력된 근거 안에서 일관된다는 뜻이며, 외부 진위가 입증됐다는 뜻이 아닙니다.</p>
      <p className="mt-2 text-sm leading-6 text-zinc-600">AI가 Fact를 생성하거나 수정하지 않습니다. 충돌 또는 검토 필요 항목은 사람이 원본 자료를 확인해 주세요.</p>
      <p className="mt-3 text-xs text-zinc-500">완료된 이미지 관찰 {view.coverage.completed} / {view.coverage.total}개 사용 · 시각 관찰과 과거 분석은 사실 자체가 아닙니다.</p>
      <p role="status" className="mt-4 text-sm font-medium">상태: {status}</p>
      {stale && <p role="status" className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">stale · Facts 또는 근거가 변경되었습니다. 아래 결과는 이전 입력의 검증입니다. 현재 값을 확인하고 재검증해 주세요.</p>}
      {interrupted && <p className="mt-2 text-sm text-zinc-600">이전 요청이 중단되었을 수 있습니다. 결과 확인 후 다시 실행할 수 있습니다.</p>}
      {(error || view.state?.attempt.errorCode) && <p role="alert" className="mt-3 text-sm leading-6 text-red-700">{error || (view.state?.attempt.errorCode && FACT_VALIDATION_ERRORS[view.state.attempt.errorCode].message)}</p>}
      {previous && <p className="mt-3 text-xs text-zinc-500">{busy || view.state?.attempt.status !== "completed" ? "이전 성공 결과를 유지하고 있습니다. " : ""}
        마지막 검증: {new Date(previous.validatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>}
    </section>
    <section className="panel p-6 sm:p-8"><h2 className="text-lg font-semibold">현재 Product Facts</h2>
      <p className="mt-2 text-xs leading-5 text-zinc-500">저장된 현재 값입니다. 이전 검증 결과와 구분해 확인하세요.</p>
      <dl className="mt-5 space-y-3 text-sm">{view.targets.map((fact) => <div key={fact.factId} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
        <dt className="whitespace-pre-wrap break-words text-zinc-500">{fact.label}</dt><dd className="whitespace-pre-wrap break-words">{fact.value}</dd></div>)}</dl>
      <ul className="mt-5 list-disc space-y-2 pl-5 text-xs leading-5 text-zinc-500">{view.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
    </section>
    {previous ? <ValidationResult result={previous} stale={stale} /> : <section className="panel px-6 py-12 text-center text-sm text-zinc-500">아직 저장된 Fact 검증 결과가 없습니다.</section>}
  </div>;
}

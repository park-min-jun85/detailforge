"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { OPTION_FRESHNESS_LABELS, type ConfirmedOptions, type OptionFreshness } from "@/features/product-options/section-snapshot";
import type { OptionComparison } from "../option-application";
import { editorSectionSchema, type EditorSection } from "../schemas";

function Groups({ groups }: { groups: ConfirmedOptions["groups"] }) {
  return <div className="space-y-3">{groups.map(group => <div key={group.id}><h4 className="font-medium">{group.name}</h4><ul className="mt-2 list-disc space-y-2 pl-5">{group.values.map(value => <li className="break-words [overflow-wrap:anywhere]" key={value.id}>{value.label}</li>)}</ul></div>)}</div>;
}
export function OptionInspector({ projectId, section, disabled, hasUnsaved, openRequest, onOpen, onBusy, onPlanStale, onSaved }: {
  projectId: string; section: EditorSection; disabled: boolean; hasUnsaved: boolean; openRequest: number; onOpen: () => void;
  onBusy: (busy: boolean) => void; onPlanStale: (stale: boolean) => void; onSaved: (row: EditorSection, message: string) => void;
}) {
  const [status, setStatus] = useState<OptionFreshness>("unavailable"), [comparison, setComparison] = useState<OptionComparison | null>(null);
  const [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const handledOpen = useRef(0);
  const endpoint = `/api/projects/${projectId}/sections/${section.id}/options`;
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try { const response = await fetch(endpoint, { cache: "no-store" }), body = await response.json();
        if (alive) { setStatus(response.ok && body.ok ? body.data.freshness : "unavailable"); if (response.ok && body.ok) onPlanStale(body.data.planStale); } }
      catch { if (alive) setStatus("unavailable"); }
    };
    void refresh(); window.addEventListener("focus", refresh);
    return () => { alive = false; window.removeEventListener("focus", refresh); };
  }, [endpoint, section.updated_at, onPlanStale]);
  useEffect(() => {
    if (!openRequest) { handledOpen.current = 0; return; }
    if (handledOpen.current === openRequest) return;
    handledOpen.current = openRequest;
    let alive = true;
    async function open() {
      try {
        const response = await fetch(endpoint, { cache: "no-store" }), body = await response.json();
        if (!alive) return;
        if (!response.ok || !body.ok) { setError(body.message ?? "옵션 비교를 불러오지 못했습니다."); return; }
        if (body.data.section.updated_at !== section.updated_at) { setError("Section이 변경되었습니다. 최신 섹션을 다시 불러와 주세요."); return; }
        onPlanStale(body.data.planStale); setStatus(body.data.freshness); setComparison(body.data); setError("");
      } catch { if (alive) setError("옵션 비교를 불러오지 못했습니다. 기존 내용은 유지됩니다."); }
    }
    void open(); return () => { alive = false; };
  }, [endpoint, openRequest, section.updated_at, onPlanStale]);
  if (section.content.type !== "option") return null;
  const groups = section.content.optionSnapshot?.confirmed.groups;
  async function apply() {
    const current = comparison?.current;
    if (!current?.rowId || loading || disabled || hasUnsaved) return;
    setLoading(true); onBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        revision: comparison!.section.updated_at, productId: current.productId, rowId: current.rowId,
        expectedVersion: current.version, expectedFingerprint: current.fingerprint, confirmEmpty: current.state === "empty",
      }) }), body = await response.json();
      if (!response.ok || !body.ok) { setError(body.message ?? "반영하지 못했습니다. 최신 옵션과 Section을 다시 확인해 주세요."); return; }
      const row = editorSectionSchema.parse(body.data.section); setComparison(null); setStatus(body.data.freshness);
      onSaved(row, body.data.sourceChangedDuringSave ? "옵션 snapshot은 저장됐지만 저장 중 원본이 변경되었거나 확인되지 않았습니다. 최신 상태를 다시 확인해 주세요." : "선택한 섹션에 확정 옵션을 반영했습니다.");
    } catch { setError("저장 결과를 확인하지 못했습니다. 다시 반영하기 전에 최신 섹션을 확인해 주세요."); }
    finally { setLoading(false); onBusy(false); }
  }
  return <section className="mb-6 space-y-4 rounded border border-zinc-200 p-4 text-sm" aria-label="확정 옵션 연결">
    <h3 className="font-semibold">반영된 옵션 · 읽기 전용</h3>
    {groups ? groups.length ? <Groups groups={groups} /> : <p>옵션 표시가 비어 있습니다.</p> : <p>이전 형식의 옵션입니다. 아래 기존 값은 유지됩니다.</p>}
    <p role="status" className="leading-6 text-amber-900">{OPTION_FRESHNESS_LABELS[status]}</p>
    <p className="text-xs leading-5 text-zinc-500">사용자가 확인한 선택값입니다. 실시간 판매 가능 여부나 재고를 보장하지 않습니다.</p>
    <Link className="text-link block" href={`/projects/${projectId}#product-options-title`}>상품 옵션 수정</Link>
    <button type="button" className="button-secondary" disabled={disabled || loading} onClick={onOpen}>최신 옵션 반영</button>
    {comparison && <section role="group" aria-label="옵션 변경 비교" className="space-y-4 border-t pt-4">
      <h4 className="font-semibold">현재 Section 값</h4>
      {groups ? <Groups groups={groups} /> : <ul>{section.content.items?.map((row, index) => <li key={index}>{row.label}: {row.value}</li>)}</ul>}
      <h4 className="font-semibold">최신 확정 옵션</h4>
      {comparison.current?.state === "present" && <Groups groups={comparison.current.groups} />}
      {comparison.current?.state === "empty" && <p className="font-semibold text-amber-900">이 섹션의 옵션 표시를 비웁니다.</p>}
      {(!comparison.current || comparison.current.state === "missing") && <p>확정 옵션을 확인할 수 없어 반영할 수 없습니다.</p>}
      {hasUnsaved && <p className="text-amber-900">비교 중 편집 내용이 변경되었습니다. 취소 후 최신 옵션 반영을 다시 눌러 저장 여부를 선택해 주세요.</p>}
      <div className="flex flex-wrap gap-2"><button type="button" className="button-primary" disabled={disabled || hasUnsaved || loading || !comparison.current?.rowId} onClick={apply}>반영 확인</button>
        <button type="button" className="button-secondary" disabled={loading} onClick={() => { setComparison(null); setError(""); }}>취소</button></div>
    </section>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </section>;
}

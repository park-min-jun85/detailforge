"use client";
import { useRef, useState } from "react";
import { candidateStatusLabels, domemeProductNumber, type OptionPreview } from "../import-contract";
import { requestOptionApply, requestOptionImport } from "../client";
import type { OptionGroups, OptionView } from "../schemas";

export function OptionImportPanel({ projectId, saved, sourceUrl, disabled, dirty, onBusy, onApply }: {
  projectId: string; saved: OptionView; sourceUrl: string | null; disabled: boolean; dirty: boolean;
  onBusy: (busy: boolean) => void; onApply: (options: OptionGroups, token: string) => void;
}) {
  const [preview, setPreview] = useState<OptionPreview | null>(null), [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), productNo = domemeProductNumber(sourceUrl);
  const run = async (apply: boolean) => {
    if (lock.current || disabled || !saved.productId) return;
    if (apply && dirty && !window.confirm("저장하지 않은 옵션 변경을 버리고, 저장된 옵션을 기준으로 후보를 반영할까요? 취소하면 현재 입력을 유지합니다. 먼저 옵션을 저장할 수도 있습니다.")) return;
    lock.current = true; setBusy(true); onBusy(true); setError("");
    try {
      if (apply) {
        if (!preview?.token) return;
        const result = await requestOptionApply(projectId, { productId: saved.productId, expectedVersion: saved.version, token: preview.token, selectedIds: selected });
        if (!result.ok) { setError(result.message); return; }
        onApply(result.data.options, result.data.importToken); setPreview(null);
      } else {
        // Clear stale actionable candidate on a new failed lookup; the editor remains untouched.
        setPreview(null);
        const result = await requestOptionImport(projectId, { productId: saved.productId, expectedVersion: saved.version });
        if (!result.ok) { setError(result.message); return; }
        setPreview(result.data);
        setSelected(saved.options.groups.length === 0 ? result.data.additions.filter(item => item.action === "add").map(item => item.id) : []);
      }
    } finally { lock.current = false; setBusy(false); onBusy(false); }
  };
  return <div className="mt-5 space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
    <h3 className="text-sm font-semibold">도매매 옵션 가져오기</h3>
    <p className="break-all text-xs leading-5 text-zinc-600">저장된 원본 URL: {sourceUrl || "없음"}{productNo ? ` · 상품번호 ${productNo}` : ""}</p>
    <p className="text-xs leading-5 text-zinc-500">상품정보 폼의 미저장 URL은 사용하지 않습니다. 불러오기 → 후보 확인 → 입력란 반영 → 별도 옵션 저장 순서입니다. 실시간 재고 동기화가 아닙니다.</p>
    {!productNo && <p className="text-sm text-zinc-600">상품정보에 도매매 원본 URL을 먼저 확인·저장해 주세요.</p>}
    <button type="button" className="button-secondary" disabled={disabled || busy || !saved.productId || !productNo} onClick={() => void run(false)}>{busy ? "처리 중…" : "도매매 옵션 불러오기"}</button>
    {busy && <p role="status" className="text-sm">옵션 요청을 처리하고 있습니다.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {preview && <div className="space-y-4 border-t border-zinc-200 pt-4" aria-label="도매매 옵션 후보">
      <p role="status" className="text-sm font-semibold">{candidateStatusLabels[preview.status]}</p>
      <p className="text-xs text-zinc-500">상품 {preview.productNo} · 조회 {new Date(preview.fetchedAt).toLocaleString("ko-KR")} · 후보 유효기간 20분</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <div><h4 className="text-xs font-semibold">이전 공급처 원본</h4>{preview.previous?.map(group => <p key={group.name} className="mt-2 break-words text-sm">{group.name}: {group.values.join(", ")}</p>) ?? <p className="mt-2 text-sm text-zinc-500">이전 가져오기 출처 없음</p>}</div>
        <div><h4 className="text-xs font-semibold">현재 저장된 옵션</h4>{preview.current.groups.length ? preview.current.groups.map(group => <p key={group.id} className="mt-2 break-words text-sm">{group.name}: {group.values.map(value => value.label).join(", ")}</p>) : <p className="mt-2 text-sm text-zinc-500">저장된 옵션 없음</p>}</div>
        <div><h4 className="text-xs font-semibold">새 공급처 후보</h4>{preview.groups?.map(group => <p key={group.name} className="mt-2 break-words text-sm">{group.name}: {group.values.join(", ")}</p>) ?? <p className="mt-2 text-sm text-zinc-500">확인 가능한 옵션 원문 없음</p>}</div>
      </div>
      {preview.notes.map((note, index) => <p key={index} className="text-xs leading-5 text-zinc-600">{note}</p>)}
      {preview.additions.map(item => <div key={item.id} className="text-sm">
        {item.action === "add" ? <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" disabled={busy || disabled} checked={selected.includes(item.id)} onChange={event => setSelected(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} /><span>{item.groupName} / {item.label} — 새 값 추가</span></label>
          : <p>{item.groupName} / {item.label} — {item.detail}</p>}
      </div>)}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="button-secondary" disabled={busy || disabled} onClick={() => { setPreview(null); setError(""); }}>후보 닫기</button>
        {preview.status === "simple_groups" && preview.token && <button type="button" className="button-primary" disabled={busy || disabled || preview.expectedVersion !== saved.version} onClick={() => void run(true)}>옵션 입력란에 반영</button>}
      </div>
      <p className="text-xs text-zinc-500">반영해도 저장되지 않습니다. 기존 표시값·순서·사용자 추가·삭제를 유지합니다. 제한되거나 모호한 항목은 자동 추가하지 않습니다.</p>
    </div>}
  </div>;
}

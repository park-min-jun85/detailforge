"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_GROUP_VALUES, MAX_OPTION_GROUPS, MAX_OPTION_VALUES, emptyOptionView, isOptionPlaceholder, type OptionGroup, type OptionView } from "../schemas";
import { requestOptions } from "../client";

export function OptionsManager({ projectId, initialView, initialError }: { projectId: string; initialView: OptionView | null; initialError?: string }) {
  const [saved, setSaved] = useState(initialView ?? emptyOptionView(null));
  const [groups, setGroups] = useState(initialView?.options.groups ?? []);
  const [busy, setBusy] = useState(false), [error, setError] = useState(initialError ?? ""), [message, setMessage] = useState("");
  const locked = useRef(false);
  const dirty = JSON.stringify(groups) !== JSON.stringify(saved.options.groups);
  const totalValues = groups.reduce((sum, group) => sum + group.values.length, 0);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const change = (next: OptionGroup[]) => { setGroups(next); setMessage(""); setError(""); };
  const updateGroup = (id: string, update: (group: OptionGroup) => OptionGroup) => change(groups.map(group => group.id === id ? update(group) : group));
  const perform = async (save: boolean) => {
    if (locked.current || (save && !saved.productId)) return;
    if (!save && dirty && !window.confirm("저장하지 않은 옵션 변경을 버리고 최신 옵션을 불러올까요?")) return;
    locked.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const result = await requestOptions(projectId, save ? { productId: saved.productId!, expectedVersion: saved.version, options: { schemaVersion: 1, groups } } : undefined);
      if (!result.ok) { setError(result.message); return; }
      setSaved(result.data); setGroups(result.data.options.groups);
      setMessage(save ? "옵션을 저장했습니다." : "최신 옵션을 불러왔습니다.");
    } finally { locked.current = false; setBusy(false); }
  };
  return <section aria-labelledby="product-options-title" className="panel p-6 sm:p-8">
    <h2 id="product-options-title" className="text-lg font-semibold">상품 옵션</h2>
    <p className="mt-2 text-sm leading-6 text-zinc-500">색상·사이즈 등 구매자가 선택할 값을 입력하세요. 상품정보·스펙과 별도로 저장되며 사실정보에 추가되지 않습니다.</p>
    <p className="mt-1 text-xs leading-5 text-zinc-500">최대 10개 그룹 · 그룹당 30개 값 · 전체 100개 값. 빈 입력과 참조 안내문은 제외하며 각 그룹에는 실제 선택값이 필요합니다.</p>
    {!saved.productId && <p className="mt-5 text-sm text-zinc-600">먼저 상품정보를 저장해 주세요. 저장 후 최신 옵션을 불러오면 입력할 수 있습니다.</p>}
    <form className="mt-6 space-y-5" aria-busy={busy} onSubmit={event => { event.preventDefault(); void perform(true); }}>
      <fieldset disabled={busy || !saved.productId} className="space-y-5">
        <legend className="sr-only">상품 옵션 편집</legend>
        {groups.length === 0 && saved.productId && <p className="text-sm text-zinc-500">등록된 옵션이 없습니다. 필요한 옵션 그룹을 추가하세요.</p>}
        {groups.map((group, groupIndex) => <div key={group.id} className="space-y-4 rounded-lg border border-zinc-200 p-4 sm:p-5">
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1"><label htmlFor={`option-group-${group.id}`} className="text-sm font-medium">옵션 그룹 {groupIndex + 1} 이름</label>
              <input id={`option-group-${group.id}`} className="product-input" maxLength={100} value={group.name} placeholder="예: 색상"
                onChange={event => updateGroup(group.id, current => ({ ...current, name: event.target.value }))} /></div>
            <button type="button" className="button-secondary shrink-0" aria-label={`옵션 그룹 ${groupIndex + 1} 삭제`} onClick={() => change(groups.filter(item => item.id !== group.id))}>그룹 삭제</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.values.map((value, valueIndex) => <div key={value.id}>
              <label htmlFor={`option-value-${value.id}`} className="text-xs font-medium text-zinc-600">그룹 {groupIndex + 1} 값 {valueIndex + 1}</label>
              <div className="flex items-center gap-2"><input id={`option-value-${value.id}`} maxLength={200} className="product-input min-w-0" value={value.label}
                aria-describedby={value.label.trim() && isOptionPlaceholder(value.label) ? `option-hint-${value.id}` : undefined}
                onChange={event => updateGroup(group.id, current => ({ ...current, values: current.values.map(item => item.id === value.id ? { ...item, label: event.target.value } : item) }))} />
                <button type="button" className="button-secondary shrink-0" aria-label={`그룹 ${groupIndex + 1} 값 ${valueIndex + 1} 삭제`}
                  onClick={() => updateGroup(group.id, current => ({ ...current, values: current.values.filter(item => item.id !== value.id) }))}>삭제</button></div>
              {value.label.trim() && isOptionPlaceholder(value.label) && <p id={`option-hint-${value.id}`} className="mt-1 text-xs text-zinc-500">원문에 보존되며 확정 옵션에서는 제외됩니다.</p>}
            </div>)}
          </div>
          {group.values.length === 0 && <p className="text-sm text-zinc-600">선택값을 추가하거나 이 그룹을 삭제해 주세요.</p>}
          <button type="button" className="button-secondary" aria-label={`그룹 ${groupIndex + 1} 옵션 값 추가`} disabled={group.values.length >= MAX_GROUP_VALUES || totalValues >= MAX_OPTION_VALUES}
            onClick={() => updateGroup(group.id, current => ({ ...current, values: [...current.values, { id: crypto.randomUUID(), label: "" }] }))}>+ 옵션 값 추가</button>
        </div>)}
        <button type="button" className="button-secondary" disabled={groups.length >= MAX_OPTION_GROUPS || totalValues >= MAX_OPTION_VALUES}
          onClick={() => change([...groups, { id: crypto.randomUUID(), name: "", values: [{ id: crypto.randomUUID(), label: "" }] }])}>+ 옵션 그룹 추가</button>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-5">
        <button type="submit" className="button-primary" disabled={busy || !saved.productId || !dirty}>{busy ? "처리 중…" : "옵션 저장"}</button>
        <button type="button" className="button-secondary" disabled={busy} onClick={() => void perform(false)}>최신 옵션 불러오기</button>
        <button type="button" className="button-secondary" disabled={busy || !dirty} onClick={() => change(saved.options.groups)}>옵션 변경 취소</button>
        <span className="text-xs text-zinc-500">{dirty ? "저장하지 않은 옵션 변경이 있습니다." : "옵션 변경 없음"}</span>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
    </form>
  </section>;
}

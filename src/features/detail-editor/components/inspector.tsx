import Image from "next/image";
import { textFields } from "../fields";
import type { EditDraft, EditorSection } from "../schemas";
import type { EditorAsset } from "../types";
const options = {
  layout: { centered: "중앙 구성", split: "좌우 분할", imageFirst: "이미지 먼저", textFirst: "본문 먼저", grid: "이미지 격자", stack: "세로 구성" },
  textAlign: { left: "왼쪽", center: "가운데" }, density: { compact: "촘촘하게", normal: "기본", spacious: "여유롭게" },
  background: { plain: "흰색", soft: "연한 회색", contrast: "짙은 회색" }, emphasis: { normal: "기본", strong: "강조" }, imageFit: { contain: "전체 보이기", cover: "영역 채우기" },
};
const labels = { layout: "레이아웃", textAlign: "텍스트 정렬", density: "여백", background: "배경", emphasis: "제목 강조", imageFit: "이미지 맞춤" };
export function Inspector({ section, draft, assets, disabled, onChange }: { section: EditorSection; draft: EditDraft; assets: EditorAsset[]; disabled: boolean; onChange: (draft: EditDraft) => void }) {
  const content = section.content;
  const rows = content.type === "specification" ? content.rows : content.type === "option" ? content.items : [];
  const manuallyChanged = textFields(content).some(field => draft.fields[field.path] !== field.value) || content.meta.groundingStatus === "needs_review";
  return <div className="space-y-6">
    {manuallyChanged && <p role="status" className="rounded bg-amber-50 p-3 text-sm leading-6 text-amber-900">직접 수정한 문구입니다. 사실 표현을 한 번 확인해 주세요.</p>}
    <fieldset disabled={disabled} className="space-y-4"><legend className="mb-4 text-sm font-semibold">문구</legend>
      {textFields(content).map(field => <label key={field.path} className="block text-sm font-medium">{field.label}
        {field.multiline ? <textarea className="product-input min-h-28 resize-y" value={draft.fields[field.path] ?? ""} maxLength={field.max} onChange={event => onChange({ ...draft, fields: { ...draft.fields, [field.path]: field.nullable && !event.target.value ? null : event.target.value } })} />
          : <input className="product-input" value={draft.fields[field.path] ?? ""} maxLength={field.max} onChange={event => onChange({ ...draft, fields: { ...draft.fields, [field.path]: field.nullable && !event.target.value ? null : event.target.value } })} />}
        <span className="mt-1 block text-right text-xs font-normal text-zinc-500">{draft.fields[field.path]?.length ?? 0} / {field.max}</span>
      </label>)}
    </fieldset>
    {(content.type === "specification" || content.type === "option") && <section className="space-y-3 text-sm"><h3 className="font-semibold">사실값 · 읽기 전용</h3>
      <p className="text-xs leading-5 text-zinc-500">원본 Fact에서 가져온 값입니다. 입력 근거의 일관성을 뜻하며 외부 진위 증명은 아닙니다.</p>
      <dl>{rows.map((row, i) => <div key={i} className="border-b border-zinc-200 py-3"><dt className="font-medium">{row.label}</dt><dd className="mt-1 break-words text-zinc-600">{row.value}</dd></div>)}</dl>
      {!rows.length && <p className="text-zinc-500">등록된 사실값이 없습니다.</p>}</section>}
    <fieldset disabled={disabled} className="space-y-3 border-t border-zinc-200 pt-4"><legend className="pr-2 text-sm font-semibold">스타일</legend>
      {(Object.keys(options) as (keyof typeof options)[]).map(key => <label key={key} className="block text-sm">{labels[key]}<select className="product-input" value={draft.style[key]} onChange={event => onChange({ ...draft, style: { ...draft.style, [key]: event.target.value } })}>
        {Object.entries(options[key]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}
    </fieldset>
    <fieldset disabled={disabled} className="space-y-3 border-t border-zinc-200 pt-4"><legend className="pr-2 text-sm font-semibold">상품 이미지 · 최대 8개</legend>
      <p className="text-xs leading-5 text-zinc-500">이미지 선택은 이 Section에만 적용됩니다. 새 이미지는 이미지 화면에서 등록하세요.</p>
      {assets.map(asset => <label key={asset.id} className="flex min-w-0 items-center gap-3 rounded border border-zinc-200 p-2 text-sm">
        <input type="checkbox" className="size-4 shrink-0 accent-zinc-800" checked={draft.assetIds.includes(asset.id)} disabled={disabled || (!draft.assetIds.includes(asset.id) && draft.assetIds.length >= 8)}
          onChange={event => onChange({ ...draft, assetIds: event.target.checked ? [...draft.assetIds, asset.id] : draft.assetIds.filter(id => id !== asset.id) })} />
        {asset.previewUrl && <Image className="size-12 shrink-0 rounded object-contain" src={asset.previewUrl} alt="" width={48} height={48} unoptimized />}
        <span className="min-w-0 break-all">{asset.name}</span></label>)}
      {!assets.length && <p className="text-sm text-zinc-500">등록된 이미지가 없습니다.</p>}
      {draft.assetIds.filter(id => !assets.some(asset => asset.id === id)).map(id => <label key={id} className="flex gap-2 text-sm"><input type="checkbox" checked onChange={() => onChange({ ...draft, assetIds: draft.assetIds.filter(value => value !== id) })} />삭제된 이미지 연결 해제</label>)}
      {content.meta.manualEdit?.assetsEdited && <p className="text-xs text-zinc-500">사람이 이미지 선택을 수정했습니다.</p>}
    </fieldset>
    <details className="border-t border-zinc-200 pt-4 text-xs leading-6 text-zinc-500"><summary className="cursor-pointer text-sm font-medium text-zinc-700">생성 근거 · 읽기 전용</summary>
      <dl className="mt-3 space-y-2 break-all"><div><dt>근거 ID (생성 당시)</dt><dd>{content.evidenceIds.join(", ") || "없음"}</dd></div>
        <div><dt>Planner key</dt><dd>{content.plannerKey}</dd></div><div><dt>Plan fingerprint</dt><dd>{content.meta.sourcePlanFingerprint}</dd></div>
        <div><dt>Provider / model</dt><dd>{content.meta.provider} / {content.meta.model}</dd></div><div><dt>Generation ID</dt><dd>{content.meta.generationId}</dd></div>
        {content.meta.manualEdit && <div><dt>마지막 수동 문구·이미지 수정</dt><dd>{content.meta.manualEdit.editedAt}</dd></div>}</dl>
      <p className="mt-3">기존 근거 ID가 수정된 문구를 자동으로 보증하지 않습니다.</p></details>
  </div>;
}

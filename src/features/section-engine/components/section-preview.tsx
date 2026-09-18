import type { AssetPreview } from "@/features/assets/types";
import { AssetThumbnail } from "@/features/page-planner/components/plan-result";
import { storedContentSchema, sectionStyleSchema, type SectionRow, type GeneratedSection } from "../schemas";
function Copy({ content }: { content: GeneratedSection }) {
  if (content.type === "option" && content.optionSnapshot) return <div className="space-y-4"><h3>{content.title}</h3>{content.optionSnapshot.confirmed.groups.map(group => <div key={group.id}><h4>{group.name}</h4><ul>{group.values.map(value => <li key={value.id}>{value.label}</li>)}</ul></div>)}</div>;
  const points = content.type === "hero" ? content.highlights : content.type === "feature" ? content.bullets : content.type === "detail" ? content.points : content.type === "notice" ? content.items : [];
  return <div className="space-y-4 break-words text-sm leading-7 text-zinc-700">
    {content.type === "hero" ? <><p className="text-xl font-semibold text-zinc-900">{content.headline}</p>{content.subheadline && <p>{content.subheadline}</p>}</> : content.title && <p className="text-lg font-semibold text-zinc-900">{content.title}</p>}
    {"body" in content && <p className="whitespace-pre-wrap">{content.body}</p>}
    {"intro" in content && content.intro && <p>{content.intro}</p>}
    {!!points.length && <ul className="list-disc space-y-2 pl-5">{points.map((point, index) => <li key={index}>{point.text}<span className="ml-2 text-xs text-zinc-500">{point.evidenceIds.join(", ")}</span></li>)}</ul>}
    {(content.type === "keyBenefits" || content.type === "useCase") && <ul className="space-y-4">{content.items.map((item, index) => <li key={index} className="rounded border border-zinc-200 p-4">
      <p className="font-semibold">{item.title}</p><p>{item.description}</p><p className="text-xs text-zinc-500">{item.evidenceIds.join(", ")}{"confidence" in item ? ` · 가설 신뢰도 ${Math.round(Number(item.confidence) * 100)}% · 사실 확정 아님` : ""}</p></li>)}</ul>}
    {(content.type === "specification" || content.type === "option") && <dl className="divide-y divide-zinc-200">{(content.type === "specification" ? content.rows : content.items ?? []).map((row, index) => <div key={index} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"><dt className="font-medium">{row.label}</dt><dd>{row.value}<span className="ml-2 text-xs text-zinc-500">{row.evidenceIds.join(", ")}</span></dd></div>)}</dl>}
    {content.type === "option" && !content.optionSnapshot && !content.items?.length && <p className="text-amber-800">지원되는 옵션 근거가 없어 항목을 생성하지 않았습니다.</p>}
  </div>;
}
export function SectionPreview({ rows, previews }: { rows: SectionRow[]; previews: AssetPreview[] }) {
  return <ol className="space-y-5" aria-label="생성된 Section 콘텐츠">{rows.map((row, index) => {
    const parsed = storedContentSchema.safeParse(row.content), style = sectionStyleSchema.safeParse(row.style);
    return <li key={row.id} className="panel min-w-0 space-y-5 p-6 sm:p-8">
      <h2 className="text-sm font-semibold text-zinc-500">Section {index + 1} · {row.type}</h2>
      {parsed.success && parsed.data.type === row.type ? <><Copy content={parsed.data} />
        {!!parsed.data.assetIds.length && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{parsed.data.assetIds.map(id => <AssetThumbnail key={id} id={id} previews={previews} />)}</div>}
        <p className="text-xs leading-5 text-zinc-500">사용 근거: {parsed.data.evidenceIds.join(", ") || "상품 사실 주장 없음"} · F: 지원된 Fact / V: 시각 관찰</p>
        <details className="text-xs leading-6 text-zinc-500"><summary className="cursor-pointer">생성 출처와 표현 설정</summary><p className="mt-2 break-all">Plan key: {parsed.data.meta.plannerKey}<br />생성: {new Date(parsed.data.meta.generatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}<br />{style.success ? `${style.data.layout} · ${style.data.textAlign} · ${style.data.density} · ${style.data.background} · ${style.data.emphasis} · ${style.data.imageFit}` : "표현 설정 형식을 확인해 주세요."}</p></details>
      </> : <p className="text-sm text-amber-800">기존 콘텐츠가 현재 생성 스키마와 다릅니다. 원본을 보존하고 있으며 전체 다시 생성할 수 있습니다.</p>}
    </li>;
  })}</ol>;
}

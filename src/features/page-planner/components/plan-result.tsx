import Image from "next/image";
import { QUALITY_LABELS } from "@/features/page-quality/policy";
import type { AssetPreview } from "@/features/assets/types";
import type { LatestPlan } from "../schemas";
export const WARNING_LABELS: Record<string, string> = {
  ...QUALITY_LABELS,
  insufficient_content_evidence: "근거가 부족하여 8개 미만의 Section으로 구성했습니다.",
  no_suitable_hero: "적합한 Hero 이미지가 선택되지 않았습니다.", restricted_facts_excluded: "확정적 주장에 사용할 수 없는 Fact를 제외했습니다.",
  product_strategy_unavailable: "사용 가능한 최신 상품 전략이 없어 제외했습니다.", partial_asset_analysis: "완료된 이미지 관찰만 사용했습니다.",
  visual_observations_not_facts: "시각 관찰은 상품 사실의 증명이 아닙니다.",
};
export function AssetThumbnail({ id, previews }: { id: string; previews: AssetPreview[] }) {
  const item = previews.find((item) => item.asset.id === id);
  return <figure className="min-w-0 space-y-2">
    {item?.previewUrl ? <Image src={item.previewUrl} width={240} height={180} unoptimized alt={item.asset.originalFilename}
      className="h-36 w-full rounded border border-zinc-200 bg-zinc-50 object-contain" /> : <div className="flex h-36 items-center justify-center rounded border border-zinc-200 bg-zinc-50 p-4 text-center text-xs text-zinc-500">현재 미리보기를 사용할 수 없습니다.</div>}
    <figcaption className="break-all text-xs leading-5 text-zinc-500">{item?.asset.originalFilename ?? `이미지 ${id}`}</figcaption>
  </figure>;
}
export function PlanResult({ result, previews, stale }: { result: LatestPlan; previews: AssetPreview[]; stale: boolean }) {
  const registry = new Map(result.evidenceSnapshot.map((item) => [item.id, item]));
  return <section className="space-y-5" aria-label="저장된 페이지 설계">
    <div className="panel grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="min-w-0"><h2 className="text-lg font-semibold">{stale ? "이전 입력의 페이지 설계" : "페이지 Narrative"}</h2>
        <p className="mt-4 whitespace-pre-wrap break-words font-medium leading-7">{result.plan.narrative.strategy}</p>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-600">{result.plan.narrative.rationale}</p>
        <p className="mt-5 text-xs leading-5 text-zinc-500">Section Engine에 전달할 설계도입니다. 실제 Section이나 최종 광고 문구는 아직 생성하지 않았습니다.</p></div>
      <div className="min-w-0"><h3 className="mb-3 text-sm font-semibold">Plan에서 선택한 Hero</h3>
        {result.plan.heroAssetId ? <AssetThumbnail id={result.plan.heroAssetId} previews={previews} /> : <p className="text-sm text-zinc-500">선택한 이미지 없음</p>}
        <p className="mt-3 break-words text-xs leading-5 text-zinc-600">{result.plan.heroRationale}</p></div>
    </div>
    {!!result.plan.warnings.length && <aside className="panel p-6" aria-label="설계 주의사항"><ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600">{result.plan.warnings.map((warning) => <li key={warning}>{WARNING_LABELS[warning]}</li>)}</ul></aside>}
    <h2 className="text-lg font-semibold">Section 구성 · {result.plan.sections.length}개</h2>
    <ol className="space-y-4">{result.plan.sections.map((section, index) => <li key={section.key} className="panel min-w-0 p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3"><span className="text-sm font-semibold text-zinc-400">{String(index + 1).padStart(2, "0")}</span>
        <h3 className="text-base font-semibold">{section.type}</h3><span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600">{section.priority === "primary" ? "핵심" : section.priority === "secondary" ? "보조" : "참고"}</span></div>
      <p className="mt-4 whitespace-pre-wrap break-words font-medium leading-6">{section.purpose}</p>
      <p className="mt-3 text-xs font-medium text-zinc-500">콘텐츠 제작 지침</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700">{section.contentBrief}</p>
      <ul className="mt-4 space-y-2 text-xs leading-5 text-zinc-600">{section.evidenceIds.map((id) => {
        const item = registry.get(id);
        return <li key={id} className="break-words">{item?.kind === "supported_fact" ? `지원된 Fact · ${item.label}: ${item.value}` : "시각 관찰 · 사실 근거 아님"} ({id})</li>;
      })}</ul>
      {!section.evidenceIds.length && <p className="mt-3 text-xs text-zinc-500">상품 주장 없이 정보 부족을 안내하는 구조입니다.</p>}
      {!!section.assetIds.length && <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{section.assetIds.map((id) => <AssetThumbnail key={id} id={id} previews={previews} />)}</div>}
    </li>)}</ol>
  </section>;
}

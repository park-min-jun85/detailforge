import type { GeneratedSection } from "@/features/section-engine/schemas";
import type { RenderAsset } from "@/features/detail-renderer/model";
import { copyQuality, visualMetrics, QUALITY_LABELS, type QualityWarning } from "./policy";
import { imageSizing } from "./images";
export function QualitySummary({sections,assets,additionalWarnings=[]}:{sections:{content:GeneratedSection}[];assets:RenderAsset[];additionalWarnings?:QualityWarning[]}) {
  const copy=sections.map(s=>s.content), metrics=visualMetrics(copy), warnings=new Set<QualityWarning>([...copyQuality(copy).warnings,...additionalWarnings]);
  if(metrics.duplicateImageCount) warnings.add("repeated_asset");
  for(const s of copy) if(s.type==="hero") for(const id of s.assetIds){const a=assets.find(a=>a.id===id); if(a&&imageSizing(a.width,a.height,"hero").lowResolution)warnings.add("hero_low_resolution");}
  return <details className="text-sm text-zinc-600"><summary className="cursor-pointer py-2">페이지 품질 · 사용 이미지 {metrics.usedImageCount}개 · 반복 이미지 {metrics.duplicateImageCount}개 · 검토 {warnings.size}건</summary>
    <p className="text-xs leading-6">이미지 포함 섹션 {Math.round(metrics.visualRatio*100)}% · 연속 텍스트 섹션 최대 {metrics.maxConsecutiveTextOnly}개. 경고는 출력되지 않으며 편집을 제한하지 않습니다.</p>
    {[...warnings].map(w=><p key={w} className="mt-2 text-amber-900">{QUALITY_LABELS[w]}</p>)}
  </details>;
}

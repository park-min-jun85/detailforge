import Link from "next/link";
import type { GeneratedSection } from "@/features/section-engine/schemas";
import type { RenderAsset } from "@/features/detail-renderer/model";
import { copyQuality, visualMetrics, QUALITY_LABELS, SEMANTIC_ROLES, type QualityWarning } from "./policy";
import { COPY_REVIEW_LABELS } from "./copy-review";
import { heroImageSizing } from "./images";
export function QualitySummary({sections,assets,additionalWarnings=[],projectId}:{sections:{content:GeneratedSection}[];assets:RenderAsset[];additionalWarnings?:QualityWarning[];projectId?:string}) {
  const copy=sections.map(s=>s.content), metrics=visualMetrics(copy), quality=copyQuality(copy,assets), warnings=new Set<QualityWarning>([...quality.warnings,...additionalWarnings]);
  if(metrics.duplicateImageCount) warnings.add("repeated_asset");
  for(const s of copy) if(s.type==="hero") for(const id of s.assetIds){const a=assets.find(a=>a.id===id); if(a&&heroImageSizing(a.width,a.height).lowResolution)warnings.add("hero_low_resolution");}
  return <details className="text-sm text-zinc-600"><summary className="cursor-pointer py-2">페이지 품질 · 사용 이미지 {metrics.usedImageCount}개 · 반복 이미지 {metrics.duplicateImageCount}개 · 검토 {warnings.size}건</summary>
    <p className="text-xs leading-6">이미지 포함 섹션 {Math.round(metrics.visualRatio*100)}% · 연속 텍스트 섹션 최대 {metrics.maxConsecutiveTextOnly}개. 경고는 출력되지 않으며 편집을 제한하지 않습니다.</p>
    {[...warnings].map(w=><p key={w} className="mt-2 text-amber-900">{QUALITY_LABELS[w]}</p>)}
    {quality.copyReview.map((finding, index) => <p key={index} className="mt-2 text-amber-900">
      {finding.sectionIndices.map(i => `${i + 1}번 · ${SEMANTIC_ROLES[copy[i].type]}`).join(" / ")}: {COPY_REVIEW_LABELS[finding.reason]}
    </p>)}
    {warnings.has("hero_low_resolution") && projectId && <Link className="text-link mt-2 inline-block" href={`/projects/${projectId}/images`}>이미지 화면에서 다른 대표 후보 확인</Link>}
  </details>;
}

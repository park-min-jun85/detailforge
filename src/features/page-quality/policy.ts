import { metaObservationCount } from "./commerce";
import { titleRelevance } from "./title-relevance";
import type { PlannerEvidence, PlannerAsset } from "@/features/page-planner/schemas";
import type { GeneratedSection } from "@/features/section-engine/schemas";
import { heroImageSizing } from "./images";

export const PRESENTATION_VERSION = 1;
export const MAX_ASSET_REUSE = 2;
export const QUALITY_WARNINGS = ["repetitive_copy", "duplicate_title", "low_visual_density", "hero_low_resolution", "repeated_asset", "low_value_section", "copy_density", "limited_gallery_diversity", "meta_observation_copy", "title_relevance"] as const;
export type QualityWarning = (typeof QUALITY_WARNINGS)[number];
export const QUALITY_LABELS: Record<QualityWarning, string> = {
  title_relevance: "제목과 실제 내용이 맞는지 검토해 주세요. 사진 속 묶음이 판매 구성을 뜻하지는 않습니다.",
  meta_observation_copy: "AI 생성 문구가 이미지 설명 위주입니다. 짧은 표현을 검토해 주세요.",
  repetitive_copy: "같은 사실이나 문구가 반복됩니다. 강조할 위치를 정리해 주세요.", duplicate_title: "비슷한 제목이 있습니다. 각 섹션의 내용을 구분해 주세요.",
  low_visual_density: "텍스트가 연속됩니다. 사용할 제품 사진과 흐름을 확인해 주세요.", hero_low_resolution: "대표 이미지 해상도가 낮아 확대 시 흐려질 수 있습니다.",
  repeated_asset: "같은 이미지가 여러 섹션에서 사용되고 있습니다.", low_value_section: "새로운 정보가 적은 섹션이 있습니다. 구성 목적을 확인해 주세요.",
  copy_density: "문구 길이나 항목 수를 간결하게 정리해 주세요.", limited_gallery_diversity: "갤러리 이미지 역할이 비슷합니다. 다른 구도의 사진도 확인해 주세요.",
};
export const SEMANTIC_ROLES = { hero: "상품 정체성과 첫 인상", keyBenefits: "서로 다른 선택 이유 2~3개", feature: "새로운 구체적 특징",
  imageText: "사진이 설명하는 한 가지 포인트", gallery: "서로 다른 구도와 디테일", useCase: "확인된 근거에 따른 활용 예시",
  detail: "제품의 세부 외관", specification: "정확한 사실 표", option: "확정된 선택값", notice: "실제 근거가 있는 안내" };
export function factPresentationRole(label: string) {
  if (/상품번호|모델|품번|관리|코드/.test(label)) return "administrative";
  if (/상품명|제품명|브랜드|품명/.test(label)) return "identity";
  if (/크기|사이즈|치수|수량|매수|구성|용량|중량|규격/.test(label)) return "key_spec";
  return "technical_spec";
}
type PlanSection = { key?: string; type: string; evidenceIds: string[]; assetIds: string[] };
export function factCoverage(evidence: PlannerEvidence[], sections: PlanSection[] = []) {
  return evidence.filter(e => e.kind === "supported_fact").map(f => {
    const role = factPresentationRole(f.label), budget = role === "identity" || role === "key_spec" ? 1 : 0;
    const used = sections.filter(s => !["specification","option","notice"].includes(s.type) && s.evidenceIds.includes(f.id));
    return { factId: f.id, role, marketingBudget: budget, primarySection: used[0]?.key ?? (role==="identity"?"hero":"specification"), sections: used.map(s => s.key ?? s.type), uses: used.length };
  });
}
export const normalizedTitle = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ko").replace(/[^\p{L}\p{N}]+/gu, "");
export function titleSimilarity(a: string, b: string) {
  const x = normalizedTitle(a), y = normalizedTitle(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const grams = (s: string) => new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)));
  const p = grams(x), q = grams(y);
  return p.size && q.size ? 2 * [...p].filter(v => q.has(v)).length / (p.size + q.size) : 0;
}
export function visualMetrics(sections: { type: string; assetIds: string[]; items?:unknown[] }[]) {
  let run = 0, maxConsecutiveTextOnly = 0, topTextOnly = 0;
  const counts = new Map<string, number>();
  const placements=sections.map(s=>{
    const nested=s.type==="useCase"?(s.items??[]).flatMap(item=>item&&typeof item==="object"&&"assetIds" in item&&Array.isArray(item.assetIds)?item.assetIds.filter((id):id is string=>typeof id==="string"):[]):[];
    return [...new Set(s.assetIds)].filter(id=>!nested.includes(id)).concat(nested);
  });
  placements.forEach((ids, i) => {
    if (ids.length) run = 0; else { run++; maxConsecutiveTextOnly = Math.max(run, maxConsecutiveTextOnly); if (i < 4) topTextOnly++; }
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  return { visualRatio: sections.length ? placements.filter(ids=>ids.length).length / sections.length : 0, maxConsecutiveTextOnly, topTextOnly,
    usedImageCount: counts.size, duplicateImageCount: [...counts.values()].filter(n => n > 1).length, maxAssetReuse: Math.max(0, ...counts.values()) };
}
export function planQuality(sections: PlanSection[], evidence: PlannerEvidence[], assets: PlannerAsset[]) {
  const warnings = new Set<QualityWarning>(), metrics = visualMetrics(sections), coverage = factCoverage(evidence, sections);
  if (coverage.some(f => f.uses > f.marketingBudget)) warnings.add("repetitive_copy");
  if (metrics.maxAssetReuse > 1) warnings.add("repeated_asset");
  if (assets.filter(a => a.visual?.available ?? !!a.analysis).length >= 3 && (metrics.visualRatio < .4 || metrics.topTextOnly >= 3)) warnings.add("low_visual_density");
  for (const s of sections) {
    const facts = evidence.filter(e => e.kind === "supported_fact").filter(e=>s.evidenceIds.includes(e.id));
    if ((["imageText", "gallery", "detail"].includes(s.type) && !s.assetIds.length && !facts.length)
      || (s.type === "feature" && !s.assetIds.length && facts.every(f => /카테고리|분류/.test(f.label)))
      || (s.type === "notice" && !facts.some(f => /주의|안내|배송|반품|보관|사용법/.test(f.label)))) warnings.add("low_value_section");
    if (s.type === "hero") for (const id of s.assetIds) { const v = assets.find(a => a.assetId === id)?.visual; if (v && heroImageSizing(v.width, v.height).lowResolution) warnings.add("hero_low_resolution"); }
    if (s.type === "gallery" && s.assetIds.length >= 3 && new Set(s.assetIds.map(id => assets.find(a => a.assetId === id)?.visual?.role ?? "unknown")).size < 2) warnings.add("limited_gallery_diversity");
  }
  return { warnings: [...warnings], metrics, coverage };
}
export function sectionTitle(s: GeneratedSection) { return s.type === "hero" ? s.headline : s.title ?? ""; }
export function copyQuality(sections: GeneratedSection[], assets?: {id:string;role?:string}[]) {
  const warnings = new Set<QualityWarning>(); let duplicateTitleCount = 0, duplicateCopyCount = 0;
  const titleList = sections.map(sectionTitle), seenMessages = new Set<string>();
  titleList.forEach((title, i) => { if (titleList.slice(0, i).some(other => titleSimilarity(title, other) >= .72)) { duplicateTitleCount++; warnings.add("duplicate_title"); } });
  for (const s of sections) {
    if (s.type === "specification" || s.type === "option") continue; // Canonical identity/values may legitimately repeat.
    const strings: string[] = [];
    const walk = (v: unknown, key = "") => { if (["plannerKey", "type", "evidenceIds", "assetIds", "meta"].includes(key)) return;
      if (typeof v === "string") strings.push(v); else if (Array.isArray(v)) v.forEach(x => walk(x)); else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, k)); };
    walk(s);
    for (const text of strings) { const normalized = normalizedTitle(text); if (normalized.length >= 8) { if (seenMessages.has(normalized)) duplicateCopyCount++; seenMessages.add(normalized); } }
    if ((s.type !== "hero" && sectionTitle(s).length > 40) || strings.some(t => t.length > 300)
      || (s.type === "hero" && s.highlights.length > 2) || (s.type === "keyBenefits" && (s.items.length < 2 || s.items.length > 3))
      || (s.type === "feature" && s.bullets.length > 3) || (s.type === "detail" && s.points.length > 3)) warnings.add("copy_density");
    if ((s.type === "keyBenefits" || s.type === "notice" || s.type === "useCase") && !s.items.length) warnings.add("low_value_section");
  }
  if (duplicateCopyCount) warnings.add("repetitive_copy");
  if (metaObservationCount(sections)) warnings.add("meta_observation_copy");
  if (sections.some(s => titleRelevance(s, sections, assets?.filter(a => s.assetIds.includes(a.id)).map(a => a.role ?? "unknown")))) warnings.add("title_relevance");
  return { warnings: [...warnings], duplicateTitleCount, duplicateCopyCount };
}
// New full AI generation only. Legacy reads and human edits remain non-blocking.
export function enforceGenerationQuality(sections: GeneratedSection[]) {
  if (visualMetrics(sections).maxAssetReuse > MAX_ASSET_REUSE) throw new Error("Excessive visual reuse");
  for (const s of sections) {
    if (s.type !== "hero" && sectionTitle(s).length > 40) throw new Error("Title too long");
    if ((s.type === "feature" || s.type === "imageText" || s.type === "detail") && (s.body?.length ?? 0) > 300) throw new Error("Body too long");
  }
}

import type { GeneratedSection } from "@/features/section-engine/schemas";

export const COMMERCE_SEMANTIC_VERSION = 1;
type Groups = { groups: { name: string; values: { label: string }[] }[] };
type Fact = { label: string; value: string };
export type TitleContext = {
  sectionType: string; title?: string | null; content: unknown;
  supportedFacts: Fact[]; confirmedOptions?: Groups; visualRoles?: string[];
};
const norm = (value: string) => value.normalize("NFKC").replace(/\s+/g, "");
const bundle = /묶음|세트|패키지|(?:\d+개)?팩(?:구성|상품|판매|$)/;
// Negated/uncertain words cannot establish pack provenance.
const explicitBundle = (value: string) => bundle.test(norm(value)) && !/아님|아니|없|불명|미확인|참조|추정|가능|제외/.test(value);
const rowValues = (content: unknown): Fact[] => {
  if (!content || typeof content !== "object" || !("rows" in content) || !Array.isArray(content.rows)) return [];
  return content.rows.filter((row): row is Fact => Boolean(row && typeof row.label === "string" && typeof row.value === "string"));
};

// Bounded contextual checks, not general natural-language proof. Never rewrites its input.
export function validateSectionTitleRelevance(input: TitleContext) {
  const hardErrors: string[] = [], warnings: string[] = [], title = norm(input.title ?? "");
  if (!title) return { valid: true, warnings, hardErrors }; // Optional gallery headings stay absent.
  const groups = input.confirmedOptions?.groups ?? [], values = groups.flatMap(g => g.values);
  const singleProduct = values.length === 1 && /^(단일상품|단품)$/.test(norm(values[0].label));
  const bundleFact = input.supportedFacts.some(f => /구성|포장|상품명|제품명|판매단위/.test(f.label) && explicitBundle(f.value));
  const bundleChoices = values.length > 0 && values.every(v => explicitBundle(v.label));
  if (bundle.test(title) && ((input.sectionType === "option" && singleProduct) || !(bundleFact || bundleChoices))) hardErrors.push("unverified_pack_title");
  if (input.sectionType === "option" && /^(제품상세|상품상세|상세정보|제품정보)$/.test(title)) hardErrors.push("generic_option_title");
  const visualSection = ["hero", "keyBenefits", "feature", "imageText", "detail", "gallery", "useCase"].includes(input.sectionType);
  if (visualSection) {
    const detailClaim = /디테일|마감|부분(?:컷|모습|확대)|확대컷/.test(title);
    const usageClaim = /착용|사용|활용/.test(title) && !(input.sectionType === "useCase" && /예시|제안|고려/.test(title) && !/모습|장면|컷/.test(title));
    if (detailClaim && !input.visualRoles?.includes("detail")) (input.visualRoles ? hardErrors : warnings).push("detail_visual_required");
    if (usageClaim && !input.visualRoles?.includes("usage")) (input.visualRoles ? hardErrors : warnings).push("usage_visual_required");
  }
  if (input.sectionType === "specification") {
    const rows = rowValues(input.content);
    for (const [term, labels] of [["소재", /소재|재질/], ["치수", /치수|크기|사이즈|규격/], ["원산지", /원산지|제조국/]] as const)
      if (title.includes(term) && !rows.some(r => labels.test(r.label))) hardErrors.push("specification_title_mismatch");
  }
  if (input.sectionType === "notice" && /배송|반품|교환|인증|안전/.test(title)
    && !input.supportedFacts.some(f => [...title.matchAll(/배송|반품|교환|인증|안전/g)].every(m => (f.label + f.value).includes(m[0])))) hardErrors.push("notice_source_required");
  return { valid: hardErrors.length === 0, warnings: [...new Set(warnings)], hardErrors: [...new Set(hardErrors)] };
}

export function safeSectionTitle(type: string, title: string | null | undefined, existingTitles: string[] = []) {
  if (title?.trim()) return title;
  const candidates: Record<string, string[]> = { option: ["옵션 안내", "선택 정보"], specification: ["상품 정보", "제품 사양", "기본 상품 정보"], notice: ["안내사항", "참고 안내"] };
  return candidates[type]?.find(value => !existingTitles.some(t => norm(t) === norm(value))) ?? null;
}
export function generatedTitle(section: GeneratedSection) { return section.type === "hero" ? section.headline : section.title; }
export const TITLE_RELEVANCE_POLICY = `Section titles and planning purposes must match their actual content and cited supported facts. A quantity, stacked photo or multiple choices is NOT bundle evidence. 묶음/세트/패키지 require explicit supported sales composition or confirmed bundle choices; an option value 단일상품 forbids a bundle option heading even with a pack Fact elsewhere. Use neutral option headings (옵션 안내/선택 정보/선택 가능한 옵션/옵션 구성). Detail/finish/close-up headings require a selected detail-role visual; wearing/use-scene headings require a selected usage-role visual. A use-case hypothesis is not an observed usage scene. Specification headings must describe actual rows; notice claims require supported notice facts. Hero identifies the product; benefits/features need supported facts. Do not add generic titles to optional gallery headings. Never replace facts or images to satisfy a title.`;

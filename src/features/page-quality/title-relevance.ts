import type { GeneratedSection } from "@/features/section-engine/schemas";

// Conservative review signal, not semantic proof or automatic copy replacement.
export function titleRelevance(section: GeneratedSection, sections: GeneratedSection[] = []) {
  const title = (section.type === "hero" ? section.headline : section.title ?? "").normalize("NFKC").replace(/\s+/g, "");
  if (section.type === "option" && /^(제품상세|상품상세|상세정보|제품정보)$/.test(title)) return "generic_option_title";
  if (/묶음구성|세트구성|패키지구성/.test(title)) {
    // A photo of stacked products, six selectable values, or a count in the name is not pack evidence.
    const explicitPackRow = sections.filter(s => s.type === "specification").flatMap(s => s.rows)
      .some(row => /구성|포장단위/.test(row.label) && /묶음|세트|팩/.test(row.value)
        && row.evidenceIds.some(id => /^F/.test(id) && section.evidenceIds.includes(id)));
    if (!explicitPackRow) return "unverified_pack_title";
  }
  return null;
}

import type { GeneratedSection } from "@/features/section-engine/schemas";
import type { SectionType } from "@/types/domain";

export const SECTION_LABELS: Record<SectionType, string> = { hero: "대표 소개", keyBenefits: "핵심 장점", feature: "특징", imageText: "이미지와 설명", gallery: "갤러리", useCase: "사용 상황", detail: "상세 설명", specification: "상품 스펙", option: "옵션", notice: "안내사항" };
export type TextField = { path: string; label: string; value: string | null; max: number; multiline?: boolean; nullable?: boolean };
// Paths are application-owned. Existing array positions retain their evidence and confidence.
export function textFields(content: GeneratedSection): TextField[] {
  const fields: TextField[] = [];
  const add = (path: string, label: string, value: string | null, max: number, nullable = false, multiline = false) => fields.push({ path, label, value, max, nullable, multiline });
  if (content.type === "hero") {
    add("headline", "헤드라인", content.headline, 80);
    add("subheadline", "보조 문구", content.subheadline, 160, true);
    content.highlights.forEach((item, i) => add(`highlights.${i}.text`, `강조 문구 ${i + 1}`, item.text, 200));
  } else {
    add("title", "제목", content.title, 80, content.type === "gallery");
    switch (content.type) {
      case "keyBenefits": case "useCase":
        if (content.type === "useCase") add("intro", "소개", content.intro, 160, true, true);
        content.items.forEach((item, i) => { add(`items.${i}.title`, `항목 ${i + 1} 제목`, item.title, 80); add(`items.${i}.description`, `항목 ${i + 1} 설명`, item.description, 400, false, true); });
        break;
      case "feature": case "detail": case "imageText":
        add("body", "본문", content.body, 700, false, true);
        if (content.type === "feature") content.bullets.forEach((p, i) => add(`bullets.${i}.text`, `특징 ${i + 1}`, p.text, 200));
        if (content.type === "detail") content.points.forEach((p, i) => add(`points.${i}.text`, `상세 항목 ${i + 1}`, p.text, 200));
        break;
      case "gallery": add("intro", "소개", content.intro, 160, true, true); break;
      case "notice": content.items.forEach((p, i) => add(`items.${i}.text`, `안내 ${i + 1}`, p.text, 200, false, true)); break;
      case "specification": case "option": break; // Fact-derived label/value pairs remain read-only.
    }
  }
  return fields;
}
export function sectionTitle(content: GeneratedSection) { return content.type === "hero" ? content.headline : content.title ?? SECTION_LABELS[content.type]; }

export function applyTextFields<T extends GeneratedSection>(content: T, values: Record<string, string | null>): T {
  const next = structuredClone(content);
  for (const field of textFields(content)) {
    const parts = field.path.split(".");
    let target: unknown = next;
    for (const key of parts.slice(0, -1)) target = (target as Record<string, unknown>)[key];
    (target as Record<string, unknown>)[parts.at(-1)!] = values[field.path];
  }
  return next;
}

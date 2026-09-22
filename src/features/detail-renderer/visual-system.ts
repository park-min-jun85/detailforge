import type { GeneratedSection } from "@/features/section-engine/schemas";
import type { RenderAsset } from "./model";
import { heroDisplayMode } from "@/features/page-quality/images";

// Derived presentation modes, never persisted tokens or AI-authored CSS.
export function heroMode(asset?: Pick<RenderAsset, "width" | "height">) {
  return heroDisplayMode(asset?.width, asset?.height);
}
export function countMode(count: number) {
  return count <= 1 ? "single" : count === 2 ? "pair" : count === 3 ? "trio" : "grid";
}
export function optionMode(section: Extract<GeneratedSection, { type: "option" }>) {
  const groups = section.optionSnapshot?.confirmed.groups;
  if (!groups) return "legacy";
  return groups.length === 1 ? groups[0].values.length === 1 ? "inline" : "wrapped" : "groups";
}
export function specificationMode(rows: number) { return rows <= 3 ? "compact" : "normal"; }

// A presentation hint only: saved density/layout and canonical copy stay intact.
const SHORT_TITLE = 40;
const SHORT_PART = 120;
const SHORT_TOTAL = 200;
function shortCopy(title: string, parts: (string | null)[]) {
  const text = [title, ...parts.filter((part): part is string => part !== null)];
  return title.length <= SHORT_TITLE && text.every(part => part.length <= SHORT_PART && !/[\r\n]/.test(part))
    && text.reduce((length, part) => length + part.length, 0) <= SHORT_TOTAL;
}
export function sectionRhythm(section: GeneratedSection): "compact" | "normal" {
  // Count references, including temporarily unavailable and nested visuals, so loading
  // or a missing signed URL cannot change the section's composition.
  if (section.assetIds.length || (section.type === "useCase" && section.items.some(item => item.assetIds.length))) return "normal";
  switch (section.type) {
    case "hero":
    case "gallery": return "normal";
    case "specification": return specificationMode(section.rows.length);
    case "option": return optionMode(section) === "inline" ? "compact" : "normal";
    case "keyBenefits": return section.items.length <= 1 && shortCopy(section.title, section.items.flatMap(item => [item.title, item.description])) ? "compact" : "normal";
    case "feature": return section.bullets.length <= 1 && shortCopy(section.title, [section.body, ...section.bullets.map(item => item.text)]) ? "compact" : "normal";
    case "imageText": return shortCopy(section.title, [section.body]) ? "compact" : "normal";
    case "useCase": return section.items.length <= 1 && shortCopy(section.title, [section.intro, ...section.items.flatMap(item => [item.title, item.description])]) ? "compact" : "normal";
    case "detail": return section.points.length <= 1 && shortCopy(section.title, [section.body, ...section.points.map(item => item.text)]) ? "compact" : "normal";
    case "notice": return section.items.length <= 1 && shortCopy(section.title, section.items.map(item => item.text)) ? "compact" : "normal";
  }
}

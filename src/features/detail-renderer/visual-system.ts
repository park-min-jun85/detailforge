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

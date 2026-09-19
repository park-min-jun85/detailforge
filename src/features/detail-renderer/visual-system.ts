import type { GeneratedSection } from "@/features/section-engine/schemas";
import type { RenderAsset } from "./model";

// Derived presentation modes, never persisted tokens or AI-authored CSS.
export function heroMode(asset?: Pick<RenderAsset, "width" | "height">) {
  const { width, height } = asset ?? {};
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) return "balanced";
  const ratio = width / height;
  if (width < 480 || ratio < .65 || ratio > 1.8) return "compact-image";
  return width >= 760 && height >= 600 ? "large-image" : "balanced";
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

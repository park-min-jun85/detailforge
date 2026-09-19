import { z } from "zod";
import type { QualityWarning } from "@/features/page-quality/policy";
import { sectionRowSchema, storedContentSchema, sectionStyleSchema, type GeneratedSection } from "@/features/section-engine/schemas";
export const canonicalSectionSchema = sectionRowSchema.extend({ content: storedContentSchema, style: sectionStyleSchema }).refine(row => row.type === row.content.type);
export type RenderSection = { id: string; type: GeneratedSection["type"]; sortOrder: number; content: GeneratedSection; style: z.infer<typeof sectionStyleSchema> };
export type RenderAsset = { id: string; name: string; previewUrl: string | null; width?: number | null; height?: number | null };
export type RenderView = {
  projectId: string; projectName: string; productName: string | null; detailPageId: string | null; width: number | null;
  state: "ready" | "product_missing" | "page_missing" | "empty" | "busy";
  sections: RenderSection[]; assets: RenderAsset[];
  readiness: { qualityWarnings?:QualityWarning[]; optionWarnings?: string[]; sectionCount: number; needsReviewCount: number; missingImageCount: number; stalePlan: boolean; validation: "ready" | "missing" | "stale" | "invalid" | "unknown"; unavailable: boolean };
};
export function referencedAssetIds(sections: { content: GeneratedSection }[]) {
  return [...new Set(sections.flatMap(({ content }) => [...content.assetIds, ...(content.type === "useCase" ? content.items.flatMap(item => item.assetIds) : [])]))];
}
export function mapCanonicalSections(rows: unknown[], pageId: string) {
  const parsed = rows.map(row => canonicalSectionSchema.parse(row));
  if (parsed.some(row => row.detail_page_id !== pageId) || new Set(parsed.map(row => row.id)).size !== parsed.length
    || new Set(parsed.map(row => row.sort_order)).size !== parsed.length) throw new Error("Invalid canonical sections");
  parsed.sort((a, b) => a.sort_order - b.sort_order);
  return {
    needsReviewCount: parsed.filter(row => row.content.meta.groundingStatus === "needs_review").length,
    sections: parsed.map(({ id, type, sort_order, content, style }): RenderSection => {
      const { meta, ...copy } = content; void meta;
      return { id, type, sortOrder: sort_order, content: copy, style };
    }),
  };
}

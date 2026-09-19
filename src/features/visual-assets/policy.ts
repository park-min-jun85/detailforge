import { z } from "zod";
import { SECTION_TYPES, type Asset } from "@/types/domain";
import { analysisStateSchema, analysisResultSchema, type AnalysisResult } from "@/features/asset-analysis/schemas";
import { assertAssetScope } from "@/features/assets/schemas";
import { derivationSchema, readExtraction } from "@/features/detail-extraction/schemas";
import { imageCategory, MAX_TRIM_FRACTION } from "@/features/detail-extraction/policy";
import { imageSizing } from "@/features/page-quality/images";

export const SECTION_VISUAL_ROLES = {
  hero: ["product", "usage"], keyBenefits: ["product", "detail", "usage"], feature: ["detail", "product"],
  imageText: ["product", "detail", "usage"], gallery: ["product", "detail", "usage", "option"],
  useCase: ["usage", "product"], detail: ["detail", "product"], specification: [], option: ["option"], notice: [],
} satisfies Record<(typeof SECTION_TYPES)[number], string[]>;
export const visualPolicySchema = z.strictObject({
  version: z.literal(1), kind: z.enum(["normal", "derived", "long_source", "unusable"]),
  category: z.enum(["normal", "long", "extreme_long"]), width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable(),
  role: z.enum(["product", "usage", "detail", "option", "mixed", "specification", "notice", "other"]),
  roleSource: z.enum(["analysis", "hint", "unknown"]), available: z.boolean(), suppressed: z.boolean(), fallback: z.boolean(),
  heroEligible: z.boolean(), heroScore: z.number().min(0).max(100), basePriority: z.number().int().nonnegative(),
  sectionPreferences: z.array(z.enum(SECTION_TYPES)).max(10), parentMissing: z.boolean(),
  resolutionSuitability: z.number().min(0).max(1).optional(),
  derivation: derivationSchema.pick({ parentAssetId: true, candidateId: true, sourceFingerprint: true, sourceRect: true, trim: true }).nullable(),
});
export type VisualPolicy = z.infer<typeof visualPolicySchema>;
export type VisualAsset = { assetId: string; analysis: AnalysisResult | null; visual?: VisualPolicy };
export type AssetInspection = { width: number | null; height: number | null; usable: boolean };

export function completedObservation(asset: Asset) {
  const state = analysisStateSchema.safeParse(asset.metadata.aiAnalysis);
  if (!state.success || state.data.status !== "completed") return null;
  const { schemaVersion, role, confidence, heroSuitability, visualSummary, composition, signals, warnings } = state.data;
  return analysisResultSchema.parse({ schemaVersion, role, confidence, heroSuitability, visualSummary: visualSummary.normalize("NFC").replace(/\r\n?/g, "\n").trim(), composition, signals, warnings: [...warnings].sort() });
}
export function hasHeroQuality(analysis: AnalysisResult | null) {
  return Boolean(analysis && analysis.signals.showsProduct && analysis.confidence >= .65 && analysis.heroSuitability >= .5
    && analysis.composition.productVisibility >= .5 && analysis.composition.subjectClarity >= .5
    && analysis.composition.textDensity !== "high" && !analysis.warnings.some(w => ["blurry", "cropped", "low_visibility", "heavy_text", "ambiguous_subject"].includes(w)));
}
export function visualAvailable(asset: VisualAsset) { return asset.visual ? asset.visual.available : Boolean(asset.analysis); }
export function heroEligible(asset: VisualAsset) { return asset.visual ? asset.visual.available && asset.visual.heroEligible && (!asset.analysis || hasHeroQuality(asset.analysis)) : hasHeroQuality(asset.analysis); }
export function placementOnly(asset: VisualAsset) { return asset.visual?.kind === "derived" && asset.visual.available && !asset.analysis; }

export function buildVisualAssetInventory(assets: Asset[], projectId: string, productId: string, inspections: Record<string, AssetInspection> = {}): VisualAsset[] {
  if (assets.length > 30 || new Set(assets.map(a => a.id)).size !== assets.length) throw new Error("Invalid inventory");
  const ids = new Set(assets.map(a => a.id));
  const inventory = [...assets].sort((a, b) => a.id.localeCompare(b.id)).map(asset => {
    let scoped = true;
    try { assertAssetScope(asset, projectId, productId); } catch { scoped = false; }
    const parsed = derivationSchema.safeParse(asset.metadata.derivation), derived = parsed.success ? parsed.data : null;
    const inspection = inspections[asset.id];
    const sourceDimensions = readExtraction(asset.metadata)?.latestResult?.sourceDimensions;
    const width = inspection?.width ?? asset.width ?? sourceDimensions?.width ?? null;
    const height = inspection?.height ?? asset.height ?? sourceDimensions?.height ?? null;
    const trim = derived?.trim, rect = derived?.sourceRect;
    const invalidTrim = !!(trim && rect && (Object.entries(trim.insets).some(([edge, n]) => n > Math.floor((edge === "left" || edge === "right" ? rect.width : rect.height) * MAX_TRIM_FRACTION))
      || rect.width - trim.insets.left - trim.insets.right !== trim.postTrimDimensions.width || rect.height - trim.insets.top - trim.insets.bottom !== trim.postTrimDimensions.height));
    const invalidDerivation = asset.metadata.derivation !== undefined && (!derived || invalidTrim || derived.parentAssetId === asset.id
      || derived.sourceRect.x + derived.sourceRect.width > derived.sourceDimensions.width
      || derived.sourceRect.y + derived.sourceRect.height > derived.sourceDimensions.height
      || (width !== null && width !== (trim?.postTrimDimensions.width ?? derived.sourceRect.width)) || (height !== null && height !== (trim?.postTrimDimensions.height ?? derived.sourceRect.height)));
    const usable = scoped && !invalidDerivation && inspection?.usable !== false;
    const category = imageCategory(width ?? 0, height ?? 0);
    const kind = !usable ? "unusable" : derived ? "derived" : category !== "normal" ? "long_source" : "normal";
    const analysis = scoped ? completedObservation(asset) : null;
    const role = analysis?.role ?? derived?.suggestedRole ?? "other";
    const goodSize = width !== null && height !== null && width >= 160 && height >= 160 && width * height >= 64000;
    const goodRole = role === "product" || role === "usage" || (kind === "derived" && role === "detail" && (analysis?.heroSuitability ?? 0) >= .8);
    const canHero = usable && category === "normal" && goodSize && goodRole && (analysis ? hasHeroQuality(analysis)
      : kind === "derived" && ["product", "usage"].includes(role) && width! / height! >= .4 && width! / height! <= 2.5);
    const derivedPriorities: Partial<Record<VisualPolicy["role"], number>> = { product: 90, usage: 80, detail: 70, option: 60 };
    const basePriority = kind === "normal" && analysis && ["product", "usage"].includes(role) ? 100
      : kind === "derived" ? (derivedPriorities[role] ?? 40) : kind === "long_source" ? 10 : 30;
    const quality = analysis ? .45 * analysis.heroSuitability + .3 * analysis.composition.productVisibility + .25 * analysis.composition.subjectClarity : .5;
    const visual: VisualPolicy = { version: 1, kind, category, width, height, role, roleSource: analysis ? "analysis" : derived ? "hint" : "unknown",
      available: usable && (Boolean(analysis) || Boolean(derived)), suppressed: false, fallback: false, heroEligible: canHero,
      heroScore: canHero ? Math.round((quality * 70 + basePriority * .2 + imageSizing(width,height,"hero").resolutionSuitability * 10) * 100) / 100 : 0, basePriority,
      resolutionSuitability: imageSizing(width,height,"hero").resolutionSuitability,
      sectionPreferences: SECTION_TYPES.filter(type => (SECTION_VISUAL_ROLES[type] as string[]).includes(role)), parentMissing: Boolean(derived && !ids.has(derived.parentAssetId)),
      derivation: derived ? { parentAssetId: derived.parentAssetId, candidateId: derived.candidateId, sourceFingerprint: derived.sourceFingerprint, sourceRect: derived.sourceRect, ...(trim ? {trim} : {}) } : null };
    return { assetId: asset.id, analysis, visual };
  });
  const uniqueCrops: VisualAsset[] = [];
  for (const asset of [...inventory].filter(a => a.visual.kind === "derived" && a.visual.available)
    .sort((a, b) => b.visual.heroScore - a.visual.heroScore || b.visual.basePriority - a.visual.basePriority || a.assetId.localeCompare(b.assetId))) {
    if (uniqueCrops.some(other => nearDuplicate(asset, other))) { asset.visual.available = false; asset.visual.suppressed = true; asset.visual.heroEligible = false; }
    else uniqueCrops.push(asset);
  }
  for (const asset of inventory) if (asset.visual.kind === "long_source") {
    asset.visual.suppressed = inventory.some(child => child.visual.kind === "derived" && child.visual.available && child.visual.derivation?.parentAssetId === asset.assetId);
    asset.visual.available &&= !asset.visual.suppressed;
    asset.visual.fallback = asset.visual.available;
  }
  return inventory;
}

export function nearDuplicate(a: VisualAsset, b: VisualAsset) {
  const x = a.visual?.derivation, y = b.visual?.derivation;
  if (!x || !y || x.parentAssetId !== y.parentAssetId || x.sourceFingerprint !== y.sourceFingerprint) return false;
  const r = x.sourceRect, s = y.sourceRect;
  const intersection = Math.max(0, Math.min(r.x + r.width, s.x + s.width) - Math.max(r.x, s.x)) * Math.max(0, Math.min(r.y + r.height, s.y + s.height) - Math.max(r.y, s.y));
  return intersection / (r.width * r.height + s.width * s.height - intersection) >= .85;
}
// Reject invalid compositions; never silently rewrite a user's or provider's section purpose.
export function validateVisualComposition(sections: { type: string; assetIds: string[] }[], assets: VisualAsset[]) {
  const byId = new Map(assets.map(a => [a.assetId, a])), longUsed = new Set<string>(), derivedUsed: VisualAsset[] = [];
  for (const section of sections) for (const id of new Set(section.assetIds)) {
    const asset = byId.get(id);
    if (!asset || !visualAvailable(asset)) throw new Error("Forbidden visual asset");
    if (!asset.visual) continue; // Legacy saved plans keep their original contract.
    if (asset.visual.kind === "long_source") {
      if (["hero", "specification", "option", "notice"].includes(section.type) || longUsed.size > 0) throw new Error("Long source placement");
      longUsed.add(id);
    }
    if (asset.visual.kind === "derived") {
      if (derivedUsed.some(other => other.assetId !== id && nearDuplicate(asset, other))) throw new Error("Near duplicate crops");
      derivedUsed.push(asset);
    }
  }
  if (derivedUsed.some(a => longUsed.has(a.visual!.derivation!.parentAssetId))) throw new Error("Raw and derived duplication");
}

// Deliberately excludes provenance hashes/rectangles, candidates, rationale, filenames and URLs.
export function visualPromptAsset(asset: VisualAsset) {
  const v = asset.visual;
  return { assetId: asset.assetId, ...(v ? { kind: v.kind, role: v.role, roleSource: v.roleSource, width: v.width, height: v.height,
    heroEligible: v.heroEligible, heroScore: v.heroScore, resolutionSuitability: v.resolutionSuitability, basePriority: v.basePriority, sectionPreferences: v.sectionPreferences, fallback: v.fallback } : {}),
    ...(asset.analysis ? { confidence: asset.analysis.confidence, heroSuitability: asset.analysis.heroSuitability,
      visualSummary: asset.analysis.visualSummary, warnings: asset.analysis.warnings } : {}) };
}
export function assetProvenanceLabel(asset: Asset, assets: Asset[]) {
  const d = derivationSchema.safeParse(asset.metadata.derivation);
  if (!d.success) return null;
  const parent = assets.find(a => a.id === d.data.parentAssetId);
  const roles = { product: "제품", usage: "사용/착용", detail: "디테일", option: "옵션/색상", mixed: "혼합" };
  return `추출 이미지 · ${parent ? `원본: ${parent.originalFilename}` : "원본 삭제됨 · 독립 이미지"} · 추출 힌트: ${roles[d.data.suggestedRole]}`;
}

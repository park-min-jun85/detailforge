import { CommerceCopyError } from "./commerce";
import { generatedTitle, validateSectionTitleRelevance } from "./title-policy";
import { visualAvailable, heroEligible } from "@/features/visual-assets/policy";
import type { LatestPlan, PagePlan, PlannerEvidence, PlannerAsset } from "@/features/page-planner/schemas";
import type { ConfirmedOptions } from "@/features/product-options/section-snapshot";
import type { GeneratedSection } from "@/features/section-engine/schemas";

function context(ids: string[], assetIds: string[], evidence: PlannerEvidence[], assets: PlannerAsset[]) {
  return { supportedFacts: evidence.filter(e => e.kind === "supported_fact").filter(e => ids.includes(e.id)),
    visualRoles: assets.filter(a => assetIds.includes(a.assetId) && visualAvailable(a)).map(a => a.visual?.role ?? a.analysis?.role ?? "unknown") };
}
export function validateGeneratedTitle(section: GeneratedSection, latest: LatestPlan) {
  const result = validateSectionTitleRelevance({ sectionType: section.type, title: generatedTitle(section), content: section,
    ...context(section.evidenceIds, section.assetIds, latest.evidenceSnapshot, latest.assetSnapshot),
    confirmedOptions: section.type === "option" ? section.optionSnapshot?.confirmed ?? latest.optionsSnapshot : undefined });
  if (!result.valid) throw new CommerceCopyError("title_relevance");
}
// Only new provider output passes here. Stored plan parsing retains its legacy contract.
export function validatePlannedSemantics(plan: PagePlan, evidence: PlannerEvidence[], assets: PlannerAsset[], options?: ConfirmedOptions) {
  const hero = assets.find(a => a.assetId === plan.heroAssetId);
  if (hero && heroEligible(hero) && !["product", "usage"].includes(hero.visual?.role ?? hero.analysis?.role ?? "unknown")) throw new CommerceCopyError("title_relevance");
  for (const s of plan.sections) {
    const source = context(s.evidenceIds, s.assetIds, evidence, assets);
    // A purpose is a positive semantic intent, unlike contentBrief which may contain negative instructions.
    if (!validateSectionTitleRelevance({ sectionType: s.type, title: s.purpose, content: { rows: source.supportedFacts },
      ...source, confirmedOptions: s.type === "option" ? options : undefined }).valid) throw new CommerceCopyError("title_relevance");
  }
}

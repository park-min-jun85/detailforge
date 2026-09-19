import "server-only";
import { factCoverage, enforceGenerationQuality } from "@/features/page-quality/policy";
import { visualAvailable, placementOnly, visualPromptAsset } from "@/features/visual-assets/policy";
import { confirmedOptionsFingerprint } from "@/features/product-options/confirmed-source";
import { validationFingerprint } from "@/features/fact-validation/evidence";
import { validatePagePlan, type LatestPlan } from "@/features/page-planner/schemas";
import { sectionOutputSchema, sectionContentSchema, type SectionOutput } from "./schemas";
import type { SectionInput } from "./types";

export function sourcePlanFingerprint(result: LatestPlan) { return validationFingerprint(result); }
export function buildSectionInput(latest: LatestPlan): SectionInput {
  validatePagePlan(latest.plan, latest.evidenceSnapshot, latest.assetSnapshot, latest.optionsSnapshot);
  return { factPresentation:factCoverage(latest.evidenceSnapshot,latest.plan.sections), visualAssets: latest.assetSnapshot.filter(a => visualAvailable(a) && latest.plan.sections.some(s => s.assetIds.includes(a.assetId))).map(visualPromptAsset), optionsSnapshot: latest.optionsSnapshot, plan: latest.plan, evidenceSnapshot: latest.evidenceSnapshot, strategySnapshot: latest.strategySnapshot,
    validation: { supported: latest.factPolicySnapshot.supported.map(fact => fact.factId),
      restricted: latest.factPolicySnapshot.restricted.map(({ factId, status }) => ({ factId, status })) } };
}
const codePattern = /<\/?[a-z!][^>]*>|javascript:|https?:\/\/|(?:class|style)\s*=|[{}]|@import|(?:color|font-size|margin|padding)\s*:|#[a-f\d]{3,8}\b|\b(?:bg|text|p|m|flex|grid)-(?:\d+|[a-z]+-\d+)\b/i;
const numericTokens = (text: string) => [...text.matchAll(/\d+(?:[.,]\d+)*(?:\s*(?:%|cm|mm|kg|ml|mL|mAh|시간|개월|일|년|회|개|배|위|도|g|L|W|V))?/g)].map(match => match[0].replace(/\s/g, ""));
const guardedTerms = /최고|완벽|무조건|보장|압도적|업계\s*1위|유일|인증|고속|방수|항균|무독성|친환경|치료|예방|안전성|내구성|반드시|모든\s*가정|따뜻|편안|흡수|튼튼|실용|착용감|보온/g;
export function validateSectionOutput(value: unknown, latest: LatestPlan): SectionOutput {
  const output = sectionOutputSchema.parse(value), input = buildSectionInput(latest);
  if (JSON.stringify(output).length > 180000) throw new Error("Output too large");
  if (output.sections.length !== input.plan.sections.length) throw new Error("Section count mismatch");
  if (new Set(output.sections.map(s => s.plannerKey)).size !== output.sections.length) throw new Error("Duplicate planner key");
  output.sections.forEach((section, index) => validateSectionContent(section, latest, input.plan.sections[index]));
  if(latest.presentationVersion===1) enforceGenerationQuality(output.sections);
  return output;
}
// Shared claim/reference checks for full generation and one-section regeneration.
// preservedAssets is only supplied after server ownership and exact-current-selection validation.
export function validateSectionContent(value: unknown, latest: LatestPlan, plan: LatestPlan["plan"]["sections"][number], preservedAssets?: string[]) {
  const section = sectionContentSchema.parse(value);
  if(latest.presentationVersion===1) enforceGenerationQuality([section]);
  const registry = new Map(latest.evidenceSnapshot.map(e => [e.id, e]));
  const checkText = (text: string, ids: string[]) => {
    if (!text.trim() || codePattern.test(text)) throw new Error("Plain text required");
    const facts = ids.map(id => registry.get(id)).filter(e => e?.kind === "supported_fact");
    const source = facts.map(f => `${f.label} ${f.value}`).join("\n");
    const numbers = new Set(numericTokens(source));
    if (numericTokens(text).some(token => !numbers.has(token))) throw new Error("Unsupported number or unit");
    if ([...text.matchAll(guardedTerms)].some(term => !source.includes(term[0]))) throw new Error("Unsupported sensitive claim");
    for (const fact of latest.factPolicySnapshot.restricted) {
      // A literal shared with a supported Fact is not uniquely restricted. Semantic review is still necessary.
      if (fact.value.trim().length >= 2 && text.includes(fact.value) && !facts.some(f => f.value.includes(fact.value))) throw new Error("Restricted fact value");
    }
  };
    if (section.plannerKey !== plan.key || section.type !== plan.type) throw new Error("Planner correspondence mismatch");
    const checkIds = (ids: string[], assetIds: string[]) => {
      if (new Set(ids).size !== ids.length || ids.some(id => !registry.has(id) || !plan.evidenceIds.includes(id))) throw new Error("Invalid evidence");
      if (new Set(assetIds).size !== assetIds.length || assetIds.some(id => preservedAssets ? !preservedAssets.includes(id) : !plan.assetIds.includes(id) || !latest.assetSnapshot.some(a => a.assetId === id && visualAvailable(a)))) throw new Error("Invalid asset");
    };
    checkIds(section.evidenceIds, section.assetIds);
    if (!preservedAssets && latest.assetSnapshot.some(a => a.visual) && (section.assetIds.length !== plan.assetIds.length || plan.assetIds.some(id => !section.assetIds.includes(id)))) throw new Error("Preserve planned visual composition");
    if (!preservedAssets && section.type === "hero" && latest.plan.heroAssetId && section.assetIds[0] !== latest.plan.heroAssetId) throw new Error("Hero must follow plan");
    if (!preservedAssets && section.assetIds.some(id => !latest.assetSnapshot.some(a => a.assetId === id && placementOnly(a)) && !section.evidenceIds.some(ref => { const e = registry.get(ref); return e?.kind === "visual_observation" && e.assetId === id; }))) throw new Error("Missing image observation");
    const walk = (node: unknown, inherited: string[]) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { node.forEach(item => walk(item, inherited)); return; }
      const data = node as Record<string, unknown>;
      const ids = Array.isArray(data.evidenceIds) ? data.evidenceIds as string[] : inherited;
      const imageIds = Array.isArray(data.assetIds) ? data.assetIds as string[] : [];
      checkIds(ids, imageIds);
      if (ids.some(id => !section.evidenceIds.includes(id)) || imageIds.some(id => !section.assetIds.includes(id))) throw new Error("Nested reference mismatch");
      for (const [key, item] of Object.entries(data)) {
        if (["type", "plannerKey", "evidenceIds", "assetIds"].includes(key)) continue;
        if (typeof item === "string") checkText(item, ids); else walk(item, ids);
      }
    };
    if (section.type === "option" && section.optionSnapshot) {
      if (confirmedOptionsFingerprint(section.optionSnapshot.confirmed) !== section.optionSnapshot.confirmed.fingerprint) throw new Error("Invalid options fingerprint");
      checkText(section.title, section.evidenceIds);
      return section;
    }
    walk(section, section.evidenceIds);
    if (section.type === "option" && latest.optionsSnapshot) {
      if (latest.optionsSnapshot.state !== "present" || section.items?.length || section.evidenceIds.some(id => registry.get(id)?.kind !== "visual_observation")) throw new Error("AI cannot author confirmed choices");
      return section;
    }
    const claims = section.type === "hero" ? section.highlights : section.type === "feature" ? section.bullets : section.type === "keyBenefits" ? section.items : [];
    if (claims.some(item => !item.evidenceIds.some(id => registry.get(id)?.kind === "supported_fact"))) throw new Error("Claim item requires supported fact");
    if (["keyBenefits", "feature", "specification", "option"].includes(section.type) && !section.evidenceIds.some(id => registry.get(id)?.kind === "supported_fact")) throw new Error("Supported facts required");
    if (section.type === "specification" || section.type === "option") {
      const rows = section.type === "specification" ? section.rows : section.items ?? [];
      const seen = new Set<string>();
      for (const row of rows) {
        if (row.evidenceIds.length !== 1) throw new Error("Exact specification source required");
        const fact = registry.get(row.evidenceIds[0]);
        if (fact?.kind !== "supported_fact" || fact.label !== row.label || fact.value !== row.value || seen.has(fact.id)) throw new Error("Specification changed");
        if (section.type === "option" && !/옵션|색상|사이즈|선택|모델|구성/.test(fact.label)) throw new Error("Option evidence missing");
        seen.add(fact.id);
      }
    }
    if (section.type === "useCase") for (const item of section.items) {
      if (!item.evidenceIds.some(id => registry.get(id)?.kind === "supported_fact") || !/고려|가정(?:한|하|해|할|하면)|예시|확인|검토/.test(item.description)) throw new Error("Hypothesis must be explicit");
    }
  return section;
}

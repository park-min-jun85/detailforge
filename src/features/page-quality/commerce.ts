import type { PlannerAsset } from "@/features/page-planner/schemas";
import type { GeneratedSection } from "@/features/section-engine/schemas";

export const COMMERCE_COPY_VERSION = 3;
export const COPY_INTENTS = {
  hero: "identity", keyBenefits: "benefit_from_fact", feature: "feature_from_fact",
  imageText: "visual_description", gallery: "visual_description", detail: "detail_description",
  useCase: "usage_hypothesis", option: "selection_information", specification: "specification", notice: "notice",
} as const;
export type CopyIntent = typeof COPY_INTENTS[keyof typeof COPY_INTENTS];
export const copyIntent = (type: string): CopyIntent => COPY_INTENTS[type as keyof typeof COPY_INTENTS] ?? "visual_description";
export class CommerceCopyError extends Error {
  readonly reason: "meta_observation" | "duplicate_purpose" | "low_value_visual" | "title_relevance";
  constructor(reason: CommerceCopyError["reason"]) { super(reason); this.reason = reason; }
}
const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase("ko").replace(/\s+/gu, "");

// Detection only. Never remove words or rewrite a stored/generated sentence.
export function detectMetaObservationCopy(text: string, context: { type?: string; intent?: CopyIntent } = {}) {
  const value = normalize(text), intent = context.intent ?? copyIntent(context.type ?? "imageText");
  const patterns: string[] = [];
  const media = /이미지|사진|제품컷|시각적으로/;
  const inspect = /확인|살펴|참고|보세요|볼수|보는|보여드/;
  if (media.test(value) && inspect.test(value)) patterns.push("media_inspection");
  if (/(?:이미지|사진)(?:입니다|이다|에서.+보입니다|에.+보입니다)/.test(value)) patterns.push("media_report");
  const visual = ["identity", "visual_description", "detail_description", "feature_from_fact", "benefit_from_fact"].includes(intent);
  if (visual && /(?:모델|사람)(?:이|가)?착용하고있는모습(?:입니다|이다)(?:[.!?。]|$)/u.test(value)) patterns.push("wearing_scene_report");
  // Bounded camera-framing phrases seen in QA; product construction/design remains valid.
  if (visual && /(?:근접|클로즈업)(?:모습|구성)(?:[.!?。]|$)|(?:누른|잡은|들고있는|촬영한|담은)구도(?:입니다|이다)?(?:[.!?。]|$)/u.test(value)) patterns.push("camera_framing");
  // A visual object + capture report can imply a photo without naming it (TASK-042 H1).
  // Keep adjacency/modifiers bounded: packaging/storage 담다 and design noun phrases are not reports.
  const visualObject = "(?:외관|모습|실루엣|디테일|장면|구도|전면|후면)";
  const captureModifier = "(?:(?:사진|이미지|화면|컷|한장)(?:에|으로)|가까이|자세히|선명하게|생생하게|함께|한눈에){0,2}";
  const captureVerb = "(?:담았습니다|담아냈습니다|촬영했습니다|포착했습니다|(?:담은|담아낸)(?:(?:사진|이미지|컷|화면|모습|장면|구도)(?:입니다|이다)?)?)";
  const captureReport = new RegExp(`${visualObject}(?:을|를)${captureModifier}${captureVerb}(?:[.!?。,;:]|$)`, "u");
  // 보여줍니다/나타납니다 alone can describe a product. Require an explicit medium in the same clause.
  const mediumReport = new RegExp(`(?:사진|이미지|컷|화면)(?:에서는|에는|에서|은|는|이|가|에)[^.!?。;,\\n]{0,32}${visualObject}(?:을|를|이|가)${captureModifier}(?:보여줍니다|나타납니다)(?:[.!?。,;:]|$)`, "u");
  if (captureReport.test(value) || text.split(/[.!?。;,\n]/u).some(clause => mediumReport.test(normalize(clause)))) patterns.push("capture_narration");
  if (visual && /모습|형태|외관|디테일|제품|패드|착용|실루엣|배치|접힘선/.test(value)) {
    if (/확인할수있|확인해보|살펴볼수|보이는모습|보입니다|배치되어있/.test(value)) patterns.push("observation_narration");
  }
  return { hasMetaObservation: patterns.length > 0, patterns };
}

export function commerceText(section: GeneratedSection): string[] {
  // Exact Fact rows and confirmed choices are data, never commerce prose.
  if (section.type === "specification" || section.type === "option") return [section.title];
  const result: string[] = [];
  const visit = (value: unknown, key = "") => {
    if (["type", "plannerKey", "evidenceIds", "assetIds", "meta", "confidence"].includes(key)) return;
    if (typeof value === "string") result.push(value);
    else if (Array.isArray(value)) value.forEach(item => visit(item));
    else if (value && typeof value === "object") Object.entries(value).forEach(([name, item]) => visit(item, name));
  };
  visit(section);
  return result;
}
export function metaObservationCount(sections: GeneratedSection[]) {
  return sections.reduce((count, section) => count + commerceText(section).filter(text => detectMetaObservationCopy(text, { type: section.type }).hasMetaObservation).length, 0);
}
export function validateCommerceCopy(section: GeneratedSection) {
  if (metaObservationCount([section])) throw new CommerceCopyError("meta_observation");
  if ((section.type === "detail" || section.type === "imageText") && !section.assetIds.length && !section.evidenceIds.some(id => id.startsWith("F"))) throw new CommerceCopyError("low_value_visual");
  if ((section.type === "detail" || section.type === "imageText") && section.body === null && !section.assetIds.length) throw new CommerceCopyError("low_value_visual");
}

export type MessageSection = { key?: string; type: string; purpose?: string; title?: string | null; evidenceIds: string[]; assetIds: string[] };
const sorted = (values: string[]) => [...new Set(values)].sort();
function purposeTokens(text: string) {
  // Conservative Korean surface normalization, not an embedding or truth classifier.
  return sorted(text.normalize("NFKC").toLocaleLowerCase("ko").split(/[^\p{L}\p{N}]+/u)
    .map(word => word.replace(/(?:에서는|에서|으로|을|를|의|은|는|이|가)$/, ""))
    .filter(word => word.length > 1 && !["확인", "안내", "제공", "보여준다", "한다"].includes(word)));
}
export function messageSignature(section: MessageSection) {
  return { type: section.type, intent: copyIntent(section.type), evidence: sorted(section.evidenceIds), assets: sorted(section.assetIds), purpose: purposeTokens(section.purpose ?? section.title ?? "") };
}
const subset = (a: string[], b: string[]) => a.every(id => b.includes(id));
export function messageDuplication(sections: MessageSection[]) {
  const duplicates: { first: number; second: number; reason: string }[] = [];
  const signatures = sections.map(messageSignature);
  for (let i = 0; i < sections.length; i++) for (let j = i + 1; j < sections.length; j++) {
    const a = signatures[i], b = signatures[j];
    if ([a.type, b.type].some(type => ["specification", "option", "notice"].includes(type))) continue;
    if (!a.assets.some(id => b.assets.includes(id))) continue;
    const visualRepeat = (candidate: typeof a, other: typeof a) => {
      if (!["imageText", "detail", "gallery"].includes(candidate.type)) return false;
      // A different description of the same V/asset is not a new detail source.
      return subset(candidate.assets, other.assets) && subset(candidate.evidence, other.evidence);
    };
    const overlap = a.purpose.filter(token => b.purpose.includes(token)).length;
    const similarity = a.purpose.length && b.purpose.length ? 2 * overlap / (a.purpose.length + b.purpose.length) : 0;
    const sameMessage = a.intent === b.intent && subset(a.assets, b.assets) && subset(b.assets, a.assets)
      && subset(a.evidence, b.evidence) && subset(b.evidence, a.evidence) && similarity >= .6;
    if (visualRepeat(a, b) || visualRepeat(b, a) || sameMessage) duplicates.push({ first: i, second: j, reason: sameMessage ? "same_message_signature" : "no_distinct_visual_or_evidence" });
  }
  return { signatures, duplicates };
}
export function validateMessageDistinctness(sections: MessageSection[]) {
  const result = messageDuplication(sections);
  if (result.duplicates.length) throw new CommerceCopyError("duplicate_purpose");
  return result;
}

// Runtime editorial hints only; never overrides a plan, promotes V to F, or changes an Asset.
export function distinctVisualAssignments(sections: Pick<MessageSection, "key" | "type">[], assets: PlannerAsset[]) {
  const used = new Set<string>();
  return sections.map(section => {
    const candidates = assets.filter(asset => asset.visual?.available && !asset.visual.suppressed
      && (section.type === "hero" ? asset.visual.heroEligible : asset.visual.sectionPreferences.some(type => type === section.type)))
      .sort((a, b) => Number(used.has(a.assetId)) - Number(used.has(b.assetId))
        || Number(b.visual?.role === "detail" && section.type === "detail") - Number(a.visual?.role === "detail" && section.type === "detail")
        || (section.type === "hero" ? b.visual!.heroScore - a.visual!.heroScore : b.visual!.basePriority - a.visual!.basePriority)
        || a.assetId.localeCompare(b.assetId));
    const distinct = candidates.filter(asset => !used.has(asset.assetId));
    if (distinct[0]) used.add(distinct[0].assetId);
    return { key: section.key, type: section.type, intent: copyIntent(section.type), preferredDistinctAssetIds: distinct.slice(0, 4).map(asset => asset.assetId), reduceIfNoDistinctEvidence: !distinct.length };
  });
}

export const COMMERCE_COPY_POLICY = `Write a storefront page, not an image-analysis report. Follow each section's copy intent; strategy can differentiate roles but is NEVER evidence for a benefit.
Never narrate the act of viewing an image: 이미지에서 확인/사진으로 확인/이미지를 통해/확인할 수 있습니다/확인해 보세요/살펴볼 수 있습니다/아래 이미지 참고. Never use titles such as 이미지로 보는 제품 or 사진으로 확인하는 디테일. Avoid 이미지입니다, 보입니다, 중앙에 배치되어 있습니다 narration.
Avoid camera-framing filler such as 근접 모습, 근접 구성, 손으로 누른 구도. Name only the observed product part/design; omit a visual body (null) when it only repeats the title or describes the shot. Do not replace filler with a performance or comfort claim.
Describe only an actually supplied V observation in a short neutral noun phrase: 앞면 지퍼 여밈 디자인, 착용 상태의 전체 실루엣. These are EXAMPLES, not facts about this product; use only when the observation actually contains that feature. Do not invent front/back views, stitching, colors or closures.
V alone cannot justify 간편/편리/편안/따뜻/보온/가벼움/부드러움/흡수/내구/튼튼/고급/실용/안전/피부 benefits. Each such claim requires a relevant supported F. A visual hint is placement-only, so give it no invented descriptive assertion. A neutral title with null detail/imageText body or null gallery intro is preferable to filler.
Hero is identity: retain a grounded product identity, no duplicated product-name subheadline, no report narration. A null subheadline and empty highlights are valid. imageText describes one distinct observed appearance. detail needs its own visual or new supported detail evidence. gallery may have only a concise title, no mandatory caption. useCase stays explicitly hypothetical with supported F. Actual notice/selection instructions such as 구매 전 옵션을 확인해 주세요 are not image reports; never invent a notice Fact.
Separate title and body roles: the title names the point; the body adds a DIFFERENT supplied observation or supported fact. Product-name + 소개합니다, closure title + 적용되어 있습니다, and the same closure/pocket list + 착용 외관 do not add information. If nothing else is supported, use the schema's nullable subheadline/body/intro instead of a restatement. Never null a required field or delete canonical data. 모델이 착용하고 있는 모습입니다 is scene-report filler; 착용 상태의 전체 실루엣 is allowed only with that actual V observation.
A shared F across marketing sections is a review risk even with different photos or wording (for example, the same quantity or dimensions). Assign its primary marketing role and keep exact canonical specification/option repetition. Shared product nouns alone do not imply duplicate meaning; distinct supplied observations and new supported F remain useful.
Use sectionIntents, factPresentation and otherSections only for differentiation, not new evidence. Same image plus same V is not another meaningful detail. Prefer distinct suitable approved photos or fewer sections; do not fill a count. Never rewrite exact specifications or confirmed choices. No post-processing, extra AI pass or automatic retries.`;

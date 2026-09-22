import type { GeneratedSection } from "@/features/section-engine/schemas";
import { copyIntent, messageDuplication, type CopyIntent } from "./commerce";

export type CopyReviewFinding = {
  reason: "title_body_redundancy" | "fact_reuse" | "visual_message_reuse";
  sectionIndices: number[];
  intents: CopyIntent[];
  evidenceIds: string[];
};
export const COPY_REVIEW_LABELS: Record<CopyReviewFinding["reason"], string> = {
  title_body_redundancy: "제목과 본문이 같은 정보를 되풀이합니다. 역할을 나누고, 생략 가능한 본문은 비우는 것을 검토해 주세요.",
  fact_reuse: "여러 판매 문구에서 같은 사실 근거를 사용합니다. 강조할 섹션을 정하고 나머지 역할을 검토해 주세요.",
  visual_message_reuse: "같은 사진·관찰 근거가 반복됩니다. 각 섹션에 별도의 정보가 있는지 검토해 주세요.",
};

const canonical = (section: GeneratedSection) => ["specification", "option", "notice"].includes(section.type);
const unique = (values: string[]) => [...new Set(values)].sort();

// Bounded Korean surface equivalence for editorial review, NEVER a truth or hard gate.
// Keep extra product nouns, numbers, negation and contrasting locations intact.
function informationTokens(text: string) {
  return unique(text.normalize("NFKC").toLocaleLowerCase("ko")
    .replace(/소개합니다|적용되어\s*있습니다/gu, " ")
    .replace(/드러난\s*착용\s*외관/gu, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .map(word => word.replace(/(?:에는|에서는|에서|으로|입니다|과|와|을|를|의|은|는|이|가)$/u, ""))
    .map(word => word === "여밈선" ? "여밈" : word)
    .filter(word => word && !["구성", "양쪽"].includes(word)));
}
function repeatsTitle(title: string, body: string | null) {
  if (!body) return false;
  const a = informationTokens(title), b = informationTokens(body);
  // A single shared noun is insufficient, regardless of length.
  return a.length >= 2 && a.length === b.length && a.every((word, i) => word === b[i]);
}

export function reviewCopyRoles(sections: GeneratedSection[]): CopyReviewFinding[] {
  const findings: CopyReviewFinding[] = [];
  const add = (reason: CopyReviewFinding["reason"], indices: number[], evidenceIds: string[]) => {
    findings.push({ reason, sectionIndices: indices, intents: indices.map(i => copyIntent(sections[i].type)), evidenceIds: unique(evidenceIds) });
  };
  sections.forEach((s, i) => {
    if (canonical(s)) return;
    const title = s.type === "hero" ? s.headline : s.title;
    const body = s.type === "hero" ? s.subheadline : "body" in s ? s.body : s.type === "gallery" ? s.intro : null;
    if (title && repeatsTitle(title, body)) add("title_body_redundancy", [i], s.evidenceIds);
  });
  const facts = unique(sections.filter(s => !canonical(s)).flatMap(s => s.evidenceIds.filter(id => /^F\d+$/u.test(id))));
  for (const id of facts) {
    const indices = sections.flatMap((s, i) => !canonical(s) && s.evidenceIds.includes(id) ? [i] : []);
    if (indices.length > 1) add("fact_reuse", indices, [id]);
  }
  // Reuse the existing type/intent, purpose/title, F/V and Asset signature policy.
  // Stored and manually edited content receives review findings, never rejection.
  for (const pair of messageDuplication(sections).duplicates) {
    const a = sections[pair.first], b = sections[pair.second];
    add("visual_message_reuse", [pair.first, pair.second], a.evidenceIds.filter(id => b.evidenceIds.includes(id)));
  }
  return findings;
}

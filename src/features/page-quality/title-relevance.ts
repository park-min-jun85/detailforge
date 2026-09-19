import type { GeneratedSection } from "@/features/section-engine/schemas";
import { generatedTitle, validateSectionTitleRelevance } from "./title-policy";
// Review only: canonical rows provide hints, never new validation status or DB mutation.
export function titleRelevance(section: GeneratedSection, sections: GeneratedSection[] = [], visualRoles?: string[]) {
  const supportedFacts = sections.filter(s => s.type === "specification").flatMap(s => s.rows)
    .filter(row => row.evidenceIds.some(id => /^F/.test(id) && section.evidenceIds.includes(id)));
  const result = validateSectionTitleRelevance({ sectionType: section.type, title: generatedTitle(section), content: section,
    supportedFacts, visualRoles, confirmedOptions: section.type === "option" ? section.optionSnapshot?.confirmed : undefined });
  return result.hardErrors[0] ?? result.warnings[0] ?? null;
}

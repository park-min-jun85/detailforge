import { validateGeneratedTitle } from "@/features/page-quality/generation-titles";
import { CommerceCopyError, validateCommerceCopy, messageDuplication } from "@/features/page-quality/commerce";
import "server-only";
import { isDeepStrictEqual } from "node:util";
import { validateSectionContent } from "@/features/section-engine/grounding";
import { storedContentSchema } from "@/features/section-engine/schemas";
import { regenerationOutputSchema } from "./schemas";
import { RegenError } from "./errors";
import type { RegenerationContext } from "./context";
export function validateRegeneration(value: unknown, context: RegenerationContext) {
  const parsed = regenerationOutputSchema(context.section.type).safeParse(value);
  if (!parsed.success) throw new RegenError("invalid_response");
  const content = parsed.data.content, current = context.section.content;
  if (content.type !== current.type || content.plannerKey !== current.plannerKey) throw new RegenError("invalid_response");
  if (!isDeepStrictEqual(content.assetIds, current.assetIds)) throw new RegenError("invalid_evidence");
  if (content.type === "useCase" && current.type === "useCase" && current.items.some(item => item.assetIds.length)
    && !isDeepStrictEqual(content.items.map(item => item.assetIds), current.items.map(item => item.assetIds))) throw new RegenError("invalid_evidence");
  if (content.type === "specification" && current.type === "specification" && !isDeepStrictEqual(content.rows, current.rows)) throw new RegenError("invalid_evidence");
  if (content.type === "option" && current.type === "option") {
    if (current.optionSnapshot) {
      if (content.items?.length || (content.optionSnapshot && !isDeepStrictEqual(content.optionSnapshot, current.optionSnapshot))) throw new RegenError("invalid_evidence");
      delete content.items; content.optionSnapshot = structuredClone(current.optionSnapshot);
    } else if (content.optionSnapshot || !isDeepStrictEqual(content.items, current.items)) throw new RegenError("invalid_evidence");
  }
  try { validateSectionContent(content, context.latest, context.target, current.assetIds); }
  catch { throw new RegenError("invalid_evidence"); }
  try {
    validateCommerceCopy(content);
    validateGeneratedTitle(content, context.latest);
    const comparison = messageDuplication([{ ...content, purpose: context.target.purpose }, ...(context.input.otherSections ?? [])]);
    if (comparison.duplicates.some(pair => pair.first === 0)) throw new CommerceCopyError("duplicate_purpose");
    return content;
  } catch { throw new RegenError("copy_quality"); }
}
export function regeneratedContent(value: unknown, context: RegenerationContext, generatedAt: string, generationId: string, model: string) {
  const content = validateRegeneration(value, context);
  const meta = { ...context.section.content.meta }; delete meta.groundingStatus;
  return storedContentSchema.parse({ ...content, meta: { ...meta, regeneration: { regenerated: true, regeneratedAt: generatedAt,
    provider: "openai", model, generationId, previousRevision: context.section.updated_at } } });
}

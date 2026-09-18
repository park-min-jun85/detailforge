import { z } from "zod";
import { aiSectionContentSchema, sectionContentSchema, sectionStyleSchema, storedContentSchema } from "@/features/section-engine/schemas";
import type { SectionType } from "@/types/domain";
const timestamp = z.iso.datetime({ offset: true }), fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
export const regenerateRequestSchema = z.strictObject({ revision: timestamp });
export function regenerationProviderSchema(type: SectionType) {
  return z.strictObject({ schemaVersion: z.literal(1), content: aiSectionContentSchema.options.find(schema => schema.shape.type.value === type)! });
}
export function regenerationOutputSchema(type: SectionType) {
  const content = sectionContentSchema.options.find(schema => schema.shape.type.value === type)!;
  return z.strictObject({ schemaVersion: z.literal(1), content });
}
export const candidateSchema = z.strictObject({ schemaVersion: z.literal(1), projectId: z.uuid(), productId: z.uuid(), detailPageId: z.uuid(), sectionId: z.uuid(),
  baseUpdatedAt: timestamp, baseFingerprint: fingerprint, inputFingerprint: fingerprint,
  content: storedContentSchema, style: sectionStyleSchema, generatedAt: timestamp, expiresAt: timestamp,
  generationId: z.uuid(), provider: z.literal("openai"), model: z.string().min(1).max(200) });
export const signedCandidateSchema = z.strictObject({ candidate: candidateSchema, signature: fingerprint });
export type Candidate = z.infer<typeof candidateSchema>;
export type SignedCandidate = z.infer<typeof signedCandidateSchema>;
export const MANUAL_REGEN_WARNING = "직접 수정한 내용이 있습니다. AI 결과를 적용하면 현재 문구가 교체됩니다.";

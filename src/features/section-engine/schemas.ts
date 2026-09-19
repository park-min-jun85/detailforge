import { optionSnapshotSchema } from "@/features/product-options/section-snapshot";
import { z } from "zod";
import { QUALITY_WARNINGS } from "@/features/page-quality/policy";
import { SECTION_TYPES, type SectionType } from "@/types/domain";

const text = (max: number) => z.string().min(1).max(max);
const refs = z.array(z.string().regex(/^[FV][1-9][0-9]{0,2}$/)).max(16);
const assets = z.array(z.uuid()).max(8);
const common = { plannerKey: z.string().regex(/^[a-z][a-z0-9-]{0,59}$/), evidenceIds: refs, assetIds: assets };
const point = z.strictObject({ text: text(200), evidenceIds: refs });
const item = z.strictObject({ title: text(80), description: text(400), evidenceIds: refs });
const row = z.strictObject({ label: text(100), value: text(500), evidenceIds: refs });
export const aiSectionContentSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...common, type: z.literal("hero"), headline: text(80), subheadline: text(160).nullable(), highlights: z.array(point).max(4) }),
  z.strictObject({ ...common, type: z.literal("keyBenefits"), title: text(80), items: z.array(item).max(4) }),
  z.strictObject({ ...common, type: z.literal("feature"), title: text(80), body: text(700), bullets: z.array(point).max(6) }),
  z.strictObject({ ...common, type: z.literal("imageText"), title: text(80), body: text(700) }),
  z.strictObject({ ...common, type: z.literal("gallery"), title: text(80).nullable(), intro: text(160).nullable() }),
  z.strictObject({ ...common, type: z.literal("useCase"), title: text(80), intro: text(160).nullable(), items: z.array(item.extend({ confidence: z.number().min(0).max(1), assetIds: assets })).max(4) }),
  z.strictObject({ ...common, type: z.literal("detail"), title: text(80), body: text(700), points: z.array(point).max(6) }),
  z.strictObject({ ...common, type: z.literal("specification"), title: text(80), rows: z.array(row).max(53) }),
  z.strictObject({ ...common, type: z.literal("option"), title: text(80), items: z.array(row).max(8) }),
  z.strictObject({ ...common, type: z.literal("notice"), title: text(80), items: z.array(point).max(8) }),
]);
const optionContent = z.strictObject({ ...common, type: z.literal("option"), title: text(80),
  items: z.array(row).max(8).optional(), optionSnapshot: optionSnapshotSchema.optional(),
}).superRefine((value, ctx) => {
  if ((value.items !== undefined) === (value.optionSnapshot !== undefined)) ctx.addIssue({ code: "custom", message: "Exactly one option representation required" });
});
export const sectionContentSchema = z.discriminatedUnion("type", [aiSectionContentSchema.options[0], aiSectionContentSchema.options[1], aiSectionContentSchema.options[2], aiSectionContentSchema.options[3], aiSectionContentSchema.options[4], aiSectionContentSchema.options[5], aiSectionContentSchema.options[6], aiSectionContentSchema.options[7], aiSectionContentSchema.options[9], optionContent]);
export const sectionOutputSchema = z.strictObject({ schemaVersion: z.literal(1), sections: z.array(aiSectionContentSchema).min(5).max(12) });
export type GeneratedSection = z.infer<typeof sectionContentSchema>;
export type SectionOutput = z.infer<typeof sectionOutputSchema>;
export const sectionStyleSchema = z.strictObject({ schemaVersion: z.literal(1), layout: z.enum(["centered", "split", "imageFirst", "textFirst", "grid", "stack"]),
  textAlign: z.enum(["left", "center"]), density: z.enum(["compact", "normal", "spacious"]), background: z.enum(["plain", "soft", "contrast"]),
  emphasis: z.enum(["normal", "strong"]), imageFit: z.enum(["contain", "cover"]) });
export function defaultSectionStyle(type: SectionType): z.infer<typeof sectionStyleSchema> {
  return { schemaVersion: 1, layout: type === "hero" ? "centered" : type === "gallery" ? "grid" : ["imageText", "feature"].includes(type) ? "split" : "stack",
    textAlign: type === "hero" ? "center" : "left", density: type === "hero" ? "spacious" : type === "notice" ? "compact" : "normal",
    background: "plain", emphasis: type === "hero" ? "strong" : "normal", imageFit: "contain" };
}
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
export function refinedSectionStyle(section: GeneratedSection, index: number): z.infer<typeof sectionStyleSchema> {
  const base=defaultSectionStyle(section.type);
  if(section.type==="specification") return {...base,density:"compact"};
  if(section.type==="option") return {...base,background:"soft"};
  if(section.assetIds.length && ["imageText","feature","detail"].includes(section.type)) return {...base,layout:index%2?"split":"imageFirst",density:"spacious",background:index%3===0?"soft":"plain"};
  return base;
}
export const sectionMetaSchema = z.strictObject({ schemaVersion: z.literal(1), plannerKey: common.plannerKey, sourcePlanFingerprint: fingerprint,
  qualityWarnings:z.array(z.enum(QUALITY_WARNINGS)).max(8).optional(),
  sourceInputFingerprint: fingerprint, generationId: z.uuid(), generatedAt: z.iso.datetime({ offset: true }), provider: z.literal("openai"), model: text(200),
  origin: z.literal("generated"), warnings: z.array(z.enum(["option_evidence_missing", "hypothesis_not_fact", "review_copy_before_publish"])).max(3),
  manualEdit: z.strictObject({ edited: z.literal(true), editedAt: z.iso.datetime({ offset: true }), textEdited: z.boolean(), assetsEdited: z.boolean() }).optional(),
  groundingStatus: z.literal("needs_review").optional(),
  regeneration: z.strictObject({ regenerated: z.literal(true), regeneratedAt: z.iso.datetime({ offset: true }),
    provider: z.literal("openai"), model: text(200), generationId: z.uuid(), previousRevision: z.iso.datetime({ offset: true }) }).optional() });
export const storedContentSchema = z.object({ meta: sectionMetaSchema }).catchall(z.unknown()).transform((value, ctx) => {
  const { meta, ...copy } = value; const parsed = sectionContentSchema.safeParse(copy);
  if (!parsed.success || parsed.data.plannerKey !== meta.plannerKey) { ctx.addIssue({ code: "custom", message: "Invalid stored section" }); return z.NEVER; }
  return { ...parsed.data, meta };
});
export const sectionRowSchema = z.object({ id: z.uuid(), detail_page_id: z.uuid(), type: z.enum(SECTION_TYPES), sort_order: z.number().int().nonnegative(),
  content: z.record(z.string(), z.json()), style: z.record(z.string(), z.json()), created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }) });
export type SectionRow = z.infer<typeof sectionRowSchema>;
export const generationStateSchema = z.strictObject({ schemaVersion: z.literal(1), runId: z.uuid(), status: z.enum(["generating", "completed", "failed", "recovery_required"]),
  startedAt: z.iso.datetime({ offset: true }), finishedAt: z.iso.datetime({ offset: true }).nullable(), errorCode: z.string().max(40).nullable(),
  backup: z.array(sectionRowSchema).max(50).nullable(), staged: z.array(sectionRowSchema).max(12),
}).superRefine((state, ctx) => {
  if ((state.status === "generating" && (state.backup === null || state.finishedAt !== null || state.errorCode !== null))
    || (state.status === "completed" && (state.backup !== null || state.staged.length || !state.finishedAt || state.errorCode))
    || (state.status === "recovery_required" && state.backup === null)
    || new Set([...(state.backup ?? []), ...state.staged].map(row => row.id)).size !== (state.backup?.length ?? 0) + state.staged.length)
    ctx.addIssue({ code: "custom", message: "Invalid generation journal" });
});
export type GenerationState = z.infer<typeof generationStateSchema>;
export function isGenerationActive(state: GenerationState | null, now: number) {
  const age = now - Date.parse(state?.startedAt ?? ""); return state?.status === "generating" && age >= 0 && age < 300000;
}
export function sectionsAreStale(rows: SectionRow[], sourcePlanFingerprint: string | null, planReady: boolean) {
  return rows.length > 0 && (!planReady || rows.some(row => {
    const parsed = storedContentSchema.safeParse(row.content);
    return !parsed.success || parsed.data.meta.sourcePlanFingerprint !== sourcePlanFingerprint;
  }));
}

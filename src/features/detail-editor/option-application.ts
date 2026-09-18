import "server-only";
import { sectionsAreStale } from "@/features/section-engine/schemas";
import { sourcePlanFingerprint } from "@/features/section-engine/grounding";
import { getPlannerView } from "@/features/page-planner/service";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { getConfirmedProductOptions } from "@/features/product-options/queries";
import { OptionError } from "@/features/product-options/errors";
import { optionFreshness, type ConfirmedOptions, type OptionFreshness } from "@/features/product-options/section-snapshot";
import { buildConfirmedOptionSnapshot } from "@/features/section-engine/options";
import { claimEditLease, releaseEditLease } from "@/features/section-engine/edit-lease";
import { readRows } from "@/features/section-engine/persistence";
import { SectionEngineError } from "@/features/section-engine/errors";
import { editorContext } from "./service";
import { editorSectionSchema, type EditorSection } from "./schemas";
import { EditorError } from "./errors";

export const optionApplySchema = z.strictObject({ revision: z.iso.datetime({ offset: true }),
  productId: z.uuid(), rowId: z.uuid(), expectedVersion: z.number().int().positive(),
  expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/), confirmEmpty: z.boolean() });
export type OptionComparison = { section: EditorSection; current: ConfirmedOptions | null; freshness: OptionFreshness; planStale: boolean };
export async function readOptionFreshness(projectId: string, productId: string) {
  try { return { current: (await getConfirmedProductOptions(projectId, productId)).snapshot, failure: null }; }
  catch (error) { return { current: null, failure: error instanceof OptionError && error.code === "invalid_schema" ? "invalid" as const : "unavailable" as const }; }
}
async function target(projectId: string, sectionId: string) {
  if (!z.uuid().safeParse(sectionId).success) throw new EditorError("not_found");
  const ctx = await editorContext(projectId), row = ctx.rows.find(row => row.id === sectionId);
  if (!ctx.page || !ctx.scope.product || !row || row.detail_page_id !== ctx.page.id || row.type !== "option") throw new EditorError("not_found");
  const section = editorSectionSchema.parse(row);
  if (section.content.type !== "option") throw new EditorError("invalid_input");
  return { ...ctx, page: ctx.page, product: ctx.scope.product, section };
}
export async function compareSectionOptions(projectId: string, sectionId: string): Promise<OptionComparison> {
  const ctx = await target(projectId, sectionId), source = await readOptionFreshness(projectId, ctx.product.id);
  const planner = await getPlannerView(projectId).catch(() => null);
  const plan = planner?.state?.latestResult;
  return { planStale: !planner || planner.stale || sectionsAreStale(ctx.rows, plan ? sourcePlanFingerprint(plan) : null, !!plan), section: ctx.section, current: source.current, freshness: source.current
    ? optionFreshness(ctx.section.content.type === "option" ? ctx.section.content.optionSnapshot : undefined, source.current) : source.failure! };
}
export async function applySectionOptions(projectId: string, sectionId: string, input: unknown) {
  try {
    const request = optionApplySchema.parse(input), ctx = await target(projectId, sectionId);
    const check = async () => {
      const source = (await getConfirmedProductOptions(projectId, ctx.product.id)).snapshot;
      if (request.productId !== ctx.product.id || source.productId !== ctx.product.id) throw new EditorError("ownership");
      if (source.rowId !== request.rowId || source.version !== request.expectedVersion || source.fingerprint !== request.expectedFingerprint) throw new EditorError("conflict");
      if (source.state === "missing" || (source.state === "empty" && !request.confirmEmpty)) throw new EditorError("invalid_input");
      return source;
    };
    if (ctx.section.updated_at !== request.revision) throw new EditorError("conflict");
    await check();
    const lease = await claimEditLease(ctx.client, ctx.page);
    try {
      const source = await check();
      const copy = ctx.section.content;
      if (copy.type !== "option") throw new EditorError("invalid_input");
      const { items, optionSnapshot, ...preserved } = copy; void items; void optionSnapshot;
      const content = { ...preserved, optionSnapshot: buildConfirmedOptionSnapshot(source, new Date().toISOString()) };
      const result = await ctx.client.from("sections").update({ content }).eq("id", sectionId).eq("detail_page_id", ctx.page.id)
        .eq("updated_at", request.revision).select("*").abortSignal(AbortSignal.timeout(10000)).maybeSingle();
      // A lost acknowledgement is not retried as a new mutation.
      const actual = result.error ? (await readRows(ctx.client, ctx.page.id)).find(row => row.id === sectionId) : result.data;
      if (!actual) throw new EditorError(result.error ? "unexpected" : "conflict");
      const saved = editorSectionSchema.parse(actual);
      if (saved.id !== sectionId || saved.detail_page_id !== ctx.page.id || saved.type !== "option" || saved.sort_order !== ctx.section.sort_order
        || !isDeepStrictEqual(saved.content, content) || !isDeepStrictEqual(saved.style, ctx.section.style)) throw new EditorError("unexpected");
      const after = await readOptionFreshness(projectId, ctx.product.id);
      // Separate rows are not atomic. Return the saved row even when the source changed after the write.
      const freshness = after.current ? optionFreshness(content.optionSnapshot, after.current) : after.failure!;
      return { section: saved, freshness, sourceChangedDuringSave: !after.current || after.current.version !== source.version || freshness !== "current" };
    } finally { await releaseEditLease(ctx.client, ctx.page, lease.id).catch(() => undefined); }
  } catch (error) {
    if (error instanceof EditorError) throw error;
    if (error instanceof z.ZodError) throw new EditorError("invalid_input");
    if (error instanceof SectionEngineError && ["busy", "conflict"].includes(error.code)) throw new EditorError(error.code as "busy" | "conflict");
    throw new EditorError("unexpected");
  }
}

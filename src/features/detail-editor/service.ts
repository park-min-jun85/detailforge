import "server-only";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAssetContext, listAssets } from "@/features/assets/service";
import { AssetError, assetRowSchema, assertAssetScope } from "@/features/assets/schemas";
import { readPage, readRows, readGeneration } from "@/features/section-engine/persistence";
import { claimEditLease, releaseEditLease, hasEditLease } from "@/features/section-engine/edit-lease";
import { readReorder, hasManualOrder, visibleOrderRows } from "@/features/section-reorder/schemas";
import { getPlannerView } from "@/features/page-planner/service";
import { latestPlanSchema } from "@/features/page-planner/schemas";
import { sourcePlanFingerprint } from "@/features/section-engine/grounding";
import { sectionsAreStale } from "@/features/section-engine/schemas";
import { SectionEngineError } from "@/features/section-engine/errors";
import { EditorError } from "./errors";
import { editorSectionSchema, editRequestSchema, prepareEdit } from "./schemas";
import type { EditorView } from "./types";

function safe(error: unknown): EditorError {
  if (error instanceof EditorError) return error;
  if (error instanceof z.ZodError) return new EditorError("invalid_input");
  if (error instanceof AssetError && error.status === 404) return new EditorError("not_found");
  if (error instanceof SectionEngineError && ["busy", "conflict", "ownership"].includes(error.code)) return new EditorError(error.code as "busy" | "conflict" | "ownership");
  return new EditorError("unexpected");
}
export async function editorContext(projectId: string) {
  if (!z.uuid().safeParse(projectId).success) throw new EditorError("not_found");
  const client = createSupabaseServerClient();
  const scope = await getAssetContext(projectId, client);
  const page = await readPage(client, projectId);
  if (!scope.product) return { client, scope, page, assets: [], rows: [], generation: null };
  const result = await client.from("assets").select("*").eq("project_id", projectId).eq("product_id", scope.product.id)
    .order("sort_order").order("id").abortSignal(AbortSignal.timeout(10000));
  if (result.error) throw new EditorError("unexpected");
  const assets = result.data.map(row => assetRowSchema.parse(row));
  for (const asset of assets) {
    try { assertAssetScope(asset, projectId, scope.product.id); } catch { throw new EditorError("ownership"); }
  }
  const generation = page ? readGeneration(page) : null;
  const rows = page ? await readRows(client, page.id) : [];
  if (page) {
    const after = await readPage(client, projectId);
    if (!after || after.id !== page.id || after.updated_at !== page.updated_at || !isDeepStrictEqual(after.settings.sectionGeneration, page.settings.sectionGeneration)
      || !isDeepStrictEqual(after.settings.sectionReorder, page.settings.sectionReorder) || !isDeepStrictEqual(after.plan, page.plan)) throw new EditorError("conflict");
  }
  return { client, scope, page, assets, rows, generation };
}
export async function getEditorView(projectId: string): Promise<EditorView> {
  try {
    const ctx = await editorContext(projectId), reorder = ctx.page ? readReorder(ctx.page.settings) : null;
    if (reorder && reorder.detailPageId !== ctx.page?.id) throw new EditorError("not_found");
    const visible = ctx.generation?.backup ?? visibleOrderRows(ctx.rows, reorder);
    const sections = visible.map(row => editorSectionSchema.parse(row));
    const plan = latestPlanSchema.safeParse(ctx.page?.plan.latestResult);
    const planner = await getPlannerView(projectId).catch(() => null);
    let previewWarning = false;
    const previews = ctx.scope.product ? await listAssets(projectId).catch(() => { previewWarning = true; return null; }) : null;
    return { projectId, projectName: ctx.scope.project.name, productName: ctx.scope.product?.name ?? "상품정보 없음", detailPageId: ctx.page?.id ?? null, sections,
      stale: sectionsAreStale(visible, plan.success ? sourcePlanFingerprint(plan.data) : null, plan.success) || !planner || planner.stale,
      blocked: !!reorder || !!ctx.generation?.backup || ctx.generation?.status === "generating", previewWarning,
      reorderRecovery: !!reorder && !!ctx.page && !hasEditLease(ctx.page), manualOrder: !!ctx.page && hasManualOrder(ctx.page.settings, ctx.rows),
      assets: ctx.assets.map(asset => ({ id: asset.id, name: asset.originalFilename, previewUrl: previews?.items.find(item => item.asset.id === asset.id)?.previewUrl ?? null })) };
  } catch (error) { throw safe(error); }
}
export async function saveSection(projectId: string, sectionId: string, input: unknown) {
  try {
    if (!z.uuid().safeParse(sectionId).success) throw new EditorError("not_found");
    const request = editRequestSchema.parse(input), ctx = await editorContext(projectId);
    const existing = ctx.rows.find(row => row.id === sectionId);
    if (!ctx.page || !ctx.scope.product || !existing || existing.detail_page_id !== ctx.page.id) throw new EditorError("not_found");
    const section = editorSectionSchema.parse(existing);
    if (section.updated_at !== request.revision) throw new EditorError("conflict");
    const edit = prepareEdit(section, request, new Date().toISOString());
    const ids = [...edit.content.assetIds, ...(edit.content.type === "useCase" ? edit.content.items.flatMap(item => item.assetIds) : [])];
    if (ids.some(id => !ctx.assets.some(asset => asset.id === id))) throw new EditorError("ownership");
    const lease = await claimEditLease(ctx.client, ctx.page);
    try {
      // Only content/style are writable. Postgres updated_at is the compare-and-swap revision.
      const result = await ctx.client.from("sections").update({ content: edit.content, style: edit.style })
        .eq("id", sectionId).eq("detail_page_id", ctx.page.id).eq("updated_at", request.revision)
        .select("*").abortSignal(AbortSignal.timeout(10000)).maybeSingle();
      if (result.error) throw new EditorError("unexpected");
      if (!result.data) throw new EditorError("conflict");
      const saved = editorSectionSchema.parse(result.data);
      if (saved.id !== sectionId || saved.detail_page_id !== ctx.page.id || saved.type !== section.type || saved.sort_order !== section.sort_order) throw new EditorError("unexpected");
      return saved;
    } finally { await releaseEditLease(ctx.client, ctx.page, lease.id).catch(() => undefined); }
  } catch (error) { throw safe(error); }
}

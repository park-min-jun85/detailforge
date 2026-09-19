import "server-only";
import { planQuality } from "@/features/page-quality/policy";
import { readOptionFreshness } from "@/features/detail-editor/option-application";
import { optionFreshness, OPTION_FRESHNESS_LABELS } from "@/features/product-options/section-snapshot";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAssetContext, listAssets } from "@/features/assets/service";
import { AssetError } from "@/features/assets/schemas";
import { readPage, readRows, readGeneration } from "@/features/section-engine/persistence";
import { hasEditLease } from "@/features/section-engine/edit-lease";
import { readReorder } from "@/features/section-reorder/schemas";
import { getPlannerView } from "@/features/page-planner/service";
import { latestPlanSchema } from "@/features/page-planner/schemas";
import { sourcePlanFingerprint } from "@/features/section-engine/grounding";
import { sectionsAreStale } from "@/features/section-engine/schemas";
import { RenderError } from "./errors";
import { mapCanonicalSections, referencedAssetIds, type RenderView } from "./model";

export async function getRenderView(projectId: string): Promise<RenderView> {
  if (!z.uuid().safeParse(projectId).success) throw new RenderError("not_found");
  try {
    const client = createSupabaseServerClient(), scope = await getAssetContext(projectId, client);
    const view: RenderView = { projectId, projectName: scope.project.name, productName: scope.product?.name ?? null,
      detailPageId: null, width: null, state: "product_missing", sections: [], assets: [],
      readiness: { sectionCount: 0, needsReviewCount: 0, missingImageCount: 0, stalePlan: false, validation: "unknown", unavailable: false } };
    if (!scope.product) return view;
    const page = await readPage(client, projectId);
    if (!page) return { ...view, state: "page_missing" };
    view.detailPageId = page.id; view.width = page.width;
    const generation = readGeneration(page), reorder = readReorder(page.settings);
    if (reorder && reorder.detailPageId !== page.id) throw new RenderError("invalid");
    // Never expose staged generation rows or a partially written reorder. No recovery writes on GET.
    if (hasEditLease(page) || generation?.backup || generation?.status === "generating" || reorder) return { ...view, state: "busy" };
    const rows = await readRows(client, page.id), mapped = mapCanonicalSections(rows, page.id);
    view.sections = mapped.sections; view.readiness.sectionCount = rows.length; view.readiness.needsReviewCount = mapped.needsReviewCount;
    const optionSections = view.sections.filter(section => section.content.type === "option");
    if (optionSections.length) {
      const source = await readOptionFreshness(projectId, scope.product.id);
      view.readiness.optionWarnings = [...new Set(optionSections.map(section => source.current ? optionFreshness(section.content.type === "option" ? section.content.optionSnapshot : undefined, source.current) : source.failure!).filter(status => status !== "current").map(status => OPTION_FRESHNESS_LABELS[status]))];
    }
    const ids = referencedAssetIds(view.sections);
    if (ids.length) {
      const previews = await listAssets(projectId, ids).catch(() => null);
      view.assets = previews?.items.map(({ asset, previewUrl }) => ({ id: asset.id, name: asset.originalFilename, previewUrl, width: asset.width, height: asset.height })) ?? [];
      view.readiness.missingImageCount = ids.filter(id => !view.assets.some(asset => asset.id === id && asset.previewUrl)).length;
    }
    const plan = latestPlanSchema.safeParse(page.plan.latestResult);
    if(plan.success) view.readiness.qualityWarnings=planQuality(view.sections.map(s=>({...s.content,key:s.content.plannerKey})),plan.data.evidenceSnapshot,plan.data.assetSnapshot).warnings;
    const planner = await getPlannerView(projectId).catch(() => null);
    view.assets = view.assets.map(asset => { const v=planner?.assets.find(a=>a.assetId===asset.id)?.visual; return {...asset,width:asset.width??v?.width,height:asset.height??v?.height}; });
    view.readiness.stalePlan = sectionsAreStale(rows, plan.success ? sourcePlanFingerprint(plan.data) : null, plan.success) || !!planner?.stale;
    view.readiness.validation = planner?.validationStatus ?? "unknown";
    view.readiness.unavailable = !planner;
    // Recheck the persisted page and rows after all reads/signing; mixed snapshots fail closed.
    const after = await readPage(client, projectId), afterRows = await readRows(client, page.id);
    if (!after || !isDeepStrictEqual(after, page) || !isDeepStrictEqual(afterRows, rows)) throw new RenderError("conflict");
    return { ...view, state: rows.length ? "ready" : "empty" };
  } catch (error) {
    if (error instanceof RenderError) throw error;
    if (error instanceof AssetError && error.status === 404) throw new RenderError("not_found");
    if (error instanceof z.ZodError) throw new RenderError("invalid");
    throw new RenderError("unavailable");
  }
}

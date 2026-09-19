import { COMMERCE_SEMANTIC_VERSION } from "@/features/page-quality/title-policy";
import { COMMERCE_COPY_VERSION, copyIntent } from "@/features/page-quality/commerce";
import { sectionTitle } from "@/features/page-quality/policy";
import "server-only";
import { isDeepStrictEqual } from "node:util";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAssetContext } from "@/features/assets/service";
import { assetRowSchema, assertAssetScope } from "@/features/assets/schemas";
import { getPlannerView } from "@/features/page-planner/service";
import { isPlannerActive } from "@/features/page-planner/schemas";
import { readPage, readRows, readGeneration } from "@/features/section-engine/persistence";
import { hasEditLease } from "@/features/section-engine/edit-lease";
import { readReorder } from "@/features/section-reorder/schemas";
import { editorSectionSchema } from "@/features/detail-editor/schemas";
import { sourcePlanFingerprint, buildSectionInput } from "@/features/section-engine/grounding";
import { validationFingerprint } from "@/features/fact-validation/evidence";
import { RegenError } from "./errors";
import type { RegenerationInput } from "./types";
export async function regenerationContext(projectId: string, sectionId: string, ownLeaseId?: string) {
  const client = createSupabaseServerClient(), scope = await getAssetContext(projectId, client);
  if (!scope.product) throw new RegenError("not_found");
  const planner = await getPlannerView(projectId), page = await readPage(client, projectId);
  if (!page || planner.detailPageId !== page.id) throw new RegenError("not_found");
  if (!isDeepStrictEqual(page.plan, planner.state ?? {})) throw new RegenError("conflict");
  const generation = readGeneration(page);
  const leaseId = (page.settings.sectionEdit as { id?: string } | undefined)?.id;
  if ((hasEditLease(page) && leaseId !== ownLeaseId) || generation?.backup || generation?.status === "generating" || readReorder(page.settings) || isPlannerActive(planner.state, Date.now())) throw new RegenError("busy");
  if (ownLeaseId && (leaseId !== ownLeaseId || !hasEditLease(page))) throw new RegenError("conflict");
  if (planner.validationStatus !== "ready") throw new RegenError("stale_validation");
  const latest = planner.state?.latestResult;
  if (!latest || planner.stale || planner.prerequisite !== "ready") throw new RegenError("stale_plan");
  buildSectionInput(latest); // Revalidate the saved boundary; peers send only bounded editorial summaries.
  const result = await client.from("sections").select("*").eq("id", sectionId).eq("detail_page_id", page.id).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
  if (result.error) throw new RegenError("database");
  if (!result.data) throw new RegenError("not_found");
  const section = editorSectionSchema.parse(result.data);
  if (section.id !== sectionId || section.detail_page_id !== page.id) throw new RegenError("ownership");
  const fingerprint = sourcePlanFingerprint(latest), target = latest.plan.sections.find(item => item.key === section.content.plannerKey);
  if (!target || target.type !== section.type || section.content.meta.sourcePlanFingerprint !== fingerprint) throw new RegenError("stale_plan");
  const assetsResult = await client.from("assets").select("*").or(`project_id.eq.${projectId},product_id.eq.${scope.product.id}`).limit(31).abortSignal(AbortSignal.timeout(10000));
  if (assetsResult.error) throw new RegenError("database");
  const assets = assetsResult.data.map(row => assetRowSchema.parse(row));
  for (const asset of assets) { try { assertAssetScope(asset, projectId, scope.product.id); } catch { throw new RegenError("ownership"); } }
  const usedAssets = [...target.assetIds, ...section.content.assetIds, ...(section.content.type === "useCase" ? section.content.items.flatMap(item => item.assetIds) : [])];
  if (usedAssets.some(id => !assets.some(asset => asset.id === id))) throw new RegenError("ownership");
  const after = await readPage(client, projectId);
  if (!after || after.id !== page.id || after.updated_at !== page.updated_at) throw new RegenError("conflict");
  const allowed = new Set(target.evidenceIds);
  let strategy = planner.productAnalysisStatus === "ready" ? structuredClone(latest.strategySnapshot) : null;
  if (strategy) {
    const within = (item: { evidenceIds: string[] }) => item.evidenceIds.length > 0 && item.evidenceIds.every(id => allowed.has(id));
    if (!within(strategy.summary)) strategy = null;
    else {
      strategy.valuePropositions = strategy.valuePropositions.filter(within); strategy.audienceHypotheses = strategy.audienceHypotheses.filter(within);
      strategy.useCaseHypotheses = strategy.useCaseHypotheses.filter(within); strategy.messagingAngles = strategy.messagingAngles.filter(within); strategy.cautions = strategy.cautions.filter(within);
    }
  }
  const peers = (await readRows(client, page.id)).map(row => editorSectionSchema.parse(row));
  if (peers.length > 50 || peers.some(row => row.detail_page_id !== page.id) || !peers.some(row => isDeepStrictEqual(row, section))) throw new RegenError("conflict");
  const otherSections = peers.filter(row => row.id !== section.id).map(row => ({ key: row.content.plannerKey, type: row.type, title: sectionTitle(row.content), purpose: latest.plan.sections.find(p => p.key === row.content.plannerKey)?.purpose, evidenceIds: row.content.evidenceIds, assetIds: row.content.assetIds }));
  const input: RegenerationInput = { copyIntent: copyIntent(section.type), otherSections, target, current: { type: section.type, content: section.content, style: section.style }, heroAssetId: latest.plan.heroAssetId,
    evidence: latest.evidenceSnapshot.filter(evidence => allowed.has(evidence.id)), strategy,
    validation: { status: "ready", supported: latest.factPolicySnapshot.supported.filter(fact => allowed.has(fact.factId)).map(fact => fact.factId),
      restricted: latest.factPolicySnapshot.restricted.map(({ factId, status }) => ({ factId, status })) } };
  if (JSON.stringify(input).length > 180000) throw new RegenError("invalid_input");
  return { client, scope, page, section, target, latest, input, inputFingerprint: validationFingerprint({ plan: fingerprint, current: planner.inputFingerprint, productId: scope.product.id, commerceSemanticVersion:COMMERCE_SEMANTIC_VERSION, commerceCopyVersion:COMMERCE_COPY_VERSION, otherSections }) };
}
export type RegenerationContext = Awaited<ReturnType<typeof regenerationContext>>;

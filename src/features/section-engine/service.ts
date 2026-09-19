import { CommerceCopyError } from "@/features/page-quality/commerce";
import "server-only";
import { copyQuality } from "@/features/page-quality/policy";
import { buildConfirmedOptionSnapshot } from "./options";
import { hasEditLease } from "./edit-lease";
import { readReorder, hasManualOrder, visibleOrderRows } from "@/features/section-reorder/schemas";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlannerView } from "@/features/page-planner/service";
import { validationFingerprint } from "@/features/fact-validation/evidence";
import { parseId } from "@/features/assets/schemas";
import { SectionEngineError } from "./errors";
import { buildSectionInput, sourcePlanFingerprint, validateSectionOutput } from "./grounding";
import { defaultSectionStyle, refinedSectionStyle, isGenerationActive, sectionsAreStale, sectionMetaSchema, type GenerationState, type SectionRow } from "./schemas";
import { getSectionProvider } from "./provider";
import { SECTION_TIMEOUT_MS } from "./config";
import { readPage, readRows, readGeneration, writeGeneration, ownedPage, insertRows, removeRows, restoreGeneration, sameRow, type Client } from "./persistence";
import type { SectionView, SectionProvider } from "./types";
const running = new Set<string>();
function safe(error: unknown) {
  if (error instanceof SectionEngineError) return error;
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  return new SectionEngineError(code === "not_found" ? "not_found" : code === "ownership" ? "ownership" : ["product_required", "facts_required"].includes(String(code)) ? "plan_required" : "unexpected");
}
function id(value: string) { try { return parseId(value); } catch { throw new SectionEngineError("not_found"); } }
async function load(client: Client, projectId: string) {
  const planner = await getPlannerView(projectId), page = await readPage(client, projectId);
  if (page?.id !== (planner.detailPageId ?? undefined) && !(page === null && planner.detailPageId === null)) throw new SectionEngineError("conflict");
  if (page && !isDeepStrictEqual(page.plan, planner.state ?? {})) throw new SectionEngineError("conflict");
  const state = page ? readGeneration(page) : null, rows = page ? await readRows(client, page.id) : [];
  if (page) {
    const after = await readPage(client, projectId);
    if (!after || after.id !== page.id || after.updated_at !== page.updated_at || !isDeepStrictEqual(after.settings.sectionGeneration, page.settings.sectionGeneration)
      || !isDeepStrictEqual(after.settings.sectionReorder, page.settings.sectionReorder) || !isDeepStrictEqual(after.plan, page.plan)) throw new SectionEngineError("conflict");
  }
  const latest = planner.state?.latestResult;
  const planReady = Boolean(page && latest && !planner.stale && planner.prerequisite === "ready" && planner.validationStatus === "ready");
  return { planner, page, state, rows, latest, planReady, fingerprint: latest ? sourcePlanFingerprint(latest) : null };
}
function view(context: Awaited<ReturnType<typeof load>>): SectionView & { revision: string } {
  const { planner, page, state, planReady, fingerprint } = context;
  const rows = state?.backup ?? visibleOrderRows(context.rows, page ? readReorder(page.settings) : null);
  return { projectId: planner.projectId, projectName: planner.projectName, productName: planner.productName, detailPageId: page?.id ?? null,
    planReady, sourcePlanFingerprint: fingerprint, planSectionCount: context.latest?.plan.sections.length ?? 0, sections: rows,
    stale: sectionsAreStale(rows, fingerprint, planReady), revision: validationFingerprint(rows), manualOrder: !!page && hasManualOrder(page.settings, rows),
    generation: state ? { status: state.status, startedAt: state.startedAt, finishedAt: state.finishedAt, errorCode: state.errorCode } : null,
    recoveryNeeded: Boolean(state?.backup && !isGenerationActive(state, Date.now())), assets: planner.assets };
}
export async function getSectionView(projectId: string) {
  try { return view(await load(createSupabaseServerClient(), id(projectId))); } catch (error) { throw safe(error); }
}
async function invoke(provider: SectionProvider, input: Parameters<SectionProvider["generate"]>[0]) {
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([provider.generate(structuredClone(input), controller.signal), new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new SectionEngineError("timeout")); }, SECTION_TIMEOUT_MS);
  })]); } catch (error) { throw error instanceof SectionEngineError ? error : new SectionEngineError("provider"); }
  finally { if (timer) clearTimeout(timer); }
}
export async function generateSections(projectId: string, options: { replaceExisting?: boolean; expectedRevision?: string } = {}, providerFactory: () => SectionProvider = getSectionProvider) {
  const project = id(projectId);
  if (running.has(project) || running.size >= 2) throw new SectionEngineError("busy");
  running.add(project);
  try {
    const client = createSupabaseServerClient(), context = await load(client, project), initial = view(context);
    if (isGenerationActive(context.state, Date.now()) || (context.page && (hasEditLease(context.page) || readReorder(context.page.settings)))) throw new SectionEngineError("busy");
    if (context.state?.backup && context.page) {
      // Recovery is explicit and costs no provider call. A subsequent user action can generate new content.
      await restoreGeneration(client, context.page, context.state.runId, "interrupted");
      return view(await load(client, project));
    }
    if (!context.planReady || !context.page || !context.latest || !context.fingerprint) throw new SectionEngineError("plan_required");
    if (context.rows.length > 50) throw new SectionEngineError("invalid_input");
    if (context.rows.length && (!options.replaceExisting || options.expectedRevision !== initial.revision)) throw new SectionEngineError("confirmation_required");
    if (options.expectedRevision && options.expectedRevision !== initial.revision) throw new SectionEngineError("conflict");
    const provider = providerFactory(), runId = randomUUID(), now = new Date().toISOString();
    let state: GenerationState = { schemaVersion: 1, runId, status: "generating", startedAt: now, finishedAt: null, errorCode: null, backup: context.rows, staged: [] };
    let page = await writeGeneration(client, context.page, state);
    try {
      const output = await invoke(provider, buildSectionInput(context.latest));
      let result;
      try { result = validateSectionOutput(output, context.latest); } catch (error) { throw new SectionEngineError(error instanceof CommerceCopyError ? "copy_quality" : "invalid_response"); }
      const latest = await load(client, project);
      if (latest.planner.optionsVersion !== context.planner.optionsVersion || !latest.planReady || latest.fingerprint !== context.fingerprint || latest.page?.id !== page.id) throw new SectionEngineError("input_changed");
      if (!isDeepStrictEqual(latest.rows, context.rows)) throw new SectionEngineError("conflict");
      const generatedAt = new Date().toISOString();
      const rows: SectionRow[] = result.sections.map((section, sortOrder) => ({ id: randomUUID(), detail_page_id: page.id, type: section.type, sort_order: sortOrder,
        content: { ...(section.type === "option" && context.latest!.optionsSnapshot ? { type: section.type, plannerKey: section.plannerKey, title: "옵션 안내", evidenceIds: section.evidenceIds, assetIds: section.assetIds,
          optionSnapshot: buildConfirmedOptionSnapshot(context.latest!.optionsSnapshot, generatedAt) } : section), meta: sectionMetaSchema.parse({ schemaVersion: 1, plannerKey: section.plannerKey, sourcePlanFingerprint: context.fingerprint,
          sourceInputFingerprint: context.latest!.inputFingerprint, generationId: runId, generatedAt, provider: "openai", model: provider.model, origin: "generated",
          qualityWarnings:copyQuality(result.sections).warnings,
          warnings: ["review_copy_before_publish", ...(section.type === "option" && !context.latest!.optionsSnapshot && !section.items.length ? ["option_evidence_missing"] : []), ...(section.type === "useCase" ? ["hypothesis_not_fact"] : [])] }) },
        style: context.latest!.presentationVersion===1?refinedSectionStyle(section,sortOrder,context.latest!.optionsSnapshot?.groups.reduce((n,g)=>n+g.values.length,0)):defaultSectionStyle(section.type), created_at: generatedAt, updated_at: generatedAt }));
      state = { ...state, staged: rows };
      page = await writeGeneration(client, await ownedPage(client, page, runId), state);
      await insertRows(client, rows);
      const check = await load(client, project);
      if (check.planner.optionsVersion !== context.planner.optionsVersion || !check.planReady || check.fingerprint !== context.fingerprint) throw new SectionEngineError("input_changed");
      if (check.rows.length !== context.rows.length + rows.length || !context.rows.every(old => check.rows.some(row => sameRow(row, old)))) throw new SectionEngineError("conflict");
      await ownedPage(client, page, runId);
      await removeRows(client, context.rows);
      const stored = await readRows(client, page.id);
      if (stored.length !== rows.length || !rows.every(row => stored.some(item => sameRow(item, row)))) throw new SectionEngineError("conflict");
      page = await ownedPage(client, page, runId);
      await writeGeneration(client, page, { ...state, status: "completed", finishedAt: new Date().toISOString(), errorCode: null, backup: null, staged: [] });
    } catch (error) {
      const failure = safe(error);
      const actual = await ownedPage(client, page, runId);
      if (readGeneration(actual)?.status !== "completed") {
        const code = failure.code === "unexpected" ? "database" : failure.code;
        await restoreGeneration(client, actual, runId, code);
        throw new SectionEngineError(code);
      }
    }
    return view(await load(client, project));
  } catch (error) { throw safe(error); }
  finally { running.delete(project); }
}

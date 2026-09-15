import "server-only";
import { hasEditLease } from "@/features/section-engine/edit-lease";
import { readReorder } from "@/features/section-reorder/schemas";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectRowSchema } from "@/features/projects/schemas";
import { productRowSchema, productFactsRowSchema } from "@/features/products/schemas";
import { assetRowSchema, parseId } from "@/features/assets/schemas";
import { detailPageRowSchema, plannerStateSchema, isPlannerActive, isPlanStale, validatePagePlan, PLANNER_WARNINGS, type PlannerState } from "./schemas";
import { buildPlannerInput } from "./evidence";
import { PlannerError } from "./errors";
import { getPlannerProvider } from "./provider";
import { PLANNER_TIMEOUT_MS } from "./config";
import type { PlannerContextInput, PlannerProvider, PlannerView } from "./types";

type Client = ReturnType<typeof createSupabaseServerClient>;
type Page = ReturnType<typeof detailPageRowSchema.parse>;
const timeout = () => AbortSignal.timeout(10000);
const running = new Set<string>();
function id(value: string) { try { return parseId(value); } catch { throw new PlannerError("not_found"); } }
function safe(error: unknown) { return error instanceof PlannerError ? error : new PlannerError("database"); }
function readState(value: Record<string, unknown>) {
  if (!Object.keys(value).length) return null;
  const parsed = plannerStateSchema.safeParse(value);
  if (!parsed.success) throw new PlannerError("invalid_input");
  return parsed.data;
}
async function readPage(client: Client, projectId: string) {
  const result = await client.from("detail_pages").select("*").eq("project_id", projectId).abortSignal(timeout()).maybeSingle();
  if (result.error) throw new PlannerError("database");
  if (!result.data) return null;
  const page = detailPageRowSchema.parse(result.data);
  if (page.project_id !== projectId) throw new PlannerError("ownership");
  return page;
}
async function loadContext(client: Client, projectId: string) {
  const projectResult = await client.from("projects").select("*").eq("id", projectId).abortSignal(timeout()).maybeSingle();
  if (projectResult.error) throw new PlannerError("database");
  if (!projectResult.data) throw new PlannerError("not_found");
  const project = projectRowSchema.parse(projectResult.data);
  if (project.id !== projectId) throw new PlannerError("ownership");
  const productResult = await client.from("products").select("*").eq("project_id", projectId).abortSignal(timeout()).maybeSingle();
  if (productResult.error) throw new PlannerError("database");
  if (!productResult.data) throw new PlannerError("product_required");
  const product = productRowSchema.parse(productResult.data);
  if (product.project_id !== projectId) throw new PlannerError("ownership");
  const [factsResult, assetsResult, page] = await Promise.all([
    client.from("product_facts").select("*").eq("product_id", product.id).abortSignal(timeout()).maybeSingle(),
    client.from("assets").select("*").or(`project_id.eq.${projectId},product_id.eq.${product.id}`).limit(31).abortSignal(timeout()),
    readPage(client, projectId),
  ]);
  if (factsResult.error || assetsResult.error) throw new PlannerError("database");
  if (!factsResult.data) throw new PlannerError("facts_required");
  const facts = productFactsRowSchema.parse(factsResult.data);
  if (facts.product_id !== product.id) throw new PlannerError("ownership");
  const assets = assetsResult.data.map((row) => assetRowSchema.parse(row));
  let current: PlannerContextInput | null = null;
  try { current = buildPlannerInput({ projectId, productId: product.id, facts: facts.facts, sourceSnapshot: facts.source_snapshot,
    validation: facts.validation, productAnalysis: product.ai_analysis, description: product.description, assets }); }
  catch (error) { if (!(error instanceof PlannerError) || error.code !== "invalid_input") throw error; }
  return { project, product, facts, page, current, state: page ? readState(page.plan) : null };
}
function view(context: Awaited<ReturnType<typeof loadContext>>): PlannerView {
  const { current, state } = context;
  const prerequisite = !current ? "invalid_input" : current.validationStatus !== "ready" ? "validation_required"
    : !current.factPolicy.supported.length && !current.input.assets.length ? "content_required" : "ready";
  return { projectId: context.project.id, projectName: context.project.name, productName: context.product.name,
    detailPageId: context.page?.id ?? null, state, prerequisite, inputFingerprint: current?.inputFingerprint ?? null,
    stale: isPlanStale(state, current?.inputFingerprint ?? null), validationStatus: current?.validationStatus ?? "invalid",
    productAnalysisStatus: current?.productAnalysisStatus ?? "invalid", factPolicy: current?.factPolicy ?? { supported: [], restricted: [] },
    assets: current?.assetSnapshot ?? [], coverage: current?.coverage ?? { total: 0, completed: 0, invalid: 0 } };
}
export async function getPlannerView(projectId: string): Promise<PlannerView> {
  const project = id(projectId);
  try { return view(await loadContext(createSupabaseServerClient(), project)); } catch (error) { throw safe(error); }
}
async function saveState(client: Client, page: Page, state: PlannerState) {
  if (hasEditLease(page) || readReorder(page.settings)) throw new PlannerError("busy");
  const value = plannerStateSchema.parse(state), before = readState(page.plan);
  let update = client.from("detail_pages").update({ plan: value }).eq("id", page.id).eq("project_id", page.project_id).eq("updated_at", page.updated_at);
  update = before ? update.eq("plan->attempt->>runId", before.attempt.runId).eq("plan->attempt->>status", before.attempt.status) : update.eq("plan", "{}");
  const result = await update.select("*").abortSignal(timeout()).maybeSingle();
  if (result.error) {
    const actual = await readPage(client, page.project_id);
    if (actual?.id === page.id && isDeepStrictEqual(actual.plan, value)) return actual;
    throw new PlannerError("database");
  }
  if (!result.data) throw new PlannerError("conflict");
  return detailPageRowSchema.parse(result.data);
}
async function claim(client: Client, projectId: string, existing: Page | null) {
  const start = (page: Page | null): PlannerState => {
    const previous = page ? readState(page.plan) : null;
    if (isPlannerActive(previous, Date.now())) throw new PlannerError("busy");
    return { schemaVersion: 1, attempt: { status: "planning", runId: randomUUID(), startedAt: new Date().toISOString(), finishedAt: null, errorCode: null }, latestResult: previous?.latestResult ?? null };
  };
  let page = existing, state = start(page);
  if (!page) {
    const pageId = randomUUID();
    // project_id UNIQUE is the cross-process duplicate guard. GET never creates a page.
    const inserted = await client.from("detail_pages").insert({ id: pageId, project_id: projectId, width: 860, status: "draft", plan: state })
      .select("*").abortSignal(timeout()).maybeSingle();
    if (!inserted.error && inserted.data) {
      page = detailPageRowSchema.parse(inserted.data);
      if (page.id !== pageId || page.project_id !== projectId) throw new PlannerError("ownership");
      return { page, state };
    }
    page = await readPage(client, projectId);
    if (page?.id === pageId && isDeepStrictEqual(page.plan, state)) return { page, state };
    if (!page) throw new PlannerError("database");
    state = start(page); // A concurrent creator's successful result is preserved, never overwritten with null.
  }
  return { page: await saveState(client, page, state), state };
}
async function finish(client: Client, projectId: string, pageId: string, state: PlannerState) {
  const page = await readPage(client, projectId);
  const active = page ? readState(page.plan) : null;
  if (!page || page.id !== pageId || active?.attempt.runId !== state.attempt.runId || active.attempt.status !== "planning") throw new PlannerError("conflict");
  return saveState(client, page, state);
}
async function invoke(provider: PlannerProvider, input: Parameters<PlannerProvider["plan"]>[0]) {
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([provider.plan(structuredClone(input), controller.signal), new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new PlannerError("timeout")); }, PLANNER_TIMEOUT_MS);
  })]); } catch (error) { throw error instanceof PlannerError ? error : new PlannerError("provider"); }
  finally { if (timer) clearTimeout(timer); }
}
export async function planPage(projectId: string, providerFactory: () => PlannerProvider = getPlannerProvider): Promise<PlannerView> {
  const project = id(projectId);
  if (running.has(project) || running.size >= 2) throw new PlannerError("busy");
  running.add(project);
  try {
    const client = createSupabaseServerClient(), context = await loadContext(client, project), initial = view(context);
    if (initial.prerequisite !== "ready") throw new PlannerError(initial.prerequisite);
    if (!context.current) throw new PlannerError("invalid_input");
    if (isPlannerActive(context.state, Date.now())) throw new PlannerError("busy");
    if (context.page && (hasEditLease(context.page) || readReorder(context.page.settings))) throw new PlannerError("busy");
    const provider = providerFactory();
    const { page, state } = await claim(client, project, context.page);
    try {
      const output = await invoke(provider, context.current.input);
      let plan;
      try { plan = validatePagePlan(output, context.current.input.evidence, context.current.input.assets); }
      catch { throw new PlannerError("invalid_response"); }
      plan.warnings = [...new Set([...plan.warnings, ...context.current.input.warnings.filter((warning): warning is typeof PLANNER_WARNINGS[number] => PLANNER_WARNINGS.includes(warning as typeof PLANNER_WARNINGS[number]))])];
      const latest = await loadContext(client, project);
      if (latest.product.id !== context.product.id || latest.current?.inputFingerprint !== context.current.inputFingerprint || view(latest).prerequisite !== "ready") throw new PlannerError("input_changed");
      const finishedAt = new Date().toISOString();
      await finish(client, project, page.id, { schemaVersion: 1, attempt: { ...state.attempt, status: "completed", finishedAt, errorCode: null },
        latestResult: { provider: "openai", model: provider.model, plannedAt: finishedAt, inputFingerprint: context.current.inputFingerprint,
          evidenceSnapshot: context.current.input.evidence, factPolicySnapshot: context.current.factPolicy, assetSnapshot: context.current.assetSnapshot,
          strategySnapshot: context.current.input.strategy, plan } });
    } catch (error) {
      const failure = safe(error);
      // A failed final save may be uncertain; finish rechecks the run rather than erasing a completed result.
      await finish(client, project, page.id, { ...state, attempt: { ...state.attempt, status: "failed", finishedAt: new Date().toISOString(), errorCode: failure.code } });
      throw failure;
    }
    return view(await loadContext(client, project));
  } catch (error) { throw safe(error); }
  finally { running.delete(project); }
}

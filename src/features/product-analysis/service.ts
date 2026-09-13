import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectRowSchema } from "@/features/projects/schemas";
import { productRowSchema, productFactsRowSchema } from "@/features/products/schemas";
import { assetRowSchema, parseId } from "@/features/assets/schemas";
import { productAnalysisStateSchema, isProductAnalysisActive, validateProductAnalysis, type ProductAnalysisState } from "./schemas";
import { buildEvidenceRegistry } from "./evidence";
import { ProductAnalysisError } from "./errors";
import { getProductAnalysisProvider } from "./provider";
import { PRODUCT_PROVIDER_TIMEOUT_MS } from "./config";
import type { ProductAnalysisProvider, ProductAnalysisView } from "./types";

type Client = ReturnType<typeof createSupabaseServerClient>;
const timeout = () => AbortSignal.timeout(10_000);
const running = new Set<string>();
function id(value: string) { try { return parseId(value); } catch { throw new ProductAnalysisError("not_found"); } }
function safe(error: unknown) { return error instanceof ProductAnalysisError ? error : new ProductAnalysisError("database"); }
function readState(value: Record<string, unknown>) {
  if (!Object.keys(value).length) return null;
  const result = productAnalysisStateSchema.safeParse(value);
  if (!result.success) throw new ProductAnalysisError("invalid_input");
  return result.data;
}
async function readProduct(client: Client, projectId: string) {
  const result = await client.from("products").select("*").eq("project_id", projectId).abortSignal(timeout()).maybeSingle();
  if (result.error) throw new ProductAnalysisError("database");
  if (!result.data) throw new ProductAnalysisError("product_required");
  const product = productRowSchema.parse(result.data);
  if (product.project_id !== projectId) throw new ProductAnalysisError("ownership");
  return product;
}
async function loadContext(client: Client, projectId: string) {
  const projectResult = await client.from("projects").select("*").eq("id", projectId).abortSignal(timeout()).maybeSingle();
  if (projectResult.error) throw new ProductAnalysisError("database");
  if (!projectResult.data) throw new ProductAnalysisError("not_found");
  const project = projectRowSchema.parse(projectResult.data);
  if (project.id !== projectId) throw new ProductAnalysisError("ownership");
  const product = await readProduct(client, projectId);
  const [factsResult, assetsResult] = await Promise.all([
    client.from("product_facts").select("*").eq("product_id", product.id).abortSignal(timeout()).maybeSingle(),
    // Inspect either FK so a corrupt cross-project relation is rejected, not silently omitted.
    client.from("assets").select("*").or(`project_id.eq.${projectId},product_id.eq.${product.id}`).limit(31).abortSignal(timeout()),
  ]);
  if (factsResult.error || assetsResult.error) throw new ProductAnalysisError("database");
  if (!factsResult.data) throw new ProductAnalysisError("facts_required");
  const facts = productFactsRowSchema.parse(factsResult.data);
  if (facts.product_id !== product.id) throw new ProductAnalysisError("ownership");
  const assets = assetsResult.data.map((row) => assetRowSchema.parse(row));
  const input = buildEvidenceRegistry({ projectId, productId: product.id, facts: facts.facts, description: product.description, assets });
  return { project, product, input, state: readState(product.ai_analysis) };
}
function view(context: Awaited<ReturnType<typeof loadContext>>): ProductAnalysisView {
  return { projectId: context.project.id, projectName: context.project.name, productName: context.product.name,
    ...context.input, state: context.state };
}
export async function getProductAnalysisView(projectId: string): Promise<ProductAnalysisView> {
  const project = id(projectId);
  try { return view(await loadContext(createSupabaseServerClient(), project)); } catch (error) { throw safe(error); }
}

async function saveState(client: Client, product: Awaited<ReturnType<typeof readProduct>>, state: ProductAnalysisState) {
  const value = productAnalysisStateSchema.parse(state);
  const before = readState(product.ai_analysis);
  let update = client.from("products").update({ ai_analysis: value }).eq("id", product.id).eq("project_id", product.project_id);
  // Every new attempt gets a server UUID. Fence its transitions without putting the large result in the URL.
  update = before ? update.eq("ai_analysis->attempt->>runId", before.attempt.runId).eq("ai_analysis->attempt->>status", before.attempt.status)
    : update.eq("ai_analysis", "{}");
  const result = await update.select("*").abortSignal(timeout()).maybeSingle();
  if (result.error) {
    const actual = await readProduct(client, product.project_id);
    if (actual.id === product.id && isDeepStrictEqual(actual.ai_analysis, value)) return actual;
    throw new ProductAnalysisError("database");
  }
  if (!result.data) throw new ProductAnalysisError("conflict");
  return productRowSchema.parse(result.data);
}
async function finish(client: Client, projectId: string, productId: string, state: ProductAnalysisState) {
  const current = await readProduct(client, projectId);
  const active = readState(current.ai_analysis);
  if (current.id !== productId || active?.attempt.status !== "analyzing" || active.attempt.runId !== state.attempt.runId)
    throw new ProductAnalysisError("conflict");
  return saveState(client, current, state);
}
async function invoke(provider: ProductAnalysisProvider, input: Parameters<ProductAnalysisProvider["analyze"]>[0]) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([provider.analyze(input, controller.signal), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new ProductAnalysisError("timeout")); }, PRODUCT_PROVIDER_TIMEOUT_MS);
    })]);
  } catch (error) { throw error instanceof ProductAnalysisError ? error : new ProductAnalysisError("provider"); }
  finally { if (timer) clearTimeout(timer); }
}
export async function analyzeProduct(projectId: string, providerFactory: () => ProductAnalysisProvider = getProductAnalysisProvider): Promise<ProductAnalysisView> {
  const project = id(projectId);
  if (running.has(project) || running.size >= 2) throw new ProductAnalysisError("busy");
  running.add(project);
  try {
    const client = createSupabaseServerClient();
    const context = await loadContext(client, project);
    if (isProductAnalysisActive(context.state, Date.now())) throw new ProductAnalysisError("busy");
    const provider = providerFactory(); // Missing config never changes DB state or starts a paid call.
    const state: ProductAnalysisState = { schemaVersion: 1, attempt: { status: "analyzing", runId: randomUUID(),
      startedAt: new Date().toISOString(), finishedAt: null, errorCode: null }, latestResult: context.state?.latestResult ?? null };
    await saveState(client, context.product, state);
    let analysis;
    try {
      // No paths, signed URLs, raw images or mutable Facts records cross this boundary.
      const output = await invoke(provider, { evidence: context.input.evidence, coverage: context.input.coverage });
      try { analysis = validateProductAnalysis(output, context.input.evidence); }
      catch { throw new ProductAnalysisError("invalid_response"); }
    } catch (error) {
      const failure = error instanceof ProductAnalysisError ? error : new ProductAnalysisError("provider");
      await finish(client, project, context.product.id, { ...state,
        attempt: { ...state.attempt, status: "failed", finishedAt: new Date().toISOString(), errorCode: failure.code } });
      throw failure;
    }
    const finishedAt = new Date().toISOString();
    await finish(client, project, context.product.id, { schemaVersion: 1,
      attempt: { ...state.attempt, status: "completed", finishedAt, errorCode: null },
      latestResult: { provider: "openai", model: provider.model, analyzedAt: finishedAt,
        inputFingerprint: context.input.inputFingerprint, evidenceSnapshot: context.input.evidence, analysis } });
    // Re-read current evidence: edits during a paid request must show stale immediately.
    return view(await loadContext(client, project));
  } catch (error) { throw safe(error); }
  finally { running.delete(project); }
}

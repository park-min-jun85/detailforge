import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectRowSchema } from "@/features/projects/schemas";
import { productRowSchema, productFactsRowSchema } from "@/features/products/schemas";
import { assetRowSchema, parseId } from "@/features/assets/schemas";
import { validationStateSchema, isValidationActive, validateFactOutput, summarizeValidation, type ValidationState } from "./schemas";
import { buildValidationEvidence } from "./evidence";
import { FactValidationError } from "./errors";
import { getValidationProvider } from "./provider";
import { VALIDATION_PROVIDER_TIMEOUT_MS } from "./config";
import type { ValidationProvider, ValidationView } from "./types";

type Client = ReturnType<typeof createSupabaseServerClient>;
const timeout = () => AbortSignal.timeout(10_000);
const running = new Set<string>();
function id(value: string) { try { return parseId(value); } catch { throw new FactValidationError("not_found"); } }
function safe(error: unknown) { return error instanceof FactValidationError ? error : new FactValidationError("database"); }
function readState(value: Record<string, unknown>) {
  if (!Object.keys(value).length) return null;
  const result = validationStateSchema.safeParse(value);
  if (!result.success) throw new FactValidationError("invalid_input");
  return result.data;
}
async function readProduct(client: Client, projectId: string) {
  const result = await client.from("products").select("*").eq("project_id", projectId).abortSignal(timeout()).maybeSingle();
  if (result.error) throw new FactValidationError("database");
  if (!result.data) throw new FactValidationError("product_required");
  const product = productRowSchema.parse(result.data);
  if (product.project_id !== projectId) throw new FactValidationError("ownership");
  return product;
}
async function loadContext(client: Client, projectId: string) {
  const projectResult = await client.from("projects").select("*").eq("id", projectId).abortSignal(timeout()).maybeSingle();
  if (projectResult.error) throw new FactValidationError("database");
  if (!projectResult.data) throw new FactValidationError("not_found");
  const project = projectRowSchema.parse(projectResult.data);
  if (project.id !== projectId) throw new FactValidationError("ownership");
  const product = await readProduct(client, projectId);
  const [factsResult, assetsResult] = await Promise.all([
    client.from("product_facts").select("*").eq("product_id", product.id).abortSignal(timeout()).maybeSingle(),
    // Inspect either FK so a corrupt cross-project relation is rejected, not silently omitted.
    client.from("assets").select("*").or(`project_id.eq.${projectId},product_id.eq.${product.id}`).limit(31).abortSignal(timeout()),
  ]);
  if (factsResult.error || assetsResult.error) throw new FactValidationError("database");
  if (!factsResult.data) throw new FactValidationError("facts_required");
  const facts = productFactsRowSchema.parse(factsResult.data);
  if (facts.product_id !== product.id) throw new FactValidationError("ownership");
  const assets = assetsResult.data.map((row) => assetRowSchema.parse(row));
  const input = buildValidationEvidence({ projectId, productId: product.id, facts: facts.facts, sourceSnapshot: facts.source_snapshot, productAnalysis: product.ai_analysis, assets });
  return { project, product, facts, input, state: readState(facts.validation) };
}
function view(context: Awaited<ReturnType<typeof loadContext>>): ValidationView {
  return { projectId: context.project.id, projectName: context.project.name, productName: context.product.name,
    ...context.input, state: context.state };
}
export async function getValidationView(projectId: string): Promise<ValidationView> {
  const project = id(projectId);
  try { return view(await loadContext(createSupabaseServerClient(), project)); } catch (error) { throw safe(error); }
}

async function readFacts(client: Client, productId: string) {
  const result = await client.from("product_facts").select("*").eq("product_id", productId).abortSignal(timeout()).maybeSingle();
  if (result.error) throw new FactValidationError("database");
  if (!result.data) throw new FactValidationError("facts_required");
  const row = productFactsRowSchema.parse(result.data);
  if (row.product_id !== productId) throw new FactValidationError("ownership");
  return row;
}
async function saveState(client: Client, facts: Awaited<ReturnType<typeof readFacts>>, state: ValidationState) {
  const value = validationStateSchema.parse(state);
  const before = readState(facts.validation);
  let update = client.from("product_facts").update({ validation: value }).eq("id", facts.id).eq("product_id", facts.product_id).eq("updated_at", facts.updated_at);
  update = before ? update.eq("validation->attempt->>runId", before.attempt.runId).eq("validation->attempt->>status", before.attempt.status)
    : update.eq("validation", "{}");
  const result = await update.select("*").abortSignal(timeout()).maybeSingle();
  if (result.error) {
    const actual = await readFacts(client, facts.product_id);
    if (actual.id === facts.id && isDeepStrictEqual(actual.validation, value)) return actual;
    throw new FactValidationError("database");
  }
  if (!result.data) throw new FactValidationError("conflict");
  return productFactsRowSchema.parse(result.data);
}
async function finish(client: Client, projectId: string, productId: string, factsId: string, state: ValidationState) {
  const product = await readProduct(client, projectId);
  if (product.id !== productId) throw new FactValidationError("conflict");
  const current = await readFacts(client, productId);
  const active = readState(current.validation);
  if (current.id !== factsId || active?.attempt.status !== "analyzing" || active.attempt.runId !== state.attempt.runId)
    throw new FactValidationError("conflict");
  return saveState(client, current, state);
}
async function invoke(provider: ValidationProvider, input: Parameters<ValidationProvider["analyze"]>[0]) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([provider.analyze(input, controller.signal), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new FactValidationError("timeout")); }, VALIDATION_PROVIDER_TIMEOUT_MS);
    })]);
  } catch (error) { throw error instanceof FactValidationError ? error : new FactValidationError("provider"); }
  finally { if (timer) clearTimeout(timer); }
}
export async function validateFacts(projectId: string, providerFactory: () => ValidationProvider = getValidationProvider): Promise<ValidationView> {
  const project = id(projectId);
  if (running.has(project) || running.size >= 2) throw new FactValidationError("busy");
  running.add(project);
  try {
    const client = createSupabaseServerClient();
    const context = await loadContext(client, project);
    if (isValidationActive(context.state, Date.now())) throw new FactValidationError("busy");
    const provider = providerFactory(); // Missing config never changes DB state or starts a paid call.
    const state: ValidationState = { schemaVersion: 1, attempt: { status: "analyzing", runId: randomUUID(),
      startedAt: new Date().toISOString(), finishedAt: null, errorCode: null }, latestResult: context.state?.latestResult ?? null };
    await saveState(client, context.facts, state);
    let analysis;
    try {
      // No paths, signed URLs, raw images or mutable Facts records cross this boundary.
      const output = await invoke(provider, structuredClone({ targets: context.input.targets, evidence: context.input.evidence, coverage: context.input.coverage, warnings: context.input.warnings }));
      try { analysis = validateFactOutput(output, context.input.targets, context.input.evidence); }
      catch { throw new FactValidationError("invalid_response"); }
    } catch (error) {
      const failure = error instanceof FactValidationError ? error : new FactValidationError("provider");
      await finish(client, project, context.product.id, context.facts.id, { ...state,
        attempt: { ...state.attempt, status: "failed", finishedAt: new Date().toISOString(), errorCode: failure.code } });
      throw failure;
    }
    const finishedAt = new Date().toISOString();
    await finish(client, project, context.product.id, context.facts.id, { schemaVersion: 1,
      attempt: { ...state.attempt, status: "completed", finishedAt, errorCode: null },
      latestResult: { ...analysis, ...summarizeValidation(analysis.facts),
        warnings: [...new Set([...context.input.warnings, ...analysis.warnings])],
        provider: "openai", model: provider.model, validatedAt: finishedAt,
        inputFingerprint: context.input.inputFingerprint, evidenceSnapshot: context.input.evidence } });
    // Re-read current evidence: edits during a paid request must show stale immediately.
    return view(await loadContext(client, project));
  } catch (error) { throw safe(error); }
  finally { running.delete(project); }
}

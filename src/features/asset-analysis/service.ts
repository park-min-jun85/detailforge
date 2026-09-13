import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAssetContext } from "@/features/assets/service";
import { AssetError, assetRowSchema, assertAssetScope, parseId } from "@/features/assets/schemas";
import type { Asset } from "@/types/domain";
import { AI_SIGNED_URL_SECONDS, MAX_CONCURRENT_ANALYSES, PROVIDER_TIMEOUT_MS } from "./config";
import { AnalysisError } from "./errors";
import { getAnalysisProvider } from "./provider";
import { analysisAssetType, analysisResultSchema, isActiveAnalysis, mergeAnalysis, previousResult, readAnalysis, type AnalysisState } from "./schemas";
import type { AnalysisProvider } from "./types";

type Client = ReturnType<typeof createSupabaseServerClient>;
type Scope = { projectId: string; productId: string; assetId: string };
const running = new Set<string>();
const dbTimeout = () => AbortSignal.timeout(10_000);

async function readAsset(client: Client, scope: Scope): Promise<Asset> {
  const result = await client.from("assets").select("*").eq("id", scope.assetId).eq("project_id", scope.projectId)
    .eq("product_id", scope.productId).abortSignal(dbTimeout()).maybeSingle();
  if (result.error) throw new AnalysisError("database");
  if (!result.data) throw new AnalysisError("not_found");
  const parsed = assetRowSchema.safeParse(result.data);
  if (!parsed.success) throw new AnalysisError("database");
  try { assertAssetScope(parsed.data, scope.projectId, scope.productId); }
  catch { throw new AnalysisError("ownership"); }
  return parsed.data;
}

async function compareAndSave(client: Client, asset: Asset, state: AnalysisState, assetType = asset.assetType) {
  const result = await client.from("assets").update({ metadata: mergeAnalysis(asset.metadata, state), asset_type: assetType })
    .eq("id", asset.id).eq("project_id", asset.projectId).eq("product_id", asset.productId).eq("storage_path", asset.storagePath)
    .eq("metadata", JSON.stringify(asset.metadata)).eq("asset_type", asset.assetType).select("*").abortSignal(dbTimeout()).maybeSingle();
  if (result.error) {
    // 응답만 유실된 UPDATE인지 확인한다. 이 재조회는 AI를 다시 호출하지 않는다.
    const actual = await readAsset(client, { projectId: asset.projectId, productId: asset.productId, assetId: asset.id });
    if (actual.storagePath === asset.storagePath && actual.assetType === assetType && isDeepStrictEqual(actual.metadata.aiAnalysis, state)) return actual;
    throw new AnalysisError("database");
  }
  return result.data ? assetRowSchema.parse(result.data) : null;
}

async function finishAttempt(client: Client, scope: Scope, path: string, attemptId: string, state: AnalysisState, type?: Asset["assetType"]) {
  // 외부 metadata key가 갱신되면 최신 값을 다시 merge한다. AI 유료 재호출은 없다.
  for (let index = 0; index < 2; index++) {
    const current = await readAsset(client, scope);
    const active = readAnalysis(current.metadata);
    if (current.storagePath !== path || active?.status !== "analyzing" || active.attemptId !== attemptId) throw new AnalysisError("conflict");
    const saved = await compareAndSave(client, current, state, type ?? current.assetType);
    if (saved) return saved;
  }
  throw new AnalysisError("conflict");
}

function safeError(error: unknown): AnalysisError {
  if (error instanceof AnalysisError) return error;
  if (error instanceof AssetError) return new AnalysisError(error.status === 404 ? "not_found" : error.status === 409 ? "ownership" : "database");
  return new AnalysisError("unexpected");
}

async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, milliseconds: number, code: "timeout" | "signed_url") {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation(controller.signal), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new AnalysisError(code)); }, milliseconds);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

export async function analyzeAsset(projectId: string, assetId: string, providerFactory: () => AnalysisProvider = getAnalysisProvider): Promise<Asset> {
  let id: string;
  try { projectId = parseId(projectId); id = parseId(assetId); } catch { throw new AnalysisError("not_found"); }
  if (running.has(id) || running.size >= MAX_CONCURRENT_ANALYSES) throw new AnalysisError("busy");
  running.add(id);
  try {
    const client = createSupabaseServerClient();
    const context = await getAssetContext(projectId, client);
    if (!context.product) throw new AnalysisError("product_required");
    const productName = context.product.name;
    const scope = { projectId, productId: context.product.id, assetId: id };
    const asset = await readAsset(client, scope);
    const previous = readAnalysis(asset.metadata);
    if (isActiveAnalysis(previous, Date.now())) throw new AnalysisError("busy");
    const provider = providerFactory(); // 설정 누락은 DB 상태를 바꾸거나 유료 요청을 시작하지 않는다.
    const attemptId = randomUUID();
    const started: AnalysisState = { schemaVersion: 1, status: "analyzing", provider: "openai", model: provider.model,
      attemptId, startedAt: new Date().toISOString(), previousResult: previousResult(previous) };
    if (!await compareAndSave(client, asset, started)) throw new AnalysisError("conflict");
    let result;
    try {
      const signed = await bounded(async () => client.storage.from("product-assets").createSignedUrl(asset.storagePath, AI_SIGNED_URL_SECONDS), 10_000, "signed_url");
      if (signed.error || !signed.data?.signedUrl) throw new AnalysisError("signed_url");
      let output: unknown;
      try { output = await bounded((signal) => provider.analyze({ imageUrl: signed.data.signedUrl, productName }, signal), PROVIDER_TIMEOUT_MS, "timeout"); }
      catch (error) { throw error instanceof AnalysisError ? error : new AnalysisError("provider"); }
      const parsed = analysisResultSchema.safeParse(output);
      if (!parsed.success || !parsed.data.visualSummary.trim()) throw new AnalysisError("invalid_response");
      result = parsed.data;
    } catch (error) {
      const failure = safeError(error);
      const failed: AnalysisState = { ...started, status: "failed", failedAt: new Date().toISOString(), errorCode: failure.code };
      failure.asset = await finishAttempt(client, scope, asset.storagePath, attemptId, failed);
      throw failure;
    }
    const completed: AnalysisState = { ...result, status: "completed", provider: "openai", model: provider.model,
      attemptId, analyzedAt: new Date().toISOString() };
    return await finishAttempt(client, scope, asset.storagePath, attemptId, completed, analysisAssetType(result));
  } catch (error) { throw safeError(error); }
  finally { running.delete(id); }
}

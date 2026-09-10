import "server-only";

import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { productFormSchema, projectIdSchema, productRevisionSchema, productRowSchema,
  productFactsRowSchema, type ProductRow, type ProductFactsRow } from "./schemas";
import { toManualSource, toManualFacts } from "./mappers";
import type { ProductSaveState } from "./types";

// 한 서버 프로세스 안의 같은 Project 저장을 직렬화한다. DB 트랜잭션을 대신하지는 않는다.
const savingProjects = new Set<string>();
type Client = ReturnType<typeof createSupabaseServerClient>;
const failed = (): ProductSaveState => ({ status: "error", message: "상품정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." });
const recovery = (): ProductSaveState => ({
  status: "recovery-required",
  message: "저장 상태를 확인하지 못했습니다. 일부 정보가 반영되었을 수 있으므로 다시 저장하지 말고 화면을 새로 열어 저장 내용을 확인해 주세요.",
});

async function readProduct(client: Client, projectId: string) {
  const result = await client.from("products").select("*").eq("project_id", projectId)
    .abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
  if (result.error) throw new Error("Product read failed");
  return result.data ? productRowSchema.parse(result.data) : null;
}
async function readFacts(client: Client, productId: string) {
  const result = await client.from("product_facts").select("*").eq("product_id", productId)
    .abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
  if (result.error) throw new Error("Facts read failed");
  return result.data ? productFactsRowSchema.parse(result.data) : null;
}
function productContent(row: ProductRow) {
  return { name: row.name, brand: row.brand, category: row.category, description: row.description,
    source_type: row.source_type, source_url: row.source_url, raw_data: row.raw_data };
}
function factsContent(row: ProductFactsRow) {
  return { facts: row.facts, source_snapshot: row.source_snapshot,
    version: row.version, validated_at: row.validated_at };
}

// Facts 실패가 확인되었을 때만 현재 요청이 쓴 Product를 보상한다.
async function restoreProduct(client: Client, before: ProductRow | null, written: ProductRow): Promise<ProductSaveState> {
  try {
    if (before) {
      const restored = await client.from("products").update(productContent(before))
        .eq("id", written.id).eq("updated_at", written.updated_at)
        .select("*").abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
      if (restored.error || !restored.data) return recovery();
      return { ...failed(), revision: restored.data.updated_at,
        message: "상품정보 저장에 실패하여 이전 상품정보로 복원했습니다. 입력 내용을 확인하고 다시 저장해 주세요." };
    }
    const removed = await client.from("products").delete()
      .eq("id", written.id).eq("updated_at", written.updated_at)
      .select("id").abortSignal(AbortSignal.timeout(10_000));
    if (removed.error || removed.data?.length !== 1) return recovery();
    return { ...failed(), revision: "",
      message: "상품정보 저장에 실패하여 이번에 생성한 상품을 정리했습니다. 다시 시도해 주세요." };
  } catch { return recovery(); }
}

export async function saveProductInformation(
  projectId: string, revision: unknown, input: unknown,
): Promise<ProductSaveState> {
  if (!projectIdSchema.safeParse(projectId).success || !productRevisionSchema.safeParse(revision).success) {
    return { status: "error", message: "프로젝트 정보를 확인할 수 없습니다. 목록에서 다시 열어 주세요." };
  }
  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { status: "error", message: "입력 내용을 확인해 주세요.", fieldErrors };
  }
  if (savingProjects.has(projectId)) return { status: "error", message: "이 프로젝트를 저장 중입니다. 잠시 후 다시 시도해 주세요." };
  savingProjects.add(projectId);
  let writeStarted = false;
  try {
    const client = createSupabaseServerClient();
    const project = await client.from("projects").select("id").eq("id", projectId)
      .abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
    if (project.error) return failed();
    if (!project.data) return { status: "error", message: "프로젝트를 찾을 수 없습니다. 목록에서 다시 열어 주세요." };

    const before = await readProduct(client, projectId);
    if ((before?.updated_at ?? "") !== revision) return {
      status: "recovery-required", message: "다른 저장으로 상품정보가 변경되었습니다. 화면을 새로 열어 최신 내용을 확인해 주세요.",
    };
    const previousFacts = before ? await readFacts(client, before.id) : null;
    const productId = before?.id ?? randomUUID();
    const source = toManualSource(parsed.data);
    const payload = { name: source.productName, brand: source.brand || null,
      category: source.category || null, description: source.description || null,
      source_type: "manual", source_url: source.sourceUrl || null, raw_data: source };
    writeStarted = true;
    const productWrite = before
      ? await client.from("products").update(payload).eq("id", productId)
        .eq("updated_at", before.updated_at).select("*")
        .abortSignal(AbortSignal.timeout(10_000)).maybeSingle()
      : await client.from("products").insert({ id: productId, project_id: projectId, ...payload })
        .select("*").abortSignal(AbortSignal.timeout(10_000)).single();

    // 응답이 유실돼도 실제로 원하는 Product가 저장됐는지 먼저 확인한다.
    const written = !productWrite.error && productWrite.data
      ? productRowSchema.parse(productWrite.data) : await readProduct(client, projectId);
    if (!written || written.id !== productId || !isDeepStrictEqual(productContent(written), payload)) {
      if (isDeepStrictEqual(written, before)) return failed();
      return recovery();
    }
    const factsPayload = { facts: toManualFacts(parsed.data), source_snapshot: source,
      version: previousFacts?.version ?? 1, validated_at: null };
    const factsId = previousFacts?.id ?? randomUUID();
    const factsWrite = previousFacts
      ? await client.from("product_facts").update(factsPayload).eq("id", factsId)
        .eq("updated_at", previousFacts.updated_at).select("*")
        .abortSignal(AbortSignal.timeout(10_000)).maybeSingle()
      : await client.from("product_facts").insert({ id: factsId, product_id: productId, ...factsPayload })
        .select("*").abortSignal(AbortSignal.timeout(10_000)).single();

    if (factsWrite.error || !factsWrite.data) {
      const currentFacts = await readFacts(client, productId);
      if (!(currentFacts?.id === factsId && isDeepStrictEqual(factsContent(currentFacts), factsPayload))) {
        // 다른 쓰기나 확인 불가능한 상태에는 오래된 스냅샷으로 덮어쓰거나 cascade delete하지 않는다.
        if (!isDeepStrictEqual(currentFacts, previousFacts)) return recovery();
        return await restoreProduct(client, before, written);
      }
    }
    return { status: "success", message: "상품정보가 저장되었습니다.",
      revision: written.updated_at, values: parsed.data };
  } catch {
    return writeStarted ? recovery() : failed();
  } finally {
    savingProjects.delete(projectId);
  }
}
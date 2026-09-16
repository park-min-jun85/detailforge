import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Asset } from "@/types/domain";
import { AssetError, assetRowSchema, assertAssetScope, nextAssetOrder, normalizeFilename, parseId,
  SIGNED_URL_SECONDS, storagePath, validateFile, validateSignature } from "./schemas";
import type { AssetContext, AssetList } from "./types";

const BUCKET = "product-assets";
const mutations = new Set<string>();
const timeout = () => AbortSignal.timeout(10_000);
type Client = ReturnType<typeof createSupabaseServerClient>;
const projectSchema = z.object({ id: z.uuid(), name: z.string() });
const productSchema = z.object({ id: z.uuid(), project_id: z.uuid(), name: z.string() });

export async function getAssetContext(projectId: string, client = createSupabaseServerClient()): Promise<AssetContext> {
  const id = parseId(projectId);
  const project = await client.from("projects").select("id,name").eq("id", id).abortSignal(timeout()).maybeSingle();
  if (project.error) throw new AssetError(503, "프로젝트를 불러오지 못했습니다. 다시 시도해 주세요.");
  if (!project.data) throw new AssetError(404, "프로젝트를 찾을 수 없습니다.");
  const parsedProject = projectSchema.parse(project.data);
  if (parsedProject.id !== id) throw new AssetError(409, "프로젝트 연결을 확인할 수 없습니다.");
  const product = await client.from("products").select("id,project_id,name").eq("project_id", id).abortSignal(timeout()).maybeSingle();
  if (product.error) throw new AssetError(503, "상품정보를 불러오지 못했습니다. 다시 시도해 주세요.");
  if (!product.data) return { project: parsedProject, product: null };
  const parsed = productSchema.parse(product.data);
  if (parsed.project_id !== id) throw new AssetError(409, "상품의 프로젝트 연결을 확인할 수 없습니다.");
  return { project: parsedProject, product: { id: parsed.id, projectId: parsed.project_id, name: parsed.name } };
}

async function requireProduct(projectId: string, client: Client) {
  const context = await getAssetContext(projectId, client);
  if (!context.product) throw new AssetError(409, "먼저 상품정보를 저장해 주세요.");
  return { projectId: context.project.id, productId: context.product.id };
}

async function exclusive<T>(productId: string, operation: () => Promise<T>) {
  // 현재 단일 서버 MVP에서 수량/순서 경쟁을 막는다. 여러 프로세스의 DB 잠금은 아니다.
  if (mutations.has(productId)) throw new AssetError(409, "이미지 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.");
  mutations.add(productId);
  try { return await operation(); } finally { mutations.delete(productId); }
}

export async function listAssets(projectId: string, onlyIds?: readonly string[]): Promise<AssetList> {
  const client = createSupabaseServerClient();
  const scope = await requireProduct(projectId, client);
  const result = await client.from("assets").select("*").eq("project_id", scope.projectId).eq("product_id", scope.productId)
    .order("sort_order").order("created_at").order("id").abortSignal(timeout());
  if (result.error) throw new AssetError(503, "이미지 목록을 불러오지 못했습니다.");
  const owned = result.data.map((row) => assetRowSchema.parse(row));
  owned.forEach((asset) => assertAssetScope(asset, scope.projectId, scope.productId));
  const assets = onlyIds ? owned.filter(asset => onlyIds.includes(asset.id)) : owned;
  const expiresAt = Date.now() + SIGNED_URL_SECONDS * 1000;
  if (!assets.length) return { items: [], expiresAt };
  const signed = await client.storage.from(BUCKET).createSignedUrls(assets.map((asset) => asset.storagePath), SIGNED_URL_SECONDS);
  if (signed.error) throw new AssetError(503, "이미지 미리보기를 불러오지 못했습니다. 다시 시도해 주세요.");
  const urls = new Map(signed.data.map((item) => [item.path, item.error ? null : item.signedUrl]));
  return { items: assets.map((asset) => ({ asset, previewUrl: urls.get(asset.storagePath) ?? null })), expiresAt };
}

async function removeObject(client: Client, path: string) {
  try { return !(await client.storage.from(BUCKET).remove([path])).error; } catch { return false; }
}

export async function uploadAsset(projectId: string, file: { name: string; mime: string; bytes: Uint8Array }): Promise<Asset> {
  const name = normalizeFilename(file.name);
  const mime = validateFile(file.mime, file.bytes.byteLength);
  validateSignature(file.bytes, mime);
  const client = createSupabaseServerClient();
  const scope = await requireProduct(projectId, client);
  return exclusive(scope.productId, async () => {
    const existing = await client.from("assets").select("sort_order", { count: "exact" }).eq("product_id", scope.productId)
      .order("sort_order", { ascending: false }).limit(1).abortSignal(timeout());
    if (existing.error || existing.count === null) throw new AssetError(503, "등록된 이미지 수를 확인하지 못했습니다.");
    const sortOrder = nextAssetOrder(existing.count, existing.data?.[0]?.sort_order ?? null);
    const id = randomUUID();
    const path = storagePath(scope.projectId, scope.productId, id, mime);
    let uploaded = false;
    try {
      uploaded = !(await client.storage.from(BUCKET).upload(path, file.bytes, { contentType: mime, upsert: false, cacheControl: "60" })).error;
    } catch { /* 응답 유실도 아래에서 이 요청의 경로만 정리한다. */ }
    if (!uploaded) {
      const cleaned = await removeObject(client, path);
      throw new AssetError(503, cleaned ? "파일 업로드에 실패했습니다. 다시 시도해 주세요." : "파일 업로드 및 정리를 확인하지 못했습니다. 관리자 확인이 필요합니다.");
    }
    const row = { id, project_id: scope.projectId, product_id: scope.productId, storage_path: path,
      original_filename: name, mime_type: mime, size_bytes: file.bytes.byteLength, asset_type: "unclassified",
      sort_order: sortOrder, width: null, height: null, metadata: {} };
    try {
      const inserted = await client.from("assets").insert(row).select("*").abortSignal(timeout()).single();
      if (!inserted.error) return assetRowSchema.parse(inserted.data);
    } catch { /* INSERT 응답 유실 여부를 재조회한 뒤 보상한다. */ }
    try {
      const check = await client.from("assets").select("*").eq("id", id).abortSignal(timeout()).maybeSingle();
      if (check.error) throw new Error("unconfirmed");
      if (check.data) {
        const asset = assetRowSchema.parse(check.data);
        assertAssetScope(asset, scope.projectId, scope.productId);
        if (asset.storagePath !== path) throw new Error("unconfirmed");
        return asset;
      }
    } catch {
      // 저장되었을 수 있는 DB row의 파일을 지우지 않는다. 운영자가 대조해야 한다.
      throw new AssetError(503, "이미지 저장 결과를 확인하지 못했습니다. 목록을 새로고침한 뒤 확인해 주세요. 관리자 확인이 필요할 수 있습니다.");
    }
    const cleaned = await removeObject(client, path);
    throw new AssetError(503, cleaned ? "이미지 정보를 저장하지 못해 업로드 파일을 정리했습니다. 다시 시도해 주세요."
      : "이미지 정보 저장과 파일 정리에 실패했습니다. 관리자 확인이 필요합니다.");
  });
}

export async function deleteAsset(projectId: string, assetId: string) {
  const id = parseId(assetId);
  const client = createSupabaseServerClient();
  const scope = await requireProduct(projectId, client);
  return exclusive(scope.productId, async () => {
    const result = await client.from("assets").select("*").eq("id", id).eq("project_id", scope.projectId)
      .eq("product_id", scope.productId).abortSignal(timeout()).maybeSingle();
    if (result.error) throw new AssetError(503, "삭제할 이미지를 확인하지 못했습니다.");
    if (!result.data) throw new AssetError(404, "삭제할 이미지를 찾을 수 없습니다.");
    const asset = assetRowSchema.parse(result.data);
    assertAssetScope(asset, scope.projectId, scope.productId);
    if (!await removeObject(client, asset.storagePath)) throw new AssetError(503, "이미지 파일을 삭제하지 못했습니다. 다시 시도해 주세요.");
    const deleted = await client.from("assets").delete().eq("id", id).eq("project_id", scope.projectId)
      .eq("product_id", scope.productId).eq("storage_path", asset.storagePath).abortSignal(timeout());
    if (deleted.error) throw new AssetError(503, "파일은 삭제했지만 목록 정리를 확인하지 못했습니다. 새로고침 후 이미지가 남아 있으면 다시 삭제해 주세요.");
    return { deleted: true };
  });
}

import { z } from "zod";
import { ASSET_TYPES, type Asset } from "@/types/domain";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PRODUCT_ASSETS = 30;
export const SIGNED_URL_SECONDS = 300;
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];
const extensions: Record<ImageMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export class AssetError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export function parseId(value: string): string {
  const result = z.uuid().safeParse(value);
  if (!result.success) throw new AssetError(404, "프로젝트 또는 이미지를 찾을 수 없습니다.");
  return result.data.toLowerCase();
}

export function validateFile(mime: string, size: number): ImageMime {
  if (!IMAGE_MIME_TYPES.includes(mime as ImageMime)) throw new AssetError(415, "JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.");
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE_BYTES) throw new AssetError(413, "파일은 0바이트보다 크고 10MB 이하여야 합니다.");
  return mime as ImageMime;
}

export function validateSignature(bytes: Uint8Array, mime: ImageMime) {
  const starts = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const valid = mime === "image/jpeg" ? starts([0xff, 0xd8, 0xff])
    : mime === "image/png" ? starts([137, 80, 78, 71, 13, 10, 26, 10])
      : starts([82, 73, 70, 70]) && [87, 69, 66, 80].every((byte, index) => bytes[index + 8] === byte);
  if (!valid) throw new AssetError(415, "파일 내용이 선택한 이미지 형식과 일치하지 않습니다.");
}

export function normalizeFilename(value: string) {
  // 파일명은 표시용으로만 보관한다. 경로, 제어문자, 방향 제어문자는 제거한다.
  const name = value.split(/[\\/]/).at(-1)?.normalize("NFC").replace(/[\x00-\x1f\x7f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
  if (!name || name === "." || name === ".." || name.length > 255) throw new AssetError(400, "파일명은 1~255자의 유효한 이름이어야 합니다.");
  return name;
}

export function storagePath(projectId: string, productId: string, id: string, mime: ImageMime) {
  return `projects/${parseId(projectId)}/products/${parseId(productId)}/${parseId(id)}.${extensions[mime]}`;
}

export function assertAssetScope(asset: Asset, projectId: string, productId: string) {
  const prefix = `projects/${parseId(projectId)}/products/${parseId(productId)}/`;
  const leaf = asset.storagePath.slice(prefix.length);
  if (asset.projectId !== projectId || asset.productId !== productId || !asset.storagePath.startsWith(prefix)
    || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(leaf) || !z.uuid().safeParse(leaf.split(".")[0]).success) {
    throw new AssetError(409, "이미지의 프로젝트 연결을 확인할 수 없습니다.");
  }
}

export function nextAssetOrder(count: number, maxOrder: number | null) {
  if (count >= MAX_PRODUCT_ASSETS) throw new AssetError(409, "상품당 이미지는 최대 30개까지 등록할 수 있습니다.");
  const next = (maxOrder ?? -1) + 1;
  if (!Number.isSafeInteger(next) || next < 0 || next > 2147483647) throw new AssetError(409, "이미지 순서를 확인할 수 없습니다.");
  return next;
}

export const assetRowSchema = z.object({
  id: z.uuid(), project_id: z.uuid(), product_id: z.uuid(), storage_path: z.string().min(1),
  original_filename: z.string(), mime_type: z.string().nullable(), size_bytes: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable(),
  asset_type: z.enum(ASSET_TYPES), sort_order: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.json()), created_at: z.iso.datetime({ offset: true }),
}).transform((row): Asset => ({
  id: row.id, projectId: row.project_id, productId: row.product_id, storagePath: row.storage_path,
  originalFilename: row.original_filename, mimeType: row.mime_type, sizeBytes: row.size_bytes,
  width: row.width, height: row.height, assetType: row.asset_type, sortOrder: row.sort_order,
  metadata: row.metadata, createdAt: row.created_at,
}));

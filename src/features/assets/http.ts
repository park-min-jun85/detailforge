import "server-only";
import { AssetError, IMAGE_MIME_TYPES, MAX_FILE_BYTES, normalizeFilename } from "./schemas";

export function assertSameOrigin(request: Request) {
  const target = new URL(request.url);
  // NextURL은 loopback 주소를 localhost로 바꾸므로 실제 브라우저의 Host를 사용한다.
  const host = request.headers.get("host");
  if (host) target.host = host;
  if (request.headers.get("origin") !== target.origin) throw new AssetError(403, "허용되지 않은 요청입니다.");
}

export async function readImageBody(request: Request) {
  const mime = request.headers.get("content-type") ?? "";
  if (!IMAGE_MIME_TYPES.some((item) => item === mime)) throw new AssetError(415, "JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.");
  let name: string;
  try { name = normalizeFilename(decodeURIComponent(request.headers.get("x-file-name") ?? "")); }
  catch { throw new AssetError(400, "파일명을 확인해 주세요."); }
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_FILE_BYTES)) throw new AssetError(413, "파일은 10MB 이하여야 합니다.");
  if (!request.body) throw new AssetError(400, "이미지 파일을 선택해 주세요.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FILE_BYTES) {
        await reader.cancel();
        throw new AssetError(413, "파일은 10MB 이하여야 합니다.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { name, mime, bytes };
}

export async function assetResponse(operation: () => Promise<unknown>, successStatus = 200) {
  const headers = { "Cache-Control": "private, no-store" };
  try { return Response.json(await operation(), { status: successStatus, headers }); }
  catch (error) {
    return Response.json({ message: error instanceof AssetError ? error.message : "이미지 작업을 완료하지 못했습니다. 목록을 확인한 뒤 다시 시도해 주세요." },
      { status: error instanceof AssetError ? error.status : 503, headers });
  }
}

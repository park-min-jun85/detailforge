import type { AssetList } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...init, cache: "no-store" }); }
  catch { throw new Error("서버 응답을 확인하지 못했습니다. 목록을 새로고침한 뒤 저장 여부를 확인해 주세요."); }
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new Error("서버 응답을 확인하지 못했습니다. 목록을 새로고침해 주세요."); }
  if (!response.ok) throw new Error(body !== null && typeof body === "object" && "message" in body && typeof body.message === "string"
    ? body.message : "이미지 작업을 완료하지 못했습니다.");
  return body as T;
}

const endpoint = (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}/assets`;
export const fetchAssets = (projectId: string) => request<AssetList>(endpoint(projectId));
export const sendAsset = (projectId: string, file: File) => request(endpoint(projectId), {
  method: "POST", headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) }, body: file,
});
export const removeAsset = (projectId: string, assetId: string) => request(`${endpoint(projectId)}/${encodeURIComponent(assetId)}`, { method: "DELETE" });

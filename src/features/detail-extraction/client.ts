import type { Asset } from "@/types/domain";
import { EXTRACTION_MESSAGES, ExtractionError, type ExtractionCode } from "./errors";
async function request<T>(projectId: string, assetId: string, action: string, body: unknown): Promise<T> {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/extract-product-shots${action}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new ExtractionError(data.code in EXTRACTION_MESSAGES ? data.code as ExtractionCode : "unexpected", data.available);
    return data as T;
  } catch (error) { throw error instanceof ExtractionError ? error : new ExtractionError("unexpected"); }
}
export const requestExtraction = (projectId: string, assetId: string, force: boolean) => request<{ asset: Asset; reused: boolean }>(projectId, assetId, "", { force });
export const requestCropSave = (projectId: string, assetId: string, candidateIds: string[]) => request<{
  saved: { candidateId: string; asset: Asset; existing: boolean }[]; failed: { candidateId: string; code: ExtractionCode; message: string }[]; available: number;
}>(projectId, assetId, "/save", { candidateIds });

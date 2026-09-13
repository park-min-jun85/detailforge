import type { ProductAnalysisView } from "./types";

export async function requestProductAnalysis(projectId: string, method: "GET" | "POST"): Promise<
  { ok: true; view: ProductAnalysisView } | { ok: false; message: string }
> {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/product-analysis`, {
      method, cache: "no-store", signal: AbortSignal.timeout(method === "POST" ? 125_000 : 45_000),
    });
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "ok" in body) {
      if (response.ok && body.ok === true && "view" in body) return { ok: true, view: body.view as ProductAnalysisView };
      if (body.ok === false && "message" in body && typeof body.message === "string") return { ok: false, message: body.message };
    }
  } catch { /* A lost response does not mean the server failed to save. */ }
  return { ok: false, message: "상품 분석 응답을 확인하지 못했습니다. 새로고침해 결과를 확인해 주세요. 중단된 분석은 3분 후 다시 실행할 수 있습니다." };
}

import type { PlannerView } from "./types";
export async function requestPagePlan(projectId: string, method: "GET" | "POST"): Promise<{ ok: true; view: PlannerView } | { ok: false; message: string }> {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/page-plan`, { method, cache: "no-store", signal: AbortSignal.timeout(method === "POST" ? 125000 : 45000) });
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "ok" in body) {
      if (response.ok && body.ok === true && "view" in body) return { ok: true, view: body.view as PlannerView };
      if (body.ok === false && "message" in body && typeof body.message === "string") return { ok: false, message: body.message };
    }
  } catch { /* A lost response may already have been saved. GET before retrying the paid operation. */ }
  return { ok: false, message: "페이지 설계 응답을 확인하지 못했습니다. 새로고침해 결과를 확인해 주세요." };
}

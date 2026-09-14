import type { SectionView } from "./types";
export async function requestSections(projectId: string, body?: { replaceExisting: boolean; expectedRevision: string }): Promise<{ ok: true; view: SectionView } | { ok: false; message: string }> {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/sections${body ? "/generate" : ""}`, {
      method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(body ? 180000 : 45000),
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    const result: unknown = await response.json();
    if (result && typeof result === "object" && "ok" in result) {
      if (response.ok && result.ok === true && "view" in result) return { ok: true, view: result.view as SectionView };
      if (result.ok === false && "message" in result && typeof result.message === "string") return { ok: false, message: result.message };
    }
  } catch { /* GET must resolve an uncertain save before another paid call. */ }
  return { ok: false, message: "생성 응답을 확인하지 못했습니다. 새로고침해 저장 상태를 먼저 확인해 주세요." };
}

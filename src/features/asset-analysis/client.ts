import type { AnalysisReply } from "./types";

export async function requestAssetAnalysis(projectId: string, assetId: string): Promise<AnalysisReply> {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/analyze`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(125_000),
    });
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "ok" in body && typeof body.ok === "boolean") return body as AnalysisReply;
  } catch { /* 응답 유실 시 DB의 분석 상태를 재조회하도록 안내한다. */ }
  return { ok: false, message: "분석 응답을 확인하지 못했습니다. 목록을 새로고침해 주세요. 중단된 분석은 3분 후 재시도할 수 있습니다." };
}

import { publicExtractionResponse } from "@/features/detail-extraction/public-response";
import { assertSameOrigin } from "@/features/assets/http";
import { analyzeAsset } from "@/features/asset-analysis/service";
import { AnalysisError } from "@/features/asset-analysis/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request, { params }: RouteContext<"/api/projects/[projectId]/assets/[assetId]/analyze">) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    try { assertSameOrigin(request); } catch { throw new AnalysisError("forbidden"); }
    const { projectId, assetId } = await params;
    return Response.json({ ok: true, asset: publicExtractionResponse(await analyzeAsset(projectId, assetId)) }, { headers });
  } catch (error) {
    const safe = error instanceof AnalysisError ? error : new AnalysisError("unexpected");
    return Response.json({ ok: false, code: safe.code, message: safe.message, ...(safe.asset ? { asset: publicExtractionResponse(safe.asset) } : {}) }, { status: safe.status, headers });
  }
}

import { assertSameOrigin } from "@/features/assets/http";
import { analyzeProduct, getProductAnalysisView } from "@/features/product-analysis/service";
import { ProductAnalysisError } from "@/features/product-analysis/errors";

export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  const safe = error instanceof ProductAnalysisError ? error : new ProductAnalysisError("unexpected");
  return Response.json({ ok: false, code: safe.code, message: safe.message }, { status: safe.status, headers });
}
export async function GET(_request: Request, { params }: RouteContext<"/api/projects/[projectId]/product-analysis">) {
  try { return Response.json({ ok: true, view: await getProductAnalysisView((await params).projectId) }, { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[projectId]/product-analysis">) {
  try {
    try { assertSameOrigin(request); } catch { throw new ProductAnalysisError("forbidden"); }
    return Response.json({ ok: true, view: await analyzeProduct((await params).projectId) }, { headers });
  } catch (error) { return failure(error); }
}

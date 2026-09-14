import { assertSameOrigin } from "@/features/assets/http";
import { getPlannerView, planPage } from "@/features/page-planner/service";
import { PlannerError } from "@/features/page-planner/errors";
export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  const safe = error instanceof PlannerError ? error : new PlannerError("unexpected");
  return Response.json({ ok: false, code: safe.code, message: safe.message }, { status: safe.status, headers });
}
export async function GET(_request: Request, { params }: RouteContext<"/api/projects/[projectId]/page-plan">) {
  try { return Response.json({ ok: true, view: await getPlannerView((await params).projectId) }, { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[projectId]/page-plan">) {
  try {
    try { assertSameOrigin(request); } catch { throw new PlannerError("forbidden"); }
    return Response.json({ ok: true, view: await planPage((await params).projectId) }, { headers });
  } catch (error) { return failure(error); }
}

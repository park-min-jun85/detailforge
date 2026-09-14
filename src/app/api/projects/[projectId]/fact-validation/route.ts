import { assertSameOrigin } from "@/features/assets/http";
import { validateFacts, getValidationView } from "@/features/fact-validation/service";
import { FactValidationError } from "@/features/fact-validation/errors";

export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  const safe = error instanceof FactValidationError ? error : new FactValidationError("unexpected");
  return Response.json({ ok: false, code: safe.code, message: safe.message }, { status: safe.status, headers });
}
export async function GET(_request: Request, { params }: RouteContext<"/api/projects/[projectId]/fact-validation">) {
  try { return Response.json({ ok: true, view: await getValidationView((await params).projectId) }, { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[projectId]/fact-validation">) {
  try {
    try { assertSameOrigin(request); } catch { throw new FactValidationError("forbidden"); }
    return Response.json({ ok: true, view: await validateFacts((await params).projectId) }, { headers });
  } catch (error) { return failure(error); }
}

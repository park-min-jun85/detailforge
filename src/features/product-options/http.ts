import "server-only";
import { assertSameOrigin } from "@/features/assets/http";
import { readEditRequest } from "@/features/detail-editor/http";
import { OptionError } from "./errors";
export async function readOptionRequest(request: Request) {
  try { assertSameOrigin(request); } catch { throw new OptionError("forbidden"); }
  try { return await readEditRequest(request, 128000); } catch { throw new OptionError("invalid_input"); }
}
export async function optionResponse(operation: () => Promise<unknown>) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try { return Response.json({ ok: true, data: await operation() }, { headers }); }
  catch (error) { const safe = error instanceof OptionError ? error : new OptionError("unavailable");
    return Response.json({ ok: false, code: safe.code, message: safe.message }, { status: safe.status, headers }); }
}

import "server-only";
import { safeRegenError } from "./service";
export async function regenerationResponse(operation: () => Promise<unknown>) {
  const headers = { "Cache-Control": "private, no-store" };
  try { return Response.json({ ok: true, data: await operation() }, { headers }); }
  catch (error) { const safe = safeRegenError(error); return Response.json({ ok: false, code: safe.code, message: safe.message }, { status: safe.status, headers }); }
}

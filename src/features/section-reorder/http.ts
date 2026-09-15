import "server-only";
import { safeReorderError } from "./service";
export async function reorderResponse(operation: () => Promise<unknown>) {
  const headers = { "Cache-Control": "private, no-store" };
  try { return Response.json({ ok: true, data: await operation() }, { headers }); }
  catch (error) { const safe = safeReorderError(error); return Response.json({ ok: false, code: safe.code, message: safe.message,
    ...(safe.sections ? { sections: safe.sections } : {}) }, { status: safe.status, headers }); }
}

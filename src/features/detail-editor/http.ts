import "server-only";
import { assertSameOrigin } from "@/features/assets/http";
import { EditorError } from "./errors";
export async function editorResponse(operation: () => Promise<unknown>) {
  const headers = { "Cache-Control": "private, no-store" };
  try { return Response.json({ ok: true, data: await operation() }, { headers }); }
  catch (error) { const safe = error instanceof EditorError ? error : new EditorError("unexpected");
    return Response.json({ ok: false, code: safe.code, message: safe.message }, { status: safe.status, headers }); }
}
export async function readEditRequest(request: Request) {
  try { assertSameOrigin(request); } catch { throw new EditorError("forbidden"); }
  if (!request.body || Number(request.headers.get("content-length")) > 32000) throw new EditorError("invalid_input");
  const reader = request.body.getReader(), decoder = new TextDecoder(); let size = 0, body = "";
  try {
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length;
      if (size > 32000) { await reader.cancel(); throw new EditorError("invalid_input"); } body += decoder.decode(chunk.value, { stream: true }); }
    return JSON.parse(body + decoder.decode()) as unknown;
  } catch { throw new EditorError("invalid_input"); } finally { reader.releaseLock(); }
}

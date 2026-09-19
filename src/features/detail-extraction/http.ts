import "server-only";
import { assertSameOrigin } from "@/features/assets/http";
import { ExtractionError } from "./errors";

export async function extractionResponse(request: Request, operation: (body: unknown) => Promise<unknown>) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    try { assertSameOrigin(request); } catch { throw new ExtractionError("forbidden"); }
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ExtractionError("invalid_input");
    const reader = request.body?.getReader(); if (!reader) throw new ExtractionError("invalid_input");
    let length = 0; const chunks: Uint8Array[] = [];
    try { while (true) { const { value, done } = await reader.read(); if (done) break;
      length += value.length; if (length > 8192) { await reader.cancel(); throw new ExtractionError("invalid_input"); } chunks.push(value); }
    } finally { reader.releaseLock(); }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new ExtractionError("invalid_input"); }
    return Response.json(await operation(body), { headers });
  } catch (error) {
    const safe = error instanceof ExtractionError ? error : new ExtractionError("unexpected");
    const status = safe.code === "forbidden" ? 403 : safe.code === "not_found" ? 404 : ["invalid_input", "invalid_rect"].includes(safe.code) ? 400
      : ["busy", "conflict", "stale", "source_changed", "asset_limit", "recursive", "ineligible"].includes(safe.code) ? 409 : 503;
    return Response.json({ code: safe.code, message: safe.message, ...(safe.available !== undefined ? { available: safe.available } : {}) }, { status, headers });
  }
}

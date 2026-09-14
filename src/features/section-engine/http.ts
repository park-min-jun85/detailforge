import "server-only";
import { z } from "zod";
import { assertSameOrigin } from "@/features/assets/http";
import { SectionEngineError } from "./errors";
export async function sectionResponse(operation: () => Promise<unknown>) {
  const headers = { "Cache-Control": "private, no-store" };
  try { return Response.json({ ok: true, view: await operation() }, { headers }); }
  catch (error) { const safe = error instanceof SectionEngineError ? error : new SectionEngineError("unexpected");
    return Response.json({ ok: false, code: safe.code, message: safe.message }, { status: safe.status, headers }); }
}
export async function readGenerationRequest(request: Request) {
  try { assertSameOrigin(request); } catch { throw new SectionEngineError("forbidden"); }
  if (!request.body || Number(request.headers.get("content-length")) > 2048) throw new SectionEngineError("invalid_input");
  const reader = request.body.getReader(); let size = 0, text = ""; const decoder = new TextDecoder();
  try {
    while (true) { const result = await reader.read(); if (result.done) break; size += result.value.length;
      if (size > 2048) { await reader.cancel(); throw new SectionEngineError("invalid_input"); } text += decoder.decode(result.value, { stream: true }); }
    text += decoder.decode();
    return z.strictObject({ replaceExisting: z.boolean(), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/) }).parse(JSON.parse(text));
  } catch { throw new SectionEngineError("invalid_input"); } finally { reader.releaseLock(); }
}

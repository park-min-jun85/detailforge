import "server-only";
import { readEditRequest } from "@/features/detail-editor/http";
import { EditorError } from "@/features/detail-editor/errors";
import { disposition } from "./filename";
import { ExportError } from "./errors";
import { exportDetail } from "./service";
export async function handleExport(request: Request, projectId: string, operation = exportDetail) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    let input;
    try { input = await readEditRequest(request, 2048); }
    catch (error) { throw new ExportError(error instanceof EditorError && error.code === "forbidden" ? "forbidden" : "invalid_input"); }
    const result = await operation(projectId, input, { signal: request.signal });
    return new Response(new Uint8Array(result.bytes), { headers: { ...headers, "Content-Type": result.format === "png" ? "image/png" : "image/jpeg",
      "Content-Disposition": disposition(result.filename, result.format), "Content-Length": String(result.bytes.length) } });
  } catch (error) {
    const safe = error instanceof ExportError ? error : new ExportError("unavailable");
    return Response.json({ ok: false, code: safe.code, message: safe.message }, { status: safe.status, headers });
  }
}

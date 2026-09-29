import { exportDenied, exportPrivateHeaders, verifyExportRequest } from "@/features/detail-export/authorization";
export const runtime="nodejs";
export async function POST(request:Request) {
  try {
    // No request payload/actor/project overrides are supported.
    if (!await verifyExportRequest(request,false)) return exportDenied();
    if (request.body) {
      const reader=request.body.getReader();
      try { const chunk=await reader.read(); if(!chunk.done || chunk.value?.length) { await reader.cancel(); return exportDenied(); } }
      finally { reader.releaseLock(); }
    }
    const snapshot=await verifyExportRequest(request,true);
    return snapshot ? Response.json(snapshot,{headers:exportPrivateHeaders}) : exportDenied();
  } catch { return exportDenied(); }
}

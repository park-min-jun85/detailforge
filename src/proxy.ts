import { NextResponse, type NextRequest } from "next/server";
import { updateAuthSession } from "@/lib/auth/proxy";
import { exportDenied, exportPrivateHeaders, verifyExportRequest } from "@/features/detail-export/authorization";

export async function proxy(request: NextRequest) {
  if(request.nextUrl.pathname.startsWith("/export-capture")) {
    try {
      if(request.nextUrl.pathname==="/export-capture" && request.method==="GET" && await verifyExportRequest(request,false)) {
        const response=NextResponse.next();
        for(const [key,value] of Object.entries(exportPrivateHeaders))response.headers.set(key,value);
        response.headers.set("Content-Security-Policy","default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
        return response;
      }
      if(request.nextUrl.pathname==="/export-capture/data" && request.method==="POST")return NextResponse.next();
    } catch { /* No capability or internal details in errors. */ }
    return exportDenied();
  }
  return updateAuthSession(request);
}

// Every application page and project API is gated before execution; DAL/RLS are
// still the resource authorization boundary. Do not exclude RSC or prefetch.
export const config = {
  matcher: ["/", "/projects/:path*", "/api/projects/:path*", "/settings/:path*", "/templates/:path*",
    "/login", "/signup", "/auth/:path*", "/export-capture/:path*"],
};

import type { NextRequest } from "next/server";
import { updateAuthSession } from "@/lib/auth/proxy";

export function proxy(request: NextRequest) { return updateAuthSession(request); }

// Every application page and project API is gated before execution; DAL/RLS are
// still the resource authorization boundary. Do not exclude RSC or prefetch.
export const config = {
  matcher: ["/", "/projects/:path*", "/api/projects/:path*", "/settings/:path*", "/templates/:path*",
    "/login", "/signup", "/auth/:path*"],
};

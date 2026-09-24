import type { NextRequest } from "next/server";
import { updateAuthSession } from "@/lib/auth/proxy";

export function proxy(request: NextRequest) { return updateAuthSession(request); }

// No redirects or route enforcement in TASK-056; legacy internal workflows remain.
export const config = {
  matcher: ["/", "/projects/:path*", "/api/projects/:path*", "/settings", "/templates",
    "/login", "/signup", "/forgot-password", "/reset-password", "/auth/:path*"],
};

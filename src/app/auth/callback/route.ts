import { NextResponse, type NextRequest } from "next/server";
import { createAuthenticatedServerClient } from "@/lib/auth/server";
import { requireCurrentUser } from "@/lib/auth/principal";
import { AUTH_RESPONSE_HEADERS } from "@/lib/auth/session";
import { safeReturnPath } from "@/lib/auth/return-path";
import { authAppOrigin } from "@/lib/auth/origin";

export async function GET(request: NextRequest) {
  const headers = new Headers(AUTH_RESPONSE_HEADERS);
  let target = "/login?notice=confirmation_failed";
  try {
    const code = request.nextUrl.searchParams.get("code");
    if (code && code.length <= 2048 && /^[a-zA-Z0-9_-]+$/.test(code)) {
      const client = await createAuthenticatedServerClient({ mode: "write", responseHeaders: headers });
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) {
        await requireCurrentUser(client);
        target = safeReturnPath(request.nextUrl.searchParams.get("next"));
      }
    }
  } catch { /* Never echo a provider error, code, token or raw callback query. */ }
  const response = NextResponse.redirect(new URL(target, authAppOrigin()), 303);
  headers.forEach((value, key) => response.headers.set(key, value));
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

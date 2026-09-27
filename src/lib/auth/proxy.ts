import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requirePublicAuthConfig } from "./config";
import { createSessionClient, AUTH_RESPONSE_HEADERS } from "./session";
import { AuthFailure, safeAuthError } from "./errors";
import { getCurrentUser } from "./principal";
import { loginLocation, safeReturnPath } from "./return-path";
import { authAppOrigin } from "./origin";

export async function updateAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const finish = (target: NextResponse) => {
    for (const cookie of response.cookies.getAll()) target.cookies.set(cookie);
    for (const [name, value] of Object.entries(AUTH_RESPONSE_HEADERS)) target.headers.set(name, value);
    target.headers.set("Referrer-Policy", "no-referrer");
    return target;
  };
  try {
    // Auth endpoints own their POST/callback/session verification and cookie writes.
    if (request.nextUrl.pathname.startsWith("/auth/")) return finish(response);
    requirePublicAuthConfig();
    const client = createSessionClient({
      getAll: () => request.cookies.getAll(),
      setAll: (changes, cacheHeaders) => {
        for (const { name, value } of changes) request.cookies.set(name, value);
        const previous = response;
        response = NextResponse.next({ request });
        for (const cookie of previous.cookies.getAll()) response.cookies.set(cookie);
        for (const { name, value, options } of changes) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries({ ...AUTH_RESPONSE_HEADERS, ...cacheHeaders })) response.headers.set(name, value);
      },
    });
    // Verified identity BEFORE RSC/Action/API execution. Resource authorization
    // still happens independently in the user-scoped DAL and DB/Storage RLS.
    const principal = await getCurrentUser(client);
    const path = request.nextUrl.pathname;
    const authPage = path === "/login" || path === "/signup";
    if (!principal && !authPage) {
      if (path.startsWith("/api/") || request.method !== "GET" && request.method !== "HEAD") {
        const safe = safeAuthError(new AuthFailure("unauthenticated"));
        return finish(NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status }));
      }
      return finish(NextResponse.redirect(new URL(loginLocation(path + request.nextUrl.search), authAppOrigin())));
    }
    if (principal && authPage) return finish(NextResponse.redirect(new URL(safeReturnPath(request.nextUrl.searchParams.get("next")), authAppOrigin())));
    return finish(response);
  } catch (error) {
    const safe = safeAuthError(error);
    const failure = NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status, headers: AUTH_RESPONSE_HEADERS });
    return finish(failure);
  }
}

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { readPublicAuthConfig } from "./config";
import { createSessionClient, AUTH_RESPONSE_HEADERS } from "./session";
import { safeAuthError } from "./errors";

export async function updateAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  try {
    // Transitional refresh-only layer. Guards still fail closed when config is absent.
    if (!readPublicAuthConfig()) return response;
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
    // Refresh/verification only, NOT project authorization. DAL must call getUser.
    await client.auth.getClaims();
    for (const [name, value] of Object.entries(AUTH_RESPONSE_HEADERS)) response.headers.set(name, value);
    return response;
  } catch (error) {
    const safe = safeAuthError(error);
    const failure = NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status, headers: AUTH_RESPONSE_HEADERS });
    for (const cookie of response.cookies.getAll()) failure.cookies.set(cookie);
    return failure;
  }
}

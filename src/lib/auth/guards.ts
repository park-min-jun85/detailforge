import "server-only";

import { redirect } from "next/navigation";
import { requireCurrentUser } from "./principal";
import { AuthFailure, safeAuthError } from "./errors";
import { AUTH_RESPONSE_HEADERS, type AuthClient } from "./session";
import { loginLocation } from "./return-path";
import { createAuthenticatedServerClient } from "./server";

export async function requireApiUser(client?: AuthClient) {
  const headers = new Headers(AUTH_RESPONSE_HEADERS);
  try {
    const requestClient = client ?? await createAuthenticatedServerClient({ mode: "write", responseHeaders: headers });
    return { ok: true as const, principal: await requireCurrentUser(requestClient), headers };
  }
  catch (error) {
    const safe = safeAuthError(error);
    return { ok: false as const, response: Response.json({ error: { code: safe.code, message: safe.message } },
      { status: safe.status, headers }) };
  }
}

export async function requirePageUser(returnPath: unknown, client?: AuthClient) {
  try { return await requireCurrentUser(client); }
  catch (error) {
    if (error instanceof AuthFailure && error.code === "unauthenticated") redirect(loginLocation(returnPath));
    throw error;
  }
}

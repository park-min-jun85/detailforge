import "server-only";

import { z } from "zod";
import { createAuthenticatedServerClient } from "./server";
import type { AuthClient } from "./session";
import { AuthFailure, providerAuthCode, providerAuthFailure } from "./errors";

export type AuthenticatedPrincipal = Readonly<{ userId: string }>;
const missingSession = new Set(["session_not_found", "refresh_token_not_found", "refresh_token_already_used", "bad_jwt", "jwt_expired"]);

export async function getCurrentUser(client?: AuthClient): Promise<AuthenticatedPrincipal | null> {
  try {
    const { data, error } = await (client ?? await createAuthenticatedServerClient()).auth.getUser();
    if (error) {
      if (error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403 || missingSession.has(providerAuthCode(error) ?? "")) return null;
      throw providerAuthFailure(error);
    }
    if (!data.user || data.user.is_anonymous) return null;
    const id = z.uuid().safeParse(data.user.id);
    if (!id.success) throw new AuthFailure("temporary_failure");
    return Object.freeze({ userId: id.data });
  } catch (error) { throw error instanceof AuthFailure ? error : new AuthFailure("temporary_failure"); }
}

export async function requireCurrentUser(client?: AuthClient): Promise<AuthenticatedPrincipal> {
  const principal = await getCurrentUser(client);
  if (!principal) throw new AuthFailure("unauthenticated");
  return principal;
}

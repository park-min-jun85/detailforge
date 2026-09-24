import "server-only";

import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { authCookieOptions, requirePublicAuthConfig } from "./config";
import { AuthFailure } from "./errors";
import { authTransport } from "./transport";

export const AUTH_RESPONSE_HEADERS = { "Cache-Control": "private, no-store", "Pragma": "no-cache", "Expires": "0" };

export function createSessionClient(cookies: CookieMethodsServer) {
  const { url, key } = requirePublicAuthConfig();
  // The existing internal client keeps its old env names. Reject mixed projects.
  if (process.env.SUPABASE_URL) {
    try { if (new URL(process.env.SUPABASE_URL).origin !== url) throw new Error(); }
    catch { throw new AuthFailure("configuration"); }
  }
  return createServerClient<Database>(url, key, {
    cookies, cookieOptions: authCookieOptions(), auth: { debug: false },
    global: { fetch: authTransport },
  });
}

export type AuthClient = ReturnType<typeof createSessionClient>;

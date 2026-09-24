"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { authCookieOptions, requirePublicAuthConfig } from "./config";
import { authTransport } from "./transport";

export function createBrowserAuthClient() {
  const { url, key } = requirePublicAuthConfig();
  return createBrowserClient<Database>(url, key, {
    cookieOptions: authCookieOptions(),
    auth: { debug: false },
    global: { fetch: authTransport },
  });
}

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "./database.types";

const serverEnvironmentSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

function getServerEnvironment() {
  const result = serverEnvironmentSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!result.success) {
    const invalidNames = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ].join(", ");

    throw new Error(
      `Missing or invalid Supabase server environment variables: ${invalidNames}`,
    );
  }

  return result.data;
}

// Privileged legacy/internal client. Never import from the new Auth foundation.
export function createSupabaseAdminClient(options?: { requestTimeoutMs: number }): SupabaseClient<Database> {
  const environment = getServerEnvironment();

  return createClient<Database>(
    environment.SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    {
      ...(options ? { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init,
        signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(options.requestTimeoutMs)]) : AbortSignal.timeout(options.requestTimeoutMs) }) } } : {}),
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

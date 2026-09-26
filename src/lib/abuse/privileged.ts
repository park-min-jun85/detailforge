import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { AuthFailure } from "@/lib/auth/errors";

// The only production admin use. This module exports no client or generic CRUD.
// Admission service verifies the actor and scopes the resource with a user JWT
// before invoking these finite RPCs. SQL repeats root/parent validation.
type Functions = Database["public"]["Functions"];
export async function admissionRpc<N extends "reserve_admission" | "settle_admission">(name: N, args: Functions[N]["Args"]) {
  const client = createSupabaseAdminClient({ requestTimeoutMs: 10_000 });
  const { data, error } = await client.rpc(name, args);
  if (error) throw new AuthFailure(error.code === "P0002" ? "rate_limited" : error.code === "42501" ? "forbidden" : "temporary_failure");
  return data;
}

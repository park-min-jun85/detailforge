import "server-only";

// Compatibility for the existing 31 internal call sites, migrated in TASK-060.
// This alias IS privileged; authenticated requests use lib/auth/server.ts instead.
export { createSupabaseAdminClient as createSupabaseServerClient } from "./admin";

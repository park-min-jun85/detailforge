import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AuthenticatedPrincipal } from "@/lib/auth/principal";
import { createAuthenticatedServerClient } from "@/lib/auth/server";
import { createProjectSchema, updateProjectSchema, PROJECT_PAGE_SIZE } from "./schemas";
import { OwnershipError, ownedProjectRowSchema, principalId, resourceId } from "./ownership";

export type ProjectClient = SupabaseClient<Database>;
const columns = "id,name,status,created_at,updated_at,owner_id";
const signal = () => AbortSignal.timeout(10_000);
async function bounded<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) { throw error instanceof OwnershipError ? error : new OwnershipError("unavailable"); }
}
function ownedRow(row: unknown, owner: string) {
  if (!row) throw new OwnershipError("not_found");
  const parsed = ownedProjectRowSchema.safeParse(row);
  if (!parsed.success || parsed.data.ownerId !== owner) throw new OwnershipError("not_found");
  return parsed.data;
}

// Defense in depth only: RLS/grants are TASK-058; legacy service-role paths remain.
// A supplied client is trusted server-side DI, never request body/query input.
export async function createProject(principal: AuthenticatedPrincipal, input: unknown, client?: ProjectClient) {
  return bounded(async () => {
    const owner = principalId(principal), parsed = createProjectSchema.safeParse(input);
    if (!parsed.success) throw new OwnershipError("invalid_input");
    const db = client ?? await createAuthenticatedServerClient();
    const result = await db.from("projects").insert({ name: parsed.data.name, status: "draft", owner_id: owner })
      .select(columns).abortSignal(signal()).single();
    if (result.error) throw new OwnershipError("unavailable");
    return ownedRow(result.data, owner);
  });
}

export async function listOwnedProjects(principal: AuthenticatedPrincipal, requestedPage = 1, client?: ProjectClient) {
  return bounded(async () => {
    const owner = principalId(principal), db = client ?? await createAuthenticatedServerClient();
    const count = await db.from("projects").select("id", { count: "exact", head: true })
      .eq("owner_id", owner).abortSignal(signal());
    if (count.error || count.count === null) throw new OwnershipError("unavailable");
    const totalPages = Math.max(1, Math.ceil(count.count / PROJECT_PAGE_SIZE));
    const page = Number.isSafeInteger(requestedPage) ? Math.min(Math.max(1, requestedPage), totalPages) : 1;
    const start = (page - 1) * PROJECT_PAGE_SIZE;
    const result = await db.from("projects").select(columns).eq("owner_id", owner)
      .order("updated_at", { ascending: false }).order("id", { ascending: false })
      .range(start, start + PROJECT_PAGE_SIZE - 1).abortSignal(signal());
    if (result.error || !result.data) throw new OwnershipError("unavailable");
    return { projects: result.data.map(row => ownedRow(row, owner)), total: count.count, totalPages, page };
  });
}

export async function getOwnedProject(principal: AuthenticatedPrincipal, projectId: string, client?: ProjectClient) {
  return bounded(async () => {
    const owner = principalId(principal), id = resourceId(projectId), db = client ?? await createAuthenticatedServerClient();
    const result = await db.from("projects").select(columns).eq("id", id).eq("owner_id", owner)
      .abortSignal(signal()).maybeSingle();
    if (result.error) throw new OwnershipError("unavailable");
    return ownedRow(result.data, owner);
  });
}

export async function updateOwnedProject(principal: AuthenticatedPrincipal, projectId: string, input: unknown, client?: ProjectClient) {
  return bounded(async () => {
    const owner = principalId(principal), id = resourceId(projectId), parsed = updateProjectSchema.safeParse(input);
    if (!parsed.success) throw new OwnershipError("invalid_input");
    const db = client ?? await createAuthenticatedServerClient();
    // Owner check is on the UPDATE itself, not a read-then-unscoped-write.
    const result = await db.from("projects").update(parsed.data).eq("id", id).eq("owner_id", owner)
      .select(columns).abortSignal(signal()).maybeSingle();
    if (result.error) throw new OwnershipError("unavailable");
    return ownedRow(result.data, owner);
  });
}

export async function deleteOwnedProject(principal: AuthenticatedPrincipal, projectId: string, client?: ProjectClient) {
  return bounded(async () => {
    const owner = principalId(principal), id = resourceId(projectId), db = client ?? await createAuthenticatedServerClient();
    // SQL row deletion cascades children. Storage objects are NOT deleted here.
    // No UI/endpoint exposes this primitive before the Storage lifecycle is designed.
    const result = await db.from("projects").delete().eq("id", id).eq("owner_id", owner)
      .select("id").abortSignal(signal()).maybeSingle();
    if (result.error) throw new OwnershipError("unavailable");
    if (!result.data) throw new OwnershipError("not_found");
    return { deleted: true as const };
  });
}

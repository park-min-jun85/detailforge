import "server-only";

import type { ProjectClient } from "./service";
import { createProjectSchema } from "./schemas";

// Explicit pre-auth/internal bridge, removed at TASK-060. Never choose an owner.
// Valid only before Stage C: NOT NULL intentionally rejects this old insert.
export async function createLegacyInternalProject(input: unknown, client: ProjectClient) {
  const parsed = createProjectSchema.parse(input);
  const { error } = await client.from("projects").insert({ name: parsed.name, status: "draft" })
    .abortSignal(AbortSignal.timeout(10_000));
  if (error) throw new Error("Project insert failed");
}

import "server-only";

import type { ProjectClient } from "./service";
import { createProjectSchema } from "./schemas";

// TASK-058 closes the ownerless bridge. TASK-060/061 must wire the verified
// principal into createProject before this old action can create projects again.
export async function createLegacyInternalProject(input: unknown, _client: ProjectClient) {
  void _client;
  createProjectSchema.parse(input);
  throw new Error("Project creation requires authenticated ownership");
}

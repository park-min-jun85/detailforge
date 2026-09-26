import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createAuthenticatedServerClient } from "@/lib/auth/server";
import { requireCurrentUser, type AuthenticatedPrincipal } from "@/lib/auth/principal";
import type { AuthClient } from "@/lib/auth/session";

type Context = Readonly<{ client: AuthClient; principal: AuthenticatedPrincipal }>;
const requests = new AsyncLocalStorage<Context>();

// Server-only DI for jobs/runtime tests. Identity is still verified by GoTrue;
// neither a principal nor an admin fallback can be supplied by an HTTP caller.
export async function withUserClient<T>(client: AuthClient, operation: () => Promise<T>): Promise<T> {
  const principal = await requireCurrentUser(client);
  return requests.run(Object.freeze({ client, principal }), operation);
}

export async function getUserContext(): Promise<Context> {
  const current = requests.getStore();
  if (current) return current;
  const client = await createAuthenticatedServerClient();
  return Object.freeze({ client, principal: await requireCurrentUser(client) });
}

export async function createUserDataClient(_options?: { requestTimeoutMs: number }): Promise<AuthClient> {
  void _options; // Auth transport already bounds every SDK request to 10 seconds.
  return (await getUserContext()).client;
}

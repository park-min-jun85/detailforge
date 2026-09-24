import "server-only";

import { cookies } from "next/headers";
import { createSessionClient, AUTH_RESPONSE_HEADERS } from "./session";
import { requirePublicAuthConfig } from "./config";

type CookieAccess = { mode: "read-only" } | { mode: "write"; responseHeaders: Headers };

// A new client for every request. RSC reads rely on proxy.ts for cookie refresh.
// Route/Action mutations must opt into writes; persistence failures are not swallowed.
export async function createAuthenticatedServerClient(access: CookieAccess = { mode: "read-only" }) {
  requirePublicAuthConfig();
  const store = await cookies();
  return createSessionClient({
    getAll: () => store.getAll(),
    setAll: (changes, cacheHeaders) => {
      if (access.mode === "read-only") return;
      for (const { name, value, options } of changes) store.set(name, value, options);
      for (const [name, value] of Object.entries({ ...AUTH_RESPONSE_HEADERS, ...cacheHeaders })) access.responseHeaders.set(name, value);
    },
  });
}

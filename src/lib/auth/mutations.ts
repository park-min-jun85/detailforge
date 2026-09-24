import "server-only";

import { z } from "zod";
import { assertSameOrigin } from "@/features/assets/http";
import { createAuthenticatedServerClient } from "./server";
import { AUTH_RESPONSE_HEADERS, type AuthClient } from "./session";
import { requireCurrentUser } from "./principal";
import { AuthFailure, providerAuthCode, providerAuthFailure, safeAuthError } from "./errors";

const credentials = z.strictObject({ email: z.email().max(254).trim(), password: z.string().min(1).max(1024) });
export const MAX_AUTH_BODY_BYTES = 8192;
type ClientFactory = (responseHeaders: Headers) => Promise<AuthClient>;
const requestClient: ClientFactory = responseHeaders => createAuthenticatedServerClient({ mode: "write", responseHeaders });

function assertAuthMutation(request: Request) {
  if (request.method !== "POST") throw new AuthFailure("forbidden");
  const configured = process.env.DETAILFORGE_APP_ORIGIN;
  let trusted: URL;
  try {
    if (!configured) throw new Error();
    trusted = new URL(configured);
    if (trusted.username || trusted.password || trusted.pathname !== "/" || trusted.search || trusted.hash
      || (trusted.protocol !== "https:" && !(trusted.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(trusted.hostname)))) throw new Error();
  } catch { throw new AuthFailure("configuration"); }
  // Existing application check plus a configured origin, never Host-derived trust.
  try { assertSameOrigin(request); } catch { throw new AuthFailure("forbidden"); }
  if (request.headers.get("origin") !== trusted.origin) throw new AuthFailure("forbidden");
}

async function readAuthBody(request: Request, empty = false): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_AUTH_BODY_BYTES)) throw new AuthFailure("invalid_input");
  if (!request.body) { if (empty) return {}; throw new AuthFailure("invalid_input"); }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AuthFailure("invalid_input");
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > MAX_AUTH_BODY_BYTES) { await reader.cancel(); throw new AuthFailure("invalid_input"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { throw new AuthFailure("invalid_input"); }
  finally { reader.releaseLock(); }
}

async function mutate(request: Request, operation: "signup" | "signin" | "signout", makeClient: ClientFactory) {
  const headers = new Headers(AUTH_RESPONSE_HEADERS);
  try {
    assertAuthMutation(request);
    const body = await readAuthBody(request, operation === "signout");
    const parsed = (operation === "signout" ? z.strictObject({}) : credentials).safeParse(body);
    if (!parsed.success) throw new AuthFailure("invalid_input");
    const client = await makeClient(headers);
    if (operation === "signout") {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw providerAuthFailure(error);
      return Response.json({ status: "signed_out", clearClientState: true, next: "/login" }, { headers });
    }
    const input = credentials.parse(parsed.data);
    if (operation === "signup") {
      const { data, error } = await client.auth.signUp(input);
      const duplicate = ["user_already_exists", "email_exists"].includes(providerAuthCode(error) ?? "");
      if (error && !duplicate) throw providerAuthFailure(error);
      // Confirmation-disabled dev projects must not silently log in through signup.
      if (data.session) {
        const { error: logoutError } = await client.auth.signOut({ scope: "local" });
        if (logoutError) throw providerAuthFailure(logoutError);
      }
      return Response.json({ status: "submitted", message: "이메일을 확인해 주세요. 이미 가입했다면 로그인 또는 비밀번호 재설정을 이용해 주세요." }, { headers });
    }
    const { error } = await client.auth.signInWithPassword(input);
    if (error) throw providerAuthFailure(error);
    const principal = await requireCurrentUser(client);
    return Response.json({ status: "signed_in", principal }, { headers });
  } catch (error) {
    const safe = safeAuthError(error);
    return Response.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status, headers });
  }
}

// Server-only building blocks, NOT exposed routes or Server Actions in TASK-056.
// Future HTTP wrappers pass the original request; no userId/options/redirect override.
export function signUpWithPassword(request: Request, makeClient: ClientFactory = requestClient) { return mutate(request, "signup", makeClient); }
export function signInWithPassword(request: Request, makeClient: ClientFactory = requestClient) { return mutate(request, "signin", makeClient); }
export function signOut(request: Request, makeClient: ClientFactory = requestClient) { return mutate(request, "signout", makeClient); }

const allowedCodes = new Set(["invalid_credentials", "email_not_confirmed", "over_request_rate_limit", "over_email_send_rate_limit",
  "weak_password", "user_already_exists", "email_exists", "session_not_found", "refresh_token_not_found", "refresh_token_already_used", "bad_jwt", "jwt_expired"]);

// The SDK can log refresh errors even with debug:false. Strip provider text before
// it becomes an SDK error; never patch the process-wide console or log credentials.
export async function authTransport(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(input, { ...init, cache: "no-store", redirect: "error",
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) });
  } catch { throw new Error("Authentication request failed."); }
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (response.ok || !url.pathname.startsWith("/auth/v1/")) return response;
  let code = "unexpected_failure";
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object") {
      const candidate = "code" in body ? body.code : "error_code" in body ? body.error_code : undefined;
      if (typeof candidate === "string" && allowedCodes.has(candidate)) code = candidate;
    }
  } catch { /* Non-JSON provider failures have the same bounded category. */ }
  return Response.json({ code, error_code: code, message: "Authentication request failed." }, { status: response.status });
}

export const AUTH_ERRORS = {
  configuration: { status: 503, message: "인증 설정을 확인해 주세요." },
  unauthenticated: { status: 401, message: "로그인이 필요합니다." },
  invalid_credentials: { status: 401, message: "이메일과 비밀번호를 확인해 주세요." },
  invalid_input: { status: 400, message: "이메일과 비밀번호 입력을 확인해 주세요." },
  password_rejected: { status: 400, message: "서비스의 비밀번호 요구사항을 확인해 주세요." },
  forbidden: { status: 403, message: "허용되지 않은 요청입니다." },
  rate_limited: { status: 429, message: "요청이 많습니다. 잠시 후 다시 시도해 주세요." },
  temporary_failure: { status: 503, message: "인증을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요." },
} as const;
export type AuthErrorCode = keyof typeof AUTH_ERRORS;

export class AuthFailure extends Error {
  readonly code: AuthErrorCode;
  constructor(code: AuthErrorCode) { super(AUTH_ERRORS[code].message); this.name = "AuthFailure"; this.code = code; }
}

export function safeAuthError(error: unknown) {
  const code = error instanceof AuthFailure ? error.code : "temporary_failure";
  return { code, ...AUTH_ERRORS[code] };
}

// Read bounded provider categories only. Never retain its message, headers or cause.
export function providerAuthCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
}
export function providerAuthFailure(error: unknown): AuthFailure {
  const code = providerAuthCode(error);
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit"
    || (error && typeof error === "object" && "status" in error && error.status === 429)) return new AuthFailure("rate_limited");
  if (code === "invalid_credentials" || code === "email_not_confirmed") return new AuthFailure("invalid_credentials");
  if (code === "weak_password") return new AuthFailure("password_rejected");
  return new AuthFailure("temporary_failure");
}

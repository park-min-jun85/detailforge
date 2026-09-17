import "server-only";

const messages = {
  key_missing: "DOMEGGOOK_API_KEY를 서버 환경에 설정해 주세요.",
  invalid_product: "상품번호 형식이 올바르지 않습니다.",
  authentication: "공식 API 인증에 실패했습니다. 키 설정을 확인해 주세요.",
  forbidden: "공식 API 접근 권한을 확인해 주세요.",
  rate_limited: "공식 API 호출 제한으로 진단을 중단했습니다.",
  redirect: "공식 API의 redirect 응답을 거부했습니다.",
  timeout: "공식 API 응답 시간이 초과되었습니다.",
  too_large: "공식 API 응답 크기 제한을 초과했습니다.",
  invalid_response: "공식 API 응답 형식을 확인할 수 없습니다.",
  product_mismatch: "응답 상품번호가 요청 상품번호와 다릅니다.",
  api_error: "공식 API가 조회 오류를 반환했습니다.",
  unavailable: "공식 API에 연결할 수 없습니다.",
} as const;
export type DomemeErrorCode = keyof typeof messages;
export class DomemeApiError extends Error {
  readonly code: DomemeErrorCode;
  constructor(code: DomemeErrorCode) {
    super(messages[code]);
    this.name = "DomemeApiError";
    this.code = code;
  }
}
// Never forward upstream messages, URLs, causes or network error objects.
export function safeDomemeError(error: unknown) {
  const code = error instanceof DomemeApiError ? error.code : "unavailable";
  return { code, message: messages[code] };
}

export const importMessages = {
  invalid_url: "URL 형식이 올바르지 않습니다. 공개 상품 페이지의 http/https 주소를 입력해 주세요.",
  blocked: "접근할 수 없는 주소입니다. 공개 상품 페이지 주소를 확인해 주세요.",
  restricted: "로그인·CAPTCHA·접근 제한이 있는 페이지는 자동으로 가져올 수 없습니다.",
  too_large: "페이지 또는 이미지 응답이 너무 큽니다.", timeout: "요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
  unsupported: "지원하지 않는 응답 형식입니다. 상품 HTML과 JPEG/PNG/WebP 이미지만 지원합니다.",
  not_found: "상품정보를 찾지 못했습니다. 수동 입력을 사용해 주세요.", browser_empty: "JavaScript 렌더링 후에도 상품정보를 찾지 못했습니다.",
  browser_missing: "렌더링에 필요한 Chromium이 없습니다. 수동 입력을 사용하거나 서버 설치 상태를 확인해 주세요.",
  unavailable: "자동으로 가져올 수 없는 페이지입니다. 수동 입력을 사용해 주세요.",
  expired: "미리보기가 만료되었거나 사용할 수 없습니다. URL을 다시 불러와 주세요.",
  busy: "가져오기가 진행 중입니다. 완료 후 다시 시도해 주세요.", invalid_input: "입력 내용과 선택 이미지를 확인해 주세요.",
  conflict: "상품정보가 변경되었습니다. 새로고침하여 저장 내용을 확인해 주세요.",
  asset_limit: "상품당 이미지는 최대 30개까지 등록할 수 있습니다.", image_failed: "이미지를 가져오지 못했습니다. 이미지 목록에서 저장 상태를 확인해 주세요.",
} as const;
export class ImportError extends Error {
  readonly code: keyof typeof importMessages;
  constructor(code: keyof typeof importMessages) { super(importMessages[code]); this.code = code; }
  get status() { return this.code === "busy" || this.code === "conflict" ? 409 : this.code === "expired" ? 410 : this.code === "blocked" || this.code === "restricted" ? 403 : this.code === "timeout" ? 504 : this.code === "too_large" ? 413 : this.code === "unavailable" || this.code === "browser_missing" ? 503 : 400; }
}

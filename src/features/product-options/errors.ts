export const OPTION_ERRORS = {
  invalid_input: { status: 400, message: "옵션 입력을 확인해 주세요. 그룹 이름과 실제 선택값이 필요하며 이름·값·ID 중복 및 개수 제한을 확인해 주세요." },
  not_found: { status: 404, message: "프로젝트 또는 상품을 찾을 수 없습니다." },
  product_required: { status: 409, message: "먼저 상품정보를 저장해 주세요." },
  conflict: { status: 409, message: "다른 변경사항이 먼저 저장되었습니다. 최신 옵션을 다시 불러와 주세요." },
  forbidden: { status: 403, message: "허용되지 않은 요청입니다." },
  unavailable: { status: 503, message: "옵션 작업을 완료하지 못했습니다. 저장 결과를 확인한 뒤 다시 시도해 주세요." },
} as const;
export class OptionError extends Error {
  readonly status: number;
  readonly code: keyof typeof OPTION_ERRORS;
  constructor(code: keyof typeof OPTION_ERRORS) { super(OPTION_ERRORS[code].message); this.code = code; this.status = OPTION_ERRORS[code].status; }
}

export const OPTION_ERRORS = {
  invalid_schema: { status: 503, message: "저장된 옵션 형식을 확인할 수 없습니다." },
  source_url: { status: 400, message: "상품정보에 저장된 도매매 원본 URL을 확인해 주세요. https://domeme.domeggook.com/s/상품번호 형식을 지원합니다." },
  expired: { status: 409, message: "후보가 만료되었거나 더 이상 유효하지 않습니다. 입력은 유지됩니다. 다시 조회하거나 출처 확인 없이 수동 저장을 선택해 주세요." },
  source_changed: { status: 409, message: "저장된 원본 URL이 변경되었습니다. 입력은 유지됩니다. 새 원본으로 다시 조회해 주세요." },
  restricted: { status: 400, message: "이 후보는 현재 옵션 모델로 반영할 수 없습니다. 기존 옵션을 유지하고 수동으로 확인해 주세요." },
  api_authentication: { status: 503, message: "도매매 API 인증 또는 접근 권한을 확인해 주세요." },
  api_rate_limited: { status: 429, message: "도매매 API 호출 제한입니다. 자동 재시도하지 않습니다. 잠시 후 직접 다시 요청해 주세요." },
  api_failed: { status: 503, message: "도매매 옵션을 조회하지 못했습니다. 기존 옵션은 유지됩니다. 서버 설정과 연결 상태를 확인해 주세요." },
  busy: { status: 409, message: "옵션 조회가 진행 중입니다. 완료 후 다시 시도해 주세요." },
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

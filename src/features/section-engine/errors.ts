export const SECTION_ERRORS = {
  not_found: { status: 404, message: "프로젝트를 찾을 수 없습니다." },
  plan_required: { status: 409, message: "최신 페이지 설계를 먼저 생성해 주세요." },
  input_changed: { status: 409, message: "생성 중 입력이나 페이지 설계가 변경되었습니다. 최신 설계를 확인해 주세요." },
  ownership: { status: 409, message: "상품·페이지·이미지의 연결 정보를 확인해 주세요." },
  invalid_input: { status: 409, message: "저장된 정보를 확인하지 못했습니다. 내용을 확인한 뒤 다시 시도해 주세요." },
  busy: { status: 409, message: "이미 생성 작업이 진행 중입니다. 잠시 후 결과를 확인해 주세요." },
  conflict: { status: 409, message: "다른 작업에서 저장 정보가 변경되었습니다. 새로고침해 확인해 주세요." },
  confirmation_required: { status: 409, message: "기존 콘텐츠 전체 교체를 먼저 확인해 주세요." },
  database: { status: 503, message: "콘텐츠 저장을 완료하지 못했습니다. 기존 결과를 복원했습니다." },
  recovery_required: { status: 503, message: "저장 복구가 필요합니다. 보관된 기존 결과를 표시합니다. 복구 후 다시 생성해 주세요." },
  not_configured: { status: 503, message: "Section 생성 AI 설정을 확인해 주세요." },
  invalid_response: { status: 502, message: "생성 결과가 설계 또는 근거 검증을 통과하지 못했습니다. 기존 콘텐츠는 유지됩니다." },
  provider: { status: 502, message: "AI 서비스에서 콘텐츠를 생성하지 못했습니다. 기존 콘텐츠는 유지됩니다." },
  timeout: { status: 504, message: "콘텐츠 생성 시간이 초과되었습니다. 결과를 새로고침해 확인해 주세요." },
  forbidden: { status: 403, message: "허용되지 않은 요청입니다." },
  interrupted: { status: 409, message: "중단된 생성 작업의 기존 콘텐츠를 복구했습니다. 다시 생성할 수 있습니다." },
  unexpected: { status: 503, message: "콘텐츠 상태를 확인하지 못했습니다. 새로고침해 주세요." },
} as const;
export type SectionErrorCode = keyof typeof SECTION_ERRORS;
export class SectionEngineError extends Error {
  readonly code: SectionErrorCode; readonly status: number;
  constructor(code: SectionErrorCode) { super(SECTION_ERRORS[code].message); this.code = code; this.status = SECTION_ERRORS[code].status; }
}

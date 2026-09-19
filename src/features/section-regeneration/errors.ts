export const REGEN_ERRORS = {
  not_configured: { status: 503, message: "AI 재생성 설정을 확인해 주세요." },
  not_found: { status: 404, message: "재생성할 섹션을 찾을 수 없습니다." },
  ownership: { status: 403, message: "프로젝트와 상품·섹션·이미지 연결을 확인해 주세요." },
  forbidden: { status: 403, message: "허용되지 않은 요청입니다." },
  invalid_input: { status: 400, message: "재생성 요청을 확인해 주세요." },
  invalid_candidate: { status: 400, message: "유효한 AI 후보가 아닙니다. 다시 생성해 주세요." },
  expired: { status: 409, message: "AI 후보의 유효 시간이 지났습니다. 다시 생성해 주세요." },
  conflict: { status: 409, message: "다른 변경사항이 먼저 저장되었습니다. 최신 섹션을 불러온 뒤 AI 후보를 다시 생성해 주세요." },
  stale_plan: { status: 409, message: "최신 페이지 설계를 먼저 확인해 주세요." },
  stale_validation: { status: 409, message: "최신 사실 검증을 먼저 완료해 주세요." },
  busy: { status: 409, message: "다른 편집·생성·복구가 진행 중입니다. 잠시 후 다시 시도해 주세요." },
  copy_quality: { status: 422, message: "생성된 문구 품질 검증을 통과하지 못했습니다. 기존 상세페이지는 유지됩니다." },
  provider: { status: 502, message: "AI 후보를 생성하지 못했습니다. 기존 내용은 유지됩니다." },
  timeout: { status: 504, message: "AI 응답 시간이 초과되었습니다. 기존 내용은 유지됩니다." },
  invalid_response: { status: 502, message: "AI 결과의 형식을 확인할 수 없습니다. 기존 내용은 유지됩니다." },
  invalid_evidence: { status: 422, message: "AI 결과가 허용된 근거 범위를 충족하지 못했습니다. 기존 내용은 유지됩니다." },
  database: { status: 503, message: "저장 상태를 확인하지 못했습니다. 최신 섹션을 다시 불러와 확인해 주세요." },
} as const;
export type RegenErrorCode = keyof typeof REGEN_ERRORS;
export class RegenError extends Error {
  readonly code: RegenErrorCode; readonly status: number;
  constructor(code: RegenErrorCode) { super(REGEN_ERRORS[code].message); this.code = code; this.status = REGEN_ERRORS[code].status; }
}

import type { PlannerErrorCode } from "./schemas";
export const PLANNER_ERRORS: Record<PlannerErrorCode, { status: number; message: string }> = {
  not_found: { status: 404, message: "프로젝트를 찾을 수 없습니다." },
  product_required: { status: 409, message: "상품정보를 먼저 저장해 주세요." },
  facts_required: { status: 409, message: "Product Facts를 먼저 저장해 주세요." },
  validation_required: { status: 409, message: "최신 사실 검증을 먼저 완료해 주세요." },
  content_required: { status: 409, message: "설계에 사용할 지원된 Fact 또는 완료된 이미지 관찰이 필요합니다." },
  invalid_input: { status: 409, message: "입력 정보 형식을 확인할 수 없습니다. 상품정보와 분석 결과를 확인해 주세요." },
  ownership: { status: 409, message: "프로젝트·상품·이미지·상세페이지 연결을 확인할 수 없습니다." },
  database: { status: 503, message: "페이지 설계 저장 상태를 확인하지 못했습니다. 새로고침해 결과를 확인해 주세요." },
  busy: { status: 409, message: "페이지 설계가 진행 중입니다. 중단된 요청은 3분 후 다시 실행할 수 있습니다." },
  conflict: { status: 409, message: "다른 작업에서 페이지 설계가 변경되었습니다. 새로고침해 주세요." },
  input_changed: { status: 409, message: "설계 중 입력 정보가 변경되었습니다. 최신 사실 검증과 입력을 확인한 뒤 다시 실행해 주세요." },
  not_configured: { status: 503, message: "페이지 설계 AI 설정을 확인해 주세요." },
  provider: { status: 502, message: "AI 서비스에서 페이지 설계를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요." },
  invalid_response: { status: 502, message: "페이지 설계 형식이나 근거를 확인할 수 없어 결과를 저장하지 않았습니다." },
  timeout: { status: 504, message: "페이지 설계 시간이 초과되었습니다. 저장 상태를 확인한 뒤 다시 시도해 주세요." },
  forbidden: { status: 403, message: "허용되지 않은 요청입니다." },
  unexpected: { status: 503, message: "페이지 설계를 완료하지 못했습니다. 새로고침해 주세요." },
};
export class PlannerError extends Error {
  readonly status: number;
  readonly code: PlannerErrorCode;
  constructor(code: PlannerErrorCode) { super(PLANNER_ERRORS[code].message); this.code = code; this.status = PLANNER_ERRORS[code].status; }
}

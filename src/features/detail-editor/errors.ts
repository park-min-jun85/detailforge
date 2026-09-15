export const EDITOR_ERRORS = {
  not_found: { status: 404, message: "편집할 프로젝트 또는 Section을 찾을 수 없습니다." },
  invalid_input: { status: 400, message: "입력한 문구, 스타일, 이미지 선택을 확인해 주세요." },
  ownership: { status: 400, message: "이 상품에 속한 이미지만 선택할 수 있습니다." },
  conflict: { status: 409, message: "다른 변경사항이 먼저 저장되었습니다. 최신 내용을 다시 불러와 주세요." },
  busy: { status: 409, message: "다른 저장 또는 상세페이지 생성·복구가 진행 중입니다. 잠시 후 다시 시도해 주세요." },
  forbidden: { status: 403, message: "허용되지 않은 요청입니다." },
  unexpected: { status: 503, message: "저장 결과를 확인하지 못했습니다. 입력 내용은 유지됩니다. 최신 내용을 확인한 뒤 다시 시도해 주세요." },
} as const;
export class EditorError extends Error {
  readonly code: keyof typeof EDITOR_ERRORS; readonly status: number;
  constructor(code: keyof typeof EDITOR_ERRORS) { super(EDITOR_ERRORS[code].message); this.code = code; this.status = EDITOR_ERRORS[code].status; }
}

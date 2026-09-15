import type { EditorSection } from "@/features/detail-editor/schemas";
export const REORDER_ERRORS = {
  invalid_input: { status: 400, message: "현재 페이지의 모든 섹션을 중복 없이 포함해 주세요." },
  not_found: { status: 404, message: "프로젝트와 상세페이지 연결을 확인해 주세요." },
  conflict: { status: 409, message: "다른 변경사항이 먼저 저장되었습니다. 최신 섹션을 다시 불러온 뒤 순서를 변경해 주세요." },
  busy: { status: 409, message: "다른 저장 또는 생성·복구가 진행 중입니다. 잠시 후 최신 상태를 확인해 주세요." },
  forbidden: { status: 403, message: "허용되지 않은 요청입니다." },
  persistence: { status: 503, message: "순서 저장에 실패해 기존 순서로 복구했습니다. 변경한 순서는 유지됩니다. 다시 저장할 수 있습니다." },
  recovery_required: { status: 503, message: "순서 저장 중 문제가 발생했습니다. 최신 상태를 다시 확인해 주세요." },
} as const;
export class ReorderError extends Error {
  readonly code: keyof typeof REORDER_ERRORS; readonly status: number; readonly sections?: EditorSection[];
  constructor(code: keyof typeof REORDER_ERRORS, sections?: EditorSection[]) { super(REORDER_ERRORS[code].message); this.code = code; this.status = REORDER_ERRORS[code].status; this.sections = sections; }
}

export class RenderError extends Error {
  readonly code: "not_found" | "invalid" | "conflict" | "unavailable";
  constructor(code: "not_found" | "invalid" | "conflict" | "unavailable") {
    super({ not_found: "프로젝트를 찾을 수 없습니다.", invalid: "상세페이지 데이터 형식을 확인할 수 없습니다. 편집기에서 상태를 확인해 주세요.",
      conflict: "상세페이지가 변경 중입니다. 잠시 후 다시 불러와 주세요.", unavailable: "상세페이지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }[code]);
    this.code = code;
  }
}

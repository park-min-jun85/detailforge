export const exportMessages = {
  invalid_input: "출력 형식과 JPG 품질(60~100)을 확인해 주세요.", forbidden: "이 페이지에서 다시 다운로드해 주세요.",
  not_found: "프로젝트를 찾을 수 없습니다.", data_missing: "저장된 상품과 상세페이지가 필요합니다.", empty: "저장된 섹션이 없습니다.",
  busy: "저장 또는 이미지 출력이 진행 중입니다. 완료 후 다시 시도해 주세요.", changed: "상세페이지가 변경되었습니다. 새로고침 후 다시 출력해 주세요.",
  configuration: "이미지 출력 서버 주소를 설정해 주세요.", browser_missing: "출력용 Chromium이 설치되지 않았습니다. 서버에서 Playwright Chromium을 설치해 주세요.",
  page_load: "최종 미리보기를 불러오지 못했습니다.", asset_load: "상품 이미지를 불러오지 못했습니다. 미리보기를 새로고침하고 이미지를 확인해 주세요.",
  font_load: "글꼴 로딩을 완료하지 못했습니다.", timeout: "이미지 출력 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
  surface_missing: "출력할 상세페이지 영역을 찾지 못했습니다.", page_too_large: "상세페이지가 너무 길거나 커서 한 장으로 출력할 수 없습니다.",
  screenshot: "상세페이지 이미지를 만들지 못했습니다.", unavailable: "출력 데이터를 불러오지 못했습니다.",
} as const;
export type ExportErrorCode = keyof typeof exportMessages;
export class ExportError extends Error {
  readonly code: ExportErrorCode;
  constructor(code: ExportErrorCode) { super(exportMessages[code]); this.code = code; }
  get status() { return this.code === "not_found" ? 404 : this.code === "forbidden" ? 403 : this.code === "invalid_input" ? 400 : ["busy", "changed", "data_missing", "empty"].includes(this.code) ? 409 : this.code === "page_too_large" ? 422 : this.code === "timeout" ? 504 : 503; }
}

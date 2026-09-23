export const EXTRACTION_MESSAGES = {
  not_found: "원본 이미지를 찾을 수 없습니다.", ownership: "상품과 이미지의 연결을 확인해 주세요.",
  unsupported_mime: "JPEG, PNG, WebP 원본만 사용할 수 있습니다.", source_load: "원본 파일을 불러오지 못했습니다.",
  decode: "원본 이미지 내용을 해석하지 못했습니다.", pixel_limit: "원본 이미지의 픽셀 수 또는 크기가 처리 한도를 초과합니다.",
  ineligible: "충분히 긴 원본 상세이미지만 제품컷을 추출할 수 있습니다.", recursive: "이미 추출한 이미지는 다시 추출할 수 없습니다.",
  tile_limit: "분석할 구간이 너무 많습니다. 더 짧은 원본 이미지를 사용해 주세요.",
  not_configured: "제품컷 분석 서버 설정을 확인해 주세요.", timeout: "제품컷 분석 시간이 초과됐습니다.",
  provider: "제품컷 분석 서비스에 연결하지 못했습니다.", invalid_response: "분석 응답 형식을 확인할 수 없습니다.",
  invalid_rect: "추출 영역이 원본 이미지 범위를 벗어났습니다.", source_changed: "분석 후 원본 이미지가 변경됐습니다. 다시 분석해 주세요.",
  crop_too_small: "저장 영역은 가로·세로 160px 이상, 면적 64,000픽셀 이상이어야 합니다.",
  stale: "후보가 변경되었거나 만료됐습니다. 최신 후보를 다시 확인해 주세요.", invalid_input: "선택한 후보와 요청 내용을 확인해 주세요.",
  asset_limit: "상품당 이미지 30개 제한을 초과합니다. 선택 수를 줄여 주세요.", crop: "선택 영역의 이미지 파일을 만들지 못했습니다.",
  upload: "추출 이미지를 저장하지 못했습니다.", database: "추출 정보를 저장하거나 조회하지 못했습니다.",
  recovery: "저장 또는 파일 정리를 확인하지 못했습니다. 중복 저장 전에 이미지 목록을 확인해 주세요.",
  busy: "이미지 작업이 진행 중입니다. 완료 후 다시 시도해 주세요.", conflict: "이미지 상태가 변경됐습니다. 새로고침해 주세요.",
  forbidden: "허용되지 않은 요청입니다.", unexpected: "제품컷 추출을 완료하지 못했습니다.",
  checkpoint_missing: "저장된 구간 분석이 없습니다. 전체 재분석이 필요합니다.",
  checkpoint_invalid: "저장된 구간 분석을 사용할 수 없습니다. 전체 재분석이 필요합니다.",
  checkpoint_stale: "분석 입력이 변경됐습니다. 전체 재분석이 필요합니다.",
  checkpoint_incomplete: "완료 기록이 없는 구간이 있습니다. 전체 재분석이 필요합니다.",
  invalid_retry_target: "현재 재시도할 수 있는 실패 구간만 선택해 주세요.",
  persistence_failure: "재시도 결과를 저장하지 못했습니다. 이전 저장 결과는 유지됩니다. AI 요청 비용이 발생했을 수 있습니다.",
} as const;
export type ExtractionCode = keyof typeof EXTRACTION_MESSAGES;
export class ExtractionError extends Error {
  readonly code: ExtractionCode;
  readonly available?: number;
  constructor(code: ExtractionCode, available?: number) { super(EXTRACTION_MESSAGES[code]); this.code = code; this.available = available; }
}

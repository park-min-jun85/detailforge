import type { Asset } from "@/types/domain";
import type { AnalysisErrorCode } from "./schemas";

export const ANALYSIS_ERRORS: Record<AnalysisErrorCode, { status: number; message: string }> = {
  not_configured: { status: 503, message: "AI 분석 설정이 없습니다. 서버의 OPENAI_API_KEY와 모델 설정을 확인해 주세요." },
  provider: { status: 502, message: "AI 서비스에서 분석을 완료하지 못했습니다. 설정과 이용 한도를 확인한 뒤 다시 시도해 주세요." },
  timeout: { status: 504, message: "AI 분석 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요." },
  invalid_response: { status: 502, message: "AI 분석 결과가 올바른 형식이 아닙니다. 결과를 적용하지 않았습니다." },
  not_found: { status: 404, message: "분석할 이미지 또는 프로젝트를 찾을 수 없습니다." },
  ownership: { status: 409, message: "이미지의 프로젝트·상품 연결을 확인할 수 없습니다." },
  product_required: { status: 409, message: "먼저 상품정보를 저장해 주세요." },
  signed_url: { status: 503, message: "분석할 이미지에 접근하지 못했습니다. 이미지 목록을 확인한 뒤 다시 시도해 주세요." },
  database: { status: 503, message: "분석 상태를 읽거나 저장하지 못했습니다. 목록을 새로고침해 결과를 확인해 주세요." },
  busy: { status: 409, message: "AI 분석이 진행 중입니다. 완료 후 다시 시도해 주세요. 중단된 분석은 3분 후 재시도할 수 있습니다." },
  conflict: { status: 409, message: "다른 작업에서 이미지가 변경되었습니다. 목록을 새로고침해 주세요." },
  forbidden: { status: 403, message: "허용되지 않은 분석 요청입니다." },
  unexpected: { status: 503, message: "이미지 분석을 완료하지 못했습니다. 목록을 확인한 뒤 다시 시도해 주세요." },
};

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode;
  readonly status: number;
  asset?: Asset;
  constructor(code: AnalysisErrorCode, asset?: Asset) {
    super(ANALYSIS_ERRORS[code].message);
    this.code = code; this.status = ANALYSIS_ERRORS[code].status; this.asset = asset;
  }
}

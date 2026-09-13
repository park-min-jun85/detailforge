import { ANALYSIS_ERRORS } from "@/features/asset-analysis/errors";
import type { ProductAnalysisErrorCode } from "./schemas";

export const PRODUCT_ANALYSIS_ERRORS: Record<ProductAnalysisErrorCode, { status: number; message: string }> = {
  ...ANALYSIS_ERRORS,
  not_found: { status: 404, message: "프로젝트를 찾을 수 없습니다." },
  facts_required: { status: 409, message: "상품 분석에 사용할 Product Facts가 없습니다. 상품정보를 먼저 저장해 주세요." },
  invalid_input: { status: 409, message: "상품정보 또는 이미지 분석 데이터 형식을 확인할 수 없습니다. 입력 정보를 확인해 주세요." },
  ownership: { status: 409, message: "프로젝트·상품·이미지 연결을 확인할 수 없습니다." },
  database: { status: 503, message: "상품 분석 상태를 읽거나 저장하지 못했습니다. 새로고침해 저장 결과를 확인해 주세요." },
  conflict: { status: 409, message: "다른 작업에서 상품 분석 상태가 변경되었습니다. 새로고침해 주세요." },
  unexpected: { status: 503, message: "상품 분석을 완료하지 못했습니다. 새로고침 후 다시 시도해 주세요." },
};
export class ProductAnalysisError extends Error {
  readonly code: ProductAnalysisErrorCode;
  readonly status: number;
  constructor(code: ProductAnalysisErrorCode) {
    super(PRODUCT_ANALYSIS_ERRORS[code].message); this.code = code; this.status = PRODUCT_ANALYSIS_ERRORS[code].status;
  }
}

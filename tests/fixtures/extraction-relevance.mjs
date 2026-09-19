// Sanitized TASK-030 identity + mocked model regions, not a claimed live provider result.
export const product = { name: "여성 양털 후리스 뽀글이 조끼 퍼 베스트 수면조끼", category: "의류/언더웨어 > 여성의류 > 조끼", brand: null };
export const facts = { productName: product.name, category: product.category, specifications: [
  { name: "품명 및 모델명", value: "컬리 집업 베스트" }, { name: "원산지", value: "수입산 / 아시아 / 중국" },
] };
export const photo = { regionType: "product_photo", visualKind: "photo", targetProductRelevance: .96, containsTargetProduct: true,
  relevanceReason: "대상 조끼 착용 사진", confidence: .95, productVisibility: .9, standaloneUsability: .9, textDensity: "low",
  box: { xMin: 100, yMin: 50, xMax: 900, yMax: 450 }, rationale: "조끼 전체를 볼 수 있는 착용 사진" };
export const electronics = { ...photo, visualKind: "diagram", targetProductRelevance: .03, containsTargetProduct: false,
  box: { xMin: 100, yMin: 550, xMax: 900, yMax: 950 }, relevanceReason: "대상 의류와 무관한 기기 그림", rationale: "전자기기 안내 그림" };

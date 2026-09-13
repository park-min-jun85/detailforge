export const analysisResult = (overrides = {}) => ({
  schemaVersion: 1, role: "product", confidence: 0.85, heroSuitability: 0.75,
  visualSummary: "밝은 단색 배경의 중앙에 피사체가 배치되어 있습니다.",
  composition: { background: "plain", textDensity: "none", subjectClarity: 0.9, productVisibility: 0.8 },
  signals: { showsProduct: true, showsUsageContext: false, showsDetailCloseup: false, showsSpecificationLayout: false,
    showsOptionsOrVariants: false, showsNoticeOrGuide: false }, warnings: [], ...overrides,
});
export const completedAnalysis = (overrides = {}) => ({ ...analysisResult(), status: "completed", provider: "openai",
  model: "test-vision", attemptId: "1645f432-b847-4e28-9ee7-f41beccccf46", analyzedAt: "2026-09-11T00:00:00.000Z", ...overrides });
export const analyzingState = (overrides = {}) => ({ schemaVersion: 1, status: "analyzing", provider: "openai", model: "test-vision",
  attemptId: "2645f432-b847-4e28-9ee7-f41beccccf46", startedAt: new Date().toISOString(), previousResult: null, ...overrides });
export const responseBody = (value = analysisResult(), overrides = {}) => ({ id: "resp_test", object: "response", created_at: 0,
  model: "test-vision", status: "completed", output: [{ id: "msg_test", type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: typeof value === "string" ? value : JSON.stringify(value), annotations: [] }] }], ...overrides });

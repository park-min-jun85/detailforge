import { z } from "zod";
import type { AssetType } from "@/types/domain";

export const ANALYSIS_ROLES = ["product", "detail", "usage", "specification", "option", "notice", "other"] as const;
export const ANALYSIS_WARNINGS = ["blurry", "cropped", "low_visibility", "heavy_text", "watermark_like_overlay", "ambiguous_subject"] as const;
export const CONFIDENCE_THRESHOLD = 0.65;
export const STALE_ANALYSIS_MS = 180_000;
const score = z.number().min(0).max(1);

// 이 schema는 provider의 strict JSON Schema와 서버 재검증에 함께 사용한다.
export const analysisResultSchema = z.strictObject({
  schemaVersion: z.literal(1), role: z.enum(ANALYSIS_ROLES), confidence: score, heroSuitability: score,
  visualSummary: z.string().min(1).max(280),
  composition: z.strictObject({
    background: z.enum(["plain", "lifestyle", "graphic", "mixed", "unknown"]),
    textDensity: z.enum(["none", "low", "medium", "high"]), subjectClarity: score, productVisibility: score,
  }),
  signals: z.strictObject({
    showsProduct: z.boolean(), showsUsageContext: z.boolean(), showsDetailCloseup: z.boolean(),
    showsSpecificationLayout: z.boolean(), showsOptionsOrVariants: z.boolean(), showsNoticeOrGuide: z.boolean(),
  }),
  warnings: z.array(z.enum(ANALYSIS_WARNINGS)).max(6),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const ANALYSIS_ERROR_CODES = ["not_configured", "provider", "timeout", "invalid_response", "not_found", "ownership",
  "product_required", "signed_url", "database", "busy", "conflict", "forbidden", "unexpected"] as const;
export type AnalysisErrorCode = (typeof ANALYSIS_ERROR_CODES)[number];
const identity = { provider: z.literal("openai"), model: z.string().min(1).max(200), attemptId: z.uuid() };
export const completedAnalysisSchema = analysisResultSchema.extend({ ...identity,
  status: z.literal("completed"), analyzedAt: z.iso.datetime({ offset: true }),
});
const attempt = { schemaVersion: z.literal(1), ...identity, startedAt: z.iso.datetime({ offset: true }),
  previousResult: completedAnalysisSchema.nullable() };
export const analysisStateSchema = z.discriminatedUnion("status", [
  completedAnalysisSchema,
  z.strictObject({ ...attempt, status: z.literal("analyzing") }),
  z.strictObject({ ...attempt, status: z.literal("failed"), failedAt: z.iso.datetime({ offset: true }), errorCode: z.enum(ANALYSIS_ERROR_CODES) }),
]);
export type AnalysisState = z.infer<typeof analysisStateSchema>;
export type CompletedAnalysis = z.infer<typeof completedAnalysisSchema>;

export function readAnalysis(metadata: Record<string, unknown>): AnalysisState | null {
  const result = analysisStateSchema.safeParse(metadata.aiAnalysis);
  return result.success ? result.data : null;
}

export function previousResult(state: AnalysisState | null): CompletedAnalysis | null {
  return state?.status === "completed" ? state : state?.previousResult ?? null;
}

export function isActiveAnalysis(state: AnalysisState | null, now: number): boolean {
  if (state?.status !== "analyzing") return false;
  const age = now - Date.parse(state.startedAt);
  return age >= 0 && age < STALE_ANALYSIS_MS;
}

export function mergeAnalysis(metadata: Record<string, unknown>, state: AnalysisState) {
  const existing = z.record(z.string(), z.json()).parse(metadata);
  return { ...existing, aiAnalysis: analysisStateSchema.parse(state) };
}

export function analysisAssetType(result: AnalysisResult): AssetType {
  const parsed = analysisResultSchema.parse(result);
  return parsed.confidence >= CONFIDENCE_THRESHOLD ? parsed.role : "unclassified";
}

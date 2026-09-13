import type { Evidence, ProductAnalysisState } from "./schemas";
export type ProductAnalysisInput = { evidence: Evidence[]; coverage: { total: number; completed: number; invalid: number } };
export type ProductAnalysisProvider = { readonly model: string; analyze(input: ProductAnalysisInput, signal: AbortSignal): Promise<unknown> };
export type ProductAnalysisView = ProductAnalysisInput & {
  projectId: string; projectName: string; productName: string; inputFingerprint: string; state: ProductAnalysisState | null;
};

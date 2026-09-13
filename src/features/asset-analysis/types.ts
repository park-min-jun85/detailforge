import type { Asset } from "@/types/domain";

export interface AnalysisInput { imageUrl: string; productName: string }
export interface AnalysisProvider {
  readonly model: string;
  analyze(input: AnalysisInput, signal: AbortSignal): Promise<unknown>;
}
export type AnalysisReply = { ok: true; asset: Asset } | { ok: false; message: string; asset?: Asset };

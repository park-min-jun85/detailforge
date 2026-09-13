import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getAnalysisConfig, PROVIDER_TIMEOUT_MS } from "./config";
import { AnalysisError } from "./errors";
import { buildAnalysisInput } from "./prompts";
import { analysisResultSchema } from "./schemas";
import type { AnalysisProvider } from "./types";

// SDK transport를 주입해 자동 테스트가 실제 API에 접근하지 않도록 한다.
export function createOpenAIProvider(config: { apiKey: string; model: string }, transport?: typeof fetch): AnalysisProvider {
  const client = new OpenAI({ apiKey: config.apiKey, timeout: PROVIDER_TIMEOUT_MS, maxRetries: 0,
    logLevel: "off", ...(transport ? { fetch: transport } : {}) });
  return {
    model: config.model,
    async analyze(input, signal) {
      try {
        const response = await client.responses.parse({
          model: config.model, input: buildAnalysisInput(input), store: false,
          max_output_tokens: 4000,
          text: { format: zodTextFormat(analysisResultSchema, "asset_visual_analysis") },
        }, { signal });
        if (response.status !== "completed" || !response.output_parsed) throw new AnalysisError("invalid_response");
        return analysisResultSchema.parse(response.output_parsed);
      } catch (error) {
        if (error instanceof AnalysisError) throw error;
        if (signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError) throw new AnalysisError("timeout");
        if (error instanceof z.ZodError || error instanceof SyntaxError) throw new AnalysisError("invalid_response");
        throw new AnalysisError("provider");
      }
    },
  };
}

export function getAnalysisProvider() { return createOpenAIProvider(getAnalysisConfig()); }

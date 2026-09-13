import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getProductAnalysisConfig, PRODUCT_PROVIDER_TIMEOUT_MS } from "./config";
import { ProductAnalysisError } from "./errors";
import { buildProductAnalysisInput } from "./prompts";
import { productAnalysisSchema, validateProductAnalysis } from "./schemas";
import type { ProductAnalysisProvider } from "./types";

// Same SDK boundary as TASK-008; injected transport keeps automated tests offline.
export function createProductAnalysisProvider(config: { apiKey: string; model: string }, transport?: typeof fetch): ProductAnalysisProvider {
  const client = new OpenAI({ apiKey: config.apiKey, timeout: PRODUCT_PROVIDER_TIMEOUT_MS, maxRetries: 0, logLevel: "off", ...(transport ? { fetch: transport } : {}) });
  return { model: config.model, async analyze(input, signal) {
    try {
      const response = await client.responses.parse({ model: config.model, input: buildProductAnalysisInput(input), store: false,
        max_output_tokens: 7000, text: { format: zodTextFormat(productAnalysisSchema, "product_strategy_analysis") } }, { signal });
      if (response.status !== "completed" || !response.output_parsed) throw new ProductAnalysisError("invalid_response");
      try { return validateProductAnalysis(response.output_parsed, input.evidence); }
      catch { throw new ProductAnalysisError("invalid_response"); }
    } catch (error) {
      if (error instanceof ProductAnalysisError) throw error;
      if (signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError) throw new ProductAnalysisError("timeout");
      if (error instanceof z.ZodError || error instanceof SyntaxError) throw new ProductAnalysisError("invalid_response");
      throw new ProductAnalysisError("provider");
    }
  } };
}
export function getProductAnalysisProvider() { return createProductAnalysisProvider(getProductAnalysisConfig()); }

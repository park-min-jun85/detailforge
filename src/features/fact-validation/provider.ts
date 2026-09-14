import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getValidationConfig, VALIDATION_PROVIDER_TIMEOUT_MS } from "./config";
import { FactValidationError } from "./errors";
import { buildFactValidationInput } from "./prompts";
import { validationOutputSchema, validateFactOutput } from "./schemas";
import type { ValidationProvider } from "./types";

// Same SDK boundary as TASK-008; injected transport keeps automated tests offline.
export function createValidationProvider(config: { apiKey: string; model: string }, transport?: typeof fetch): ValidationProvider {
  const client = new OpenAI({ apiKey: config.apiKey, timeout: VALIDATION_PROVIDER_TIMEOUT_MS, maxRetries: 0, logLevel: "off", ...(transport ? { fetch: transport } : {}) });
  return { model: config.model, async analyze(input, signal) {
    try {
      const response = await client.responses.parse({ model: config.model, input: buildFactValidationInput(input), store: false,
        max_output_tokens: 16000, text: { format: zodTextFormat(validationOutputSchema, "fact_validation") } }, { signal });
      if (response.status !== "completed" || !response.output_parsed) throw new FactValidationError("invalid_response");
      try { return validateFactOutput(response.output_parsed, input.targets, input.evidence); }
      catch { throw new FactValidationError("invalid_response"); }
    } catch (error) {
      if (error instanceof FactValidationError) throw error;
      if (signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError) throw new FactValidationError("timeout");
      if (error instanceof z.ZodError || error instanceof SyntaxError) throw new FactValidationError("invalid_response");
      throw new FactValidationError("provider");
    }
  } };
}
export function getValidationProvider() { return createValidationProvider(getValidationConfig()); }

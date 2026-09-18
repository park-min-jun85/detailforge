import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getRegenerationConfig, REGEN_TIMEOUT_MS } from "./config";
import { regenerationProviderSchema } from "./schemas";
import { buildRegenerationMessages } from "./prompts";
import { RegenError } from "./errors";
import type { RegenerationProvider } from "./types";
export function createRegenerationProvider(config: { apiKey: string; model: string }, transport?: typeof fetch): RegenerationProvider {
  const client = new OpenAI({ apiKey: config.apiKey, timeout: REGEN_TIMEOUT_MS, maxRetries: 0, logLevel: "off", ...(transport ? { fetch: transport } : {}) });
  return { model: config.model, async generate(input, signal) {
    try {
      const schema = regenerationProviderSchema(input.target.type);
      const result = await client.responses.parse({ model: config.model, input: buildRegenerationMessages(input), store: false,
        max_output_tokens: 6000, text: { format: zodTextFormat(schema, "section_regeneration") } }, { signal });
      if (result.status !== "completed" || !result.output_parsed) throw new RegenError("invalid_response");
      return schema.parse(result.output_parsed);
    } catch (error) {
      if (error instanceof RegenError) throw error;
      if (signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError) throw new RegenError("timeout");
      if (error instanceof z.ZodError || error instanceof SyntaxError) throw new RegenError("invalid_response");
      throw new RegenError("provider");
    }
  } };
}
export function getRegenerationProvider() { return createRegenerationProvider(getRegenerationConfig()); }

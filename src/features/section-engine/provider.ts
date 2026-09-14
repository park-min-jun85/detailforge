import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getSectionConfig, SECTION_TIMEOUT_MS } from "./config";
import { SectionEngineError } from "./errors";
import { buildSectionMessages } from "./prompts";
import { sectionOutputSchema } from "./schemas";
import type { SectionProvider } from "./types";
export function createSectionProvider(config: { apiKey: string; model: string }, transport?: typeof fetch): SectionProvider {
  const client = new OpenAI({ apiKey: config.apiKey, timeout: SECTION_TIMEOUT_MS, maxRetries: 0, logLevel: "off", ...(transport ? { fetch: transport } : {}) });
  return { model: config.model, async generate(input, signal) {
    try {
      const response = await client.responses.parse({ model: config.model, input: buildSectionMessages(input), store: false,
        max_output_tokens: 16000, text: { format: zodTextFormat(sectionOutputSchema, "detail_page_sections") } }, { signal });
      if (response.status !== "completed" || !response.output_parsed) throw new SectionEngineError("invalid_response");
      return sectionOutputSchema.parse(response.output_parsed);
    } catch (error) {
      if (error instanceof SectionEngineError) throw error;
      if (signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError) throw new SectionEngineError("timeout");
      if (error instanceof z.ZodError || error instanceof SyntaxError) throw new SectionEngineError("invalid_response");
      throw new SectionEngineError("provider");
    }
  } };
}
export function getSectionProvider() { return createSectionProvider(getSectionConfig()); }

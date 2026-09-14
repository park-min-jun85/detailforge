import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getPlannerConfig, PLANNER_TIMEOUT_MS } from "./config";
import { PlannerError } from "./errors";
import { buildPlannerMessages } from "./prompts";
import { pagePlanSchema, validatePagePlan } from "./schemas";
import type { PlannerProvider } from "./types";
export function createPlannerProvider(config: { apiKey: string; model: string }, transport?: typeof fetch): PlannerProvider {
  const client = new OpenAI({ apiKey: config.apiKey, timeout: PLANNER_TIMEOUT_MS, maxRetries: 0, logLevel: "off", ...(transport ? { fetch: transport } : {}) });
  return { model: config.model, async plan(input, signal) {
    try {
      const response = await client.responses.parse({ model: config.model, input: buildPlannerMessages(input), store: false,
        max_output_tokens: 10000, text: { format: zodTextFormat(pagePlanSchema, "detail_page_plan") } }, { signal });
      if (response.status !== "completed" || !response.output_parsed) throw new PlannerError("invalid_response");
      try { return validatePagePlan(response.output_parsed, input.evidence, input.assets); } catch { throw new PlannerError("invalid_response"); }
    } catch (error) {
      if (error instanceof PlannerError) throw error;
      if (signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError) throw new PlannerError("timeout");
      if (error instanceof z.ZodError || error instanceof SyntaxError) throw new PlannerError("invalid_response");
      throw new PlannerError("provider");
    }
  } };
}
export function getPlannerProvider() { return createPlannerProvider(getPlannerConfig()); }

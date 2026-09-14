import "server-only";
import { PlannerError } from "./errors";
const DEFAULT_PLANNER_MODEL = "gpt-5.6-terra";
export const PLANNER_TIMEOUT_MS = 60_000;
export function getPlannerConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_PLANNER_MODEL?.trim() || DEFAULT_PLANNER_MODEL;
  if (!apiKey || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(model)) throw new PlannerError("not_configured");
  return { apiKey, model };
}

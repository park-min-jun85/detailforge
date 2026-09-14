import "server-only";
import { FactValidationError } from "./errors";

const DEFAULT_VALIDATION_MODEL = "gpt-5.6-terra";
export const VALIDATION_PROVIDER_TIMEOUT_MS = 60_000;
export function getValidationConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_VALIDATION_MODEL?.trim() || DEFAULT_VALIDATION_MODEL;
  if (!apiKey || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(model)) throw new FactValidationError("not_configured");
  return { apiKey, model };
}

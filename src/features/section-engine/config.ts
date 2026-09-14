import "server-only";
import { SectionEngineError } from "./errors";
const DEFAULT_SECTION_MODEL = "gpt-5.6-terra";
export const SECTION_TIMEOUT_MS = 60_000;
export function getSectionConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim(), model = process.env.OPENAI_SECTION_MODEL?.trim() || DEFAULT_SECTION_MODEL;
  if (!apiKey || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(model)) throw new SectionEngineError("not_configured");
  return { apiKey, model };
}

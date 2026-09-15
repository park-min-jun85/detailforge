import "server-only";
import { RegenError } from "./errors";
export { SECTION_TIMEOUT_MS as REGEN_TIMEOUT_MS } from "@/features/section-engine/config";
const DEFAULT_REGEN_MODEL = "gpt-5.6-terra";
export const CANDIDATE_TTL_MS = 10 * 60_000;
export function getRegenerationConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim(), model = process.env.OPENAI_SECTION_REGEN_MODEL?.trim() || DEFAULT_REGEN_MODEL;
  if (!apiKey || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(model)) throw new RegenError("not_configured");
  return { apiKey, model };
}

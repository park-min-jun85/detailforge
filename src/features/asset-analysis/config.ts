import "server-only";
import { AnalysisError } from "./errors";

const DEFAULT_ASSET_MODEL = "gpt-5.6-luna";
export const PROVIDER_TIMEOUT_MS = 60_000;
export const AI_SIGNED_URL_SECONDS = 300;
export const MAX_CONCURRENT_ANALYSES = 2;

export function getAnalysisConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_ASSET_MODEL?.trim() || DEFAULT_ASSET_MODEL;
  if (!apiKey || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(model)) throw new AnalysisError("not_configured");
  return { apiKey, model };
}

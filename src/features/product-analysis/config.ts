import "server-only";
import { ProductAnalysisError } from "./errors";

const DEFAULT_PRODUCT_MODEL = "gpt-5.6-terra";
export const PRODUCT_PROVIDER_TIMEOUT_MS = 60_000;
export function getProductAnalysisConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_PRODUCT_MODEL?.trim() || DEFAULT_PRODUCT_MODEL;
  if (!apiKey || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(model)) throw new ProductAnalysisError("not_configured");
  return { apiKey, model };
}

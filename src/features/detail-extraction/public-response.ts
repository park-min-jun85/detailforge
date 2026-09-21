import "server-only";
import { isExtractionActive, isSaveActive, readExtraction } from "./schemas";

// Transport projection only. Never write this projection back to stored metadata.
// Applied recursively because assets also occur in upload/analysis/save responses.
export function publicExtractionResponse<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => publicExtractionResponse(item)) as T;
  if (!value || typeof value !== "object") return value;
  const object = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(object)) {
    if (key === "extractionContextFingerprint") continue;
    if (key === "metadata" && item && typeof item === "object" && "id" in object) {
      const metadata = item as Record<string, unknown>, state = readExtraction(metadata);
      const rest = Object.fromEntries(Object.entries(metadata).filter(([key]) => key !== "detailExtraction" && key !== "extractionDisplay"));
      output[key] = { ...rest, extractionDisplay: {
        hasAttempt: !!state, hasResult: !!state?.latestResult,
        active: isExtractionActive(state) || isSaveActive(state), revision: state?.revision ?? null,
      } };
    } else output[key] = publicExtractionResponse(item);
  }
  return output as T;
}

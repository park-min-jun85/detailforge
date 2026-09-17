import { OPTION_ERRORS } from "./errors";
import { optionViewSchema, type OptionGroups } from "./schemas";
export async function requestOptions(projectId: string, save?: { productId: string; expectedVersion: number; options: OptionGroups }) {
  try {
    const response = await fetch(`/api/projects/${projectId}/options`, { method: save ? "PUT" : "GET", cache: "no-store",
      ...(save ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(save) } : {}), signal: AbortSignal.timeout(60000) });
    const body = await response.json();
    if (response.ok && body.ok) return { ok: true as const, data: optionViewSchema.parse(body.data) };
    const code = typeof body.code === "string" && body.code in OPTION_ERRORS ? body.code as keyof typeof OPTION_ERRORS : "unavailable";
    return { ok: false as const, message: OPTION_ERRORS[code].message };
  } catch { return { ok: false as const, message: OPTION_ERRORS.unavailable.message }; }
}

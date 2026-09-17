import { OPTION_ERRORS } from "./errors";
import { optionViewSchema, type OptionGroups } from "./schemas";
import { optionApplyResultSchema, optionPreviewSchema } from "./import-contract";
export async function requestOptions(projectId: string, save?: { productId: string; expectedVersion: number; options: OptionGroups; importToken?: string }) {
  try {
    const response = await fetch(`/api/projects/${projectId}/options`, { method: save ? "PUT" : "GET", cache: "no-store",
      ...(save ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(save) } : {}), signal: AbortSignal.timeout(60000) });
    const body = await response.json();
    if (response.ok && body.ok) return { ok: true as const, data: optionViewSchema.parse(body.data) };
    const code = typeof body.code === "string" && body.code in OPTION_ERRORS ? body.code as keyof typeof OPTION_ERRORS : "unavailable";
    return { ok: false as const, message: OPTION_ERRORS[code].message };
  } catch { return { ok: false as const, message: OPTION_ERRORS.unavailable.message }; }
}

export async function requestOptionImport(projectId: string, input: { productId: string; expectedVersion: number }) {
  const result = await importRequest(projectId, "", input);
  if (!result.ok) return result;
  const parsed = optionPreviewSchema.safeParse(result.data);
  return parsed.success ? { ok: true as const, data: parsed.data } : { ok: false as const, message: OPTION_ERRORS.unavailable.message };
}
export async function requestOptionApply(projectId: string, input: { productId: string; expectedVersion: number; token: string; selectedIds: string[] }) {
  const result = await importRequest(projectId, "/apply", input);
  if (!result.ok) return result;
  const parsed = optionApplyResultSchema.safeParse(result.data);
  return parsed.success ? { ok: true as const, data: parsed.data } : { ok: false as const, message: OPTION_ERRORS.unavailable.message };
}
async function importRequest(projectId: string, suffix: string, input: unknown) {
  try {
    const response = await fetch(`/api/projects/${projectId}/options/import${suffix}`, { method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(60000) });
    const body = await response.json();
    if (response.ok && body.ok) return { ok: true as const, data: body.data as unknown };
    const code = typeof body.code === "string" && body.code in OPTION_ERRORS ? body.code as keyof typeof OPTION_ERRORS : "unavailable";
    return { ok: false as const, message: OPTION_ERRORS[code].message };
  } catch { return { ok: false as const, message: OPTION_ERRORS.unavailable.message }; }
}

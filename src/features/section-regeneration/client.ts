import { editorSectionSchema } from "@/features/detail-editor/schemas";
import { signedCandidateSchema, type SignedCandidate } from "./schemas";
import { REGEN_ERRORS, type RegenErrorCode } from "./errors";
async function request(projectId: string, sectionId: string, action: string, body: unknown) {
  const response = await fetch(`/api/projects/${projectId}/sections/${sectionId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(120000) });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    const code = typeof result.code === "string" && Object.hasOwn(REGEN_ERRORS, result.code) ? result.code as RegenErrorCode : "database";
    return { ok: false as const, code, message: REGEN_ERRORS[code].message };
  }
  return { ok: true as const, data: result.data as unknown };
}
export async function requestCandidate(projectId: string, sectionId: string, revision: string) {
  try { const result = await request(projectId, sectionId, "regenerate", { revision }); return result.ok ? { ok: true as const, value: signedCandidateSchema.parse(result.data) } : result; }
  catch { return { ok: false as const, code: "provider" as const, message: REGEN_ERRORS.provider.message }; }
}
export async function requestApplyCandidate(projectId: string, sectionId: string, candidate: SignedCandidate) {
  try { const result = await request(projectId, sectionId, "apply-candidate", candidate); return result.ok ? { ok: true as const, section: editorSectionSchema.parse(result.data) } : result; }
  catch { return { ok: false as const, code: "database" as const, message: REGEN_ERRORS.database.message }; }
}

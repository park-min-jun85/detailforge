import { editorSectionSchema, type EditDraft } from "./schemas";
import { EDITOR_ERRORS } from "./errors";
import type { EditorView } from "./types";
export async function requestEditorView(projectId: string): Promise<EditorView> {
  const response = await fetch(`/api/projects/${projectId}/editor`, { cache: "no-store", signal: AbortSignal.timeout(45000) });
  const body = await response.json();
  if (!response.ok || !body.ok || !Array.isArray(body.data?.sections)) throw new Error(EDITOR_ERRORS.unexpected.message);
  return { ...body.data, sections: body.data.sections.map((row: unknown) => editorSectionSchema.parse(row)) };
}
export async function requestSave(projectId: string, sectionId: string, revision: string, draft: EditDraft) {
  try {
    const response = await fetch(`/api/projects/${projectId}/sections/${sectionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision, ...draft }), cache: "no-store", signal: AbortSignal.timeout(90000) });
    const body = await response.json();
    if (response.ok && body.ok) return { ok: true as const, section: editorSectionSchema.parse(body.data) };
    const code = typeof body.code === "string" && body.code in EDITOR_ERRORS ? body.code as keyof typeof EDITOR_ERRORS : "unexpected";
    return { ok: false as const, message: EDITOR_ERRORS[code].message };
  } catch { return { ok: false as const, message: EDITOR_ERRORS.unexpected.message }; }
}

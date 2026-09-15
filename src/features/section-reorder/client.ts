import { z } from "zod";
import { editorSectionSchema } from "@/features/detail-editor/schemas";
import { REORDER_ERRORS } from "./errors";
import type { ReorderRequest } from "./schemas";
const resultSchema = z.object({ sections: z.array(editorSectionSchema), recovered: z.boolean() });
export async function requestReorder(projectId: string, request: ReorderRequest | { detailPageId: string; recover: true }) {
  try {
    const response = await fetch(`/api/projects/${projectId}/sections/reorder`, { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request), cache: "no-store", signal: AbortSignal.timeout(180000) });
    const body = await response.json();
    if (response.ok && body.ok) return { ok: true as const, ...resultSchema.parse(body.data) };
    const code = typeof body.code === "string" && body.code in REORDER_ERRORS ? body.code as keyof typeof REORDER_ERRORS : "recovery_required";
    const rows = z.array(editorSectionSchema).safeParse(body.sections);
    return { ok: false as const, code, message: REORDER_ERRORS[code].message, sections: rows.success ? rows.data : undefined };
  } catch { return { ok: false as const, code: "recovery_required" as const, message: REORDER_ERRORS.recovery_required.message, sections: undefined }; }
}

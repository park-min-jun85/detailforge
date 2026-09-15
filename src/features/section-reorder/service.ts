import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAssetContext } from "@/features/assets/service";
import { readPage, readRows } from "@/features/section-engine/persistence";
import { claimEditLease, releaseEditLease } from "@/features/section-engine/edit-lease";
import { editorSectionSchema } from "@/features/detail-editor/schemas";
import { orderRequestSchema, assertWholeSet, readReorder, manualOrderSchema, type ReorderJournal } from "./schemas";
import { immutableFingerprint, saveJournal, leasedPage, reconcile, updateOrder, rollbackOrder } from "./persistence";
import { ReorderError } from "./errors";

export function safeReorderError(error: unknown) {
  if (error instanceof ReorderError) return error;
  if (error instanceof z.ZodError) return new ReorderError("invalid_input");
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  const status = error && typeof error === "object" && "status" in error ? error.status : null;
  return new ReorderError(code === "invalid_input" ? "invalid_input" : code === "busy" ? "busy" : code === "conflict" ? "conflict" : code === "forbidden" ? "forbidden" : status === 404 || code === "ownership" ? "not_found" : "recovery_required");
}
export async function reorderSections(projectId: string, input: unknown) {
  try {
    if (!z.uuid().safeParse(projectId).success) throw new ReorderError("not_found");
    const request = orderRequestSchema.parse(input), client = createSupabaseServerClient();
    const scope = await getAssetContext(projectId, client), page = await readPage(client, projectId);
    if (!scope.product || !page || page.id !== request.detailPageId) throw new ReorderError("not_found");
    const journal = readReorder(page.settings);
    if (journal && journal.detailPageId !== page.id) throw new ReorderError("not_found");
    const recovering = "recover" in request;
    if (!recovering && journal) throw new ReorderError("busy");
    const before = await readRows(client, page.id);
    before.forEach(row => editorSectionSchema.parse(row));
    if (!recovering && !assertWholeSet(request, before)) throw new ReorderError("conflict");
    const lease = await claimEditLease(client, page, recovering ? journal?.runId : undefined);
    try {
      if (recovering && !journal) return { sections: (await readRows(client, page.id)).map(row => editorSectionSchema.parse(row)), recovered: true };
      if (recovering) return { sections: await rollbackOrder(client, page, lease.id), recovered: true };
      const rows = await readRows(client, page.id);
      if (!assertWholeSet(request, rows)) throw new ReorderError("conflict");
      if (request.orderedSectionIds.every((id, i) => rows[i]?.id === id && rows[i].sort_order === i)) return { sections: rows.map(row => editorSectionSchema.parse(row)), recovered: false };
      let state: ReorderJournal = { schemaVersion: 1, runId: randomUUID(), detailPageId: page.id, status: "applying", startedAt: new Date().toISOString(),
        orderedSectionIds: request.orderedSectionIds, pending: null,
        backup: rows.map(row => ({ id: row.id, sortOrder: row.sort_order, updatedAt: row.updated_at, fingerprint: immutableFingerprint(row) })),
        current: rows.map(row => ({ id: row.id, sortOrder: row.sort_order, updatedAt: row.updated_at })) };
      await saveJournal(client, page, lease.id, state);
      try {
        for (const [index, id] of request.orderedSectionIds.entries()) state = await updateOrder(client, page, lease.id, state, id, index);
        const verified = await reconcile(client, page, lease.id);
        if (!request.orderedSectionIds.every((id, i) => verified.rows[i]?.id === id && verified.rows[i].sort_order === i)) throw new ReorderError("conflict");
        const fingerprints = [...new Set(verified.rows.map(row => editorSectionSchema.parse(row).content.meta.sourcePlanFingerprint))];
        const manualOrder = manualOrderSchema.parse({ edited: true, editedAt: new Date().toISOString(), runId: state.runId,
          sourcePlanFingerprint: fingerprints.length === 1 ? fingerprints[0] : null, orderedSectionIds: request.orderedSectionIds });
        await saveJournal(client, page, lease.id, null, manualOrder);
        return { sections: verified.rows.map(row => editorSectionSchema.parse(row)), recovered: false };
      } catch (error) {
        const actual = await leasedPage(client, page, lease.id);
        if (!readReorder(actual.settings)) throw safeReorderError(error);
        const restored = await rollbackOrder(client, page, lease.id);
        throw new ReorderError("persistence", restored);
      }
    } finally { await releaseEditLease(client, page, lease.id).catch(() => undefined); }
  } catch (error) { throw safeReorderError(error); }
}

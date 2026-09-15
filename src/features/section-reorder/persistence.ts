import "server-only";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { validationFingerprint } from "@/features/fact-validation/evidence";
import { readPage, readRows, type Client, type PageRow } from "@/features/section-engine/persistence";
import { hasEditLease } from "@/features/section-engine/edit-lease";
import type { SectionRow } from "@/features/section-engine/schemas";
import { editorSectionSchema } from "@/features/detail-editor/schemas";
import { readReorder, reorderJournalSchema, sameIds, type ReorderJournal } from "./schemas";
import { ReorderError } from "./errors";

export function immutableFingerprint(row: SectionRow) {
  const { sort_order, updated_at, ...immutable } = row; void sort_order; void updated_at;
  return validationFingerprint(immutable);
}
export async function leasedPage(client: Client, original: PageRow, leaseId: string) {
  const page = await readPage(client, original.project_id);
  if (!page || page.id !== original.id || (page.settings.sectionEdit as { id?: string } | undefined)?.id !== leaseId || !hasEditLease(page)) throw new ReorderError("conflict");
  return page;
}
export async function saveJournal(client: Client, original: PageRow, leaseId: string, state: ReorderJournal | null, manualOrder?: Record<string, unknown>) {
  const page = await leasedPage(client, original, leaseId);
  const settings: Record<string, unknown> = { ...page.settings, sectionEdit: { id: leaseId, startedAt: new Date().toISOString() } };
  if (state) settings.sectionReorder = reorderJournalSchema.parse(state); else delete settings.sectionReorder;
  if (manualOrder) {
    const previous = settings.editor;
    if (previous !== undefined && (previous === null || typeof previous !== "object" || Array.isArray(previous))) throw new ReorderError("invalid_input");
    settings.editor = { ...(previous as Record<string, unknown> | undefined), manualOrder };
  }
  const result = await client.from("detail_pages").update({ settings: z.record(z.string(), z.json()).parse(settings) }).eq("id", page.id).eq("project_id", page.project_id).eq("updated_at", page.updated_at)
    .select("id").abortSignal(AbortSignal.timeout(10000)).maybeSingle();
  if (result.error || !result.data) {
    const actual = await leasedPage(client, original, leaseId);
    if (!isDeepStrictEqual(actual.settings, settings)) throw new ReorderError("persistence");
  }
}
export async function reconcile(client: Client, page: PageRow, leaseId: string) {
  const latest = await leasedPage(client, page, leaseId), state = readReorder(latest.settings);
  if (!state || state.detailPageId !== page.id) throw new ReorderError("recovery_required");
  const rows = await readRows(client, page.id);
  if (!sameIds(rows.map(row => row.id), state.backup.map(row => row.id))) throw new ReorderError("conflict");
  for (const row of rows) {
    const original = state.backup.find(item => item.id === row.id)!, current = state.current.find(item => item.id === row.id)!;
    if (immutableFingerprint(row) !== original.fingerprint) throw new ReorderError("conflict");
    const pending = state.pending?.id === row.id ? state.pending : null;
    if (pending && row.sort_order === pending.toOrder && row.updated_at !== pending.fromUpdatedAt) {
      // The write intent was durable before the request. Resolve an interrupted/lost acknowledgement.
      current.sortOrder = row.sort_order; current.updatedAt = row.updated_at;
    } else if (row.sort_order !== current.sortOrder || row.updated_at !== current.updatedAt) throw new ReorderError("conflict");
  }
  if (state.pending) { state.pending = null; await saveJournal(client, page, leaseId, state); }
  return { state, rows };
}
export async function updateOrder(client: Client, page: PageRow, leaseId: string, state: ReorderJournal, id: string, toOrder: number) {
  const current = state.current.find(item => item.id === id)!;
  if (current.sortOrder === toOrder) return state;
  const next = { ...state, pending: { id, fromUpdatedAt: current.updatedAt, fromOrder: current.sortOrder, toOrder } };
  await saveJournal(client, page, leaseId, next);
  await leasedPage(client, page, leaseId);
  const result = await client.from("sections").update({ sort_order: toOrder }).eq("id", id).eq("detail_page_id", page.id).eq("updated_at", current.updatedAt)
    .select("*").abortSignal(AbortSignal.timeout(10000)).maybeSingle();
  if (!result.error && !result.data) throw new ReorderError("conflict");
  // Re-read even on failure: recover acknowledgement loss without repeating the update.
  const reconciled = await reconcile(client, page, leaseId);
  if (reconciled.state.current.find(item => item.id === id)?.sortOrder !== toOrder) throw new ReorderError("persistence");
  return reconciled.state;
}
export async function rollbackOrder(client: Client, page: PageRow, leaseId: string) {
  try {
    let { state } = await reconcile(client, page, leaseId);
    state = { ...state, status: "recovery_required" }; await saveJournal(client, page, leaseId, state);
    for (const original of state.backup) state = await updateOrder(client, page, leaseId, state, original.id, original.sortOrder);
    const verified = await reconcile(client, page, leaseId);
    if (verified.rows.some(row => row.sort_order !== state.backup.find(item => item.id === row.id)?.sortOrder)) throw new ReorderError("recovery_required");
    await saveJournal(client, page, leaseId, null);
    return verified.rows.map(row => editorSectionSchema.parse(row));
  } catch {
    try { const current = await leasedPage(client, page, leaseId), state = readReorder(current.settings); if (state) await saveJournal(client, page, leaseId, { ...state, status: "recovery_required" }); } catch { /* Preserve the last durable intent for explicit recovery. */ }
    throw new ReorderError("recovery_required");
  }
}

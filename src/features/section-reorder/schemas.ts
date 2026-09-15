import { z } from "zod";
import type { SectionRow } from "@/features/section-engine/schemas";
const ids = z.array(z.uuid()).min(1).max(50).refine(value => new Set(value).size === value.length);
const revision = z.strictObject({ id: z.uuid(), updatedAt: z.iso.datetime({ offset: true }) });
export const reorderRequestSchema = z.strictObject({ detailPageId: z.uuid(), orderedSectionIds: ids, expectedSections: z.array(revision).min(1).max(50) })
  .refine(value => sameIds(value.orderedSectionIds, value.expectedSections.map(row => row.id)));
export const recoveryRequestSchema = z.strictObject({ detailPageId: z.uuid(), recover: z.literal(true) });
export const orderRequestSchema = z.union([reorderRequestSchema, recoveryRequestSchema]);
export type ReorderRequest = z.infer<typeof reorderRequestSchema>;
export function sameIds(left: string[], right: string[]) { return left.length === right.length && new Set(left).size === left.length && new Set(right).size === right.length && left.every(id => right.includes(id)); }
export function assertWholeSet(request: ReorderRequest, rows: SectionRow[]) {
  return sameIds(request.orderedSectionIds, rows.map(row => row.id)) && rows.every(row => request.expectedSections.some(expected => expected.id === row.id && expected.updatedAt === row.updated_at));
}
const savedOrder = revision.extend({ sortOrder: z.number().int().nonnegative() });
export const reorderJournalSchema = z.strictObject({ schemaVersion: z.literal(1), runId: z.uuid(), detailPageId: z.uuid(), status: z.enum(["applying", "recovery_required"]),
  backup: z.array(savedOrder.extend({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/) })).min(1).max(50), current: z.array(savedOrder).min(1).max(50),
  pending: z.strictObject({ id: z.uuid(), fromUpdatedAt: revision.shape.updatedAt, fromOrder: savedOrder.shape.sortOrder, toOrder: savedOrder.shape.sortOrder }).nullable(),
  orderedSectionIds: ids, startedAt: revision.shape.updatedAt,
}).refine(state => sameIds(state.backup.map(row => row.id), state.orderedSectionIds) && sameIds(state.current.map(row => row.id), state.orderedSectionIds)
  && (!state.pending || state.current.some(row => row.id === state.pending!.id && row.updatedAt === state.pending!.fromUpdatedAt && row.sortOrder === state.pending!.fromOrder)));
export type ReorderJournal = z.infer<typeof reorderJournalSchema>;
export const manualOrderSchema = z.strictObject({ edited: z.literal(true), editedAt: revision.shape.updatedAt, runId: z.uuid(), sourcePlanFingerprint: z.string().regex(/^[a-f0-9]{64}$/).nullable(), orderedSectionIds: ids });
export function readReorder(settings: Record<string, unknown>) { return settings.sectionReorder === undefined ? null : reorderJournalSchema.parse(settings.sectionReorder); }
export function hasManualOrder(settings: Record<string, unknown>, rows: SectionRow[]) {
  const editor = settings.editor; const parsed = manualOrderSchema.safeParse(editor && typeof editor === "object" && "manualOrder" in editor ? editor.manualOrder : null);
  return parsed.success && sameIds(parsed.data.orderedSectionIds, rows.map(row => row.id));
}
export function visibleOrderRows(rows: SectionRow[], state: ReorderJournal | null) {
  if (!state) return rows;
  // Present the last complete order while writes/compensation are in progress.
  return [...rows].sort((a, b) => (state.backup.find(row => row.id === a.id)?.sortOrder ?? a.sort_order) - (state.backup.find(row => row.id === b.id)?.sortOrder ?? b.sort_order) || a.id.localeCompare(b.id));
}

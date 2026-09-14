import "server-only";
import { isDeepStrictEqual } from "node:util";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { detailPageRowSchema } from "@/features/page-planner/schemas";
import { generationStateSchema, sectionRowSchema, type GenerationState, type SectionRow } from "./schemas";
import { SectionEngineError } from "./errors";
export type Client = ReturnType<typeof createSupabaseServerClient>;
export type PageRow = ReturnType<typeof detailPageRowSchema.parse>;
const signal = () => AbortSignal.timeout(10000);
const timestampKey = (value: string) => `${Date.parse(value)}:${(value.match(/\.(\d+)/)?.[1] ?? "").padEnd(9, "0").slice(3)}`;
export function sameRow(left: SectionRow, right: SectionRow) {
  // PostgreSQL serializes Z as +00:00 and may trim fractional zeroes. Preserve sub-millisecond revisions.
  return isDeepStrictEqual({ ...left, created_at: timestampKey(left.created_at), updated_at: timestampKey(left.updated_at) },
    { ...right, created_at: timestampKey(right.created_at), updated_at: timestampKey(right.updated_at) });
}
export function readGeneration(page: PageRow): GenerationState | null {
  const value = page.settings.sectionGeneration;
  if (value === undefined) return null;
  const parsed = generationStateSchema.safeParse(value);
  if (!parsed.success) throw new SectionEngineError("invalid_input");
  if ([...(parsed.data.backup ?? []), ...parsed.data.staged].some(row => row.detail_page_id !== page.id)
    || parsed.data.staged.some(row => (row.content.meta as Record<string, unknown> | undefined)?.generationId !== parsed.data.runId)) throw new SectionEngineError("ownership");
  return parsed.data;
}
export async function readPage(client: Client, projectId: string) {
  const result = await client.from("detail_pages").select("*").eq("project_id", projectId).abortSignal(signal()).maybeSingle();
  if (result.error) throw new SectionEngineError("unexpected");
  if (!result.data) return null;
  const page = detailPageRowSchema.parse(result.data);
  if (page.project_id !== projectId) throw new SectionEngineError("ownership");
  return page;
}
export async function readRows(client: Client, pageId: string): Promise<SectionRow[]> {
  const result = await client.from("sections").select("*").eq("detail_page_id", pageId).order("sort_order").order("id").limit(63).abortSignal(signal());
  if (result.error) throw new SectionEngineError("unexpected");
  const rows = result.data.map(row => sectionRowSchema.parse(row));
  if (rows.some(row => row.detail_page_id !== pageId)) throw new SectionEngineError("ownership");
  if (rows.length > 62) throw new SectionEngineError("invalid_input");
  return rows;
}
export async function writeGeneration(client: Client, page: PageRow, state: GenerationState) {
  const value = generationStateSchema.parse(state);
  const settings = { ...page.settings, sectionGeneration: value };
  if (JSON.stringify(settings).length > 600000) throw new SectionEngineError("invalid_input");
  const result = await client.from("detail_pages").update({ settings }).eq("id", page.id).eq("project_id", page.project_id)
    .eq("updated_at", page.updated_at).select("*").abortSignal(signal()).maybeSingle();
  if (result.error || !result.data) {
    const actual = await readPage(client, page.project_id);
    if (actual?.id === page.id && isDeepStrictEqual(actual.settings, settings)) return actual;
    throw new SectionEngineError(result.error ? "unexpected" : "conflict");
  }
  return detailPageRowSchema.parse(result.data);
}
export async function ownedPage(client: Client, original: PageRow, runId: string) {
  const page = await readPage(client, original.project_id);
  if (!page || page.id !== original.id || readGeneration(page)?.runId !== runId) throw new SectionEngineError("conflict");
  return page;
}
export async function insertRows(client: Client, rows: SectionRow[]) {
  if (!rows.length) return;
  const result = await client.from("sections").insert(rows).select("*").abortSignal(signal());
  if (result.error) {
    const actual = await readRows(client, rows[0].detail_page_id);
    if (rows.every(row => actual.some(item => sameRow(item, row)))) return;
    throw new SectionEngineError("unexpected");
  }
  if (!result.data || result.data.length !== rows.length) throw new SectionEngineError("unexpected");
}
export async function removeRows(client: Client, rows: SectionRow[]) {
  if (!rows.length) return;
  // One DB statement, scoped to the exact rows/revisions observed. Never delete the whole page indiscriminately.
  const conditions = rows.map(row => `and(id.eq.${row.id},updated_at.eq.${row.updated_at})`).join(",");
  const result = await client.from("sections").delete().eq("detail_page_id", rows[0].detail_page_id).or(conditions).select("id").abortSignal(signal());
  if (result.error || result.data?.length !== rows.length) {
    const actual = await readRows(client, rows[0].detail_page_id);
    if (!actual.some(row => rows.some(old => old.id === row.id))) return;
    throw new SectionEngineError("conflict");
  }
}
export async function restoreGeneration(client: Client, original: PageRow, runId: string, errorCode: string) {
  let page = await ownedPage(client, original, runId), state = readGeneration(page)!;
  if (state.status === "completed") return; // An acknowledged commit must never be rolled back.
  if (!state.backup) throw new SectionEngineError("recovery_required");
  try {
    let actual = await readRows(client, page.id);
    if (state.backup.some(old => actual.some(row => row.id === old.id && !sameRow(row, old)))) throw new SectionEngineError("conflict");
    await ownedPage(client, page, runId);
    await insertRows(client, state.backup.filter(old => !actual.some(row => row.id === old.id)));
    actual = await readRows(client, page.id);
    const staged = actual.filter(row => state.staged.some(item => item.id === row.id));
    if (staged.some(row => !state.staged.some(item => sameRow(item, row)))) throw new SectionEngineError("conflict");
    await ownedPage(client, page, runId);
    await removeRows(client, staged);
    actual = await readRows(client, page.id);
    if (actual.length !== state.backup.length || !state.backup.every(old => actual.some(row => sameRow(row, old)))) throw new SectionEngineError("conflict");
    page = await ownedPage(client, page, runId);
    await writeGeneration(client, page, { ...state, status: "failed", finishedAt: new Date().toISOString(), errorCode, backup: null, staged: [] });
  } catch {
    try {
      page = await ownedPage(client, page, runId); state = readGeneration(page)!;
      if (state.status !== "completed") await writeGeneration(client, page, { ...state, status: "recovery_required", errorCode: "recovery_required", finishedAt: new Date().toISOString() });
    } catch { /* The durable backup remains in the last acknowledged journal; never discard it. */ }
    throw new SectionEngineError("recovery_required");
  }
}

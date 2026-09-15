import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { readPage, readGeneration, type Client, type PageRow } from "./persistence";
import { SectionEngineError } from "./errors";
import { readReorder } from "@/features/section-reorder/schemas";
import { isPlannerActive, plannerStateSchema } from "@/features/page-planner/schemas";
const leaseSchema = z.strictObject({ id: z.uuid(), startedAt: z.iso.datetime({ offset: true }) });
export function hasEditLease(page: PageRow, now = Date.now()) {
  if (!page.settings.sectionEdit) return false;
  const lease = leaseSchema.safeParse(page.settings.sectionEdit);
  if (!lease.success) throw new SectionEngineError("invalid_input");
  return now - Date.parse(lease.data.startedAt) < 180000;
}
export async function claimEditLease(client: Client, page: PageRow, recoveringReorderId?: string) {
  const generation = readGeneration(page);
  const reorder = readReorder(page.settings);
  const planner = plannerStateSchema.safeParse(page.plan);
  if (hasEditLease(page) || (planner.success && isPlannerActive(planner.data, Date.now())) || generation?.backup || generation?.status === "generating" || (reorder && reorder.runId !== recoveringReorderId)) throw new SectionEngineError("busy");
  const lease = { id: randomUUID(), startedAt: new Date().toISOString() };
  const result = await client.from("detail_pages").update({ settings: { ...page.settings, sectionEdit: lease } })
    .eq("id", page.id).eq("project_id", page.project_id).eq("updated_at", page.updated_at).select("id").abortSignal(AbortSignal.timeout(10000)).maybeSingle();
  if (result.error || !result.data) {
    const actual = await readPage(client, page.project_id);
    if ((actual?.settings.sectionEdit as { id?: string } | undefined)?.id !== lease.id) throw new SectionEngineError("conflict");
  }
  return lease;
}
export async function releaseEditLease(client: Client, original: PageRow, leaseId: string) {
  // Re-read and merge: a concurrent Planner may have changed plan/updated_at.
  for (let attempt = 0; attempt < 2; attempt++) {
    const page = await readPage(client, original.project_id);
    if (!page || page.id !== original.id || (page.settings.sectionEdit as { id?: string } | undefined)?.id !== leaseId) return;
    const settings = { ...page.settings }; delete settings.sectionEdit;
    const result = await client.from("detail_pages").update({ settings }).eq("id", page.id).eq("project_id", page.project_id)
      .eq("updated_at", page.updated_at).select("id").abortSignal(AbortSignal.timeout(10000)).maybeSingle();
    if (!result.error && result.data) return;
  }
  // An interrupted release expires in three minutes; it never restores/overwrites section content.
}

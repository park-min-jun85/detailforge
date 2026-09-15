import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { validationFingerprint } from "@/features/fact-validation/evidence";
import { editorSectionSchema } from "@/features/detail-editor/schemas";
import { claimEditLease, releaseEditLease } from "@/features/section-engine/edit-lease";
import { RegenError } from "./errors";
import { regenerateRequestSchema, candidateSchema } from "./schemas";
import { regenerationContext } from "./context";
import { regeneratedContent } from "./grounding";
import { getRegenerationProvider } from "./provider";
import { signCandidate, verifyCandidate } from "./candidate";
import { CANDIDATE_TTL_MS, REGEN_TIMEOUT_MS } from "./config";
import type { RegenerationProvider, RegenerationInput } from "./types";
const running = new Set<string>();
export function safeRegenError(error: unknown): RegenError {
  if (error instanceof RegenError) return error;
  if (error instanceof z.ZodError) return new RegenError("invalid_input");
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  const status = error && typeof error === "object" && "status" in error ? error.status : null;
  if (["busy", "conflict", "ownership", "forbidden", "invalid_input"].includes(String(code))) return new RegenError(code as "busy" | "conflict" | "ownership" | "forbidden" | "invalid_input");
  return new RegenError(status === 404 || code === "not_found" ? "not_found" : code === "facts_required" ? "stale_validation" : "database");
}
export async function invokeRegeneration(provider: RegenerationProvider, input: RegenerationInput, timeout = REGEN_TIMEOUT_MS) {
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([provider.generate(structuredClone(input), controller.signal), new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new RegenError("timeout")); }, timeout);
  })]); } catch (error) { throw error instanceof RegenError ? error : new RegenError("provider"); }
  finally { if (timer) clearTimeout(timer); }
}
function ids(projectId: string, sectionId: string) { if (!z.uuid().safeParse(projectId).success || !z.uuid().safeParse(sectionId).success) throw new RegenError("not_found"); }
export async function regenerateSection(projectId: string, sectionId: string, value: unknown, providerFactory: () => RegenerationProvider = getRegenerationProvider) {
  ids(projectId, sectionId);
  // Bound duplicate costs in this single-server MVP; this is not a new DB lease.
  if (running.has(projectId) || running.size >= 2) throw new RegenError("busy");
  running.add(projectId);
  try {
    const request = regenerateRequestSchema.parse(value), context = await regenerationContext(projectId, sectionId);
    if (request.revision !== context.section.updated_at) throw new RegenError("conflict");
    const provider = providerFactory(), output = await invokeRegeneration(provider, context.input);
    const generatedAt = new Date().toISOString(), generationId = randomUUID();
    const content = regeneratedContent(output, context, generatedAt, generationId, provider.model);
    const latest = await regenerationContext(projectId, sectionId);
    if (!isDeepStrictEqual(latest.section, context.section) || latest.inputFingerprint !== context.inputFingerprint) throw new RegenError("conflict");
    return signCandidate(candidateSchema.parse({ schemaVersion: 1, projectId, productId: context.scope.product!.id, detailPageId: context.page.id,
      sectionId, baseUpdatedAt: context.section.updated_at, baseFingerprint: validationFingerprint(context.section), inputFingerprint: context.inputFingerprint,
      content, style: context.section.style, generatedAt, expiresAt: new Date(Date.parse(generatedAt) + CANDIDATE_TTL_MS).toISOString(), generationId, provider: "openai", model: provider.model }));
  } catch (error) { throw safeRegenError(error); }
  finally { running.delete(projectId); }
}
export async function applySectionCandidate(projectId: string, sectionId: string, value: unknown) {
  try {
    ids(projectId, sectionId);
    const candidate = verifyCandidate(value, projectId, sectionId), context = await regenerationContext(projectId, sectionId);
    const matchesScope = (ctx: typeof context) => ctx.page.id === candidate.detailPageId && ctx.scope.product?.id === candidate.productId;
    if (!matchesScope(context)) throw new RegenError("ownership");
    const alreadyApplied = (row: typeof context.section) => row.content.meta.regeneration?.generationId === candidate.generationId
      && isDeepStrictEqual(row.content, candidate.content) && isDeepStrictEqual(row.style, candidate.style);
    if (alreadyApplied(context.section)) return context.section; // Acknowledgement loss: do not repeat an acknowledged content write.
    const checkBase = (ctx: typeof context) => {
      if (!matchesScope(ctx) || ctx.section.updated_at !== candidate.baseUpdatedAt || validationFingerprint(ctx.section) !== candidate.baseFingerprint
        || ctx.inputFingerprint !== candidate.inputFingerprint) throw new RegenError("conflict");
    };
    checkBase(context);
    const lease = await claimEditLease(context.client, context.page);
    try {
      const latest = await regenerationContext(projectId, sectionId, lease.id); checkBase(latest);
      verifyCandidate(value, projectId, sectionId); // Expiration also checked after the DB reads.
      const { meta, ...copy } = candidate.content; void meta;
      const content = regeneratedContent({ schemaVersion: 1, content: copy }, latest, candidate.generatedAt, candidate.generationId, candidate.model);
      if (!isDeepStrictEqual(content, candidate.content) || !isDeepStrictEqual(latest.section.style, candidate.style)) throw new RegenError("invalid_candidate");
      const result = await latest.client.from("sections").update({ content }).eq("id", sectionId).eq("detail_page_id", latest.page.id)
        .eq("updated_at", candidate.baseUpdatedAt).select("*").abortSignal(AbortSignal.timeout(10000)).maybeSingle();
      if (result.error) {
        const actual = await latest.client.from("sections").select("*").eq("id", sectionId).eq("detail_page_id", latest.page.id).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
        const row = editorSectionSchema.safeParse(actual.data);
        if (!actual.error && row.success && row.data.id === sectionId && row.data.detail_page_id === latest.page.id && row.data.sort_order === latest.section.sort_order && alreadyApplied(row.data)) return row.data;
        throw new RegenError("database");
      }
      if (!result.data) throw new RegenError("conflict");
      const saved = editorSectionSchema.parse(result.data);
      if (saved.id !== sectionId || saved.detail_page_id !== latest.page.id || saved.type !== latest.section.type || saved.sort_order !== latest.section.sort_order || !alreadyApplied(saved)) throw new RegenError("database");
      return saved;
    } finally { await releaseEditLease(context.client, context.page, lease.id).catch(() => undefined); }
  } catch (error) { throw safeRegenError(error); }
}

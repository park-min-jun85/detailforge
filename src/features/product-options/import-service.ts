import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { diagnoseDomemeProduct } from "@/features/wholesale-import/domeme-api/client";
import { DomemeApiError } from "@/features/wholesale-import/domeme-api/errors";
import { importExclusive } from "@/features/wholesale-import/tickets";
import { importedOptionSourceSchema, optionCandidateSchema, type ImportedOptionSource } from "./schemas";
import { optionProductScope, readOptionRow } from "./queries";
import { domemeProductNumber, optionApplySchema, optionLookupSchema, optionPreviewSchema } from "./import-contract";
import { compareImportedOptions, applyImportedAdditions } from "./import-merge";
import { issueOptionTicket, readOptionTicket, OPTION_TICKET_TTL } from "./import-tickets";
import { OptionError } from "./errors";

type Client = ReturnType<typeof createSupabaseServerClient>;
export async function readOptionImportScope(client: Client, projectId: string, productId: string, expectedVersion: number) {
  if (!await optionProductScope(client, projectId, productId)) throw new OptionError("product_required");
  const product = await client.from("products").select("id,project_id,source_url").eq("id", productId).eq("project_id", projectId).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
  if (product.error) throw new OptionError("unavailable");
  if (!product.data || product.data.id !== productId || product.data.project_id !== projectId) throw new OptionError("not_found");
  const sourceUrl = product.data.source_url, productNo = domemeProductNumber(sourceUrl);
  if (!sourceUrl || !productNo) throw new OptionError("source_url");
  const row = await readOptionRow(client, productId);
  if ((row?.version ?? 0) !== expectedVersion) throw new OptionError("conflict");
  return { projectId, productId, sourceUrl, productNo, expectedVersion, row };
}
function previousSource(value: unknown): ImportedOptionSource | null {
  const parsed = importedOptionSourceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
function translateError(error: unknown): never {
  if (error instanceof OptionError) throw error;
  if (error instanceof DomemeApiError) {
    if (["authentication", "forbidden", "key_missing"].includes(error.code)) throw new OptionError("api_authentication");
    throw new OptionError(error.code === "rate_limited" ? "api_rate_limited" : "api_failed");
  }
  if (error && typeof error === "object" && "code" in error && error.code === "busy") throw new OptionError("busy");
  throw new OptionError("unavailable");
}
export async function previewImportedOptions(projectId: string, input: unknown, diagnose = diagnoseDomemeProduct) {
  try {
    const parsed = optionLookupSchema.safeParse(input);
    if (!parsed.success) throw new OptionError("invalid_input");
    return await importExclusive(`options:${projectId}`, async () => {
      const client = createSupabaseServerClient();
      const scope = await readOptionImportScope(client, projectId, parsed.data.productId, parsed.data.expectedVersion);
      const report = await diagnose(scope.productNo);
      // The official client already verifies this, retain a second boundary for mocked/changed providers.
      if (report.productNo !== scope.productNo) throw new OptionError("api_failed");
      const fresh = await readOptionImportScope(client, projectId, scope.productId, scope.expectedVersion);
      if (fresh.sourceUrl !== scope.sourceUrl) throw new OptionError("source_changed");
      const fetchedAt = new Date().toISOString(), expiresAt = Date.now() + OPTION_TICKET_TTL;
      const current = fresh.row?.groups ?? { schemaVersion: 1 as const, groups: [] };
      const previous = previousSource(fresh.row?.source_snapshot);
      const bounded = optionCandidateSchema.safeParse(report.options.groups);
      const groups = bounded.success ? bounded.data : null;
      let status = report.options.status;
      const notes = [...report.options.reasons];
      if (status === "simple_groups" && (!groups?.length || (previous && previous.productNo !== scope.productNo))) {
        status = "unsupported"; notes.push("현재 출처와 상품이 다르거나 원문 구조를 확인할 수 없습니다. 전체 교체는 수동으로 확인해 주세요.");
      }
      const comparison = status === "simple_groups" && groups ? compareImportedOptions(current, previous, groups) : { additions: [], notes: [] };
      let token: string | null = null, additions = comparison.additions;
      if (status === "simple_groups" && groups) {
        const source: Omit<ImportedOptionSource, "bindings"> = { inputMethod: "domeme_api", schemaVersion: 1, supplier: "domeme", productNo: scope.productNo,
          sourceUrl: scope.sourceUrl, apiVersion: "4.6", fetchedAt, groups, fingerprint: createHash("sha256").update(JSON.stringify({ productNo: scope.productNo, groups, combinations: report.options.combinations })).digest("hex") };
        const issued = issueOptionTicket({ projectId, productId: scope.productId, sourceUrl: scope.sourceUrl, productNo: scope.productNo,
          expectedVersion: scope.expectedVersion, kind: "candidate", expiresAt, source, previous, current, additions });
        token = issued.token; additions = issued.ticket.additions;
      }
      return optionPreviewSchema.parse({ token, status, productId: scope.productId, productNo: scope.productNo, sourceUrl: scope.sourceUrl, fetchedAt,
        expiresAt: new Date(expiresAt).toISOString(), expectedVersion: scope.expectedVersion, groups, previous: previous?.groups ?? null, current, additions, notes: [...notes, ...comparison.notes] });
    });
  } catch (error) { translateError(error); }
}
export async function prepareImportedOptions(projectId: string, input: unknown) {
  try {
    const request = optionApplySchema.safeParse(input);
    if (!request.success) throw new OptionError("invalid_input");
    const scope = await readOptionImportScope(createSupabaseServerClient(), projectId, request.data.productId, request.data.expectedVersion);
    const ticket = readOptionTicket(request.data.token, scope, "candidate");
    const result = applyImportedAdditions(ticket.current, ticket.previous, ticket.source, ticket.additions, request.data.selectedIds);
    const prepared = issueOptionTicket({ ...ticket, kind: "prepared", preparedSource: result.source });
    return { options: result.options, importToken: prepared.token };
  } catch (error) { translateError(error); }
}

import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { importedOptionSourceSchema, normalizeOptionDraft, optionSaveSchema, optionRowSchema } from "./schemas";
import { readOptionImportScope } from "./import-service";
import { readOptionTicket } from "./import-tickets";
import { optionProductScope, readOptionRow, toOptionView } from "./queries";
import { OptionError } from "./errors";

export async function saveProductOptions(projectId: string, input: unknown) {
  try {
    const request = optionSaveSchema.safeParse(input);
    if (!request.success) throw new OptionError("invalid_input");
    let normalized: ReturnType<typeof normalizeOptionDraft>;
    try { normalized = normalizeOptionDraft(request.data.options); } catch { throw new OptionError("invalid_input"); }
    const client = createSupabaseServerClient(), productId = await optionProductScope(client, projectId, request.data.productId);
    if (!productId) throw new OptionError("product_required");
    const before = await readOptionRow(client, productId);
    if ((before?.version ?? 0) !== request.data.expectedVersion) throw new OptionError("conflict");
    const id = before?.id ?? randomUUID();
    const previousSource = importedOptionSourceSchema.safeParse(before?.source_snapshot);
    let sourceSnapshot = previousSource.success ? previousSource.data : normalized.sourceSnapshot;
    if (request.data.importToken) {
      const scope = await readOptionImportScope(client, projectId, productId, request.data.expectedVersion);
      const ticket = readOptionTicket(request.data.importToken, scope, "prepared");
      if (!ticket.preparedSource) throw new OptionError("expired");
      sourceSnapshot = importedOptionSourceSchema.parse(ticket.preparedSource);
    }
    const payload = { groups: normalized.confirmed, source_snapshot: sourceSnapshot, version: request.data.expectedVersion + 1 };
    const result = before
      ? await client.from("product_options").update(payload).eq("id", id).eq("product_id", productId).eq("version", before.version)
        .select("*").abortSignal(AbortSignal.timeout(10000)).maybeSingle()
      : await client.from("product_options").insert({ id, product_id: productId, ...payload })
        .select("*").abortSignal(AbortSignal.timeout(10000)).single();
    if (result.error?.code === "23505" || (!result.error && !result.data)) throw new OptionError("conflict");
    // A write response can be lost. Confirm exact content/version without retrying the mutation.
    const row = result.error ? await readOptionRow(client, productId) : optionRowSchema.parse(result.data);
    if (!row || row.id !== id || row.product_id !== productId || row.version !== payload.version
      || !isDeepStrictEqual(row.groups, payload.groups) || !isDeepStrictEqual(row.source_snapshot, payload.source_snapshot)) throw new OptionError("unavailable");
    return toOptionView(row);
  } catch (error) { throw error instanceof OptionError ? error : new OptionError("unavailable"); }
}

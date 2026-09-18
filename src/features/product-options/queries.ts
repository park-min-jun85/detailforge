import "server-only";
import { confirmedSource } from "./confirmed-source";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emptyOptionView, optionRowSchema, type OptionView } from "./schemas";
import { OptionError } from "./errors";

type Client = ReturnType<typeof createSupabaseServerClient>;
export async function optionProductScope(client: Client, projectId: string, expectedProductId?: string) {
  if (!z.uuid().safeParse(projectId).success || (expectedProductId !== undefined && !z.uuid().safeParse(expectedProductId).success)) throw new OptionError("not_found");
  const project = await client.from("projects").select("id").eq("id", projectId).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
  if (project.error) throw new OptionError("unavailable");
  if (!project.data || project.data.id !== projectId) throw new OptionError("not_found");
  const product = await client.from("products").select("id,project_id").eq("project_id", projectId).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
  if (product.error) throw new OptionError("unavailable");
  if (!product.data) return null;
  if (product.data.project_id !== projectId || !z.uuid().safeParse(product.data.id).success || (expectedProductId && product.data.id !== expectedProductId)) throw new OptionError("not_found");
  return product.data.id;
}
export async function readOptionRow(client: Client, productId: string) {
  const result = await client.from("product_options").select("*").eq("product_id", productId).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
  if (result.error) throw new OptionError("unavailable");
  if (!result.data) return null;
  const parsed = optionRowSchema.safeParse(result.data);
  if (!parsed.success) throw new OptionError("invalid_schema");
  const row = parsed.data;
  if (row.product_id !== productId) throw new OptionError("not_found");
  return row;
}
export function toOptionView(row: NonNullable<Awaited<ReturnType<typeof readOptionRow>>>): OptionView {
  return { productId: row.product_id, id: row.id, options: row.groups, version: row.version, updatedAt: row.updated_at };
}
export async function getProductOptions(projectId: string, expectedProductId?: string): Promise<OptionView> {
  try {
    const client = createSupabaseServerClient(), productId = await optionProductScope(client, projectId, expectedProductId);
    if (!productId) return emptyOptionView(null);
    const row = await readOptionRow(client, productId);
    return row ? toOptionView(row) : emptyOptionView(productId);
  } catch (error) { throw error instanceof OptionError ? error : new OptionError("unavailable"); }
}

// Planner/Section boundary: confirmed data only, no raw source or implicit Fact conversion.
export async function getConfirmedProductOptions(projectId: string, productId: string) {
  const view = await getProductOptions(projectId, productId);
  if (!view.productId) throw new OptionError("product_required");
  return { productId: view.productId, version: view.version, hasOptions: view.options.groups.length > 0, options: view.options, snapshot: confirmedSource(view) };
}

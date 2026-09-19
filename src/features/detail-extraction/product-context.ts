import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { manualFactsSchema } from "@/features/products/schemas";
import { ExtractionError } from "./errors";

const text = (value: string | null | undefined, max: number) => (value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim().slice(0, max);
const identityLabels = new Set(["품명", "모델명", "품명 및 모델명", "제품명", "모델", "model", "model name"]);
export function buildExtractionProductContext(product: { name: string; category?: string | null; brand?: string | null }, facts: unknown) {
  const parsed = manualFactsSchema.safeParse(facts);
  const identifiers = parsed.success ? parsed.data.specifications
    .filter(row => identityLabels.has(text(row.name, 100).toLowerCase()))
    .map(row => ({ label: text(row.name, 40), value: text(row.value, 120) })) : [];
  // Stable across DB object-key and specification order. Keep distinct conflicting identity values.
  const sorted = [...new Map(identifiers.map(row => [JSON.stringify(row), row])).values()]
    .sort((a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); return x < y ? -1 : x > y ? 1 : 0; }).slice(0, 4);
  return { productName: text(product.name, 200), category: text(product.category, 100), brand: text(product.brand, 100), identifiers: sorted };
}
export type ExtractionProductContext = ReturnType<typeof buildExtractionProductContext>;
export function productContextFingerprint(context: ExtractionProductContext) {
  return createHash("sha256").update(JSON.stringify({ productName: context.productName, category: context.category,
    brand: context.brand, identifiers: context.identifiers })).digest("hex");
}
const productSchema = z.object({ id: z.uuid(), project_id: z.uuid(), name: z.string(), category: z.string().nullable().optional(), brand: z.string().nullable().optional() });
export async function loadExtractionProductContext(client: ReturnType<typeof createSupabaseServerClient>, scope: { projectId: string; productId: string }) {
  const product = await client.from("products").select("id,project_id,name,category,brand").eq("id", scope.productId)
    .eq("project_id", scope.projectId).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
  if (product.error) throw new ExtractionError("database");
  const parsed = productSchema.safeParse(product.data);
  if (!parsed.success || parsed.data.id !== scope.productId || parsed.data.project_id !== scope.projectId) throw new ExtractionError("ownership");
  const facts = await client.from("product_facts").select("product_id,facts").eq("product_id", scope.productId)
    .abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
  if (facts.error) throw new ExtractionError("database");
  if (facts.data && facts.data.product_id !== scope.productId) throw new ExtractionError("ownership");
  const context = buildExtractionProductContext(parsed.data, facts.data?.facts);
  return { context, fingerprint: productContextFingerprint(context) };
}

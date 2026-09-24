import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectRowSchema } from "@/features/projects/schemas";
import type { ProjectSummary, Product } from "@/types/domain";
import { projectIdSchema, productRowSchema, type ProductInput } from "./schemas";
import { toProduct, toProductInput } from "./mappers";

type DetailResult =
  | { status: "ready"; project: ProjectSummary; product: Product | null; values: ProductInput | null }
  | { status: "not-found" }
  | { status: "error"; message: string };

export async function getProductDetail(projectId: string): Promise<DetailResult> {
  if (!projectIdSchema.safeParse(projectId).success) return { status: "not-found" };
  try {
    const client = createSupabaseServerClient();
    const projectResult = await client.from("projects").select("*").eq("id", projectId)
      .abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
    if (projectResult.error) throw new Error("Project read failed");
    if (!projectResult.data) return { status: "not-found" };

    const productResult = await client.from("products").select("*").eq("project_id", projectId)
      .abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
    if (productResult.error) throw new Error("Product read failed");
    const product = productResult.data ? toProduct(productRowSchema.parse(productResult.data)) : null;
    return { status: "ready", project: projectRowSchema.parse(projectResult.data),
      product, values: product ? toProductInput(product) : null };
  } catch {
    return { status: "error", message: "상품정보를 불러오지 못했습니다. 연결 상태와 저장된 원본 정보를 확인한 후 다시 시도해 주세요." };
  }
}

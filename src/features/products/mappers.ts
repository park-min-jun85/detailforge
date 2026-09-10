import type { Product } from "@/types/domain";
import { manualFactsSchema, manualSourceSchema, productFormSchema,
  type ProductInput, type ProductRow } from "./schemas";

export function toManualSource(input: ProductInput) {
  return manualSourceSchema.parse({ inputMethod: "manual", ...input });
}

export function toManualFacts(input: ProductInput) {
  const source = toManualSource(input);
  return manualFactsSchema.parse({
    productName: source.productName,
    ...(source.brand ? { brand: source.brand } : {}),
    ...(source.category ? { category: source.category } : {}),
    specifications: source.specifications,
  });
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id, projectId: row.project_id, name: row.name, brand: row.brand,
    category: row.category, description: row.description, sourceType: row.source_type,
    sourceUrl: row.source_url, rawData: row.raw_data, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function toProductInput(product: Product): ProductInput {
  // 초기 schema 기본값 {}만 이전 형식으로 허용한다. 모르는 원본 JSON을 조용히 덮어쓰지 않는다.
  const source = Object.keys(product.rawData).length === 0
    ? null : manualSourceSchema.parse(product.rawData);
  return productFormSchema.parse({
    productName: product.name, brand: product.brand ?? "", category: product.category ?? "",
    description: product.description ?? "", sourceUrl: product.sourceUrl ?? "",
    specifications: source?.specifications ?? [],
  });
}

export function readProductFormData(formData: FormData) {
  const names = formData.getAll("specificationName");
  const values = formData.getAll("specificationValue");
  return {
    productName: formData.get("productName"),
    brand: formData.get("brand") ?? "",
    category: formData.get("category") ?? "",
    description: formData.get("description") ?? "",
    sourceUrl: formData.get("sourceUrl") ?? "",
    specifications: Array.from({ length: Math.max(names.length, values.length) }, (_, index) => ({
      name: names[index] ?? "", value: values[index] ?? "",
    })),
  };
}
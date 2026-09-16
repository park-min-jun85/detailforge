import { z } from "zod";

export const MAX_SPECIFICATIONS = 50;
const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label}은(는) ${max}자 이하로 입력해 주세요.`).default("");

const specificationSchema = z.object({
  name: z.string().trim().max(100, "스펙 항목명은 100자 이하로 입력해 주세요."),
  value: z.string().trim().max(500, "스펙 값은 500자 이하로 입력해 주세요."),
});
const specificationsSchema = z.array(specificationSchema)
  .max(MAX_SPECIFICATIONS, "스펙은 최대 50개까지 입력할 수 있습니다.")
  .superRefine((rows, context) => {
    rows.forEach((row, index) => {
      if (!row.name && row.value) context.addIssue({
        code: "custom", path: [index, "name"], message: "스펙 항목명을 입력해 주세요.",
      });
      if (row.name && !row.value) context.addIssue({
        code: "custom", path: [index, "value"], message: "스펙 값을 입력해 주세요.",
      });
    });
  }).transform((rows) => rows.filter((row) => row.name || row.value));

const productFields = {
  productName: z.string({ error: "상품명을 입력해 주세요." }).trim()
    .min(1, "상품명을 입력해 주세요.").max(200, "상품명은 200자 이하로 입력해 주세요."),
  brand: optionalText(100, "브랜드"),
  category: optionalText(100, "카테고리"),
  description: optionalText(5000, "상품 설명"),
  sourceUrl: optionalText(2048, "원본 상품 URL").refine((value) => {
    if (!value) return true;
    try { return ["http:", "https:"].includes(new URL(value).protocol); }
    catch { return false; }
  }, "http:// 또는 https://로 시작하는 올바른 URL을 입력해 주세요."),
  specifications: specificationsSchema.default([]),
};

export const productFormSchema = z.object(productFields);
export const manualSourceSchema = z.object({ inputMethod: z.literal("manual"), ...productFields });
export const wholesaleProvenanceSchema = z.object({ sourceUrl: z.url().max(2048), sourceHost: z.string().max(253), fetchedAt: z.iso.datetime(),
  importedAt: z.iso.datetime(), extractionMethod: z.enum(["json_ld","metadata","dom","browser","mixed"]), importedImageUrls: z.array(z.url().max(2048)).max(30),
  extracted: z.object({ name:z.string().max(200).nullable(),brand:z.string().max(100).nullable(),category:z.string().max(100).nullable(),description:z.string().max(5000).nullable(),specifications:z.array(z.object({name:z.string().max(100),value:z.string().max(500)})).max(50) }) }).strict();
export const wholesaleSourceSchema = z.object({ inputMethod:z.literal("wholesale_url"), ...productFields, provenance:wholesaleProvenanceSchema });
export const productSourceSchema = z.union([manualSourceSchema,wholesaleSourceSchema]);
export const manualFactsSchema = z.object({
  productName: z.string().min(1).max(200),
  brand: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(100).optional(),
  specifications: z.array(z.object({
    name: z.string().min(1).max(100),
    value: z.string().min(1).max(500),
  })).max(MAX_SPECIFICATIONS),
});
export const projectIdSchema = z.uuid();
export const productRevisionSchema = z.union([z.literal(""), z.iso.datetime({ offset: true })]);

const jsonObject = z.record(z.string(), z.json());
export const productRowSchema = z.object({
  id: z.uuid(), project_id: z.uuid(), name: z.string(),
  brand: z.string().nullable(), category: z.string().nullable(),
  description: z.string().nullable(), source_type: z.string(), source_url: z.string().nullable(),
  raw_data: jsonObject,
  ai_analysis: jsonObject.default({}),
  created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }),
});
export const productFactsRowSchema = z.object({
  id: z.uuid(), product_id: z.uuid(), facts: jsonObject, source_snapshot: jsonObject,
  validation: jsonObject.default({}),
  version: z.number().int().positive(), validated_at: z.iso.datetime({ offset: true }).nullable(),
  created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }),
});

export type ProductInput = z.infer<typeof productFormSchema>;
export type ManualSource = z.infer<typeof manualSourceSchema>;
export type ProductRow = z.infer<typeof productRowSchema>;
export type ProductFactsRow = z.infer<typeof productFactsRowSchema>;

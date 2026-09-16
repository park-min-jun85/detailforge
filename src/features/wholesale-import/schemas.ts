import { z } from "zod";
import { productFormSchema, productRevisionSchema } from "@/features/products/schemas";
export const remoteUrlSchema = z.string().trim().max(2048).transform((value, ctx) => {
  try { const url = new URL(value); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) throw new Error(); url.hash = ""; return url.href; }
  catch { ctx.addIssue({ code: "custom", message: "Invalid public URL" }); return z.NEVER; }
});
export const extractionMethodSchema = z.enum(["json_ld", "metadata", "dom", "browser", "mixed"]);
export const extractedProductSchema = z.object({ name: z.string().max(200).nullable(), brand: z.string().max(100).nullable(), category: z.string().max(100).nullable(), description: z.string().max(5000).nullable(), specifications: z.array(z.object({ name: z.string().min(1).max(100), value: z.string().min(1).max(500) }).strict()).max(50) }).strict();
export const candidateSchema = z.object({ sourceType: z.literal("wholesale_url"), sourceUrl: remoteUrlSchema, sourceHost: z.string().max(253), fetchedAt: z.iso.datetime(), extractionMethod: extractionMethodSchema,
  product: extractedProductSchema, images: z.array(z.object({ url: remoteUrlSchema, alt: z.string().max(200).nullable(), selected: z.boolean() }).strict()).max(30), warnings: z.array(z.string().max(300)).max(10) }).strict();
export const previewRequestSchema = z.object({ url: remoteUrlSchema }).strict();
export const importSaveSchema = z.object({ token: z.uuid(), revision: productRevisionSchema, values: productFormSchema, selectedImageUrls: z.array(remoteUrlSchema).max(30) }).strict();
export type ImportCandidate = z.infer<typeof candidateSchema>;
export type ExtractedProduct = z.infer<typeof extractedProductSchema>;

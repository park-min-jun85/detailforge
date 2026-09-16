import { z } from "zod";
export const exportRequestSchema = z.discriminatedUnion("format", [
  z.object({ format: z.literal("png") }).strict(),
  z.object({ format: z.literal("jpg"), quality: z.number().int().min(60).max(100).default(90) }).strict(),
]);
export type ExportOptions = z.infer<typeof exportRequestSchema>;

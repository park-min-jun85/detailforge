import { z } from "zod";
import { PROJECT_STATUSES, type ProjectSummary } from "@/types/domain";

export const createProjectSchema = z.strictObject({
  name: z.string({ error: "프로젝트명을 입력해 주세요." })
    .trim()
    .min(1, "프로젝트명을 입력해 주세요.")
    .max(100, "프로젝트명은 100자 이하로 입력해 주세요."),
});

export const updateProjectSchema = z.strictObject({
  name: createProjectSchema.shape.name.optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
}).refine(input => Object.keys(input).length > 0);

export function parseProjectFormData(formData: FormData) {
  const input: Record<string, unknown> = Object.create(null);
  for (const [key, value] of formData) {
    if (key.startsWith("$ACTION_")) continue; // Next action transport metadata.
    if (Object.hasOwn(input, key)) return createProjectSchema.safeParse({ duplicateField: true });
    input[key] = value;
  }
  return createProjectSchema.safeParse(input);
}

// Legacy/UI projection only, NOT an ownership authorization check.
export const projectRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: z.enum(PROJECT_STATUSES),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
}).transform((row): ProjectSummary => ({
  id: row.id,
  name: row.name,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
}));

export const PROJECT_PAGE_SIZE = 20;

export function parseProjectPage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page * PROJECT_PAGE_SIZE) ? page : 1;
}

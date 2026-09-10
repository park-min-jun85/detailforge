import { z } from "zod";
import { PROJECT_STATUSES, type Project } from "@/types/domain";

export const createProjectSchema = z.object({
  name: z.string({ error: "프로젝트명을 입력해 주세요." })
    .trim()
    .min(1, "프로젝트명을 입력해 주세요.")
    .max(100, "프로젝트명은 100자 이하로 입력해 주세요."),
});

// DB의 넓은 string 타입을 검증한 뒤 Domain의 camelCase로 변환한다.
export const projectRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: z.enum(PROJECT_STATUSES),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
}).transform((row): Project => ({
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
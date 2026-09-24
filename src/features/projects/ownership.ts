import "server-only";

import { z } from "zod";
import type { AuthenticatedPrincipal } from "@/lib/auth/principal";
import type { Project, ProjectSummary } from "@/types/domain";
import { projectRowSchema } from "./schemas";

export class OwnershipError extends Error {
  readonly code: "unauthenticated" | "invalid_input" | "not_found" | "unavailable";
  readonly status: number;
  constructor(code: OwnershipError["code"]) {
    super(({ unauthenticated: "로그인이 필요합니다.", invalid_input: "프로젝트 입력을 확인해 주세요.",
      not_found: "프로젝트를 찾을 수 없습니다.", unavailable: "프로젝트 작업을 완료하지 못했습니다." })[code]);
    this.name = "OwnershipError"; this.code = code;
    this.status = ({ unauthenticated: 401, invalid_input: 400, not_found: 404, unavailable: 503 })[code];
  }
}

// This validates shape, not authentication. Callers obtain this principal from getUser.
export function principalId(principal: AuthenticatedPrincipal): string {
  const parsed = z.uuid().safeParse(principal?.userId);
  if (!parsed.success) throw new OwnershipError("unauthenticated");
  return parsed.data;
}

export function resourceId(value: unknown): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new OwnershipError("not_found");
  return parsed.data;
}

export const ownedProjectRowSchema = z.object({ owner_id: z.uuid() }).passthrough()
  .transform((row): Project => ({ ...projectRowSchema.parse(row), ownerId: row.owner_id }));

// Offline/admin inspection only. Missing owner is an explicit legacy state.
export const legacyProjectOwnershipSchema = z.object({ owner_id: z.uuid().nullish() }).passthrough()
  .transform(row => ({ ...projectRowSchema.parse(row), ownerId: row.owner_id ?? null }));

export function toProjectSummary(project: Project): ProjectSummary {
  return { id: project.id, name: project.name, status: project.status,
    createdAt: project.createdAt, updatedAt: project.updatedAt };
}

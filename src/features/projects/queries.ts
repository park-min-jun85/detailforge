import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROJECT_STATUSES, type ProjectSummary } from "@/types/domain";
import { PROJECT_PAGE_SIZE, projectRowSchema } from "./schemas";
import type { ProjectQueryResult } from "./types";

const projectColumns = "id,name,status,created_at,updated_at";
const workingStatuses = PROJECT_STATUSES.filter((status) => status !== "completed");

// Explicit legacy/internal reads until TASK-060; use service.ts for owned access.
type ProjectListData = { projects: ProjectSummary[]; page: number; total: number; totalPages: number };
type DashboardData = {
  total: number;
  working: number;
  completed: number;
  recentProjects: ProjectSummary[];
};

export async function getProjects(requestedPage = 1): Promise<ProjectQueryResult<ProjectListData>> {
  try {
    const client = createSupabaseServerClient();
    const signal = AbortSignal.timeout(10_000);
    const countResult = await client.from("projects")
      .select("id", { count: "exact", head: true }).abortSignal(signal);
    if (countResult.error || countResult.count === null) throw new Error("Project count failed");

    const total = countResult.count;
    const totalPages = Math.max(1, Math.ceil(total / PROJECT_PAGE_SIZE));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const start = (page - 1) * PROJECT_PAGE_SIZE;
    const result = await client.from("projects").select(projectColumns)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .range(start, start + PROJECT_PAGE_SIZE - 1)
      .abortSignal(signal);
    if (result.error || !result.data) throw new Error("Project list failed");

    return { success: true, data: {
      projects: projectRowSchema.array().parse(result.data), page, total, totalPages,
    } };
  } catch {
    return { success: false, message: "프로젝트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

export async function getProjectDashboard(): Promise<ProjectQueryResult<DashboardData>> {
  try {
    const client = createSupabaseServerClient();
    const signal = AbortSignal.timeout(10_000);
    const [total, working, completed, recent] = await Promise.all([
      client.from("projects").select("id", { count: "exact", head: true }).abortSignal(signal),
      client.from("projects").select("id", { count: "exact", head: true })
        .in("status", workingStatuses).abortSignal(signal),
      client.from("projects").select("id", { count: "exact", head: true })
        .eq("status", "completed").abortSignal(signal),
      client.from("projects").select(projectColumns)
        .order("updated_at", { ascending: false }).order("id", { ascending: false })
        .limit(5).abortSignal(signal),
    ]);
    if (total.error || working.error || completed.error || recent.error ||
      total.count === null || working.count === null || completed.count === null || !recent.data) {
      throw new Error("Project dashboard failed");
    }
    return { success: true, data: {
      total: total.count, working: working.count, completed: completed.count,
      recentProjects: projectRowSchema.array().parse(recent.data),
    } };
  } catch {
    return { success: false, message: "제작 현황을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

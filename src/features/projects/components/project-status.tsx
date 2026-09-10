import type { ProjectStatus } from "@/types/domain";

const labels = {
  draft: "초안", analyzing: "분석 중", generated: "생성됨", editing: "편집 중", completed: "완료",
} satisfies Record<ProjectStatus, string>;

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${
      status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-zinc-50 text-zinc-700"
    }`}><span className="sr-only">상태: </span>{labels[status]}</span>
  );
}
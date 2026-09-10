import type { Project, ProjectStatus } from "@/types/domain";

const statusLabels = {
  draft: "초안",
  analyzing: "분석 중",
  generated: "생성됨",
  editing: "편집 중",
  completed: "완료",
} satisfies Record<ProjectStatus, string>;

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul",
});

export function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <div>
      <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_7rem_12rem_7rem] gap-4 border-b border-zinc-200 bg-zinc-50 px-6 py-3 text-xs font-medium text-zinc-500 lg:grid">
        <span>프로젝트명</span><span>상태</span><span>최근 수정일 (한국 시간)</span><span>프로젝트 열기</span>
      </div>
      <ul className="divide-y divide-zinc-200">
        {projects.map((project) => (
          <li key={project.id} className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_7rem_12rem_7rem] lg:items-center">
            <p className="min-w-0 font-medium leading-6 [overflow-wrap:anywhere]">{project.name}</p>
            <div><span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${
              project.status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-zinc-50 text-zinc-700"
            }`}><span className="sr-only">상태: </span>{statusLabels[project.status]}</span></div>
            <time dateTime={project.updatedAt} className="text-xs leading-5 text-zinc-500">
              <span className="lg:sr-only">최근 수정: </span>{dateFormatter.format(new Date(project.updatedAt))}
            </time>
            <span className="text-xs text-zinc-500" aria-disabled="true">
              열기 <span className="ml-1 rounded border border-zinc-200 px-1.5 py-0.5">준비 중</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
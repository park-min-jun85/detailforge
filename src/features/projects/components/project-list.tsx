import Link from "next/link";
import type { Project } from "@/types/domain";
import { ProjectStatusBadge } from "./project-status";

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
            <div><ProjectStatusBadge status={project.status} /></div>
            <time dateTime={project.updatedAt} className="text-xs leading-5 text-zinc-500">
              <span className="lg:sr-only">최근 수정: </span>{dateFormatter.format(new Date(project.updatedAt))}
            </time>
            <Link href={`/projects/${project.id}`} className="text-link" aria-label={`${project.name} 열기`}>
              열기 <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

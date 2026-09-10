import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AppIcon } from "@/components/ui/app-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectList } from "@/features/projects/components/project-list";
import { ProjectLoadError } from "@/features/projects/components/project-load-error";
import { getProjects } from "@/features/projects/queries";
import { parseProjectPage } from "@/features/projects/schemas";

export const metadata: Metadata = { title: "프로젝트" };

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  await connection();
  const params = await searchParams;
  const result = await getProjects(parseProjectPage(params.page));

  return (
    <div className="page-content">
      <PageHeader title="프로젝트" description="상품별 상세페이지 작업을 한곳에서 관리하세요."
        action={<Link href="/projects/new" className="button-primary"><AppIcon name="plus" />새 프로젝트</Link>}
      />
      {params.created === "1" && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">프로젝트가 생성되었습니다.</p>}
      {!result.success ? <ProjectLoadError message={result.message} retryHref="/projects" /> : (
        <section aria-label="프로젝트 목록" className="panel overflow-hidden">
          <div className="border-b border-zinc-200 px-6 py-4 text-sm text-zinc-600">전체 {result.data.total.toLocaleString("ko-KR")}개</div>
          {result.data.total === 0
            ? <EmptyState icon="folder" title="아직 프로젝트가 없습니다." description="새 프로젝트를 만들어 상세페이지 작업을 시작하세요." />
            : <ProjectList projects={result.data.projects} />}
          {result.data.totalPages > 1 && (
            <nav aria-label="프로젝트 목록 페이지" className="flex items-center justify-between gap-4 border-t border-zinc-200 px-6 py-4 text-sm">
              {result.data.page > 1 ? <Link className="text-link" href={`/projects?page=${result.data.page - 1}`}>이전</Link> : <span className="text-zinc-400">이전</span>}
              <span className="text-zinc-600">{result.data.page} / {result.data.totalPages}</span>
              {result.data.page < result.data.totalPages ? <Link className="text-link" href={`/projects?page=${result.data.page + 1}`}>다음</Link> : <span className="text-zinc-400">다음</span>}
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
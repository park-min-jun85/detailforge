import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AppIcon } from "@/components/ui/app-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectList } from "@/features/projects/components/project-list";
import { ProjectLoadError } from "@/features/projects/components/project-load-error";
import { getProjectDashboard } from "@/features/projects/queries";

export const metadata: Metadata = { title: "Dashboard" };

const summaries = [
  { label: "전체 프로젝트", icon: "folder", key: "total" },
  { label: "작업 중", icon: "edit", key: "working" },
  { label: "완료", icon: "check", key: "completed" },
] as const;

export default async function DashboardPage() {
  await connection();
  const result = await getProjectDashboard();

  return (
    <div className="page-content">
      <PageHeader title="Dashboard" description="상품 상세페이지 제작 현황을 확인하세요."
        action={<Link href="/projects/new" className="button-primary"><AppIcon name="plus" />새 상세페이지 만들기</Link>}
      />
      {!result.success ? <ProjectLoadError message={result.message} retryHref="/" /> : (
        <>
          <section aria-label="프로젝트 현황">
            <dl className="grid gap-4 sm:grid-cols-3">
              {summaries.map(({ label, icon, key }) => (
                <div key={key} className="panel p-6">
                  <dt className="flex items-center justify-between gap-3 text-sm font-medium text-zinc-600">
                    {label}<AppIcon name={icon} className="size-5 text-zinc-400" />
                  </dt>
                  <dd className="mt-5 text-3xl font-semibold tracking-tight">{result.data[key].toLocaleString("ko-KR")}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="panel overflow-hidden" aria-labelledby="recent-projects-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-6 py-5">
              <h2 id="recent-projects-title" className="text-base font-semibold">최근 프로젝트</h2>
              <Link href="/projects" className="text-link">전체 프로젝트 보기 <span aria-hidden="true">→</span></Link>
            </div>
            {result.data.recentProjects.length === 0
              ? <EmptyState icon="folder" headingLevel={3} title="아직 생성된 프로젝트가 없습니다." description="프로젝트를 만들면 이곳에서 최근 작업을 이어갈 수 있습니다." />
              : <ProjectList projects={result.data.recentProjects} />}
          </section>
        </>
      )}
    </div>
  );
}
import type { Metadata } from "next";
import { AppIcon } from "@/components/ui/app-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "프로젝트" };

export default function ProjectsPage() {
  return (
    <div className="page-content">
      <PageHeader title="프로젝트" description="상품별 상세페이지 작업을 한곳에서 관리하세요."
        action={
          <div className="space-y-2 sm:text-right">
            {/* TASK-005: 생성 동작과 데이터는 이 페이지의 서버 경계에서 연결한다. */}
            <button type="button" aria-disabled="true" aria-describedby="project-creation-note" className="button-primary">
              <AppIcon name="plus" />새 프로젝트
            </button>
            <p id="project-creation-note" className="text-xs text-zinc-500">프로젝트 생성 기능은 준비 중입니다.</p>
          </div>
        }
      />
      <section aria-label="프로젝트 목록" className="panel">
        <EmptyState icon="folder" title="아직 프로젝트가 없습니다."
          description="프로젝트 생성 기능이 제공되면 상품별 상세페이지 작업을 시작할 수 있습니다." />
      </section>
    </div>
  );
}
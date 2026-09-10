import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "템플릿" };

export default function TemplatesPage() {
  return (
    <div className="page-content">
      <PageHeader title="템플릿" />
      <section aria-label="템플릿 안내" className="panel">
        <EmptyState icon="template" title="템플릿 기능 준비 중" description="상세페이지 템플릿 기능은 이후 단계에서 제공됩니다." />
      </section>
    </div>
  );
}
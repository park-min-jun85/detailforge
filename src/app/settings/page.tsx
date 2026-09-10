import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "설정" };

export default function SettingsPage() {
  return (
    <div className="page-content">
      <PageHeader title="설정" />
      <section aria-label="설정 안내" className="panel">
        <EmptyState icon="settings" title="설정 기능 준비 중" description="작업 공간 설정은 이후 단계에서 제공됩니다." />
      </section>
    </div>
  );
}
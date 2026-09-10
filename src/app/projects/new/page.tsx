import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { CreateProjectForm } from "@/features/projects/components/create-project-form";

export const metadata: Metadata = { title: "새 프로젝트" };

export default function NewProjectPage() {
  return (
    <div className="page-content">
      <PageHeader title="새 프로젝트" description="상세페이지 작업을 시작할 프로젝트의 이름을 입력하세요." />
      <CreateProjectForm />
    </div>
  );
}
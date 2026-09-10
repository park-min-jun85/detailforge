import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export default function ProjectNotFound() {
  return (
    <div className="page-content">
      <PageHeader title="프로젝트를 찾을 수 없습니다." description="주소를 확인하거나 프로젝트 목록에서 다시 선택해 주세요." />
      <Link href="/projects" className="button-primary">프로젝트 목록으로</Link>
    </div>
  );
}
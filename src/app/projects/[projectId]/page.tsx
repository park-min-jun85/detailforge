import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectStatusBadge } from "@/features/projects/components/project-status";
import { ProjectLoadError } from "@/features/projects/components/project-load-error";
import { ProductForm } from "@/features/products/components/product-form";
import { getProductDetail } from "@/features/products/queries";

export const metadata: Metadata = { title: "상품정보" };

export default async function ProjectDetailPage({ params }: PageProps<"/projects/[projectId]">) {
  await connection();
  const { projectId } = await params;
  const result = await getProductDetail(projectId);
  if (result.status === "not-found") notFound();

  return (
    <div className="page-content">
      <Link className="text-link" href="/projects">← 프로젝트 목록</Link>
      {result.status === "error" ? (
        <>
          <PageHeader title="상품정보" />
          <ProjectLoadError message={result.message} retryHref={`/projects/${projectId}`} />
        </>
      ) : (
        <>
          <PageHeader title={result.project.name} description="상세페이지 제작에 사용할 상품정보를 관리하세요."
            action={<ProjectStatusBadge status={result.project.status} />} />
          <ol aria-label="상세페이지 제작 단계" className="flex flex-wrap gap-x-6 gap-y-3 border-b border-zinc-200 pb-5 text-sm">
            <li aria-current="step" className="font-semibold text-zinc-950">1. 상품정보</li>
            <li className="text-zinc-500">2. 이미지</li>
            <li className="text-zinc-500">3. 상품 분석</li>
            <li className="text-zinc-500">4. 상세페이지</li>
          </ol>
          <ProductForm projectId={result.project.id} initialValues={result.values} revision={result.product?.updatedAt ?? ""} />
        </>
      )}
    </div>
  );
}

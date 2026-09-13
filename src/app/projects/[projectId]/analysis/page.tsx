import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectLoadError } from "@/features/projects/components/project-load-error";
import { ProductAnalysisManager } from "@/features/product-analysis/components/analysis-manager";
import { getProductAnalysisView } from "@/features/product-analysis/service";
import { ProductAnalysisError } from "@/features/product-analysis/errors";

export const metadata: Metadata = { title: "상품 분석" };
export default async function ProductAnalysisPage({ params }: PageProps<"/projects/[projectId]/analysis">) {
  await connection();
  const { projectId } = await params;
  const result = await getProductAnalysisView(projectId).then((view) => ({ ok: true as const, view })).catch((error: unknown) => ({ ok: false as const,
    error: error instanceof ProductAnalysisError ? error : new ProductAnalysisError("unexpected") }));
  if (!result.ok && result.error.code === "not_found") notFound();
  return <div className="page-content">
    <Link href={`/projects/${projectId}/images`} className="text-link">← 이미지</Link>
    <PageHeader title="상품 분석" description={result.ok ? `${result.view.projectName} · 상품: ${result.view.productName}` : "상품정보를 바탕으로 상세페이지의 설명 방향을 준비합니다."} />
    <ol aria-label="상세페이지 제작 단계" className="flex flex-wrap gap-x-6 gap-y-3 border-b border-zinc-200 pb-5 text-sm">
      <li><Link href={`/projects/${projectId}`} className="text-link">1. 상품정보</Link></li>
      <li><Link href={`/projects/${projectId}/images`} className="text-link">2. 이미지</Link></li>
      <li aria-current="step" className="font-semibold">3. 상품 분석</li><li className="text-zinc-500">4. 상세페이지</li>
    </ol>
    {result.ok ? <ProductAnalysisManager initialView={result.view} />
      : result.error.code === "product_required" || result.error.code === "facts_required" ? <section className="panel space-y-4 p-8">
        <h2 className="text-lg font-semibold">상품정보가 필요합니다</h2><p className="text-sm text-zinc-600">{result.error.message}</p>
        <Link href={`/projects/${projectId}`} className="button-primary">상품정보 입력</Link></section>
        : <ProjectLoadError message={result.error.message} retryHref={`/projects/${projectId}/analysis`} />}
  </div>;
}

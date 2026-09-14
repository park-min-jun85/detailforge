import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectLoadError } from "@/features/projects/components/project-load-error";
import { ValidationManager } from "@/features/fact-validation/components/validation-manager";
import { getValidationView } from "@/features/fact-validation/service";
import { FactValidationError } from "@/features/fact-validation/errors";

export const metadata: Metadata = { title: "Fact 검증" };
export default async function FactValidationPage({ params }: PageProps<"/projects/[projectId]/validation">) {
  await connection();
  const { projectId } = await params;
  const result = await getValidationView(projectId).then((view) => ({ ok: true as const, view })).catch((error: unknown) => ({ ok: false as const,
    error: error instanceof FactValidationError ? error : new FactValidationError("unexpected") }));
  if (!result.ok && result.error.code === "not_found") notFound();
  return <div className="page-content">
    <Link href={`/projects/${projectId}/analysis`} className="text-link">← 상품 분석</Link>
    <PageHeader title="Fact 검증" description={result.ok ? `${result.view.projectName} · 상품: ${result.view.productName}` : "기존 Fact와 입력된 근거의 일관성을 확인합니다."} />
    <ol aria-label="상세페이지 제작 단계" className="flex flex-wrap gap-x-6 gap-y-3 border-b border-zinc-200 pb-5 text-sm">
      <li><Link href={`/projects/${projectId}`} className="text-link">1. 상품정보</Link></li>
      <li><Link href={`/projects/${projectId}/images`} className="text-link">2. 이미지</Link></li>
      <li><Link href={`/projects/${projectId}/analysis`} className="text-link">3. 상품 분석</Link></li><li aria-current="step" className="font-semibold">4. Fact 검증</li><li className="text-zinc-500">5. 상세페이지</li>
    </ol>
    {result.ok ? <ValidationManager initialView={result.view} />
      : result.error.code === "product_required" || result.error.code === "facts_required" ? <section className="panel space-y-4 p-8">
        <h2 className="text-lg font-semibold">상품정보가 필요합니다</h2><p className="text-sm text-zinc-600">{result.error.message}</p>
        <Link href={`/projects/${projectId}`} className="button-primary">상품정보 입력</Link></section>
        : <ProjectLoadError message={result.error.message} retryHref={`/projects/${projectId}/validation`} />}
  </div>;
}

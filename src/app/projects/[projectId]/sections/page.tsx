import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectLoadError } from "@/features/projects/components/project-load-error";
import { SectionManager } from "@/features/section-engine/components/section-manager";
import { getSectionView } from "@/features/section-engine/service";
import { SectionEngineError } from "@/features/section-engine/errors";
export const metadata: Metadata = { title: "상세페이지 생성" };
export default async function SectionGenerationPage({ params }: PageProps<"/projects/[projectId]/sections">) {
  await connection(); const { projectId } = await params;
  const result = await getSectionView(projectId).then((view) => ({ ok: true as const, view })).catch((error: unknown) => ({ ok: false as const, error: error instanceof SectionEngineError ? error : new SectionEngineError("unexpected") }));
  if (!result.ok && result.error.code === "not_found") notFound();
  return <div className="page-content">
    <Link href={`/projects/${projectId}/planner`} className="text-link">← 페이지 설계</Link>
    <PageHeader title="상세페이지 생성" description={result.ok ? `${result.view.projectName} · 상품: ${result.view.productName}` : "최신 설계에 맞춰 Section 콘텐츠를 생성합니다."} />
    <ol aria-label="상세페이지 제작 단계" className="flex flex-wrap gap-x-6 gap-y-3 border-b border-zinc-200 pb-5 text-sm">
      <li><Link href={`/projects/${projectId}`} className="text-link">1. 상품정보</Link></li><li><Link href={`/projects/${projectId}/images`} className="text-link">2. 이미지</Link></li>
      <li><Link href={`/projects/${projectId}/analysis`} className="text-link">3. 상품 분석</Link></li><li><Link href={`/projects/${projectId}/validation`} className="text-link">4. 사실 검증</Link></li>
      <li><Link href={`/projects/${projectId}/planner`} className="text-link">5. 페이지 설계</Link></li><li aria-current="step" className="font-semibold">6. 상세페이지</li>
    </ol>
    {result.ok ? <SectionManager initialView={result.view} /> : result.error.code === "plan_required" ? <section className="panel space-y-4 p-8">
      <h2 className="text-lg font-semibold">최신 페이지 설계가 필요합니다</h2><p className="text-sm text-zinc-600">{result.error.message}</p><Link href={`/projects/${projectId}/planner`} className="button-primary">페이지 설계 확인</Link></section>
      : <ProjectLoadError message={result.error.message} retryHref={`/projects/${projectId}/sections`} />}
  </div>;
}

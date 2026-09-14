import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectLoadError } from "@/features/projects/components/project-load-error";
import { PlannerManager } from "@/features/page-planner/components/planner-manager";
import { getPlannerView } from "@/features/page-planner/service";
import { PlannerError } from "@/features/page-planner/errors";
export const metadata: Metadata = { title: "페이지 설계" };
export default async function PlannerPage({ params }: PageProps<"/projects/[projectId]/planner">) {
  await connection(); const { projectId } = await params;
  const result = await getPlannerView(projectId).then((view) => ({ ok: true as const, view })).catch((error: unknown) => ({ ok: false as const, error: error instanceof PlannerError ? error : new PlannerError("unexpected") }));
  if (!result.ok && result.error.code === "not_found") notFound();
  return <div className="page-content">
    <Link href={`/projects/${projectId}/validation`} className="text-link">← 사실 검증</Link>
    <PageHeader title="페이지 설계" description={result.ok ? `${result.view.projectName} · 상품: ${result.view.productName}` : "상세페이지의 구조와 사용할 근거를 설계합니다."} />
    <ol aria-label="상세페이지 제작 단계" className="flex flex-wrap gap-x-6 gap-y-3 border-b border-zinc-200 pb-5 text-sm">
      <li><Link href={`/projects/${projectId}`} className="text-link">1. 상품정보</Link></li><li><Link href={`/projects/${projectId}/images`} className="text-link">2. 이미지</Link></li>
      <li><Link href={`/projects/${projectId}/analysis`} className="text-link">3. 상품 분석</Link></li><li><Link href={`/projects/${projectId}/validation`} className="text-link">4. 사실 검증</Link></li>
      <li aria-current="step" className="font-semibold">5. 페이지 설계</li><li><Link href={`/projects/${projectId}/sections`} className="text-link">6. 상세페이지</Link></li>
    </ol>
    {result.ok ? <><PlannerManager initialView={result.view} /><div className="flex justify-end"><Link href={`/projects/${projectId}/sections`} className="button-primary">다음: 상세페이지 생성 →</Link></div></> : result.error.code === "product_required" || result.error.code === "facts_required" ? <section className="panel space-y-4 p-8">
      <h2 className="text-lg font-semibold">상품정보가 필요합니다</h2><p className="text-sm text-zinc-600">{result.error.message}</p><Link href={`/projects/${projectId}`} className="button-primary">상품정보 입력</Link></section>
      : <ProjectLoadError message={result.error.message} retryHref={`/projects/${projectId}/planner`} />}
  </div>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectLoadError } from "@/features/projects/components/project-load-error";
import { AssetManager } from "@/features/assets/components/asset-manager";
import { getAssetContext, listAssets } from "@/features/assets/service";
import { AssetError } from "@/features/assets/schemas";

export const metadata: Metadata = { title: "제품 이미지" };

export default async function ProductImagesPage({ params }: PageProps<"/projects/[projectId]/images">) {
  await connection();
  const { projectId } = await params;
  const result = await (async () => {
    try {
      const context = await getAssetContext(projectId);
      const list = context.product ? await listAssets(projectId) : null;
      return { status: "ready" as const, context, list };
    } catch (error) {
      if (error instanceof AssetError && error.status === 404) return { status: "not-found" as const };
      return { status: "error" as const };
    }
  })();
  if (result.status === "not-found") notFound();

  return <div className="page-content">
    <Link href={`/projects/${projectId}`} className="text-link">← 상품정보</Link>
    {result.status === "error" ? <>
      <PageHeader title="제품 이미지" />
      <ProjectLoadError message="이미지 정보를 불러오지 못했습니다. 다시 시도해 주세요." retryHref={`/projects/${projectId}/images`} />
    </> : <>
      <PageHeader title={result.context.project.name} description={result.context.product ? `상품: ${result.context.product.name}` : "먼저 상품정보를 저장해 주세요."} />
      <ol aria-label="상세페이지 제작 단계" className="flex flex-wrap gap-x-6 gap-y-3 border-b border-zinc-200 pb-5 text-sm">
        <li><Link href={`/projects/${projectId}`} className="text-link">1. 상품정보</Link></li>
        <li aria-current="step" className="font-semibold text-zinc-950">2. 이미지</li>
        <li className="text-zinc-500">3. 상품 분석</li><li className="text-zinc-500">4. Fact 검증</li><li className="text-zinc-500">5. 상세페이지</li>
      </ol>
      {result.list ? <><AssetManager projectId={result.context.project.id} initialList={result.list} />
        <div className="flex justify-end"><Link href={`/projects/${projectId}/analysis`} className="button-primary">다음: 상품 분석 →</Link></div></> :
        <section className="panel space-y-4 p-8">
          <h2 className="text-lg font-semibold">상품정보가 필요합니다</h2>
          <p className="text-sm text-zinc-500">이미지를 등록하려면 먼저 상품정보를 저장해 주세요.</p>
          <Link href={`/projects/${projectId}`} className="button-primary">상품정보 입력</Link>
        </section>}
    </>}
  </div>;
}

import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getRenderView } from "@/features/detail-renderer/service";
import { RenderError } from "@/features/detail-renderer/errors";
import { RenderReview } from "@/features/detail-renderer/review";
import { ProjectLoadError } from "@/features/projects/components/project-load-error";
export const metadata: Metadata = { title: "최종 미리보기", robots: { index: false, follow: false } };
export default async function RenderPage({ params }: PageProps<"/projects/[projectId]/render">) {
  await connection();
  const { projectId } = await params;
  const result = await getRenderView(projectId).then(view => ({ ok: true as const, view })).catch((error: unknown) => ({ ok: false as const, error: error instanceof RenderError ? error : new RenderError("unavailable") }));
  if (!result.ok && result.error.code === "not_found") notFound();
  return result.ok ? <RenderReview view={result.view} /> : <div className="page-content"><ProjectLoadError message={result.error.message} retryHref={`/projects/${projectId}/render`} /></div>;
}

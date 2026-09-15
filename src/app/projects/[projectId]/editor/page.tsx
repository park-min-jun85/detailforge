import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { DetailEditor } from "@/features/detail-editor/components/editor";
import { getEditorView } from "@/features/detail-editor/service";
import { EditorError } from "@/features/detail-editor/errors";
import { ProjectLoadError } from "@/features/projects/components/project-load-error";
export const metadata: Metadata = { title: "상세페이지 편집" };
export default async function EditorPage({ params }: PageProps<"/projects/[projectId]/editor">) {
  await connection(); const { projectId } = await params;
  const result = await getEditorView(projectId).then(view => ({ ok: true as const, view })).catch((error: unknown) => ({ ok: false as const, error: error instanceof EditorError ? error : new EditorError("unexpected") }));
  if (!result.ok && result.error.code === "not_found") notFound();
  return result.ok ? <DetailEditor initialView={result.view} /> : <div className="page-content"><ProjectLoadError message={result.error.message} retryHref={`/projects/${projectId}/editor`} /></div>;
}

import { compareSectionOptions, applySectionOptions } from "@/features/detail-editor/option-application";
import { editorResponse, readEditRequest } from "@/features/detail-editor/http";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: RouteContext<"/api/projects/[projectId]/sections/[sectionId]/options">) {
  return editorResponse(async () => { const { projectId, sectionId } = await params; return compareSectionOptions(projectId, sectionId); });
}
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[projectId]/sections/[sectionId]/options">) {
  return editorResponse(async () => { const { projectId, sectionId } = await params; return applySectionOptions(projectId, sectionId, await readEditRequest(request)); });
}

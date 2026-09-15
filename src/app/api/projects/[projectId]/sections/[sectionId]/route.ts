import { saveSection } from "@/features/detail-editor/service";
import { editorResponse, readEditRequest } from "@/features/detail-editor/http";
export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: RouteContext<"/api/projects/[projectId]/sections/[sectionId]">) {
  return editorResponse(async () => { const { projectId, sectionId } = await params; return saveSection(projectId, sectionId, await readEditRequest(request)); });
}

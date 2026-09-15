import { getEditorView } from "@/features/detail-editor/service";
import { editorResponse } from "@/features/detail-editor/http";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: RouteContext<"/api/projects/[projectId]/editor">) {
  return editorResponse(() => params.then(({ projectId }) => getEditorView(projectId)));
}

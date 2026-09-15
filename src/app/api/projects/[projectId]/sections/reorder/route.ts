import { reorderSections } from "@/features/section-reorder/service";
import { reorderResponse } from "@/features/section-reorder/http";
import { readEditRequest } from "@/features/detail-editor/http";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function PATCH(request: Request, { params }: RouteContext<"/api/projects/[projectId]/sections/reorder">) {
  return reorderResponse(async () => reorderSections((await params).projectId, await readEditRequest(request)));
}

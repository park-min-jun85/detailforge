import { applySectionCandidate } from "@/features/section-regeneration/service";
import { regenerationResponse } from "@/features/section-regeneration/http";
import { readEditRequest } from "@/features/detail-editor/http";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[projectId]/sections/[sectionId]/apply-candidate">) {
  return regenerationResponse(async () => { const { projectId, sectionId } = await params; return applySectionCandidate(projectId, sectionId, await readEditRequest(request, 180000)); });
}

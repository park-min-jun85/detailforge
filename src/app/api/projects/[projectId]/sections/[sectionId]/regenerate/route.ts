import { regenerateSection } from "@/features/section-regeneration/service";
import { regenerationResponse } from "@/features/section-regeneration/http";
import { readEditRequest } from "@/features/detail-editor/http";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[projectId]/sections/[sectionId]/regenerate">) {
  return regenerationResponse(async () => { const { projectId, sectionId } = await params; return regenerateSection(projectId, sectionId, await readEditRequest(request, 2048)); });
}

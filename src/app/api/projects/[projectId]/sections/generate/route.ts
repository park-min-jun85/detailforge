import { generateSections } from "@/features/section-engine/service";
import { sectionResponse, readGenerationRequest } from "@/features/section-engine/http";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[projectId]/sections/generate">) {
  return sectionResponse(async () => generateSections((await params).projectId, await readGenerationRequest(request)));
}

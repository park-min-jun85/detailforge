import { getSectionView } from "@/features/section-engine/service";
import { sectionResponse } from "@/features/section-engine/http";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: RouteContext<"/api/projects/[projectId]/sections">) {
  return sectionResponse(() => params.then(({ projectId }) => getSectionView(projectId)));
}

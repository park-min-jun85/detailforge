import { extractionResponse } from "@/features/detail-extraction/http";
import { saveProductShots } from "@/features/detail-extraction/service";
export const runtime = "nodejs";
export const maxDuration = 360;
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[projectId]/assets/[assetId]/extract-product-shots/save">) {
  return extractionResponse(request, async body => {
    const { projectId, assetId } = await params;
    return saveProductShots(projectId, assetId, body);
  });
}

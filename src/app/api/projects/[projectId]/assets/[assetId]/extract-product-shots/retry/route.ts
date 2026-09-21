import { extractionResponse } from "@/features/detail-extraction/http";
import { retryProductShots } from "@/features/detail-extraction/retry";

export const runtime = "nodejs";
export const maxDuration = 360;
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[projectId]/assets/[assetId]/extract-product-shots/retry">) {
  return extractionResponse(request, async body => {
    const { projectId, assetId } = await params;
    return retryProductShots(projectId, assetId, body);
  });
}

import { extractionResponse } from "@/features/detail-extraction/http";
import { analyzeProductShots } from "@/features/detail-extraction/service";
import { analyzeRequestSchema } from "@/features/detail-extraction/schemas";
import { ExtractionError } from "@/features/detail-extraction/errors";
export const runtime = "nodejs";
export const maxDuration = 360;
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[projectId]/assets/[assetId]/extract-product-shots">) {
  return extractionResponse(request, async body => {
    const parsed = analyzeRequestSchema.safeParse(body); if (!parsed.success) throw new ExtractionError("invalid_input");
    const { projectId, assetId } = await params;
    return analyzeProductShots(projectId, assetId, parsed.data.force);
  });
}

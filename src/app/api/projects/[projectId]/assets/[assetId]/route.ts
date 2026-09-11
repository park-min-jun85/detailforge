import { assetResponse, assertSameOrigin } from "@/features/assets/http";
import { deleteAsset } from "@/features/assets/service";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: RouteContext<"/api/projects/[projectId]/assets/[assetId]">) {
  return assetResponse(async () => {
    assertSameOrigin(request);
    const { projectId, assetId } = await params;
    return deleteAsset(projectId, assetId);
  });
}

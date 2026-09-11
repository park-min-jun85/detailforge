import { assetResponse, assertSameOrigin, readImageBody } from "@/features/assets/http";
import { getAssetContext, listAssets, uploadAsset } from "@/features/assets/service";
import { AssetError } from "@/features/assets/schemas";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: RouteContext<"/api/projects/[projectId]/assets">) {
  return assetResponse(async () => listAssets((await params).projectId));
}

export async function POST(request: Request, { params }: RouteContext<"/api/projects/[projectId]/assets">) {
  return assetResponse(async () => {
    assertSameOrigin(request);
    const { projectId } = await params;
    if (!(await getAssetContext(projectId)).product) throw new AssetError(409, "먼저 상품정보를 저장해 주세요.");
    return { asset: await uploadAsset(projectId, await readImageBody(request)) };
  }, 201);
}

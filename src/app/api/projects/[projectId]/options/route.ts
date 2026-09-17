import { getProductOptions } from "@/features/product-options/queries";
import { saveProductOptions } from "@/features/product-options/persistence";
import { optionResponse, readOptionRequest } from "@/features/product-options/http";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return optionResponse(async () => getProductOptions((await params).projectId));
}
export async function PUT(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return optionResponse(async () => saveProductOptions((await params).projectId, await readOptionRequest(request)));
}

import { optionResponse, readOptionRequest } from "@/features/product-options/http";
import { prepareImportedOptions } from "@/features/product-options/import-service";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return optionResponse(async () => prepareImportedOptions((await params).projectId, await readOptionRequest(request)));
}

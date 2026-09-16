import { handleExport } from "@/features/detail-export/http";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return handleExport(request, (await params).projectId);
}

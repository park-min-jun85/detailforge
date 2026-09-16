import { importImage } from "@/features/wholesale-import/service";
import { importResponse, readImportRequest } from "@/features/wholesale-import/http";
import { revalidatePath } from "next/cache";
export const runtime="nodejs";
export const maxDuration=90;
export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){return importResponse(async()=>{const {projectId}=await params;const result=await importImage(projectId,await readImportRequest(request));revalidatePath(`/projects/${projectId}/images`);return result;});}

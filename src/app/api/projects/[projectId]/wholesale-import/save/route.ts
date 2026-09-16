import { saveImport } from "@/features/wholesale-import/service";
import { importResponse, readImportRequest } from "@/features/wholesale-import/http";
import { revalidatePath } from "next/cache";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){return importResponse(async()=>{const {projectId}=await params;const result=await saveImport(projectId,await readImportRequest(request));if(result.status!=="error")revalidatePath(`/projects/${projectId}`);return result;});}

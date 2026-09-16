import "server-only";
import { readEditRequest } from "@/features/detail-editor/http";
import { AssetError } from "@/features/assets/schemas";
import { ImportError } from "./errors";
export const importHeaders={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
export async function importResponse(operation:()=>Promise<unknown>){try{return Response.json({ok:true,data:await operation()},{headers:importHeaders});}catch(error){const safe=error instanceof ImportError?error:new ImportError(error instanceof AssetError?(error.status===415?"unsupported":error.status===413?"too_large":error.status===409&&error.message.includes("30")?"asset_limit":"image_failed"):"unavailable");return Response.json({ok:false,code:safe.code,message:safe.message},{status:safe.status,headers:importHeaders});}}
export async function readImportRequest(request:Request){try{return await readEditRequest(request,128000);}catch{throw new ImportError("invalid_input");}}

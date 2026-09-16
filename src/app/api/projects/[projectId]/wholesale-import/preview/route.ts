import { previewImport, previewImage } from "@/features/wholesale-import/service";
import { importResponse, importHeaders, readImportRequest } from "@/features/wholesale-import/http";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){return importResponse(async()=>previewImport((await params).projectId,await readImportRequest(request)));}
export async function GET(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const query=new URL(request.url).searchParams;let response:Response|undefined;
  const error=await importResponse(async()=>{const result=await previewImage((await params).projectId,query.get("token")??"",Number(query.get("image")));response=new Response(new Uint8Array(result.bytes),{headers:{...importHeaders,"Content-Type":result.mime,"Content-Security-Policy":"default-src 'none'; sandbox"}});return null;});
  return response??error;
}

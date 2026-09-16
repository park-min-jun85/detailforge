import { importMessages } from "./errors";
import type { ProductSaveState } from "@/features/products/types";
export async function importRequest<T>(projectId:string,operation:"preview"|"save"|"images",input:unknown):Promise<T>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),operation==="preview"?55000:90000);
  try{const response=await fetch(`/api/projects/${projectId}/wholesale-import/${operation}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input),signal:controller.signal});const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok)throw new Error(payload?.code&&Object.hasOwn(importMessages,payload.code)?importMessages[payload.code as keyof typeof importMessages]:importMessages.unavailable);return payload.data as T;
  }catch(error){throw new Error(controller.signal.aborted?importMessages.timeout:error instanceof Error&&Object.values(importMessages).some(message=>message===error.message)?error.message:importMessages.unavailable);}
  finally{clearTimeout(timer);}
}
export async function saveConfirmedImport(projectId:string,input:{token:string;revision:unknown;values:unknown;selectedImageUrls:string[]},onProgress:(results:string[])=>void):Promise<ProductSaveState>{
  const result=await importRequest<ProductSaveState>(projectId,"save",input);
  if(result.status!=="success")return result;
  onProgress([]);let success=0;const messages:string[]=[];
  for(const [index,url] of [...new Set(input.selectedImageUrls)].entries()){
    try{const image=await importRequest<{status:"imported"|"skipped"}>(projectId,"images",{token:input.token,url});success++;messages.push(`이미지 ${index+1}: ${image.status==="skipped"?"이미 등록됨":"가져오기 완료"}`);}
    catch(error){messages.push(`이미지 ${index+1}: ${error instanceof Error?error.message:importMessages.unavailable}`);}
    onProgress([...messages]);
  }
  return {...result,message:`상품정보를 저장했습니다. 이미지 ${messages.length}장 중 ${success}장을 가져왔습니다.${success<messages.length?" 일부 이미지 실패 — 아래 결과를 확인해 주세요.":""}`};
}

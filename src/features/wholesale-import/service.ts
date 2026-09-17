import "server-only";
import { z } from "zod";
import { getAssetContext, uploadAsset } from "@/features/assets/service";
import { normalizeFilename, assetRowSchema, assertAssetScope, MAX_PRODUCT_ASSETS } from "@/features/assets/schemas";
import { saveProductInformation } from "@/features/products/persistence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchResource, decodeHtml } from "./fetcher";
import { renderedHtml } from "./browser";
import { resolveAdapter } from "./adapters/generic";
import { sufficient } from "./extractor";
import { importSaveSchema, previewRequestSchema } from "./schemas";
import { ImportError } from "./errors";
import { importExclusive, issueTicket, readTicket, thumbnailSlot } from "./tickets";
import { validateRemoteImage } from "./remote-image";
export async function previewImport(projectId:string,input:unknown,dependencies:{fetch?:typeof fetchResource;render?:typeof renderedHtml}={}) {
  const parsed=previewRequestSchema.safeParse(input);if(!parsed.success)throw new ImportError("invalid_url");
  await getAssetContext(projectId);
  return importExclusive(`preview:${projectId}`,async()=>{
    const signal=AbortSignal.timeout(45000),resource=await (dependencies.fetch??fetchResource)(parsed.data.url,"html",{signal});
    const adapter=resolveAdapter(new URL(resource.url)),html=decodeHtml(resource);let candidate=adapter.extract(html,resource.url);
    if(!sufficient(candidate)){
      if(!/<script\b/i.test(html))throw new ImportError("not_found");
      candidate=adapter.extract(await (dependencies.render??renderedHtml)(resource.url,signal),resource.url,true);
      if(!sufficient(candidate))throw new ImportError("browser_empty");
    }
    return {candidate,token:issueTicket(projectId,candidate)};
  });
}
export async function saveImport(projectId:string,input:unknown) {
  const parsed=importSaveSchema.safeParse(input);if(!parsed.success)throw new ImportError("invalid_input");
  return importExclusive(`save:${projectId}`,async()=>{
    const {token,values,revision}=parsed.data,ticket=readTicket(projectId,token),candidate=ticket.candidate;
    const urls=[...new Set(parsed.data.selectedImageUrls)];if(urls.some(url=>!candidate.images.some(image=>image.url===url)))throw new ImportError("invalid_input");
    const result=await saveProductInformation(projectId,revision,{...values,sourceUrl:candidate.sourceUrl},{sourceUrl:candidate.sourceUrl,sourceHost:candidate.sourceHost,fetchedAt:candidate.fetchedAt,importedAt:new Date().toISOString(),extractionMethod:candidate.extractionMethod,importedImageUrls:urls,extracted:candidate.product});
    if(result.status==="success"){
      const context=await getAssetContext(projectId);if(!context.product)throw new ImportError("conflict");
      ticket.saved={productId:context.product.id,urls};
    }
    return result;
  });
}
export async function loadRemoteImage(url:string,signal?:AbortSignal,fetcher=fetchResource){const result=await fetcher(url,"image",{signal});const mime=validateRemoteImage(result.mime,result.bytes);return {...result,mime};}
export async function previewImage(projectId:string,token:string,index:number){
  const ticket=readTicket(projectId,token);if(!Number.isInteger(index)||!ticket.candidate.images[index])throw new ImportError("invalid_input");
  return thumbnailSlot(()=>loadRemoteImage(ticket.candidate.images[index].url));
}
export function remoteFilename(url:string,mime:string){try{return normalizeFilename(decodeURIComponent(new URL(url).pathname.split("/").at(-1)??"").replace(/[<>:"|?*]/g,""));}catch{return `imported-image.${mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg"}`;}}
export async function importImage(projectId:string,input:unknown,fetcher=fetchResource){
  const parsed=z.object({token:z.uuid(),url:z.string().max(2048)}).strict().safeParse(input);if(!parsed.success)throw new ImportError("invalid_input");
  return importExclusive(`images:${projectId}`,async()=>{
    const ticket=readTicket(projectId,parsed.data.token);if(!ticket.saved||!ticket.saved.urls.includes(parsed.data.url))throw new ImportError("invalid_input");
    const context=await getAssetContext(projectId);if(context.product?.id!==ticket.saved.productId)throw new ImportError("conflict");
    const client=createSupabaseServerClient(),existing=await client.from("assets").select("*").eq("project_id",projectId).eq("product_id",ticket.saved.productId).abortSignal(AbortSignal.timeout(10000));
    if(existing.error)throw new ImportError("unavailable");
    const assets=existing.data.map(row=>assetRowSchema.parse(row));assets.forEach(asset=>assertAssetScope(asset,projectId,ticket.saved!.productId));
    const found=assets.find(asset=>{const source=asset.metadata.source;return source&&typeof source==="object"&&"url" in source&&source.url===parsed.data.url;});
    if(found)return {status:"skipped" as const,assetId:found.id};
    if(assets.length>=MAX_PRODUCT_ASSETS)throw new ImportError("asset_limit");
    const image=await loadRemoteImage(parsed.data.url,AbortSignal.timeout(15000),fetcher);
    const asset=await uploadAsset(projectId,{name:remoteFilename(image.url,image.mime),mime:image.mime,bytes:image.bytes},{expectedProductId:ticket.saved.productId,source:{type:"wholesale_url",url:parsed.data.url,pageUrl:ticket.candidate.sourceUrl,importedAt:new Date().toISOString()}});
    return {status:"imported" as const,assetId:asset.id};
  });
}

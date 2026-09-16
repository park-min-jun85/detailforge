import "server-only";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { resolvePublic, type Resolver } from "./security";
import { ImportError } from "./errors";
export type ResourceKind = "html" | "image" | "script" | "style" | "json";
export type FetchedResource = { url: string; mime: string; bytes: Buffer; charset?: string };
export const RESOURCE_LIMITS = {html:2*1024*1024,image:10*1024*1024,script:1024*1024,style:512*1024,json:512*1024};
export function acceptsMime(kind: ResourceKind, mime: string) {
  return kind === "html" ? ["text/html","application/xhtml+xml"].includes(mime) : kind === "image" ? ["image/png","image/jpeg","image/webp"].includes(mime) : kind === "script" ? /^(text|application)\/(javascript|x-javascript|ecmascript)$/.test(mime) : kind === "style" ? mime === "text/css" : mime === "application/json";
}
export type Transport = (target: Awaited<ReturnType<typeof resolvePublic>>, signal: AbortSignal) => Promise<IncomingMessage>;
export const pinnedTransport: Transport = ({url,address},signal) => new Promise((resolve,reject) => {
  // Connect to the already checked IP while preserving HTTP Host and TLS SNI/certificate checks.
  const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url,{method:"GET",signal,agent:false,
    lookup: (_host,_options,callback) => callback(null,address.address,address.family), family:address.family,
    headers:{"User-Agent":"DetailForge-ProductImport/1.0","Accept":"text/html,application/json,image/png,image/jpeg,image/webp,text/css,application/javascript;q=0.8","Accept-Encoding":"identity"}},resolve);
  request.on("error",reject);request.end();
});
export async function fetchResource(value: string, kind: ResourceKind, options: {signal?: AbortSignal; resolver?: Resolver; transport?: Transport} = {}): Promise<FetchedResource> {
  const signal=AbortSignal.any([AbortSignal.timeout(15000),...(options.signal?[options.signal]:[])]),limit=RESOURCE_LIMITS[kind];let next=value;
  try {
    for(let redirects=0;redirects<=5;redirects++) {
      if(signal.aborted) throw new ImportError("timeout");
      const target=await resolvePublic(next,options.resolver), response=await (options.transport??pinnedTransport)(target,signal);
      const status=response.statusCode??0;
      if([301,302,303,307,308].includes(status)) {const location=response.headers.location;response.destroy();if(!location||redirects===5)throw new ImportError("blocked");next=new URL(location,target.url).href;continue;}
      if([401,403,407,429].includes(status)){response.destroy();throw new ImportError("restricted");}
      if(status<200||status>=300){response.destroy();throw new ImportError("unavailable");}
      const mime=(response.headers["content-type"]??"").split(";")[0].trim().toLowerCase();
      if(!acceptsMime(kind,mime)){response.destroy();throw new ImportError("unsupported");}
      if(Number(response.headers["content-length"])>limit){response.destroy();throw new ImportError("too_large");}
      const encoding=response.headers["content-encoding"]?.toLowerCase();
      const decoder=encoding==="gzip"?createGunzip():encoding==="br"?createBrotliDecompress():encoding==="deflate"?createInflate():null;
      if(encoding&&encoding!=="identity"&&!decoder){response.destroy();throw new ImportError("unsupported");}
      let wire=0,size=0;const chunks:Buffer[]=[];
      response.on("data",chunk=>{wire+=chunk.length;if(wire>limit)response.destroy(new ImportError("too_large"));});
      if(decoder) response.on("error",error=>decoder.destroy(error));
      const stream=decoder?response.pipe(decoder):response;
      try { for await(const chunk of stream){size+=chunk.length;if(size>limit)throw new ImportError("too_large");chunks.push(Buffer.from(chunk));} }
      finally {response.destroy();decoder?.destroy();}
      return {url:target.url.href,mime,bytes:Buffer.concat(chunks),charset:response.headers["content-type"]?.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1]};
    }
    throw new ImportError("blocked");
  } catch(error){if(signal.aborted)throw new ImportError("timeout");throw error instanceof ImportError?error:new ImportError("unavailable");}
}
export function decodeHtml(resource:FetchedResource){
  const charset=resource.charset??resource.bytes.subarray(0,4096).toString("latin1").match(/<meta\b[^>]*charset\s*=\s*["']?([^\s;"'/>]+)/i)?.[1]??"utf-8";
  try{return new TextDecoder(charset).decode(resource.bytes);}catch{throw new ImportError("unsupported");}
}

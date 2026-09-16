"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { importRequest } from "../client";
import { importMessages } from "../errors";
import { candidateSchema, type ImportCandidate } from "../schemas";
export type ImportPreview={token:string;candidate:ImportCandidate};
function ImageCandidate({src,alt}:{src:string;alt:string}){const [failed,setFailed]=useState(false);return failed?<p className="flex h-32 items-center justify-center bg-zinc-100 text-xs text-zinc-500">미리보기를 불러오지 못했습니다.</p>:<Image unoptimized src={src} width={220} height={128} alt={alt} loading="lazy" onError={()=>setFailed(true)} className="h-32 w-full bg-zinc-50 object-contain"/>;}
export function ImportPanel({projectId,disabled,preview,selected,onReady,onSelection,onDiscard,onBusy}:{projectId:string;disabled:boolean;preview:ImportPreview|null;selected:string[];onReady:(value:ImportPreview)=>void;onSelection:(urls:string[])=>void;onDiscard:()=>void;onBusy:(value:boolean)=>void}){
  const [url,setUrl]=useState(""),[loading,setLoading]=useState(false),[error,setError]=useState("");const active=useRef(false);
  async function load(){if(active.current||disabled)return;active.current=true;setLoading(true);onBusy(true);setError("");
    try{const result=await importRequest<ImportPreview>(projectId,"preview",{url});onReady({token:result.token,candidate:candidateSchema.parse(result.candidate)});}catch(error){setError(error instanceof Error&&Object.values(importMessages).some(message=>message===error.message)?error.message:importMessages.unavailable);}finally{active.current=false;setLoading(false);onBusy(false);}}
  return <section className="panel space-y-4 p-6 sm:p-8" aria-label="상품정보 가져오기">
    <h2 className="text-lg font-semibold">상품정보 가져오기</h2><p className="text-sm text-zinc-600">가져온 정보는 저장 전에 직접 확인할 수 있습니다. 불러오면 아래 입력란에 후보를 채웁니다. 수동 입력도 계속 사용할 수 있습니다.</p>
    <label className="block text-sm font-medium" htmlFor="wholesale-url">도매사이트 상품 URL</label>
    <div className="flex flex-wrap gap-3"><input id="wholesale-url" type="url" maxLength={2048} value={url} disabled={disabled||loading} onChange={event=>setUrl(event.target.value)} placeholder="https://…" className="product-input min-w-0 flex-1"/><button type="button" disabled={disabled||loading||!url.trim()} className="button-secondary" onClick={load}>{loading?"불러오는 중…":"상품정보 불러오기"}</button></div>
    {loading&&<p role="status" className="text-sm text-zinc-600">공개 상품 페이지를 확인하고 있습니다.</p>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {preview&&<div className="space-y-4 border-t border-zinc-200 pt-4"><h3 className="font-semibold">Import Preview · 아직 저장되지 않았습니다</h3><p className="break-words text-sm text-zinc-600">{preview.candidate.sourceHost} · {preview.candidate.extractionMethod} · 스펙 {preview.candidate.product.specifications.length}개 자동 추출</p>
      {preview.candidate.warnings.map((warning,index)=><p key={index} className="text-sm text-amber-900">{warning}</p>)}
      <p className="text-sm">아래 상품명·브랜드·설명·스펙은 자동 추출 후보입니다. 수정한 뒤 ‘확인한 정보로 저장’을 눌러 주세요.</p>
      <fieldset disabled={disabled||loading}><legend className="mb-3 text-sm font-medium">가져올 이미지 {selected.length}/{preview.candidate.images.length}개 · 상품당 최대 30개</legend><div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {preview.candidate.images.map((image,index)=><label key={image.url} className="overflow-hidden rounded border border-zinc-200"><ImageCandidate key={preview.token+index} src={`/api/projects/${projectId}/wholesale-import/preview?token=${preview.token}&image=${index}`} alt={image.alt??`이미지 후보 ${index+1}`}/><span className="flex items-center gap-2 p-3 text-sm"><input type="checkbox" checked={selected.includes(image.url)} onChange={event=>onSelection(event.target.checked?[...selected,image.url]:selected.filter(url=>url!==image.url))}/>이미지 {index+1} 사용</span></label>)}
      </div></fieldset><button type="button" className="text-link" disabled={disabled||loading} onClick={onDiscard}>가져오기 취소 · 이전 입력 복원</button>
    </div>}
  </section>;
}

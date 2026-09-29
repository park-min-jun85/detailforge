"use client";
import { useEffect, useState } from "react";
import { RenderSurface } from "@/features/detail-renderer/surface";
import type { ExportSnapshot } from "../types";
export function ExportCaptureSurface() {
  const [snapshot,setSnapshot]=useState<ExportSnapshot | null>(null);
  useEffect(()=>{
    let active=true;
    // Only the server-side Chromium interceptor supplies the one-use capability.
    // It never appears in client JS, the URL, browser cookies, or browser storage.
    void fetch("/export-capture/data",{method:"POST",credentials:"omit",cache:"no-store",redirect:"error"})
      .then(async response=>{if(!response.ok)throw Error();return response.json() as Promise<ExportSnapshot>;})
      .then(value=>{if(active)setSnapshot(value);}).catch(()=>{});
    return ()=>{active=false;};
  },[]);
  return snapshot ? <RenderSurface {...snapshot} /> : <p>출력 준비 중</p>;
}

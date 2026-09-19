"use client";
import Image from "next/image";
import { useState } from "react";
import type { RenderAsset } from "./model";
import styles from "./renderer.module.css";
import { imageSizing, heroImageSizing } from "@/features/page-quality/images";
export function RenderImage({ asset, type = "default" }: { asset?: RenderAsset; type?: string }) {
  const [failed, setFailed] = useState(false);
  const [natural, setNatural] = useState<{ width:number; height:number } | null>(null);
  const width = natural?.width ?? asset?.width ?? 760, height = natural?.height ?? asset?.height ?? 570;
  const sizing = type === "hero" ? heroImageSizing(natural?.width ?? asset?.width, natural?.height ?? asset?.height)
    : imageSizing(natural?.width ?? asset?.width, natural?.height ?? asset?.height, type);
  return <figure className={styles.image} data-image-state={!asset?.previewUrl || failed ? "missing" : "available"}>
    {asset?.previewUrl && !failed
      ? <Image src={asset.previewUrl} alt={asset.name} width={width} height={height} style={{ maxWidth:sizing.maxWidth, maxHeight:sizing.maxHeight }} unoptimized loading="eager" onLoad={event => { const img=event.currentTarget; setNatural({width:img.naturalWidth,height:img.naturalHeight}); }} onError={() => setFailed(true)} />
      : <div role="img" aria-label="상품 이미지를 불러올 수 없습니다" className={styles.missing}>상품 이미지를 불러올 수 없습니다.</div>}
  </figure>;
}

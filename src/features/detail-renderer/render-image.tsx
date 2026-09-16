"use client";
import Image from "next/image";
import { useState } from "react";
import type { RenderAsset } from "./model";
import styles from "./renderer.module.css";
export function RenderImage({ asset }: { asset?: RenderAsset }) {
  const [failed, setFailed] = useState(false);
  const width = asset?.width ?? 760, height = asset?.height ?? 570;
  return <figure className={styles.image} data-image-state={!asset?.previewUrl || failed ? "missing" : "available"}>
    {asset?.previewUrl && !failed
      ? <Image src={asset.previewUrl} alt={asset.name} width={width} height={height} unoptimized loading="eager" onError={() => setFailed(true)} />
      : <div role="img" aria-label="상품 이미지를 불러올 수 없습니다" className={styles.missing}>상품 이미지를 불러올 수 없습니다.</div>}
  </figure>;
}

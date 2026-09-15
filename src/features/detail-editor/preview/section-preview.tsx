import Image from "next/image";
import type { EditorSection } from "../schemas";
import type { EditorAsset } from "../types";
import { SectionCopy } from "./section-renderers";
import styles from "./preview.module.css";

// Data-only rendering boundary. Selection and editor outlines live in the parent.
export function SectionPreview({ section, assets }: { section: EditorSection; assets: EditorAsset[] }) {
  const { content, style } = section;
  const ids = [...new Set([...content.assetIds, ...(content.type === "useCase" ? content.items.flatMap(item => item.assetIds) : [])])];
  return <div className={styles.section} data-layout={style.layout} data-align={style.textAlign} data-density={style.density}
    data-background={style.background} data-emphasis={style.emphasis} data-fit={style.imageFit}>
    <div className={styles.copy}><SectionCopy content={content} /></div>
    {!!ids.length && <div className={styles.images}>{ids.map(id => {
      const asset = assets.find(item => item.id === id);
      return <figure key={id}>{asset?.previewUrl ? <Image src={asset.previewUrl} alt={asset.name} width={760} height={520} unoptimized /> : <div className={styles.missing}>이미지 미리보기 없음</div>}</figure>;
    })}</div>}
  </div>;
}

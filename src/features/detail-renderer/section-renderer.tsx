import type { GeneratedSection, sectionStyleSchema } from "@/features/section-engine/schemas";
import type { z } from "zod";
import type { RenderAsset } from "./model";
import { SectionCopy } from "./section-copy";
import { RenderImage } from "./render-image";
import styles from "./renderer.module.css";
export function SectionRenderer({ content, style, assets }: { content: GeneratedSection; style: z.infer<typeof sectionStyleSchema>; assets: RenderAsset[] }) {
  if (content.type === "option" && !(content.optionSnapshot ? content.optionSnapshot.confirmed.groups.length : content.items?.length)) return null;
  const nested = content.type === "useCase" ? content.items.flatMap(item => item.assetIds) : [];
  const ids = [...new Set(content.assetIds)].filter(id => !nested.includes(id));
  const hasCopy = content.type !== "gallery" || !!content.title || !!content.intro;
  if (!hasCopy && !ids.length) return null;
  return <section className={styles.section} data-section-type={content.type} data-layout={style.layout} data-align={style.textAlign}
    data-density={style.density} data-background={style.background} data-emphasis={style.emphasis} data-fit={style.imageFit}>
    {hasCopy && <div className={styles.copy}><SectionCopy content={content} assets={assets} /></div>}
    {!!ids.length && <div className={styles.images}>{ids.map(id => { const asset = assets.find(item => item.id === id); return <RenderImage key={id + (asset?.previewUrl ?? "")} asset={asset} type={content.type} />; })}</div>}
  </section>;
}

import { SectionRenderer } from "./section-renderer";
import type { RenderSection, RenderAsset } from "./model";
import styles from "./renderer.module.css";
// Capture this boundary, never the review shell. Width is the persisted DetailPage width, without scaling.
export function RenderSurface({ width, sections, assets }: { width: number; sections: RenderSection[]; assets: RenderAsset[] }) {
  return <article data-detail-render-surface="1" data-render-width={width} aria-label="최종 상품 상세페이지" className={styles.surface} style={{ width }}>
    {sections.map(section => <SectionRenderer key={section.id} content={section.content} style={section.style} assets={assets} />)}
  </article>;
}

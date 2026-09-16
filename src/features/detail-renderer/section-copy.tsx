import type { GeneratedSection } from "@/features/section-engine/schemas";
import type { RenderAsset } from "./model";
import { RenderImage } from "./render-image";
import styles from "./renderer.module.css";
function Points({ items }: { items: { text: string }[] }) {
  return items.length ? <ul>{items.map((item, i) => <li key={i}>{item.text}</li>)}</ul> : null;
}
function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  return rows.length ? <table><tbody>{rows.map((row, i) => <tr key={i}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}</tbody></table> : null;
}
export function SectionCopy({ content, assets }: { content: GeneratedSection; assets: RenderAsset[] }) {
  switch (content.type) {
    case "hero": return <><h2>{content.headline}</h2>{content.subheadline && <p className={styles.intro}>{content.subheadline}</p>}<Points items={content.highlights} /></>;
    case "keyBenefits": return <><h2>{content.title}</h2>{!!content.items.length && <div className={styles.cards}>{content.items.map((item, i) => <article key={i}><span className={styles.number} aria-hidden="true">{String(i + 1).padStart(2, "0")}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}</div>}</>;
    case "feature": return <><h2>{content.title}</h2><p>{content.body}</p><Points items={content.bullets} /></>;
    case "imageText": return <><h2>{content.title}</h2><p>{content.body}</p></>;
    case "gallery": return <>{content.title && <h2>{content.title}</h2>}{content.intro && <p>{content.intro}</p>}</>;
    case "useCase": return <><h2>{content.title}</h2>{content.intro && <p>{content.intro}</p>}{!!content.items.length && <div className={styles.cases}>{content.items.map((item, i) => <article key={i}><div><h3>{item.title}</h3><p>{item.description}</p></div>{!!item.assetIds.length && <div className={styles.images}>{item.assetIds.map(id => { const asset = assets.find(a => a.id === id); return <RenderImage key={id + (asset?.previewUrl ?? "")} asset={asset} />; })}</div>}</article>)}</div>}</>;
    case "detail": return <><h2>{content.title}</h2><p>{content.body}</p><Points items={content.points} /></>;
    case "specification": return <><h2>{content.title}</h2><Rows rows={content.rows} /></>;
    case "option": return <><h2>{content.title}</h2><Rows rows={content.items} /></>;
    case "notice": return <><h2>{content.title}</h2><Points items={content.items} /></>;
    default: return <p role="alert">표시할 수 없는 섹션입니다.</p>;
  }
}

import type { GeneratedSection } from "@/features/section-engine/schemas";
type Of<T extends GeneratedSection["type"]> = Extract<GeneratedSection, { type: T }>;
function Points({ items }: { items: { text: string }[] }) { return items.length ? <ul>{items.map((item, i) => <li key={i}>{item.text}</li>)}</ul> : null; }
function Cards({ items }: { items: { title: string; description: string }[] }) { return <div className="preview-cards">{items.map((item, i) => <article key={i}><h3>{item.title}</h3><p>{item.description}</p></article>)}</div>; }
function Rows({ rows }: { rows: { label: string; value: string }[] }) { return <table><tbody>{rows.map((row, i) => <tr key={i}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}</tbody></table>; }
export function HeroPreview({ content }: { content: Of<"hero"> }) { return <><h2>{content.headline}</h2>{content.subheadline && <p className="preview-intro">{content.subheadline}</p>}<Points items={content.highlights} /></>; }
export function BenefitsPreview({ content }: { content: Of<"keyBenefits"> }) { return <><h2>{content.title}</h2><Cards items={content.items} /></>; }
export function FeaturePreview({ content }: { content: Of<"feature"> }) { return <><h2>{content.title}</h2><p>{content.body}</p><Points items={content.bullets} /></>; }
export function ImageTextPreview({ content }: { content: Of<"imageText"> }) { return <><h2>{content.title}</h2><p>{content.body}</p></>; }
export function GalleryPreview({ content }: { content: Of<"gallery"> }) { return <>{content.title && <h2>{content.title}</h2>}{content.intro && <p>{content.intro}</p>}</>; }
export function UseCasePreview({ content }: { content: Of<"useCase"> }) { return <><h2>{content.title}</h2>{content.intro && <p>{content.intro}</p>}<Cards items={content.items} /><p className="preview-note">사용 상황 제안 · 사실과 구분하여 검토해 주세요.</p></>; }
export function DetailPreview({ content }: { content: Of<"detail"> }) { return <><h2>{content.title}</h2><p>{content.body}</p><Points items={content.points} /></>; }
export function SpecificationPreview({ content }: { content: Of<"specification"> }) { return <><h2>{content.title}</h2><Rows rows={content.rows} /></>; }
export function OptionPreview({ content }: { content: Of<"option"> }) { return <><h2>{content.title}</h2>{content.items.length ? <Rows rows={content.items} /> : <p>등록된 옵션 정보가 없습니다.</p>}</>; }
export function NoticePreview({ content }: { content: Of<"notice"> }) { return <><h2>{content.title}</h2><Points items={content.items} /></>; }
export function SectionCopy({ content }: { content: GeneratedSection }) {
  switch (content.type) {
    case "hero": return <HeroPreview content={content} />;
    case "keyBenefits": return <BenefitsPreview content={content} />;
    case "feature": return <FeaturePreview content={content} />;
    case "imageText": return <ImageTextPreview content={content} />;
    case "gallery": return <GalleryPreview content={content} />;
    case "useCase": return <UseCasePreview content={content} />;
    case "detail": return <DetailPreview content={content} />;
    case "specification": return <SpecificationPreview content={content} />;
    case "option": return <OptionPreview content={content} />;
    case "notice": return <NoticePreview content={content} />;
  }
}

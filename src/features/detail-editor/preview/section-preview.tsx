import type { EditorSection } from "../schemas";
import type { EditorAsset } from "../types";
import { SectionRenderer } from "@/features/detail-renderer/section-renderer";
// Selection, local drafts and scaling belong to the Editor wrapper, never the shared renderer.
export function SectionPreview({ section, assets }: { section: EditorSection; assets: EditorAsset[] }) {
  return <SectionRenderer content={section.content} style={section.style} assets={assets} />;
}

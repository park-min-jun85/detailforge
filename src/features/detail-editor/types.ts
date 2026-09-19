import type { EditorSection } from "./schemas";
import type { QualityWarning } from "@/features/page-quality/policy";
export type EditorAsset = { id: string; name: string; previewUrl: string | null; provenanceLabel?: string | null; width?:number|null; height?:number|null };
export type EditorView = { qualityWarnings?:QualityWarning[]; projectId: string; projectName: string; productName: string; detailPageId: string | null; sections: EditorSection[]; stale: boolean;
  blocked: boolean; reorderRecovery: boolean; manualOrder: boolean; assets: EditorAsset[]; previewWarning: boolean };

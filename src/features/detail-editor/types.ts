import type { EditorSection } from "./schemas";
export type EditorAsset = { id: string; name: string; previewUrl: string | null };
export type EditorView = { projectId: string; projectName: string; productName: string; detailPageId: string | null; sections: EditorSection[]; stale: boolean;
  blocked: boolean; reorderRecovery: boolean; manualOrder: boolean; assets: EditorAsset[]; previewWarning: boolean };

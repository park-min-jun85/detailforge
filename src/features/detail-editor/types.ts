import type { EditorSection } from "./schemas";
export type EditorAsset = { id: string; name: string; previewUrl: string | null };
export type EditorView = { projectId: string; projectName: string; productName: string; sections: EditorSection[]; stale: boolean;
  blocked: boolean; assets: EditorAsset[]; previewWarning: boolean };

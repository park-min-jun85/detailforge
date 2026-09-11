import type { Asset } from "@/types/domain";

export interface AssetPreview { asset: Asset; previewUrl: string | null }
export interface AssetList { items: AssetPreview[]; expiresAt: number }
export interface AssetContext {
  project: { id: string; name: string };
  product: { id: string; projectId: string; name: string } | null;
}

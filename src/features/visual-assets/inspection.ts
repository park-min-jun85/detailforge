import "server-only";
import sharp from "sharp";
import type { Asset } from "@/types/domain";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertAssetScope, validateSignature, validateFile } from "@/features/assets/schemas";
import { loadSource } from "@/features/detail-extraction/source";
import type { AssetInspection } from "./policy";

// Immutable UUID object paths; short bounded cache avoids decoding on every read-only UI poll.
const dimensions = new Map<string, { until: number; value: AssetInspection }>();
export async function inspectVisualAssets(client: ReturnType<typeof createSupabaseServerClient>, assets: Asset[], projectId: string, productId: string) {
  for (const asset of assets) assertAssetScope(asset, projectId, productId);
  const result: Record<string, AssetInspection> = {};
  if (!assets.length) return result;
  const signed = await client.storage.from("product-assets").createSignedUrls(assets.map(a => a.storagePath), 60);
  if (signed.error || !signed.data) throw new Error("Visual availability unavailable");
  // Small batches bound memory and latency; no AI or DB mutation.
  for (let offset = 0; offset < assets.length; offset += 3) await Promise.all(assets.slice(offset, offset + 3).map(async asset => {
    const exists = signed.data.some(item => item.path === asset.storagePath && item.signedUrl && !item.error);
    if (!exists) { result[asset.id] = { width: asset.width, height: asset.height, usable: false }; return; }
    if (asset.width && asset.height) { result[asset.id] = { width: asset.width, height: asset.height, usable: true }; return; }
    const key = `${process.env.SUPABASE_URL}:${asset.storagePath}:${asset.sizeBytes}`, cached = dimensions.get(key);
    if (cached && cached.until > Date.now()) { result[asset.id] = cached.value; return; }
    try {
      const bytes = await loadSource(client, asset);
      validateSignature(bytes, validateFile(asset.mimeType ?? "", bytes.length));
      const decoder = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning" }).timeout({ seconds: 10 });
      const metadata = await decoder.metadata();
      if (!metadata.width || !metadata.height || metadata.width > 6000 || metadata.height > 60000 || (metadata.pages ?? 1) !== 1) throw new Error("Invalid image");
      await decoder.clone().resize(1, 1).raw().toBuffer();
      const rotated = (metadata.orientation ?? 1) >= 5;
      const value = { width: rotated ? metadata.height : metadata.width, height: rotated ? metadata.width : metadata.height, usable: true };
      if (dimensions.size >= 120) dimensions.delete(dimensions.keys().next().value!);
      dimensions.set(key, { until: Date.now() + 60_000, value }); result[asset.id] = value;
    } catch { result[asset.id] = { width: null, height: null, usable: false }; }
  }));
  return result;
}

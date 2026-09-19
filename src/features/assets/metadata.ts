import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Asset } from "@/types/domain";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

// Every application metadata writer participates. Large extraction results never go into a URL filter.
export function metadataUpdate(client: ReturnType<typeof createSupabaseServerClient>, asset: Asset, metadata: Record<string, unknown>, assetType = asset.assetType) {
  const previous = asset.metadata.detailExtraction;
  const revision = previous && typeof previous === "object" && "revision" in previous && z.uuid().safeParse(previous.revision).success ? String(previous.revision) : null;
  const next = metadata.detailExtraction;
  const merged = next && typeof next === "object" ? { ...metadata, detailExtraction: { ...next, revision: randomUUID() } } : metadata;
  const query = client.from("assets").update({ metadata: z.record(z.string(), z.json()).parse(merged), asset_type: assetType })
    .eq("id", asset.id).eq("project_id", asset.projectId).eq("product_id", asset.productId).eq("storage_path", asset.storagePath).eq("asset_type", asset.assetType);
  return revision ? query.eq("metadata->detailExtraction->>revision", revision) : query.eq("metadata", JSON.stringify(asset.metadata));
}

import "server-only";
import type { Asset } from "@/types/domain";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertAssetScope, MAX_FILE_BYTES } from "@/features/assets/schemas";
import { ExtractionError } from "./errors";

export async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, milliseconds: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation(controller.signal), new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new ExtractionError("timeout")); }, milliseconds);
  })]); } finally { if (timer) clearTimeout(timer); }
}
export async function readLimitedResponse(response: Response) {
  const declared = response.headers.get("content-length");
  if (!response.ok || !response.body || (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_FILE_BYTES))) {
    await response.body?.cancel(); throw new ExtractionError("source_load");
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.length;
      if (length > MAX_FILE_BYTES) { await reader.cancel(); throw new ExtractionError("source_load"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!length) throw new ExtractionError("source_load");
  return Buffer.concat(chunks, length);
}
export async function loadSource(client: ReturnType<typeof createSupabaseServerClient>, asset: Asset) {
  try {
    assertAssetScope(asset, asset.projectId, asset.productId);
    if (asset.sizeBytes !== null && asset.sizeBytes > MAX_FILE_BYTES) throw new ExtractionError("source_load");
    return await bounded(async signal => {
      const signed = await client.storage.from("product-assets").createSignedUrl(asset.storagePath, 60);
      if (signal.aborted) throw new ExtractionError("timeout");
      if (signed.error || !signed.data?.signedUrl) throw new ExtractionError("source_load");
      const url = new URL(signed.data.signedUrl), configured = new URL(process.env.SUPABASE_URL!);
      // Only the server-configured private bucket and this already scoped DB path. No URL input.
      if (url.origin !== configured.origin || decodeURIComponent(url.pathname) !== `/storage/v1/object/sign/product-assets/${asset.storagePath}`) throw new ExtractionError("ownership");
      return readLimitedResponse(await fetch(url, { signal, redirect: "error", cache: "no-store" }));
    }, 20_000);
  } catch (error) { throw error instanceof ExtractionError ? error : new ExtractionError("source_load"); }
}

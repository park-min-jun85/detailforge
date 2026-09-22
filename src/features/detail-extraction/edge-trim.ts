import "server-only";
import sharp from "sharp";
import { analyzeCropEdges } from "./frame-analysis";
export type TrimInsets = { top: number; right: number; bottom: number; left: number };
// Diagnostics are ephemeral. Only bounded insets enter the existing crop/provenance path.
export function detectTrim(data: Uint8Array, width: number, height: number): TrimInsets {
  const edges = analyzeCropEdges(data, width, height);
  return { top: edges.top.trimPixels, right: edges.right.trimPixels, bottom: edges.bottom.trimPixels, left: edges.left.trimPixels };
}
export async function trimCrop(bytes: Buffer, width: number, height: number) {
  const { data: rgba, info } = await sharp(bytes, { limitInputPixels: 40_000_000 }).timeout({ seconds: 10 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== width || info.height !== height) throw new Error("Crop dimensions mismatch");
  let insets = detectTrim(rgba, width, height);
  let w = width - insets.left - insets.right, h = height - insets.top - insets.bottom;
  if (w < 160 || h < 160 || w * h < 64000) { insets = { top: 0, right: 0, bottom: 0, left: 0 }; w = width; h = height; }
  return { insets, width: w, height: h, applied: Object.values(insets).some(Boolean) };
}

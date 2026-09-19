import "server-only";
import sharp from "sharp";
import { MAX_TRIM_FRACTION } from "./policy";
export type TrimInsets = { top: number; right: number; bottom: number; left: number };
// Only complete, nearly uniform bands ending in a clear full-edge transition.
// Ambiguous backgrounds, textured clothing, wide bands and dark surfaces are preserved.
export function detectTrim(data: Uint8Array, width: number, height: number): TrimInsets {
  const result: TrimInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const edge of ["top", "right", "bottom", "left"] as const) {
    const vertical = edge === "left" || edge === "right", length = vertical ? height : width, axis = vertical ? width : height;
    const cap = Math.floor(axis * MAX_TRIM_FRACTION);
    const line = (offset: number) => {
      let min = 255, max = 0, sum = 0, squares = 0, opaque = 0, transparent = 0, darker = 0, neutral = true;
      for (let i = 0; i < length; i++) {
        const x = vertical ? (edge === "left" ? offset : width - 1 - offset) : i;
        const y = vertical ? i : (edge === "top" ? offset : height - 1 - offset), p = (y * width + x) * 4;
        if (data[p + 3] <= 2) { transparent++; continue; }
        if (data[p + 3] < 253) return { band: false, content: false };
        const lo = Math.min(data[p], data[p + 1], data[p + 2]), hi = Math.max(data[p], data[p + 1], data[p + 2]);
        if (hi - lo > 8) neutral = false;
        min = Math.min(min, lo); max = Math.max(max, hi); sum += lo; squares += lo * lo; opaque++; if (hi < 230) darker++;
      }
      const mean = sum / Math.max(1, opaque);
      return { band: transparent === length || (neutral && opaque === length && min >= 238 && max - min <= 8 && squares / length - mean * mean <= 6), content: darker / length >= .9 };
    };
    let count = 0;
    while (count <= cap && line(count).band) count++;
    if (count >= 2 && count <= cap && line(count).content) result[edge] = count;
  }
  return result;
}
export async function trimCrop(bytes: Buffer, width: number, height: number) {
  const rgba = await sharp(bytes, { limitInputPixels: 40_000_000 }).timeout({ seconds: 10 }).ensureAlpha().raw().toBuffer();
  let insets = detectTrim(rgba, width, height);
  let w = width - insets.left - insets.right, h = height - insets.top - insets.bottom;
  if (w < 160 || h < 160 || w * h < 64000) { insets = { top: 0, right: 0, bottom: 0, left: 0 }; w = width; h = height; }
  return { insets, width: w, height: h, applied: Object.values(insets).some(Boolean) };
}

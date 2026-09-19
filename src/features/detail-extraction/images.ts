import "server-only";
import sharp from "sharp";
import { trimCrop } from "./edge-trim";
import { createHash } from "node:crypto";
import { MAX_FILE_BYTES, validateFile, validateSignature, type ImageMime } from "@/features/assets/schemas";
import { ExtractionError } from "./errors";
import { imageCategory, MAX_INPUT_PIXELS, MAX_SOURCE_WIDTH, MAX_SOURCE_HEIGHT, TILE_HEIGHT, TILE_OVERLAP, MAX_TILE_COUNT, SNAP_WINDOW, OUTPUT_QUALITY } from "./policy";
import type { Dimensions, Rect } from "./schemas";
import type { TileRect } from "./geometry";

export type WorkingImage = { bytes: Buffer; fingerprint: string; dimensions: Dimensions; orientation: number; mime: ImageMime };
export const sourceFingerprint = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const input = (bytes: Uint8Array) => sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).timeout({ seconds: 30 });

export async function decodeSource(bytes: Uint8Array, declaredMime: string | null): Promise<WorkingImage> {
  let mime: ImageMime;
  try { mime = validateFile(declaredMime ?? "", bytes.byteLength); validateSignature(bytes, mime); }
  catch { throw new ExtractionError("unsupported_mime"); }
  try {
    const metadata = await input(bytes).metadata();
    const format = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[mime];
    if (metadata.format !== format || (metadata.pages ?? 1) > 1) throw new ExtractionError("decode");
    const rotated = (metadata.orientation ?? 1) >= 5;
    const dimensions = { width: rotated ? metadata.height : metadata.width, height: rotated ? metadata.width : metadata.height };
    if (!dimensions.width || !dimensions.height || dimensions.width > MAX_SOURCE_WIDTH || dimensions.height > MAX_SOURCE_HEIGHT
      || dimensions.width * dimensions.height > MAX_INPUT_PIXELS) throw new ExtractionError("pixel_limit");
    if (imageCategory(dimensions.width, dimensions.height) === "normal") throw new ExtractionError("ineligible");
    // One lossless orientation-normalized working buffer; never overwrite the original file.
    const normalized = await input(bytes).rotate().png().toBuffer();
    return { bytes: normalized, fingerprint: sourceFingerprint(bytes), dimensions, orientation: metadata.orientation ?? 1, mime };
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    // libvips reports the decoder's pixel cap before metadata is returned. Never expose its message.
    throw new ExtractionError(error instanceof Error && /pixel limit/i.test(error.message) ? "pixel_limit" : "decode");
  }
}

export function planTiles(dimensions: Dimensions, whiteRows: readonly boolean[] = []): TileRect[] {
  const tiles: TileRect[] = [];
  let y = 0;
  while (y < dimensions.height) {
    if (tiles.length >= MAX_TILE_COUNT) throw new ExtractionError("tile_limit");
    let end = Math.min(dimensions.height, y + TILE_HEIGHT);
    if (end < dimensions.height && whiteRows.length === dimensions.height) {
      // Only broad near-white, low-variance gutters. Never infer a product boundary from text.
      const candidates: number[] = [];
      for (let row = Math.max(y + TILE_OVERLAP + 1, end - SNAP_WINDOW); row < Math.min(dimensions.height - 8, end + SNAP_WINDOW); row++) {
        if (row >= 8 && whiteRows.slice(row - 8, row + 8).every(Boolean)) candidates.push(row);
      }
      candidates.sort((a, b) => Math.abs(a - end) - Math.abs(b - end) || a - b);
      end = candidates[0] ?? end;
    }
    tiles.push({ index: tiles.length, x: 0, y, width: dimensions.width, height: end - y });
    if (end === dimensions.height) break;
    y = end - TILE_OVERLAP;
  }
  return tiles;
}

export async function imageTiles(image: WorkingImage) {
  const { data, info } = await input(image.bytes).resize({ width: 64, height: image.dimensions.height, fit: "fill" }).flatten({ background: "white" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rows = Array.from({ length: info.height }, (_, y) => {
    let sum = 0, squared = 0;
    for (let x = 0; x < info.width; x++) { const value = data[y * info.width + x]; sum += value; squared += value * value; }
    const mean = sum / info.width;
    return mean >= 245 && squared / info.width - mean * mean <= 8;
  });
  return planTiles(image.dimensions, rows);
}

export async function tileDataUrl(image: WorkingImage, tile: TileRect) {
  const bytes = await input(image.bytes).extract({ left: tile.x, top: tile.y, width: tile.width, height: tile.height })
    .resize({ width: 1024, withoutEnlargement: true }).flatten({ background: "white" }).jpeg({ quality: 85 }).toBuffer();
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

export async function cropImage(image: WorkingImage, rect: Rect) {
  try {
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isSafeInteger) || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0
      || rect.x + rect.width > image.dimensions.width || rect.y + rect.height > image.dimensions.height) throw new ExtractionError("invalid_rect");
    const originalCrop = await input(image.bytes).extract({ left: rect.x, top: rect.y, width: rect.width, height: rect.height }).png().toBuffer();
    const trimmed = await trimCrop(originalCrop, rect.width, rect.height);
    const pipeline = input(originalCrop).extract({ left: trimmed.insets.left, top: trimmed.insets.top, width: trimmed.width, height: trimmed.height });
    const bytes = await (image.mime === "image/jpeg" ? pipeline.jpeg({ quality: OUTPUT_QUALITY, chromaSubsampling: "4:4:4" })
      : image.mime === "image/webp" ? pipeline.webp({ quality: OUTPUT_QUALITY }) : pipeline.png({ compressionLevel: 6 })).toBuffer();
    validateFile(image.mime, bytes.length); validateSignature(bytes, image.mime);
    const actual = await input(bytes).metadata();
    if (bytes.length > MAX_FILE_BYTES || actual.width !== trimmed.width || actual.height !== trimmed.height) throw new ExtractionError("crop");
    return { bytes, width: actual.width, height: actual.height, mime: image.mime,
      ...(trimmed.applied ? { trim: { policyVersion: 1 as const, insets: trimmed.insets, postTrimDimensions: { width: trimmed.width, height: trimmed.height } } } : {}) };
  } catch (error) { throw error instanceof ExtractionError ? error : new ExtractionError("crop"); }
}

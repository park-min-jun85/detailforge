// Shared bounded policy; no provider/Storage secrets in this module.
export const POLICY_VERSION = 2;
export const MIN_PRODUCT_RELEVANCE = 0.75;
export const LONG_MIN_HEIGHT = 2400;
export const LONG_ASPECT_RATIO = 3.5;
export const EXTREME_LONG_ASPECT_RATIO = 12;
export const MAX_INPUT_PIXELS = 40_000_000;
export const MAX_SOURCE_WIDTH = 6000;
export const MAX_SOURCE_HEIGHT = 60000;
export const TILE_HEIGHT = 2048;
export const TILE_OVERLAP = 256;
export const SNAP_WINDOW = 128;
export const MAX_TILE_COUNT = 16;
export const MAX_REGIONS_PER_TILE = 8;
export const MAX_CHECKPOINT_BYTES = 256 * 1024;
// Serialization/interpretation versions, independent of the application version.
export const TILE_LAYOUT_VERSION = 1;
export const EXTRACTION_PROMPT_VERSION = 1;
export const NORMALIZATION_VERSION = 1;
export const MAX_CANDIDATES = 24;
export const MIN_CROP_WIDTH = 160;
export const MIN_CROP_HEIGHT = 160;
export const MIN_CROP_AREA = 64000;
export const CROP_MARGIN = 0.02;
export const MAX_CROP_MARGIN = 24;
export const TILE_TIMEOUT_MS = 45000;
export const RUN_TIMEOUT_MS = 300000;
export const LEASE_MS = 360000;
export const OUTPUT_QUALITY = 95;
export const MAX_TRIM_FRACTION = .03;
export const TRIM_POLICY_VERSION = 2;
export const PRODUCT_REGIONS = ["product_photo", "usage_photo", "detail_closeup", "variant_photo"] as const;
export function imageCategory(width: number, height: number) {
  if (!(width > 0 && height >= LONG_MIN_HEIGHT && height / width >= LONG_ASPECT_RATIO)) return "normal";
  return height / width >= EXTREME_LONG_ASPECT_RATIO ? "extreme_long" : "long";
}
export const REGION_LABELS = { product_photo: "제품", usage_photo: "사용/착용", detail_closeup: "디테일", variant_photo: "옵션/색상",
  mixed: "혼합", text_or_spec: "텍스트/표", shipping_or_notice: "배송/공지", promotional_banner: "홍보 배너", other: "기타" };

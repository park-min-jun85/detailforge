// Presentation only: never changes image bytes, evidence confidence or saved CSS.
export const MAX_RASTER_UPSCALE = 1.5;
export function heroDisplayMode(width?: number | null, height?: number | null) {
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) return "balanced";
  if (width < 480 || width / height < .65 || width / height > 1.8) return "compact-image";
  return width >= 760 && height >= 600 ? "large-image" : "balanced";
}
// One geometric policy for ranking, review and actual rendering. No pixel enhancement.
export function heroImageSizing(width?: number | null, height?: number | null) {
  const mode = heroDisplayMode(width, height), target = mode === "compact-image" ? 520 : mode === "large-image" ? 680 : 560;
  const known = Boolean(width && height && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0);
  const scale = known ? Math.min(target / width!, 720 / height!, MAX_RASTER_UPSCALE) : 1;
  const requiredDisplayWidth = known ? width! * scale : target, requiredDisplayHeight = known ? height! * scale : 720;
  return { mode, target, known, maxWidth: requiredDisplayWidth, maxHeight: requiredDisplayHeight,
    requiredDisplayWidth, requiredDisplayHeight, upscaleRatio: known ? scale : null,
    resolutionSuitability: known ? Math.min(1, 1 / scale) : 0, lowResolution: known && scale > 1 };
}
export const IMAGE_TARGETS = { hero: 560, heroLarge: 680, gallery: 350, gallerySingle: 640, detail: 640, imageText: 480, feature: 480, useCase: 440, default: 600 } as const;
export function imageSizing(width: number | null | undefined, height: number | null | undefined, type: string = "default") {
  const target = IMAGE_TARGETS[type as keyof typeof IMAGE_TARGETS] ?? IMAGE_TARGETS.default;
  const known = Boolean(width && height && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0);
  return { target, maxWidth: known ? Math.min(target, Math.floor(width! * MAX_RASTER_UPSCALE)) : target,
    maxHeight: known ? Math.min(720, Math.floor(height! * MAX_RASTER_UPSCALE)) : 720,
    resolutionSuitability: known ? Math.min(1, width! / target, height! / target) : 0,
    lowResolution: known && Math.min(width!, height!) < target, known };
}

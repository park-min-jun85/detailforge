// Presentation only: never changes image bytes, evidence confidence or saved CSS.
export const MAX_RASTER_UPSCALE = 1.5;
export const IMAGE_TARGETS = { hero: 560, heroLarge: 680, gallery: 350, gallerySingle: 640, detail: 640, imageText: 480, feature: 480, useCase: 440, default: 600 } as const;
export function imageSizing(width: number | null | undefined, height: number | null | undefined, type: string = "default") {
  const target = IMAGE_TARGETS[type as keyof typeof IMAGE_TARGETS] ?? IMAGE_TARGETS.default;
  const known = Boolean(width && height && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0);
  return { target, maxWidth: known ? Math.min(target, Math.floor(width! * MAX_RASTER_UPSCALE)) : target,
    maxHeight: known ? Math.min(720, Math.floor(height! * MAX_RASTER_UPSCALE)) : 720,
    resolutionSuitability: known ? Math.min(1, width! / target, height! / target) : 0,
    lowResolution: known && Math.min(width!, height!) < target, known };
}

import { ExtractionError } from "./errors";
import { MIN_CROP_WIDTH, MIN_CROP_HEIGHT, MIN_CROP_AREA, MAX_TRIM_FRACTION } from "./policy";
import { manualInsetsSchema, type ManualInsets, type Rect, type Dimensions, type Derivation } from "./schemas";

export function assertSourceRect(rect: Rect, dimensions: Dimensions) {
  if (![rect.x, rect.y, rect.width, rect.height, dimensions.width, dimensions.height].every(Number.isSafeInteger)
    || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0
    || rect.x + rect.width > dimensions.width || rect.y + rect.height > dimensions.height) throw new ExtractionError("invalid_rect");
}

export function insetRect(base: Rect, insets: ManualInsets): Rect {
  return { x: base.x + insets.left, y: base.y + insets.top,
    width: base.width - insets.left - insets.right, height: base.height - insets.top - insets.bottom };
}

export function manualCropRect(base: Rect, dimensions: Dimensions, insets: ManualInsets): Rect {
  if (!manualInsetsSchema.safeParse(insets).success) throw new ExtractionError("invalid_input");
  assertSourceRect(base, dimensions);
  const final = insetRect(base, insets);
  assertSourceRect(final, dimensions);
  if (final.width < MIN_CROP_WIDTH || final.height < MIN_CROP_HEIGHT || final.width * final.height < MIN_CROP_AREA)
    throw new ExtractionError("crop_too_small");
  return final;
}

// The sourceRect field always means the original Candidate, including legacy rows.
export function effectiveCropRect(derivation: Pick<Derivation, "sourceRect" | "trim" | "adjustment">): Rect {
  const insets = derivation.adjustment?.insets ?? derivation.trim?.insets;
  return insets ? insetRect(derivation.sourceRect, insets) : derivation.sourceRect;
}

export function validatedDerivedRect(derivation: Derivation, dimensions: { width: number | null; height: number | null }): Rect | null {
  try {
    assertSourceRect(derivation.sourceRect, derivation.sourceDimensions);
    const final = derivation.schemaVersion === 2
      ? manualCropRect(derivation.sourceRect, derivation.sourceDimensions, derivation.adjustment.insets)
      : effectiveCropRect(derivation);
    assertSourceRect(final, derivation.sourceDimensions);
    if (derivation.trim && (Object.entries(derivation.trim.insets).some(([edge, n]) => n > Math.floor(
      (edge === "left" || edge === "right" ? derivation.sourceRect.width : derivation.sourceRect.height) * MAX_TRIM_FRACTION))
      || final.width !== derivation.trim.postTrimDimensions.width || final.height !== derivation.trim.postTrimDimensions.height)) return null;
    if (dimensions.width !== null && dimensions.width !== final.width || dimensions.height !== null && dimensions.height !== final.height) return null;
    return final;
  } catch { return null; }
}

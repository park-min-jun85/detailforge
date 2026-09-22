import "server-only";
import { MAX_INPUT_PIXELS, MAX_TRIM_FRACTION } from "./policy";

export const CROP_EDGES = ["top", "right", "bottom", "left"] as const;
export type CropEdge = typeof CROP_EDGES[number];
export type EdgeDecision = {
  trimPixels: number;
  frameConfidence: number;
  contentRisk: "safe" | "ambiguous" | "detail";
  reason: "invalid_input" | "band_detail" | "dark_edge" | "wide_band" | "no_separator"
    | "interior_ambiguous" | "transparent_band" | "confirmed_frame";
};
type Color = [number, number, number];
type Line = { mean: Color; variance: number; range: number; adjacent: number; transparent: boolean; opaque: boolean };
const distance = (a: Color, b: Color) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const luminance = (c: Color) => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
const uniform = (line: Line) => line.opaque && line.range <= 12 && line.variance <= 6 && line.adjacent <= 12;
const keep = (reason: EdgeDecision["reason"], contentRisk: EdgeDecision["contentRisk"] = "ambiguous", frameConfidence = 0): EdgeDecision =>
  ({ trimPixels: 0, frameConfidence, contentRisk, reason });

// No semantic labels, masks, IDs or historical decisions enter this function.
// Only edge strips are visited: O(perimeter * (3% axis + constant lookahead)).
export function analyzeCropEdge(data: Uint8Array, width: number, height: number, edge: CropEdge): EdgeDecision {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
    || width * height > MAX_INPUT_PIXELS || data.length !== width * height * 4 || !CROP_EDGES.includes(edge)) return keep("invalid_input");
  const vertical = edge === "left" || edge === "right", length = vertical ? height : width, axis = vertical ? width : height;
  const cap = Math.floor(axis * MAX_TRIM_FRACTION);
  if (cap < 2) return keep("wide_band");
  // Full bands are always checked, including corners and one-pixel contrast pockets.
  // Only the retained separator/interior ignores perpendicular edge intersections.
  const guard = Math.ceil(length * MAX_TRIM_FRACTION) + 3;
  const line = (offset: number, inset = 0): Line => {
    const sum: Color = [0, 0, 0], squares: Color = [0, 0, 0], low: Color = [255, 255, 255], high: Color = [0, 0, 0];
    const count = length - inset * 2;
    let transparent = true, opaque = true, adjacent = 0, previous = -1;
    for (let i = inset; i < length - inset; i++) {
      const x = vertical ? (edge === "left" ? offset : width - 1 - offset) : i;
      const y = vertical ? i : (edge === "top" ? offset : height - 1 - offset), p = (y * width + x) * 4;
      transparent &&= data[p + 3] === 0;
      opaque &&= data[p + 3] === 255;
      for (let c = 0; c < 3; c++) {
        const value = data[p + c];
        sum[c] += value; squares[c] += value * value;
        low[c] = Math.min(low[c], value); high[c] = Math.max(high[c], value);
        if (previous >= 0) adjacent = Math.max(adjacent, Math.abs(value - data[previous + c]));
      }
      previous = p;
    }
    const mean = sum.map(value => value / count) as Color;
    return { mean, variance: Math.max(...squares.map((value, c) => value / count - mean[c] ** 2)),
      range: Math.max(...high.map((value, c) => value - low[c])), adjacent, transparent, opaque };
  };
  const first = line(0);
  if (first.transparent) {
    let thickness = 1;
    while (thickness <= cap && line(thickness).transparent) thickness++;
    if (thickness < 2 || thickness > cap) return keep("wide_band");
    return { trimPixels: thickness, frameConfidence: 1, contentRisk: "safe", reason: "transparent_band" };
  }
  // Stage A: conservative risk veto. A single outlier or alpha detail cannot be averaged away.
  if (!uniform(first)) return keep("band_detail", "detail");
  if (luminance(first.mean) < 180) return keep("dark_edge");
  let thickness = 1;
  while (thickness <= cap) {
    const next = line(thickness);
    if (!uniform(next) || distance(first.mean, next.mean) > 6) break;
    thickness++;
  }
  if (thickness < 2 || thickness > cap || thickness + 7 >= axis || length <= guard * 2) return keep("wide_band");

  // Stage A continued: a bare uniform-to-texture transition is semantically ambiguous.
  // Require a 1–3px continuous separator which itself stays in the resulting image.
  const separator = line(thickness, guard);
  if (!uniform(separator) || distance(first.mean, separator.mean) < 60) return keep("no_separator", "ambiguous", .25);
  let separatorWidth = 1;
  while (separatorWidth < 4) {
    const next = line(thickness + separatorWidth, guard);
    if (!uniform(next) || distance(separator.mean, next.mean) > 8) break;
    separatorWidth++;
  }
  if (separatorWidth > 3) return keep("no_separator", "ambiguous", .25);

  // Stage B: consistent two-sided contrast plus a genuinely more varied interior.
  // These are bounded pixel signals, not object recognition or a probability of safety.
  const interior = Array.from({ length: 4 }, (_, i) => line(thickness + separatorWidth + i, guard));
  const contrast = interior.every(row => row.opaque && distance(row.mean, separator.mean) >= 40 && distance(row.mean, first.mean) >= 30);
  const textured = interior.some(row => row.variance >= Math.max(8, first.variance * 3));
  const separatorExtremum = interior.every(row => {
    const value = luminance(separator.mean);
    return value <= Math.min(luminance(first.mean), luminance(row.mean)) - 25
      || value >= Math.max(luminance(first.mean), luminance(row.mean)) + 25;
  });
  if (!contrast || !textured || !separatorExtremum) return keep("interior_ambiguous", "ambiguous", .5);
  return { trimPixels: thickness, frameConfidence: 1, contentRisk: "safe", reason: "confirmed_frame" };
}

export function analyzeCropEdges(data: Uint8Array, width: number, height: number): Record<CropEdge, EdgeDecision> {
  return { top: analyzeCropEdge(data, width, height, "top"), right: analyzeCropEdge(data, width, height, "right"),
    bottom: analyzeCropEdge(data, width, height, "bottom"), left: analyzeCropEdge(data, width, height, "left") };
}

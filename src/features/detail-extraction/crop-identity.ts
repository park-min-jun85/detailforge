import type { Rect } from "./schemas";

// Use only with a validated parent and source fingerprint. Role/score changes
// must not create another file for the same source pixels.
export function cropRectKey(rect: Rect): string {
  return `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
}

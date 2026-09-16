import "server-only";
import { createHash } from "node:crypto";
import type { RenderView } from "./model";
// Signed URL tokens expire independently of canonical content; retain only asset identity/path.
export function renderFingerprint(view: RenderView) {
  return createHash("sha256").update(JSON.stringify({ page: view.detailPageId, width: view.width, sections: view.sections,
    assets: view.assets.map(asset => ({ ...asset, previewUrl: asset.previewUrl ? new URL(asset.previewUrl).origin + new URL(asset.previewUrl).pathname : null })) })).digest("hex");
}

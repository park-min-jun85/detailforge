import "server-only";
import { ExportError } from "./errors";
export const SURFACE_SELECTOR = 'article[data-detail-render-surface="1"]';
export const MAX_EXPORT_HEIGHT = 16000;
export const MAX_EXPORT_PIXELS = 16000000;
export const EXPORT_TIMEOUT_MS = 75000;
export function trustedOrigin(value = process.env.DETAILFORGE_APP_ORIGIN, environment = process.env.NODE_ENV) {
  try {
    const url = new URL(value || (environment === "production" ? "" : "http://127.0.0.1:3000"));
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) throw new Error();
    return url.origin;
  } catch { throw new ExportError("configuration"); }
}
export function checkDimensions(width: number, height: number, expectedWidth: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width > 2000 || height > MAX_EXPORT_HEIGHT || width * height > MAX_EXPORT_PIXELS) throw new ExportError("page_too_large");
  if (width !== expectedWidth) throw new ExportError("screenshot");
}

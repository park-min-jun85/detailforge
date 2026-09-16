import type { ExportOptions } from "./schemas";
export function exportFilename(name: string | null, format: ExportOptions["format"], now = new Date()) {
  const cleaned = (name ?? "").normalize("NFC").replace(/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f]/g, "").replace(/^[.\s]+|[.\s]+$/g, "");
  const base = [...cleaned].slice(0, 80).join("").replace(/[.\s]+$/g, "");
  const safe = !base || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base) ? "detail-page" : base;
  return `${safe}_detail_${now.toISOString().slice(0, 10).replaceAll("-", "")}.${format}`;
}
export function disposition(filename: string, format: ExportOptions["format"]) {
  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="detail-page.${format}"; filename*=UTF-8''${encoded}`;
}

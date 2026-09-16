import "server-only";
import { z } from "zod";
import { getRenderView } from "@/features/detail-renderer/service";
import { renderFingerprint } from "@/features/detail-renderer/fingerprint";
import { RenderError } from "@/features/detail-renderer/errors";
import { captureWithChromium } from "./browser";
import { trustedOrigin, checkDimensions, EXPORT_TIMEOUT_MS } from "./config";
import { ExportError } from "./errors";
import { exportRequestSchema } from "./schemas";
import { exportFilename } from "./filename";
import { imageDimensions } from "./image-header";
import type { CaptureProvider } from "./types";
const execution = globalThis as typeof globalThis & { detailExportBusy?: boolean };
export async function exportDetail(projectId: string, request: unknown, dependencies: { capture?: CaptureProvider; read?: typeof getRenderView; origin?: string; timeoutMs?: number; signal?: AbortSignal } = {}) {
  if (!z.uuid().safeParse(projectId).success) throw new ExportError("not_found");
  const parsed = exportRequestSchema.safeParse(request);
  if (!parsed.success) throw new ExportError("invalid_input");
  const origin = trustedOrigin(dependencies.origin), read = dependencies.read ?? getRenderView;
  if (execution.detailExportBusy) throw new ExportError("busy");
  const controller = new AbortController(), abort = () => controller.abort();
  dependencies.signal?.addEventListener("abort", abort, { once: true });
  if (dependencies.signal?.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    const fail = () => reject(new ExportError("timeout"));
    controller.signal.addEventListener("abort", fail, { once: true });
    if (controller.signal.aborted) fail();
    timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? EXPORT_TIMEOUT_MS);
  });
  const operation = async () => {
    const view = await read(projectId);
    if (view.state === "busy") throw new ExportError("busy");
    if (view.state === "empty") throw new ExportError("empty");
    if (view.state !== "ready" || !view.width) throw new ExportError("data_missing");
    if (view.readiness.missingImageCount) throw new ExportError("asset_load");
    if (controller.signal.aborted) throw new ExportError("timeout");
    const fingerprint = renderFingerprint(view);
    if (execution.detailExportBusy) throw new ExportError("busy");
    execution.detailExportBusy = true;
    let result;
    try {
      result = await (dependencies.capture ?? captureWithChromium)({ url: `${origin}/projects/${projectId}/render`, width: view.width, fingerprint,
        imageUrls: view.assets.flatMap(asset => asset.previewUrl ? [asset.previewUrl] : []), options: parsed.data }, controller.signal);
    } finally { execution.detailExportBusy = false; }
    const dimensions = imageDimensions(result.bytes, parsed.data.format);
    checkDimensions(dimensions.width, dimensions.height, view.width);
    if (dimensions.height !== result.height || dimensions.width !== result.width || result.bytes.length > 32000000) throw new ExportError("screenshot");
    const after = await read(projectId);
    if (after.state !== "ready" || renderFingerprint(after) !== fingerprint) throw new ExportError("changed");
    return { ...result, format: parsed.data.format, filename: exportFilename(view.productName, parsed.data.format) };
  };
  const pending = operation();
  // Only browser work holds the slot until provider cleanup. Slow read-only DB calls cannot lock it forever.
  try { return await Promise.race([pending, deadline]); }
  catch (error) {
    if (error instanceof ExportError) throw error;
    if (error instanceof RenderError) throw new ExportError(error.code === "not_found" ? "not_found" : error.code === "conflict" ? "changed" : "unavailable");
    throw new ExportError("unavailable");
  } finally { clearTimeout(timer); dependencies.signal?.removeEventListener("abort", abort); }
}

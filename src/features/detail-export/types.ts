import type { ExportOptions } from "./schemas";
export type CaptureInput = { url: string; width: number; fingerprint: string; imageUrls: string[]; options: ExportOptions };
export type CaptureResult = { bytes: Uint8Array; width: number; height: number };
export type CaptureProvider = (input: CaptureInput, signal: AbortSignal) => Promise<CaptureResult>;

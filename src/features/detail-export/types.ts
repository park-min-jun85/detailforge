import type { ExportOptions } from "./schemas";
import type { RenderSection, RenderAsset } from "@/features/detail-renderer/model";
export type ExportSnapshot = {width:number; sections:RenderSection[]; assets:RenderAsset[]; fingerprint:string};
export type ExportAuthorization = {id:string;token:string;worker:string;close:()=>Promise<void>};
export type CaptureInput = { url: string; width: number; fingerprint: string; imageUrls: string[]; options: ExportOptions; authorization: ExportAuthorization };
export type CaptureResult = { bytes: Uint8Array; width: number; height: number };
export type CaptureProvider = (input: CaptureInput, signal: AbortSignal) => Promise<CaptureResult>;

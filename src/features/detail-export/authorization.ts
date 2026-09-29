import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserContext } from "@/lib/supabase/user";
import type { Database, Json } from "@/lib/supabase/database.types";
import { referencedAssetIds, type RenderView } from "@/features/detail-renderer/model";
import type { ExportOptions } from "./schemas";
import { ExportError } from "./errors";
import type { ExportAuthorization, ExportSnapshot } from "./types";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
// Separate finite privileged boundary. No client, generic CRUD or signing escapes.
async function rpc<N extends "issue_export_ticket" | "use_export_ticket" | "close_export_ticket">(name: N, args: Database["public"]["Functions"][N]["Args"]) {
  const { data, error } = await createSupabaseAdminClient({ requestTimeoutMs: 10_000 }).rpc(name, args);
  if (error) throw new ExportError("unavailable");
  return data as Json | undefined;
}

export async function authorizeExport(view: RenderView, options: ExportOptions, fingerprint: string): Promise<ExportAuthorization> {
  const { client, principal } = await getUserContext();
  const project = await client.from("projects").select("id").eq("id", view.projectId).maybeSingle();
  if (project.error || !project.data || !view.detailPageId || view.width !== 860) throw new ExportError("not_found");
  const assets: ExportSnapshot["assets"] = [];
  let total = 0;
  for (const id of referencedAssetIds(view.sections)) {
    const row = await client.from("assets").select("id,project_id,product_id,storage_path").eq("project_id",view.projectId).eq("id",id).maybeSingle();
    if (row.error || !row.data) throw new ExportError("asset_load");
    // DB and Storage RLS both apply. No arbitrary URL fetch or privileged signing.
    const object = await client.storage.from("product-assets").download(row.data.storage_path);
    if (object.error || !object.data || object.data.size > 10485760) throw new ExportError("asset_load");
    const bytes = Buffer.from(await object.data.arrayBuffer());
    let encoded: Buffer;
    try { encoded = await sharp(bytes, { limitInputPixels: 40000000 }).rotate().png().toBuffer(); }
    catch { throw new ExportError("asset_load"); }
    total += encoded.length;
    if (total > 10000000) throw new ExportError("page_too_large");
    const asset = view.assets.find(a => a.id === id);
    if (!asset) throw new ExportError("asset_load");
    assets.push({ ...asset, previewUrl: `data:image/png;base64,${encoded.toString("base64")}` });
  }
  const snapshot: ExportSnapshot = { width:860, sections:view.sections, assets, fingerprint };
  if (Buffer.byteLength(JSON.stringify(snapshot)) > 16000000) throw new ExportError("page_too_large");
  const id=randomUUID(), token=randomBytes(32).toString("hex"), worker=randomBytes(32).toString("hex");
  try {
    await rpc("issue_export_ticket", { p_id:id,p_actor:principal.userId,p_project:view.projectId,p_page:view.detailPageId,
      p_token_hash:digest(token),p_worker_hash:digest(worker),p_fingerprint:fingerprint,p_options:options,p_snapshot:snapshot as unknown as Json });
  } catch (error) {
    // An uncertain INSERT response must never make the ticket reusable.
    await rpc("close_export_ticket",{p_id:id,p_actor:principal.userId}).catch(()=>{}); throw error;
  }
  return { id, token, worker, close:async()=>{await rpc("close_export_ticket",{p_id:id,p_actor:principal.userId});} };
}

const secret = z.string().regex(/^[a-f0-9]{64}$/);
export async function verifyExportRequest(request: Request, consume: boolean): Promise<Json | null> {
  const url = new URL(request.url);
  if (url.search || request.headers.has("cookie") || request.headers.has("authorization") || request.headers.has("rsc")) return null;
  const id = request.headers.get("x-export-id"), token = request.headers.get("x-export-token"), worker = request.headers.get("x-export-worker");
  if (!z.uuid().safeParse(id).success || !secret.safeParse(token).success || !secret.safeParse(worker).success) return null;
  return await rpc("use_export_ticket",{p_id:id!,p_token_hash:digest(token!),p_worker_hash:digest(worker!),p_consume:consume}) ?? null;
}

export const exportPrivateHeaders = { "Cache-Control":"private, no-store, max-age=0", "Referrer-Policy":"no-referrer", "X-Content-Type-Options":"nosniff" };
export const exportDenied = () => Response.json({ok:false,code:"forbidden"},{status:404,headers:exportPrivateHeaders});

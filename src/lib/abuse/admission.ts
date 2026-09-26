import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/principal";
import { AuthFailure } from "@/lib/auth/errors";
import type { AuthClient } from "@/lib/auth/session";
import { storagePath, validateFile, MAX_FILE_BYTES } from "@/features/assets/schemas";
import { admissionRpc } from "./privileged";

export type PaidOperation = "asset-analysis" | "product-analysis" | "fact-validation" | "page-planner" | "section-engine" | "section-regeneration" | "extraction" | "extraction-retry";
const ticketSchema = z.object({ id: z.uuid(), assetId: z.uuid().nullable(), path: z.string().nullable(), expiresAt: z.string() });
const fingerprint = (input: unknown) => createHash("sha256").update(JSON.stringify(input)).digest("hex");

async function actorFor(client: AuthClient, projectId: string, productId?: string) {
  z.uuid().parse(projectId); if (productId) z.uuid().parse(productId);
  const principal = await requireCurrentUser(client);
  const project = await client.from("projects").select("id").eq("id", projectId).eq("owner_id", principal.userId).maybeSingle();
  if (project.error || !project.data) throw new AuthFailure("forbidden");
  if (productId) {
    const product = await client.from("products").select("id").eq("id", productId).eq("project_id", projectId).maybeSingle();
    if (product.error || !product.data) throw new AuthFailure("forbidden");
  }
  return principal.userId;
}

// Paths/Asset identity are always server generated. Input is an internal scope,
// never a spread of request JSON. Full cap reservation prevents size spoofing.
export async function issueUpload(client: AuthClient, projectId: string, productId: string, mime: string, bytes: number) {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_FILE_BYTES) throw new AuthFailure("invalid_input");
  const actor = await actorFor(client, projectId, productId), assetId = randomUUID();
  const path = storagePath(projectId, productId, assetId, validateFile(mime, bytes));
  const hash = fingerprint({ projectId, productId, assetId, mime, bytes });
  const ticket = ticketSchema.parse(await admissionRpc("reserve_admission", { p_actor: actor, p_project: projectId,
    p_product: productId, p_operation: "upload", p_key: hash, p_fingerprint: hash, p_asset: assetId, p_mime: mime }));
  if (ticket.assetId !== assetId || ticket.path !== path) throw new AuthFailure("temporary_failure");
  return { id: assetId, path, async settle(outcome: "consumed" | "released" | "uncertain") {
    await admissionRpc("settle_admission", { p_actor: actor, p_id: ticket.id, p_outcome: outcome });
  } };
}

export async function withPaidOperation<T>(client: AuthClient, projectId: string, operation: PaidOperation,
  input: unknown, dispatch: () => Promise<T>, requestKey?: string): Promise<T> {
  // Existing operation schemas impose tighter semantic bounds. This is a final
  // cap on serialized input before it can reach either the ledger or provider.
  const encoded = JSON.stringify(input);
  if (!encoded || Buffer.byteLength(encoded) > 16 * 1024 * 1024) throw new AuthFailure("invalid_input");
  const actor = await actorFor(client, projectId), hash = fingerprint(input);
  // Identical inputs within a rolling application minute share a dispatch key.
  // Callers may supply a durable generation/tile identity, never an HTTP key.
  const key = fingerprint({ operation, projectId, hash, generation: requestKey ?? Math.floor(Date.now() / 60_000) });
  const ticket = ticketSchema.parse(await admissionRpc("reserve_admission", { p_actor: actor, p_project: projectId,
    p_product: null, p_operation: operation, p_key: key, p_fingerprint: hash }));
  try {
    const result = await dispatch();
    await admissionRpc("settle_admission", { p_actor: actor, p_id: ticket.id, p_outcome: "consumed" });
    return result;
  } catch (error) {
    // An ambiguous provider outcome is charged, never automatically refunded.
    try { await admissionRpc("settle_admission", { p_actor: actor, p_id: ticket.id, p_outcome: "uncertain" }); } catch { /* reserved remains charged */ }
    throw error;
  }
}

import "server-only";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { ImportedOptionSource, OptionGroups } from "./schemas";
import type { OptionAddition } from "./import-contract";
import { OptionError } from "./errors";

type Scope = { projectId: string; productId: string; sourceUrl: string; productNo: string; expectedVersion: number };
export type OptionTicket = Scope & { kind: "candidate" | "prepared"; expiresAt: number;
  source: Omit<ImportedOptionSource, "bindings">; previous: ImportedOptionSource | null;
  current: OptionGroups; additions: OptionAddition[]; preparedSource?: ImportedOptionSource;
};
// Process-local, bounded and restart-invalidated, like Wholesale Import tickets.
// HMAC authenticates the opaque cache handle; payload and credentials are never in the token.
const runtime = globalThis as typeof globalThis & { optionTickets?: { secret: Buffer; entries: Map<string, OptionTicket> } };
const cache = runtime.optionTickets ??= { secret: randomBytes(32), entries: new Map() };
const signature = (id: string) => createHmac("sha256", cache.secret).update(`domeme-options:${id}`).digest("hex");
export const OPTION_TICKET_TTL = 20 * 60 * 1000;
export function issueOptionTicket(ticket: OptionTicket, now = Date.now()) {
  for (const [id, entry] of cache.entries) if (entry.expiresAt <= now) cache.entries.delete(id);
  // Repeated lookup of the same candidate/base preserves provisional UUIDs too.
  if (ticket.kind === "candidate") for (const [id, entry] of cache.entries) {
    if (entry.kind === "candidate" && entry.projectId === ticket.projectId && entry.productId === ticket.productId
      && entry.expectedVersion === ticket.expectedVersion && entry.sourceUrl === ticket.sourceUrl && entry.source.fingerprint === ticket.source.fingerprint
      && JSON.stringify(entry.current) === JSON.stringify(ticket.current) && JSON.stringify(entry.previous) === JSON.stringify(ticket.previous)) {
      entry.source = ticket.source; entry.expiresAt = ticket.expiresAt;
      return { token: `${id}.${signature(id)}`, ticket: structuredClone(entry) };
    }
  }
  if (cache.entries.size >= 50) cache.entries.delete(cache.entries.keys().next().value!);
  const id = randomUUID(); cache.entries.set(id, structuredClone(ticket));
  return { token: `${id}.${signature(id)}`, ticket: structuredClone(ticket) };
}
export function readOptionTicket(token: string, scope: Scope, kind: OptionTicket["kind"], now = Date.now()): OptionTicket {
  const parts = /^([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(token);
  if (!parts || !timingSafeEqual(Buffer.from(parts[2], "hex"), Buffer.from(signature(parts[1]), "hex"))) throw new OptionError("expired");
  const ticket = cache.entries.get(parts[1]);
  if (!ticket || ticket.expiresAt <= now || ticket.kind !== kind || ticket.projectId !== scope.projectId || ticket.productId !== scope.productId) throw new OptionError("expired");
  if (ticket.sourceUrl !== scope.sourceUrl || ticket.productNo !== scope.productNo) throw new OptionError("source_changed");
  if (ticket.expectedVersion !== scope.expectedVersion) throw new OptionError("conflict");
  return structuredClone(ticket);
}

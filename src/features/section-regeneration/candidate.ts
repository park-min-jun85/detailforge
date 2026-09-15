import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalValidationJson } from "@/features/fact-validation/evidence";
import { candidateSchema, signedCandidateSchema, type Candidate } from "./schemas";
import { CANDIDATE_TTL_MS } from "./config";
import { RegenError } from "./errors";
function signature(candidate: Candidate) {
  const root = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!root) throw new RegenError("not_configured");
  // Domain-separated derived key; neither the root key nor the derived key leaves the server.
  const key = createHmac("sha256", root).update("detailforge:section-candidate:v1").digest();
  return createHmac("sha256", key).update(canonicalValidationJson(candidate)).digest("hex");
}
export function signCandidate(value: Candidate) { const candidate = candidateSchema.parse(value); return { candidate, signature: signature(candidate) }; }
export function verifyCandidate(value: unknown, projectId: string, sectionId: string, now = Date.now()) {
  const parsed = signedCandidateSchema.safeParse(value);
  if (!parsed.success) throw new RegenError("invalid_candidate");
  const { candidate, signature: supplied } = parsed.data;
  if (!timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(signature(candidate), "hex")) || candidate.projectId !== projectId || candidate.sectionId !== sectionId) throw new RegenError("invalid_candidate");
  const age = now - Date.parse(candidate.generatedAt), expires = Date.parse(candidate.expiresAt);
  if (age < 0 || age >= CANDIDATE_TTL_MS || now >= expires || expires - Date.parse(candidate.generatedAt) !== CANDIDATE_TTL_MS) throw new RegenError("expired");
  return candidate;
}

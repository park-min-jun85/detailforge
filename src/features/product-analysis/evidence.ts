import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { manualFactsSchema } from "@/features/products/schemas";
import { analysisResultSchema, analysisStateSchema } from "@/features/asset-analysis/schemas";
import { assertAssetScope } from "@/features/assets/schemas";
import type { Asset } from "@/types/domain";
import { evidenceSnapshotSchema, type Evidence } from "./schemas";
import { ProductAnalysisError } from "./errors";

// Object key order and Unicode/line-ending differences must not change evidence IDs or fingerprints.
export function normalizeInput(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (Array.isArray(value)) return value.map(normalizeInput);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, normalizeInput(child)]));
  return value;
}
export function fingerprintInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(normalizeInput(value))).digest("hex");
}
const factsSchema = manualFactsSchema.strict().extend({ specifications: z.array(z.strictObject({ name: z.string().min(1).max(100), value: z.string().min(1).max(500) })).max(50) });
export function buildEvidenceRegistry(input: { projectId: string; productId: string; facts: unknown; description: string | null; assets: Asset[] }) {
  try {
    const facts = factsSchema.parse(normalizeInput(input.facts));
    const description = z.string().max(5000).parse(normalizeInput(input.description ?? ""));
    const evidence: Evidence[] = [{ id: "F1", kind: "product_fact", label: "상품명", value: facts.productName }];
    if (facts.brand) evidence.push({ id: "F2", kind: "product_fact", label: "브랜드", value: facts.brand });
    if (facts.category) evidence.push({ id: "F3", kind: "product_fact", label: "카테고리", value: facts.category });
    const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
    facts.specifications.sort((a, b) => compare(a.name, b.name) || compare(a.value, b.value)).forEach((spec, index) =>
      evidence.push({ id: `F${index + 4}`, kind: "product_fact", label: spec.name, value: spec.value }));
    if (input.assets.length > 30 || new Set(input.assets.map((asset) => asset.id)).size !== input.assets.length) throw new ProductAnalysisError("invalid_input");
    let completed = 0, invalid = 0;
    for (const asset of [...input.assets].sort((a, b) => compare(a.id, b.id))) {
      try { assertAssetScope(asset, input.projectId, input.productId); } catch { throw new ProductAnalysisError("ownership"); }
      const raw = asset.metadata.aiAnalysis;
      if (raw === undefined) continue;
      const state = analysisStateSchema.safeParse(raw);
      if (!state.success) { invalid++; continue; }
      // Failed/analyzing attempts and their previousResult are deliberately excluded.
      if (state.data.status !== "completed") continue;
      completed++;
      evidence.push({ id: `V${completed}`, kind: "visual_observation", label: `이미지 관찰 ${completed}`, assetId: asset.id,
        observation: analysisResultSchema.parse(normalizeInput(analysisResultSchema.parse({
          schemaVersion: state.data.schemaVersion, role: state.data.role, confidence: state.data.confidence,
          heroSuitability: state.data.heroSuitability, visualSummary: state.data.visualSummary,
          composition: state.data.composition, signals: state.data.signals, warnings: [...state.data.warnings].sort(),
        }))) });
    }
    if (description) evidence.push({ id: "S1", kind: "unverified_source_statement", label: "UNVERIFIED SOURCE DESCRIPTION", value: description });
    const snapshot = evidenceSnapshotSchema.parse(evidence);
    // Include coverage because absence/partial coverage is also supplied to the provider.
    const coverage = { total: input.assets.length, completed, invalid };
    const providerInput = { evidence: snapshot, coverage };
    return { ...providerInput, inputFingerprint: fingerprintInput(providerInput) };
  } catch (error) { throw error instanceof ProductAnalysisError ? error : new ProductAnalysisError("invalid_input"); }
}

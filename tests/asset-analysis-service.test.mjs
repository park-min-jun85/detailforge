import test from "node:test";
import assert from "node:assert/strict";
import { analyzeAsset } from "../src/features/asset-analysis/service.ts";
import { AnalysisError } from "../src/features/asset-analysis/errors.ts";
import { startAssetDb, assetId, projectId, productId, otherId, assetRow } from "./helpers/asset-db.mjs";
import { analysisResult, completedAnalysis, analyzingState } from "./helpers/analysis.mjs";

async function fixture(t) {
  const db = await startAssetDb(); t.after(() => db.close());
  const row = assetRow({ metadata: { preserve: { label: "keep" } } });
  db.state.assets.push(row); db.state.objects.add(row.storage_path); return db.state;
}
const factory = (analyze = async () => analysisResult()) => () => ({ model: "test-vision", analyze });

test("successful analysis persists state, role and metadata, with one private URL and no Facts writes", async (t) => {
  const state = await fixture(t); let calls = 0;
  const asset = await analyzeAsset(projectId, assetId, factory(async (input) => {
    calls++; assert.equal(state.assets[0].metadata.aiAnalysis.status, "analyzing");
    assert.match(input.imageUrl, /\/object\/sign\/product-assets\//); return analysisResult();
  }));
  assert.equal(calls, 1); assert.equal(asset.assetType, "product"); assert.equal(asset.metadata.aiAnalysis.status, "completed");
  assert.equal(asset.metadata.aiAnalysis.model, "test-vision"); assert.deepEqual(asset.metadata.preserve, { label: "keep" });
  assert.doesNotMatch(JSON.stringify(state.assets), /temporary-test-token|signedUrl/);
  assert.equal(state.requests.find((item) => item.path.includes("/sign/")).payload.expiresIn, 300);
  assert.ok(state.requests.filter((item) => item.method !== "GET" && !item.path.includes("/storage/")).every((item) => item.path.endsWith("/assets") && item.method === "PATCH"));
});

test("low confidence is saved but stays unclassified, with no hero assignment", async (t) => {
  await fixture(t);
  const asset = await analyzeAsset(projectId, assetId, factory(async () => analysisResult({ confidence: 0.64, heroSuitability: 1 })));
  assert.equal(asset.assetType, "unclassified"); assert.equal(asset.metadata.aiAnalysis.heroSuitability, 1);
});

test("missing/mismatched Project, Product, Asset and path never reach provider or sign", async (t) => {
  const state = await fixture(t); let calls = 0; const provider = factory(async () => { calls++; return analysisResult(); });
  await assert.rejects(analyzeAsset("bad-id", assetId, provider), (error) => error.code === "not_found");
  await assert.rejects(analyzeAsset(otherId, assetId, provider), (error) => error.code === "not_found");
  const product = state.product; state.product = null;
  await assert.rejects(analyzeAsset(projectId, assetId, provider), (error) => error.code === "product_required");
  state.product = { ...product, project_id: otherId }; state.ignoreProductFilter = true;
  await assert.rejects(analyzeAsset(projectId, assetId, provider), (error) => error.code === "ownership");
  state.product = product; state.ignoreProductFilter = false;
  for (const override of [{ project_id: otherId }, { product_id: otherId }, { storage_path: `projects/${otherId}/other.png` }]) {
    state.assets = [assetRow(override)]; await assert.rejects(analyzeAsset(projectId, assetId, provider));
  }
  assert.equal(calls, 0); assert.equal(state.requests.filter((request) => request.path.includes("/sign/")).length, 0);
});

test("provider failure and malformed output persist bounded failure state only", async (t) => {
  const state = await fixture(t);
  await assert.rejects(analyzeAsset(projectId, assetId, factory(async () => { throw new Error("secret-test-key internal-provider-error"); })), (error) => {
    assert.equal(error.code, "provider"); assert.doesNotMatch(error.message, /secret-test-key|internal-provider/); assert.equal(error.asset.metadata.aiAnalysis.status, "failed"); return true;
  });
  assert.equal(state.assets[0].asset_type, "unclassified");
  await assert.rejects(analyzeAsset(projectId, assetId, factory(async () => analysisResult({ role: "hero" }))), (error) => error.code === "invalid_response");
  assert.equal(state.assets[0].metadata.aiAnalysis.errorCode, "invalid_response");
  assert.doesNotMatch(JSON.stringify(state.assets), /internal-provider|secret-test-key/);
});

test("reanalysis failure preserves old success and type, then success replaces only analysis", async (t) => {
  const state = await fixture(t); const old = completedAnalysis();
  state.assets[0].metadata.aiAnalysis = old; state.assets[0].asset_type = "product";
  await assert.rejects(analyzeAsset(projectId, assetId, factory(async () => { throw new AnalysisError("timeout"); })));
  assert.deepEqual(state.assets[0].metadata.aiAnalysis.previousResult, old); assert.equal(state.assets[0].asset_type, "product");
  const next = await analyzeAsset(projectId, assetId, factory(async () => analysisResult({ role: "detail" })));
  assert.equal(next.assetType, "detail"); assert.equal(next.metadata.aiAnalysis.status, "completed");
  assert.ok(!("previousResult" in next.metadata.aiAnalysis)); assert.deepEqual(next.metadata.preserve, { label: "keep" });
});

test("fresh analyzing blocks retries; stale and future leases allow a new attempt", async (t) => {
  const state = await fixture(t); state.assets[0].metadata.aiAnalysis = analyzingState();
  await assert.rejects(analyzeAsset(projectId, assetId, factory()), (error) => error.code === "busy");
  for (const startedAt of [new Date(Date.now() - 180_001).toISOString(), new Date(Date.now() + 60_000).toISOString()]) {
    state.assets[0].metadata.aiAnalysis = analyzingState({ startedAt });
    const result = await analyzeAsset(projectId, assetId, factory()); assert.equal(result.metadata.aiAnalysis.status, "completed");
  }
});

test("missing config and failed initial DB claim do not spend a provider call", async (t) => {
  const state = await fixture(t); const before = structuredClone(state.assets[0].metadata);
  await assert.rejects(analyzeAsset(projectId, assetId, () => { throw new AnalysisError("not_configured"); }), (error) => error.code === "not_configured");
  assert.deepEqual(state.assets[0].metadata, before);
  let calls = 0; state.failure = "patch-analyzing";
  await assert.rejects(analyzeAsset(projectId, assetId, factory(async () => { calls++; return analysisResult(); })), (error) => error.code === "database");
  assert.equal(calls, 0);
});

test("signed URL failure is persisted and does not invoke AI", async (t) => {
  const state = await fixture(t); state.failure = "sign"; let calls = 0;
  await assert.rejects(analyzeAsset(projectId, assetId, factory(async () => { calls++; return analysisResult(); })), (error) => error.code === "signed_url");
  assert.equal(calls, 0); assert.equal(state.assets[0].metadata.aiAnalysis.status, "failed");
});

test("concurrent metadata updates merge safely and completed update acknowledgement loss recovers", async (t) => {
  const state = await fixture(t);
  state.patchAckLost = "completed";
  const asset = await analyzeAsset(projectId, assetId, factory(async () => {
    state.assets[0].metadata.external = { keep: "concurrent" }; return analysisResult();
  }));
  assert.deepEqual(asset.metadata.external, { keep: "concurrent" }); assert.equal(asset.metadata.aiAnalysis.status, "completed");
});

test("metadata conflict during finish is reread without another AI call", async (t) => {
  const state = await fixture(t); let calls = 0;
  state.beforePatch = (payload) => {
    if (payload.metadata.aiAnalysis.status === "completed") { state.assets[0].metadata.late = true; state.beforePatch = null; }
  };
  const asset = await analyzeAsset(projectId, assetId, factory(async () => { calls++; return analysisResult(); }));
  assert.equal(calls, 1); assert.equal(asset.metadata.late, true);
});

test("late response cannot overwrite a newer analysis attempt or resurrect a deleted Asset", async (t) => {
  const state = await fixture(t); const newer = analyzingState();
  await assert.rejects(analyzeAsset(projectId, assetId, factory(async () => {
    state.assets[0].metadata.aiAnalysis = newer; return analysisResult();
  })), (error) => error.code === "conflict");
  assert.deepEqual(state.assets[0].metadata.aiAnalysis, newer);
  state.assets[0].metadata = {};
  await assert.rejects(analyzeAsset(projectId, assetId, factory(async () => { state.assets = []; return analysisResult(); })), (error) => error.code === "not_found");
  assert.equal(state.assets.length, 0);
});

test("failed final save is not displayed as success and leaves a retryable stale lease", async (t) => {
  const state = await fixture(t); state.failure = "patch-completed";
  await assert.rejects(analyzeAsset(projectId, assetId, factory()), (error) => error.code === "database");
  assert.equal(state.assets[0].metadata.aiAnalysis.status, "analyzing"); assert.equal(state.assets[0].asset_type, "unclassified");
});

test("same Asset duplicate and more than two concurrent analyses are rejected", async (t) => {
  const state = await fixture(t);
  const secondId = "3645f432-b847-4e28-9ee7-f41beccccf46";
  for (const id of [secondId, otherId]) { const row = assetRow({ id, storage_path: `projects/${projectId}/products/${productId}/${id}.png` }); state.assets.push(row); state.objects.add(row.storage_path); }
  let release; const pending = new Promise((resolve) => { release = resolve; });
  const provider = factory(async () => { await pending; return analysisResult(); });
  const first = analyzeAsset(projectId, assetId, provider); const second = analyzeAsset(projectId, secondId, provider);
  await assert.rejects(analyzeAsset(projectId, assetId, provider), (error) => error.code === "busy");
  await assert.rejects(analyzeAsset(projectId, otherId, provider), (error) => error.code === "busy");
  release(); await Promise.all([first, second]);
});

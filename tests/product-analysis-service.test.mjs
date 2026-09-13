import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { analyzeProduct, getProductAnalysisView } from "../src/features/product-analysis/service.ts";
import { ProductAnalysisError } from "../src/features/product-analysis/errors.ts";
import { isProductAnalysisStale } from "../src/features/product-analysis/schemas.ts";
import { startProductAnalysisDb, projectId, productId, assetRow, strategyResult } from "./helpers/product-analysis.mjs";
import { completedAnalysis } from "./helpers/analysis.mjs";
const factory = (analyze = async () => strategyResult()) => () => ({ model: "mock-product", analyze });
const rejects = (operation, code) => assert.rejects(operation, (error) => { assert.equal(error.code, code); assert.doesNotMatch(error.message, /secret-test|private-error/); return true; });

test("first product analysis and reload preserve Facts, raw_data, source and Project", async () => {
  const db = await startProductAnalysisDb(); try {
    const before = structuredClone({ facts: db.state.facts, product: db.state.product, project: db.state.project }); let calls = 0;
    const result = await analyzeProduct(projectId, factory(async (input) => { calls++; assert.equal(input.coverage.total, 0); return strategyResult(); }));
    assert.equal(calls, 1); assert.equal(result.state.attempt.status, "completed");
    assert.deepEqual((await getProductAnalysisView(projectId)).state, result.state);
    assert.deepEqual(db.state.facts, before.facts); assert.deepEqual(db.state.project, before.project);
    const { ai_analysis, updated_at, ...after } = db.state.product;
    const original = Object.fromEntries(Object.entries(before.product).filter(([key]) => !["ai_analysis", "updated_at"].includes(key)));
    assert.deepEqual(after, original); assert.ok(ai_analysis.latestResult.evidenceSnapshot.length); assert.ok(updated_at);
    const writes = db.state.requests.filter((r) => r.method !== "GET");
    assert.equal(writes.length, 2); assert.ok(writes.every((r) => r.table === "products" && Object.keys(r.payload).join() === "ai_analysis"));
    assert.ok(db.state.requests.every((r) => !r.path.startsWith("/storage/")));
  } finally { await db.close(); }
});
test("reanalysis succeeds with fresh snapshot; failed reanalysis preserves exact prior success", async () => {
  const db = await startProductAnalysisDb(); try {
    const first = await analyzeProduct(projectId, factory()); const original = structuredClone(first.state.latestResult);
    await rejects(analyzeProduct(projectId, factory(async () => { throw new Error("secret-test-key private-error"); })), "provider");
    assert.equal(db.state.product.ai_analysis.attempt.status, "failed"); assert.deepEqual(db.state.product.ai_analysis.latestResult, original);
    db.state.facts.facts.productName = "입력 변경";
    assert.equal(isProductAnalysisStale((await getProductAnalysisView(projectId)).state, (await getProductAnalysisView(projectId)).inputFingerprint), true);
    const second = await analyzeProduct(projectId, factory());
    assert.notEqual(second.state.latestResult.inputFingerprint, original.inputFingerprint);
    assert.notEqual(second.state.attempt.runId, first.state.attempt.runId); assert.equal(isProductAnalysisStale(second.state, second.inputFingerprint), false);
  } finally { await db.close(); }
});
test("initial provider failure and malformed or invented evidence output persist failure only", async () => {
  for (const [run, code] of [[async () => { throw new Error("private-error"); }, "provider"],
    [async () => ({ invalid: true }), "invalid_response"], [async () => strategyResult({ summary: { text: "요약", evidenceIds: ["V99"] } }), "invalid_response"]]) {
    const db = await startProductAnalysisDb(); try {
      await rejects(analyzeProduct(projectId, factory(run)), code);
      assert.equal(db.state.product.ai_analysis.attempt.status, "failed"); assert.equal(db.state.product.ai_analysis.latestResult, null);
    } finally { await db.close(); }
  }
});
test("missing Project/Product/Facts and inconsistent foreign keys do not call provider", async () => {
  const cases = [
    [(s) => s.project = null, "not_found"], [(s) => s.product = null, "product_required"], [(s) => s.facts = null, "facts_required"],
    [(s) => { s.product.project_id = productId; s.ignoreFilter = "products"; }, "ownership"],
    [(s) => { s.facts.product_id = projectId; s.ignoreFilter = "product_facts"; }, "ownership"],
    [(s) => s.assets.push(assetRow({ project_id: productId })), "ownership"],
    [(s) => s.assets.push(assetRow({ product_id: projectId })), "ownership"],
    [(s) => s.assets.push(assetRow({ storage_path: "other-project/secret.png" })), "ownership"],
  ];
  for (const [change, code] of cases) {
    const db = await startProductAnalysisDb(); try {
      change(db.state); let called = false;
      await rejects(analyzeProduct(projectId, factory(async () => { called = true; return strategyResult(); })), code);
      assert.equal(called, false); assert.ok(db.state.requests.every((r) => r.method === "GET"));
    } finally { await db.close(); }
  }
  await rejects(analyzeProduct("invalid-id", factory()), "not_found");
});
test("partial image coverage is visible and only completed observations reach provider", async () => {
  const db = await startProductAnalysisDb(); try {
    db.state.assets = [assetRow({ metadata: { aiAnalysis: completedAnalysis() } }), assetRow({ id: randomUUID() })];
    const result = await analyzeProduct(projectId, factory(async (input) => {
      assert.deepEqual(input.coverage, { total: 2, completed: 1, invalid: 0 });
      assert.equal(input.evidence.filter((e) => e.kind === "visual_observation").length, 1);
      assert.doesNotMatch(JSON.stringify(input), /storage_path|signedUrl|input_image/); return strategyResult();
    }));
    assert.equal(result.coverage.completed, 1);
  } finally { await db.close(); }
});
test("config and initial save failure do not consume provider calls or erase prior result", async () => {
  const db = await startProductAnalysisDb(); try {
    await analyzeProduct(projectId, factory()); const before = structuredClone(db.state.product.ai_analysis);
    await rejects(analyzeProduct(projectId, () => { throw new ProductAnalysisError("not_configured"); }), "not_configured");
    assert.deepEqual(db.state.product.ai_analysis, before);
    db.state.failure = "patch-analyzing"; let called = false;
    await rejects(analyzeProduct(projectId, factory(async () => { called = true; return strategyResult(); })), "database");
    assert.equal(called, false); assert.deepEqual(db.state.product.ai_analysis, before);
  } finally { await db.close(); }
});
test("fresh lease rejects duplicate while stale and future leases allow retry", async () => {
  const db = await startProductAnalysisDb(); try {
    const state = { schemaVersion: 1, attempt: { status: "analyzing", runId: randomUUID(), startedAt: new Date().toISOString(), finishedAt: null, errorCode: null }, latestResult: null };
    db.state.product.ai_analysis = structuredClone(state);
    await rejects(analyzeProduct(projectId, factory()), "busy");
    for (const offset of [-190000, 190000]) {
      db.state.product.ai_analysis = { ...state, attempt: { ...state.attempt, startedAt: new Date(Date.now() + offset).toISOString() } };
      assert.equal((await analyzeProduct(projectId, factory())).state.attempt.status, "completed");
    }
  } finally { await db.close(); }
});
test("input changed during request saves original evidence and immediately reports stale", async () => {
  const db = await startProductAnalysisDb(); try {
    const result = await analyzeProduct(projectId, factory(async () => { db.state.facts.facts.productName = "다른 입력"; db.state.product.description = "다른 설명"; return strategyResult(); }));
    assert.equal(isProductAnalysisStale(result.state, result.inputFingerprint), true);
    assert.equal(result.state.latestResult.evidenceSnapshot[0].value, "검증용 정리함");
    assert.equal(db.state.product.description, "다른 설명");
  } finally { await db.close(); }
});
test("lost save acknowledgment is recovered without another AI call", async () => {
  for (const stage of ["analyzing", "completed"]) {
    const db = await startProductAnalysisDb(); try {
      db.state.ackLost = stage; let calls = 0;
      assert.equal((await analyzeProduct(projectId, factory(async () => { calls++; return strategyResult(); }))).state.attempt.status, "completed");
      assert.equal(calls, 1);
    } finally { await db.close(); }
  }
});
test("late results cannot overwrite a newer attempt or resurrect a deleted Product", async () => {
  for (const deleted of [false, true]) {
    const db = await startProductAnalysisDb(); try {
      const newRun = randomUUID();
      await rejects(analyzeProduct(projectId, factory(async () => {
        if (deleted) db.state.product = null; else db.state.product.ai_analysis.attempt.runId = newRun;
        return strategyResult();
      })), deleted ? "product_required" : "conflict");
      if (!deleted) assert.equal(db.state.product.ai_analysis.attempt.runId, newRun); else assert.equal(db.state.product, null);
    } finally { await db.close(); }
  }
});
test("CAS claim races reject before AI; failed final save leaves retryable state", async () => {
  const db = await startProductAnalysisDb(); try {
    let calls = 0;
    db.state.beforePatch = async (payload) => { if (payload.ai_analysis.attempt.status === "analyzing") db.state.product.ai_analysis = { another: true }; };
    await rejects(analyzeProduct(projectId, factory(async () => { calls++; return strategyResult(); })), "conflict"); assert.equal(calls, 0);
    db.state.beforePatch = null; db.state.product.ai_analysis = {}; db.state.failure = "patch-completed";
    await rejects(analyzeProduct(projectId, factory()), "database"); assert.equal(db.state.product.ai_analysis.attempt.status, "analyzing");
    assert.equal(db.state.product.ai_analysis.latestResult, null);
  } finally { await db.close(); }
});
test("same-project in-process requests cannot duplicate the paid call", async () => {
  const db = await startProductAnalysisDb(); let release, entered;
  const started = new Promise((resolve) => { entered = resolve; }); const gate = new Promise((resolve) => { release = resolve; });
  try {
    const pending = analyzeProduct(projectId, factory(async () => { entered(); await gate; return strategyResult(); }));
    await started; await rejects(analyzeProduct(projectId, factory()), "busy"); release(); await pending;
  } finally { release(); await db.close(); }
});
test("large previous result stays out of CAS query URLs during reanalysis", async () => {
  const db = await startProductAnalysisDb(); try {
    db.state.product.description = "검증 설명 ".repeat(600);
    await analyzeProduct(projectId, factory(async () => strategyResult({
      valuePropositions: Array.from({ length: 5 }, (_, i) => ({ title: `방향 ${i}`, rationale: "긴 해석 ".repeat(70), confidence: .5, evidenceIds: ["F1"] })),
    })));
    const first = structuredClone(db.state.product.ai_analysis.latestResult);
    assert.ok(JSON.stringify(first).length > 3000);
    await rejects(analyzeProduct(projectId, factory(async () => { throw new Error("provider failed"); })), "provider");
    assert.deepEqual(db.state.product.ai_analysis.latestResult, first);
    for (const request of db.state.requests.filter((r) => r.method === "PATCH")) {
      assert.ok(request.query.length < 500); assert.doesNotMatch(request.query, /evidenceSnapshot|latestResult|%EA%B8%B4/);
    }
  } finally { await db.close(); }
});

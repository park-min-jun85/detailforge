import test from "node:test";
import assert from "node:assert/strict";
import { createProductAnalysisProvider } from "../src/features/product-analysis/provider.ts";
import { strategyResult } from "./helpers/product-analysis.mjs";
import { responseBody } from "./helpers/analysis.mjs";
const input = { evidence: [{ id: "F1", kind: "product_fact", label: "상품명", value: "테스트" }, { id: "F4", kind: "product_fact", label: "재질", value: "ABS" }], coverage: { total: 0, completed: 0, invalid: 0 } };
const config = { apiKey: "secret-test-key", model: "test-product" };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
test("product SDK sends strict text-only evidence once without URLs or tools", async () => {
  let body, calls = 0;
  const provider = createProductAnalysisProvider(config, async (_url, options) => { calls++; body = JSON.parse(options.body); return reply(responseBody(strategyResult())); });
  assert.deepEqual(await provider.analyze(input, new AbortController().signal), strategyResult());
  assert.equal(calls, 1); assert.equal(body.model, config.model); assert.equal(body.store, false);
  assert.equal(body.text.format.strict, true); assert.equal(body.text.format.schema.additionalProperties, false);
  assert.equal(body.input[1].content[0].type, "input_text"); assert.equal(body.tools, undefined);
  assert.doesNotMatch(JSON.stringify(body), /input_image|image_url|signedUrl|secret-test-key/);
});
test("product provider rejects malformed output, refusal, incomplete and nonexistent evidence", async () => {
  for (const body of [responseBody("broken JSON"), responseBody(strategyResult({ summary: { text: "요약", evidenceIds: ["F99"] } })),
    responseBody(strategyResult(), { status: "incomplete" }), responseBody(null, { output: [{ type: "message", id: "msg", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "no" }] }] })]) {
    const provider = createProductAnalysisProvider(config, async () => reply(body));
    await assert.rejects(provider.analyze(input, new AbortController().signal), (e) => e.code === "invalid_response");
  }
});
test("product provider has no automatic retry and never exposes raw errors", async () => {
  let calls = 0;
  const provider = createProductAnalysisProvider(config, async () => { calls++; return reply({ error: { message: "secret-test-key private-error" } }, 500); });
  await assert.rejects(provider.analyze(input, new AbortController().signal), (e) => { assert.equal(e.code, "provider"); assert.doesNotMatch(e.message, /secret-test|private-error/); return true; });
  assert.equal(calls, 1);
});
test("product provider abort is a safe timeout", async () => {
  const controller = new AbortController(); controller.abort();
  const provider = createProductAnalysisProvider(config, async () => { throw new Error("must not call"); });
  await assert.rejects(provider.analyze(input, controller.signal), (e) => e.code === "timeout");
});

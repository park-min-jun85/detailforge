import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAIProvider } from "../src/features/asset-analysis/provider.ts";
import { analysisResult, responseBody } from "./helpers/analysis.mjs";
const input = { imageUrl: "https://storage.invalid/object/sign/test?token=temporary", productName: "untrusted product" };
const config = { apiKey: "secret-test-openai-key", model: "test-vision" };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("official SDK sends one image with strict schema, chosen model and store=false", async () => {
  let body, calls = 0;
  const provider = createOpenAIProvider(config, async (_url, options) => { calls++; body = JSON.parse(options.body); return reply(responseBody()); });
  assert.deepEqual(await provider.analyze(input, new AbortController().signal), analysisResult());
  assert.equal(calls, 1); assert.equal(body.model, config.model); assert.equal(body.store, false);
  assert.equal(body.text.format.type, "json_schema"); assert.equal(body.text.format.strict, true);
  assert.equal(body.text.format.schema.additionalProperties, false);
  assert.equal(body.text.format.schema.properties.composition.additionalProperties, false);
  assert.equal(body.input[1].content.filter((part) => part.type === "input_image").length, 1);
  assert.doesNotMatch(JSON.stringify(body), /secret-test-openai-key/);
});

test("provider errors stay private and no automatic paid retry occurs", async () => {
  let calls = 0;
  const provider = createOpenAIProvider(config, async () => { calls++; return reply({ error: { message: "secret-test-openai-key internal-provider-error", type: "server_error" } }, 500); });
  await assert.rejects(provider.analyze(input, new AbortController().signal), (error) => {
    assert.equal(error.code, "provider"); assert.doesNotMatch(error.message, /secret-test|internal-provider/); return true;
  });
  assert.equal(calls, 1);
});

test("malformed JSON, invalid scores, refusal and incomplete response are rejected", async () => {
  for (const body of [responseBody("not json"), responseBody(analysisResult({ confidence: 2 })), responseBody(analysisResult({ role: "hero" })),
    responseBody(analysisResult(), { status: "incomplete" }), responseBody(null, { output: [{ id: "msg", type: "message", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "refused" }] }] })]) {
    const provider = createOpenAIProvider(config, async () => reply(body));
    await assert.rejects(provider.analyze(input, new AbortController().signal), (error) => error.code === "invalid_response");
  }
});

test("aborted provider call produces a bounded timeout error", async () => {
  const controller = new AbortController(); controller.abort();
  const provider = createOpenAIProvider(config, async () => { throw new Error("Should not reach transport after abort"); });
  await assert.rejects(provider.analyze(input, controller.signal), (error) => error.code === "timeout");
});

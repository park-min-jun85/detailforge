import test from "node:test";
import assert from "node:assert/strict";
import { MAX_FILE_BYTES, validateFile, validateSignature, normalizeFilename, storagePath, assertAssetScope, assetRowSchema, nextAssetOrder } from "../src/features/assets/schemas.ts";
import { readImageBody, assertSameOrigin, assetResponse } from "../src/features/assets/http.ts";
import { assetRow, assetId, projectId, productId, otherId, png } from "./helpers/asset-db.mjs";

test("image MIME, size boundary and signature validation", () => {
  for (const mime of ["image/jpeg", "image/png", "image/webp"]) assert.equal(validateFile(mime, MAX_FILE_BYTES), mime);
  for (const mime of ["image/svg+xml", "image/gif", "text/html", ""]) assert.throws(() => validateFile(mime, 1));
  for (const size of [0, -1, 1.2, MAX_FILE_BYTES + 1]) assert.throws(() => validateFile("image/png", size));
  validateSignature(png, "image/png");
  validateSignature(new Uint8Array([255, 216, 255]), "image/jpeg");
  validateSignature(new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]), "image/webp");
  assert.throws(() => validateSignature(png, "image/jpeg"));
  assert.throws(() => validateSignature(new TextEncoder().encode("<svg/>"), "image/png"));
});

test("filename is normalized separately from a server UUID path", () => {
  assert.equal(normalizeFilename("C:\\fakepath\\..\\제품\u202e\u0000.png"), "제품.png");
  assert.equal(normalizeFilename("../../  제품.png  "), "제품.png");
  for (const name of ["", ".", "..", "a".repeat(256), "\u0000"]) assert.throws(() => normalizeFilename(name));
  assert.equal(storagePath(projectId.toUpperCase(), productId, assetId, "image/jpeg"), `projects/${projectId}/products/${productId}/${assetId}.jpg`);
  assert.throws(() => storagePath("../other", productId, assetId, "image/png"));
});

test("asset mapping validates JSON and guards both relations and exact path scope", () => {
  const asset = assetRowSchema.parse(assetRow());
  assert.equal(asset.assetType, "unclassified"); assert.equal(asset.width, null); assert.deepEqual(asset.metadata, {});
  assert.equal(asset.projectId, projectId); assert.equal(asset.originalFilename, "제품.png");
  assertAssetScope(asset, projectId, productId);
  for (const override of [{ projectId: otherId }, { productId: otherId }, { storagePath: `projects/${otherId}/products/${productId}/${assetId}.png` },
    { storagePath: `projects/${projectId}/products/${productId}/../${assetId}.png` }]) {
    assert.throws(() => assertAssetScope({ ...asset, ...override }, projectId, productId));
  }
  assert.throws(() => assetRowSchema.parse(assetRow({ metadata: [] })));
});

test("asset limit and next order use the maximum rather than row count", () => {
  assert.equal(nextAssetOrder(0, null), 0); assert.equal(nextAssetOrder(2, 9), 10);
  assert.equal(nextAssetOrder(29, 40), 41); assert.throws(() => nextAssetOrder(30, 29));
  assert.throws(() => nextAssetOrder(1, 2147483647));
});

test("binary body validation enforces actual streamed size and valid encoded name", async () => {
  const request = (body, headers = {}) => new Request("http://localhost/api", { method: "POST", body, duplex: "half",
    headers: { "Content-Type": "image/png", "X-File-Name": encodeURIComponent("제품.png"), ...headers } });
  const parsed = await readImageBody(request(png));
  assert.deepEqual(parsed.bytes, png); assert.equal(parsed.name, "제품.png");
  await assert.rejects(readImageBody(request(png, { "X-File-Name": "%broken" })));
  await assert.rejects(readImageBody(request(png, { "Content-Length": String(MAX_FILE_BYTES + 1) })));
  await assert.rejects(readImageBody(request(new Uint8Array(MAX_FILE_BYTES + 1))), /10MB/);
});

test("cross-origin mutations are rejected and internal errors are never returned", async () => {
  assertSameOrigin(new Request("http://localhost/api", { headers: { Origin: "http://localhost" } }));
  assertSameOrigin(new Request("http://localhost:3100/api", { headers: { Host: "127.0.0.1:3100", Origin: "http://127.0.0.1:3100" } }));
  assert.throws(() => assertSameOrigin(new Request("http://localhost:3100/api", { headers: { Host: "127.0.0.1:3100", Origin: "http://localhost:3100" } })));
  assert.throws(() => assertSameOrigin(new Request("http://localhost/api", { headers: { Origin: "https://evil.invalid" } })));
  assert.throws(() => assertSameOrigin(new Request("http://localhost/api")));
  const response = await assetResponse(async () => { throw new Error("private-db-detail secret-test-key"); });
  assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.doesNotMatch(await response.text(), /private-db-detail|secret-test-key/);
});

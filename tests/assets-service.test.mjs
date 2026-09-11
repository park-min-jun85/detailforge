import test from "node:test";
import assert from "node:assert/strict";
import { getAssetContext, listAssets, uploadAsset, deleteAsset } from "../src/features/assets/service.ts";
import { assetResponse } from "../src/features/assets/http.ts";
import { startAssetDb, projectId, productId, otherId, assetId, assetRow, uploadFile } from "./helpers/asset-db.mjs";

async function fixture(t) { const db = await startAssetDb(); t.after(() => db.close()); return db.state; }

test("upload stores unchanged bytes metadata, private signed previews and stable order", async (t) => {
  const state = await fixture(t);
  const old = assetRow({ sort_order: 8 }); state.assets.push(old); state.objects.add(old.storage_path);
  const asset = await uploadAsset(projectId, uploadFile);
  assert.equal(asset.sortOrder, 9); assert.equal(asset.assetType, "unclassified"); assert.equal(asset.productId, productId);
  assert.equal(asset.sizeBytes, uploadFile.bytes.length); assert.deepEqual(asset.metadata, {}); assert.equal(asset.width, null);
  assert.equal(state.objects.size, 2); assert.equal(state.assets.length, 2);
  const list = await listAssets(projectId);
  assert.deepEqual(list.items.map((item) => item.asset.sortOrder), [8, 9]);
  assert.match(list.items[1].previewUrl, /\/object\/sign\/product-assets\//);
  assert.ok(list.expiresAt <= Date.now() + 300_000);
  assert.equal(state.requests.find((item) => item.path.includes("/sign/")).payload.expiresIn, 300);
  assert.doesNotMatch(JSON.stringify(state.assets), /signedUrl|temporary-test-token/);
});

test("missing Project/Product and mismatched relationship stop Storage writes", async (t) => {
  const state = await fixture(t);
  await assert.rejects(uploadAsset("bad-id", uploadFile));
  state.project = null; await assert.rejects(uploadAsset(projectId, uploadFile), /프로젝트/);
  state.project = { id: projectId, name: "프로젝트" }; state.product = null;
  assert.equal((await getAssetContext(projectId)).product, null);
  await assert.rejects(uploadAsset(projectId, uploadFile), /상품정보/);
  state.product = { id: productId, project_id: otherId, name: "다른 상품" }; state.ignoreProductFilter = true;
  await assert.rejects(uploadAsset(projectId, uploadFile), /연결/);
  assert.equal(state.objects.size, 0);
});

test("30 existing assets reject upload before Storage; simultaneous upload is guarded", async (t) => {
  const state = await fixture(t);
  state.assets = Array.from({ length: 30 }, (_, index) => assetRow({ sort_order: index }));
  await assert.rejects(uploadAsset(projectId, uploadFile), /30개/); assert.equal(state.objects.size, 0);
  state.assets = [];
  const results = await Promise.allSettled([uploadAsset(projectId, uploadFile), uploadAsset(projectId, uploadFile)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(state.assets.length, 1);
});

test("failed DB INSERT removes uploaded object and hides internal error", async (t) => {
  const state = await fixture(t); state.failure = "insert";
  const response = await assetResponse(() => uploadAsset(projectId, uploadFile));
  assert.equal(response.status, 503); const body = await response.text();
  assert.match(body, /정리했습니다/); assert.doesNotMatch(body, /secret-test-key|private-db-detail/);
  assert.equal(state.objects.size, 0); assert.equal(state.assets.length, 0);
});

test("acknowledgement loss is recovered without deleting a committed asset", async (t) => {
  const state = await fixture(t); state.ackLost = true;
  const asset = await uploadAsset(projectId, uploadFile);
  assert.equal(asset.id, state.assets[0].id); assert.equal(state.objects.size, 1);
});

test("uncertain INSERT and failed cleanup return recovery guidance", async (t) => {
  const state = await fixture(t); state.failure = "insert"; state.failRecoveryRead = true;
  await assert.rejects(uploadAsset(projectId, uploadFile), /저장 결과를 확인하지 못했습니다/);
  assert.equal(state.objects.size, 1);
  state.failRecoveryRead = false; state.failCleanup = true;
  await assert.rejects(uploadAsset(projectId, uploadFile), /관리자 확인/);
});

test("Storage upload failure creates no DB asset", async (t) => {
  const state = await fixture(t); state.failure = "upload";
  await assert.rejects(uploadAsset(projectId, uploadFile), /업로드/);
  assert.equal(state.assets.length, 0); assert.equal(state.objects.size, 0);
});

test("delete rejects foreign asset ids, mismatched product, and unsafe paths before Storage", async (t) => {
  const state = await fixture(t);
  for (const override of [{ project_id: otherId }, { product_id: otherId }, { storage_path: `projects/${otherId}/file.png` }]) {
    state.assets = [assetRow(override)];
    await assert.rejects(deleteAsset(projectId, assetId));
  }
  assert.equal(state.requests.filter((item) => item.method === "DELETE").length, 0);
});

test("delete removes file and DB; file failure preserves DB; DB failure permits retry", async (t) => {
  const state = await fixture(t); const row = assetRow();
  state.assets = [row]; state.objects.add(row.storage_path); state.failure = "storage-delete";
  await assert.rejects(deleteAsset(projectId, assetId), /파일을 삭제하지 못했습니다/);
  assert.equal(state.assets.length, 1); assert.equal(state.objects.size, 1);
  state.failure = "db-delete";
  await assert.rejects(deleteAsset(projectId, assetId), /목록 정리/);
  assert.equal(state.assets.length, 1); assert.equal(state.objects.size, 0);
  state.failure = null; await deleteAsset(projectId, assetId);
  assert.equal(state.assets.length, 0); assert.equal(state.objects.size, 0);
});

test("missing preview object is visible as unavailable; query errors stay private", async (t) => {
  const state = await fixture(t); state.assets = [assetRow()];
  assert.equal((await listAssets(projectId)).items[0].previewUrl, null);
  state.failure = "read";
  const response = await assetResponse(() => listAssets(projectId));
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private-|secret-test-key/);
});

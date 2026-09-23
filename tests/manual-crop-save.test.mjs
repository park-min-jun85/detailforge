import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { startAssetDb, assetRow, assetId, projectId, otherId } from './helpers/asset-db.mjs';
import { frameMissAnalogues, renderFrameMiss } from './fixtures/v0.2.1/frame-miss-analogues.mjs';
import { candidateId } from '../src/features/detail-extraction/geometry.ts';
import { sourceFingerprint, cropImage } from '../src/features/detail-extraction/images.ts';
import { manualCropRect, effectiveCropRect } from '../src/features/detail-extraction/crop-geometry.ts';
import { saveProductShots } from '../src/features/detail-extraction/service.ts';
import { getExtractionReview } from '../src/features/detail-extraction/review.ts';
import { derivationSchema } from '../src/features/detail-extraction/schemas.ts';
import { POST } from '../src/app/api/projects/[projectId]/assets/[assetId]/extract-product-shots/save/route.ts';

const zero = { left: 0, top: 0, right: 0, bottom: 0 }, dimensions = { width: 800, height: 4000 };
const code = expected => error => error.code === expected;
const sourceCache = new Map();
async function fixture(t, name = 'RF-A-R', size = {}) {
  const db = await startAssetDb(); t.after(() => db.close());
  const sample = { ...frameMissAnalogues.find(f => f.id === name), ...size }, key = JSON.stringify([name, size]);
  if (!sourceCache.has(key)) sourceCache.set(key, (async () => {
    const patch = await sharp(renderFrameMiss(sample), { raw: { width: sample.width, height: sample.height, channels: 4 } }).png().toBuffer();
    return sharp({ create: { ...dimensions, channels: 4, background: '#a9c3b1' } }).composite([{ input: patch, left: 100, top: 200 }]).png().toBuffer();
  })());
  const bytes = await sourceCache.get(key), fingerprint = sourceFingerprint(bytes);
  const result = { schemaVersion: 1, policyVersion: 1, sourceFingerprint: fingerprint, sourceDimensions: dimensions, coordinateSpace: 'orientation_normalized_pixels', sourceOrientation: 1,
    provider: 'openai', model: 'stored-fixture-no-provider', analyzedAt: '2026-09-23T00:00:00.000Z', tileCount: 2, completedTiles: 2, failedTiles: [], partialAnalysis: false, truncatedCandidates: false, candidates: [] };
  const row = assetRow({ size_bytes: bytes.length, width: dimensions.width, height: dimensions.height, asset_type: 'detail', metadata: { source: { retained: true }, detailExtraction: {
    schemaVersion: 1, revision: randomUUID(), saveLease: null, attempt: { status: 'completed', runId: randomUUID(), startedAt: '2026-09-23T00:00:00.000Z', finishedAt: '2026-09-23T00:00:01.000Z', errorCode: null }, latestResult: result,
  } } });
  db.state.assets.push(row); db.state.objects.add(row.storage_path); db.state.objectBytes.set(row.storage_path, bytes);
  const add = (rect = { x: 100, y: 200, width: sample.width, height: sample.height }, regionType = 'product_photo') => {
    const c = { id: candidateId(fingerprint, rect, regionType), rect, regionType, confidence: .9, productVisibility: .9, standaloneUsability: .9, textDensity: 'none', rationale: 'stored fixture', defaultSelected: false, saveAllowed: true, edgeTruncated: false, tileIndices: [0] };
    row.metadata.detailExtraction.latestResult.candidates.push(c); return c;
  };
  const candidate = add();
  const body = (items = [{ candidateId: candidate.id, manualInsets: zero }]) => ({ schemaVersion: 2, expectedRevision: row.metadata.detailExtraction.revision, items });
  return { ...db, row, bytes, fingerprint, candidate, add, body };
}
const storageWrites = f => f.state.requests.filter(r => r.method === 'POST' && r.path.startsWith('/storage/v1/object/product-assets')).length;
const dbWrites = f => f.state.requests.filter(r => ['POST', 'PATCH', 'DELETE'].includes(r.method) && r.path.startsWith('/rest/v1/')).length;
const makeRequest = (body, origin = 'http://localhost') => new Request('http://localhost/save', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const route = body => POST(makeRequest(body), { params: Promise.resolve({ projectId, assetId }) });

for (const [label, name, size, insets] of [
  ['A01', 'RF-A-R', {}, { left: 16, top: 16, right: 16, bottom: 16 }],
  ['B01', 'RF-B-R', { width: 380, height: 572 }, { ...zero, bottom: 26 }],
  ['B02', 'RF-C-R', { width: 691, height: 547 }, { ...zero, bottom: 38 }],
]) test(`${label} generalized preserve scenario: exact manual save, no safety claim or original mutation`, async t => {
  const f = await fixture(t, name, size), original = Buffer.from(f.bytes);
  const image = { bytes: f.bytes, mime: 'image/png', orientation: 1, dimensions, fingerprint: f.fingerprint };
  const auto = await cropImage(image, f.candidate.rect); assert.equal(auto.trim, undefined);
  const reply = await saveProductShots(projectId, assetId, f.body([{ candidateId: f.candidate.id, manualInsets: insets }]));
  assert.equal(reply.failed.length, 0); assert.equal(reply.saved.length, 1);
  const asset = reply.saved[0].asset, d = derivationSchema.parse(asset.metadata.derivation), final = manualCropRect(f.candidate.rect, dimensions, insets);
  assert.equal(d.schemaVersion, 2); assert.deepEqual(d.sourceRect, f.candidate.rect); assert.deepEqual(d.adjustment, { mode: 'manual', insets });
  assert.deepEqual(effectiveCropRect(d), final); assert.equal(d.parentAssetId, assetId); assert.equal(d.sourceFingerprint, f.fingerprint); assert.equal(d.candidateId, f.candidate.id);
  assert.equal(d.trim, undefined); assert.equal(asset.assetType, 'unclassified'); assert.deepEqual([asset.width, asset.height], [final.width, final.height]);
  const actual = await sharp(f.state.objectBytes.get(asset.storagePath)).ensureAlpha().raw().toBuffer();
  const expected = await sharp(f.bytes).extract({ left: final.x, top: final.y, width: final.width, height: final.height }).ensureAlpha().raw().toBuffer();
  assert.deepEqual(actual, expected); assert.deepEqual(f.state.objectBytes.get(f.row.storage_path), original);
  assert.doesNotMatch(JSON.stringify(d), /safe_to_trim|contentRisk|knownContentBounds|history|temporary-test-token/);
});
test('all-zero manual bypasses a confirmed automatic frame and creates full Candidate variant', async t => {
  const f = await fixture(t, 'RF-A-P');
  const auto = await saveProductShots(projectId, assetId, { candidateIds: [f.candidate.id] });
  const old = structuredClone(f.state.assets[1]); assert.equal(auto.saved[0].asset.metadata.derivation.trim.insets.top, 8);
  const manual = await saveProductShots(projectId, assetId, f.body());
  assert.equal(manual.saved[0].existing, false); assert.equal(manual.saved[0].asset.height, 320);
  assert.deepEqual(manual.saved[0].asset.metadata.derivation.adjustment.insets, zero);
  assert.deepEqual(f.state.assets[1], old); assert.equal(f.state.assets.length, 3);
});
test('automatic and manual same final pixels reuse without provenance rewrite', async t => {
  const f = await fixture(t, 'RF-A-P'), auto = await saveProductShots(projectId, assetId, { candidateIds: [f.candidate.id] }), before = structuredClone(f.state.assets[1]);
  const reply = await saveProductShots(projectId, assetId, f.body([{ candidateId: f.candidate.id, manualInsets: { ...zero, top: 8 } }]));
  assert.equal(reply.saved[0].existing, true); assert.equal(reply.saved[0].asset.id, auto.saved[0].asset.id);
  assert.equal(f.state.assets.length, 2); assert.equal(storageWrites(f), 1); assert.deepEqual(f.state.assets[1], before);
});
test('manual-first matching automatic crop also reuses exact final pixels', async t => {
  const f = await fixture(t, 'RF-A-P');
  const first = await saveProductShots(projectId, assetId, f.body([{ candidateId: f.candidate.id, manualInsets: { ...zero, top: 8 } }]));
  const reply = await saveProductShots(projectId, assetId, { candidateIds: [f.candidate.id] });
  assert.equal(reply.saved[0].existing, true); assert.equal(reply.saved[0].asset.id, first.saved[0].asset.id);
  assert.equal(reply.saved[0].asset.metadata.derivation.schemaVersion, 2); assert.equal(storageWrites(f), 1);
});
test('same manual final rect replay is idempotent and distinct variant consumes one slot', async t => {
  const f = await fixture(t), items = [{ candidateId: f.candidate.id, manualInsets: { ...zero, top: 16 } }];
  const first = await saveProductShots(projectId, assetId, f.body(items));
  const replay = await saveProductShots(projectId, assetId, f.body(items)); assert.equal(replay.saved[0].asset.id, first.saved[0].asset.id); assert.equal(replay.saved[0].existing, true);
  const variant = await saveProductShots(projectId, assetId, f.body([{ candidateId: f.candidate.id, manualInsets: { ...zero, top: 17 } }]));
  assert.notEqual(variant.saved[0].asset.id, first.saved[0].asset.id); assert.equal(storageWrites(f), 2); assert.equal(f.state.assets.length, 3);
});
test('different base and role can share final rect in a single mixed request and one slot', async t => {
  const f = await fixture(t), second = f.add({ ...f.candidate.rect, x: 110, width: 310 }, 'detail_closeup');
  for (let i = 0; i < 28; i++) f.state.assets.push(assetRow({ id: randomUUID() }));
  const reply = await saveProductShots(projectId, assetId, f.body([
    { candidateId: f.candidate.id, manualInsets: { ...zero, left: 20 } }, { candidateId: second.id, manualInsets: { ...zero, left: 10 } },
  ]));
  assert.equal(reply.saved.length, 2); assert.equal(reply.saved[0].asset.id, reply.saved[1].asset.id); assert.equal(reply.available, 0); assert.equal(storageWrites(f), 1);
});
test('legacy approved automatic result survives policy change; manual never falls back to base', async t => {
  const f = await fixture(t), prior = await saveProductShots(projectId, assetId, { candidateIds: [f.candidate.id] });
  const old = f.state.assets[1]; old.height -= 6;
  old.metadata.derivation.trim = { policyVersion: 1, insets: { ...zero, top: 6 }, postTrimDimensions: { width: 320, height: 314 } };
  const legacyBytes = await sharp(f.state.objectBytes.get(old.storage_path)).extract({ left: 0, top: 6, width: 320, height: 314 }).png().toBuffer();
  f.state.objectBytes.set(old.storage_path, legacyBytes); old.size_bytes = legacyBytes.length;
  const before = structuredClone(old), bytes = Buffer.from(f.state.objectBytes.get(old.storage_path));
  const automatic = await saveProductShots(projectId, assetId, f.body([{ candidateId: f.candidate.id }]));
  assert.equal(automatic.saved[0].existing, true); assert.equal(automatic.saved[0].asset.id, prior.saved[0].asset.id);
  const manual = await saveProductShots(projectId, assetId, f.body()); assert.equal(manual.saved[0].existing, false);
  assert.deepEqual(f.state.assets[1], before); assert.deepEqual(f.state.objectBytes.get(old.storage_path), bytes);
});
test('new manual rows never mark the entire base saved for legacy review', async t => {
  const f = await fixture(t), before = await getExtractionReview(projectId, assetId);
  const saved = await saveProductShots(projectId, assetId, f.body()), view = await getExtractionReview(projectId, assetId);
  assert.deepEqual(view.savedCandidateIds, []); assert.equal(view.result.candidates[0].basisKey, before.result.candidates[0].basisKey);
  assert.notEqual(view.revision, before.revision); assert.deepEqual(view.savedCrops, [{ assetId: saved.saved[0].asset.id, finalRect: f.candidate.rect, adjustmentMode: 'manual' }]);
  assert.equal(view.result.sourceOrientation, 1); assert.equal(view.result.coordinateSpace, 'orientation_normalized_pixels');
  assert.doesNotMatch(JSON.stringify(view), /sourceFingerprint|storagePath|checkpoint|temporary-test-token/);
});
test('mixed auto/manual items save independently and retain provenance modes', async t => {
  const f = await fixture(t), second = f.add({ x: 100, y: 1000, width: 320, height: 320 });
  const reply = await saveProductShots(projectId, assetId, f.body([{ candidateId: f.candidate.id }, { candidateId: second.id, manualInsets: zero }]));
  assert.deepEqual(reply.saved.map(s => s.asset.metadata.derivation.schemaVersion), [1, 2]); assert.equal(reply.failed.length, 0);
});
for (const [label, mutate, expected] of [
  ['source bytes changed', f => f.state.objectBytes.set(f.row.storage_path, Buffer.from('changed')), 'source_changed'],
  ['orientation changed', f => { f.row.metadata.detailExtraction.latestResult.sourceOrientation = 2; }, 'source_changed'],
  ['source dimensions changed', f => { f.row.metadata.detailExtraction.latestResult.sourceDimensions = { width: 799, height: 4000 }; }, 'source_changed'],
  ['candidate removed', f => { f.row.metadata.detailExtraction.latestResult.candidates = []; }, 'stale'],
  ['candidate identity changed', f => { f.row.metadata.detailExtraction.latestResult.candidates[0].rect.x++; }, 'stale'],
  ['revision changed', f => { f.row.metadata.detailExtraction.revision = randomUUID(); }, 'conflict'],
  ['save prohibited', f => { f.row.metadata.detailExtraction.latestResult.candidates[0].saveAllowed = false; }, 'stale'],
  ['recursive source', f => { f.row.metadata.derivation = { kind: 'detail_image_crop' }; }, 'recursive'],
  ['foreign asset product', f => { f.row.product_id = otherId; }, 'not_found'],
  ['foreign project', f => { f.row.project_id = otherId; }, 'not_found'],
  ['foreign product ownership', f => { f.state.product.project_id = otherId; f.state.ignoreProductFilter = true; }, 'ownership'],
]) test(`manual ${label}: reject before crop/upload/database write`, async t => {
  const f = await fixture(t), body = f.body(); mutate(f);
  await assert.rejects(saveProductShots(projectId, assetId, body), code(expected)); assert.equal(storageWrites(f), 0); assert.equal(dbWrites(f), 0);
});
test('a prohibited role cannot be saved even with a forged saveAllowed flag', async t => {
  const f = await fixture(t), c = f.add(f.candidate.rect, 'shipping_or_notice'); c.saveAllowed = true;
  await assert.rejects(saveProductShots(projectId, assetId, f.body([{ candidateId: c.id, manualInsets: zero }])), code('stale')); assert.equal(storageWrites(f), 0);
});
for (const kind of ['analysis', 'save']) test(`active ${kind} lease blocks manual; expired lease recovers`, async t => {
  const f = await fixture(t), state = f.row.metadata.detailExtraction;
  if (kind === 'analysis') { state.attempt.status = 'analyzing'; state.attempt.startedAt = new Date().toISOString(); }
  else state.saveLease = { id: randomUUID(), startedAt: new Date().toISOString() };
  await assert.rejects(saveProductShots(projectId, assetId, f.body()), code('busy')); assert.equal(storageWrites(f), 0);
  if (kind === 'analysis') state.attempt.startedAt = '2020-01-01T00:00:00.000Z'; else state.saveLease.startedAt = '2020-01-01T00:00:00.000Z';
  assert.equal((await saveProductShots(projectId, assetId, f.body())).saved.length, 1);
});
test('CAS race before claim prevents all crop uploads', async t => {
  const f = await fixture(t); f.state.beforePatch = payload => { if (payload.metadata?.detailExtraction?.saveLease) { f.row.metadata.detailExtraction.revision = randomUUID(); f.state.beforePatch = null; } };
  await assert.rejects(saveProductShots(projectId, assetId, f.body()), code('conflict')); assert.equal(storageWrites(f), 0); assert.equal(f.state.assets.length, 1);
});
test('external result/revision change during multi-save stops remaining items, keeps success', async t => {
  const f = await fixture(t), second = f.add({ x: 100, y: 1000, width: 320, height: 320 });
  const add = f.state.objects.add.bind(f.state.objects);
  f.state.objects.add = path => { f.row.metadata.detailExtraction.revision = randomUUID(); return add(path); };
  const reply = await saveProductShots(projectId, assetId, f.body([{ candidateId: f.candidate.id, manualInsets: zero }, { candidateId: second.id, manualInsets: zero }]));
  assert.equal(reply.saved.length, 1); assert.equal(reply.failed[0].code, 'conflict'); assert.equal(storageWrites(f), 1); assert.equal(f.state.assets.length, 2);
});
test('asset-limit preflight counts final unique rectangles, rejects before writes', async t => {
  const f = await fixture(t), second = f.add({ x: 100, y: 1000, width: 320, height: 320 });
  for (let i = 0; i < 28; i++) f.state.assets.push(assetRow({ id: randomUUID() }));
  await assert.rejects(saveProductShots(projectId, assetId, f.body([{ candidateId: f.candidate.id, manualInsets: zero }, { candidateId: second.id, manualInsets: zero }])), e => e.code === 'asset_limit' && e.available === 1);
  assert.equal(storageWrites(f), 0); assert.equal(dbWrites(f), 0); assert.equal(f.state.assets.length, 29);
});
test('full inventory still permits duplicate reuse without slot consumption', async t => {
  const f = await fixture(t), first = await saveProductShots(projectId, assetId, f.body());
  for (let i = 0; i < 28; i++) f.state.assets.push(assetRow({ id: randomUUID() }));
  const reply = await saveProductShots(projectId, assetId, f.body()); assert.equal(reply.saved[0].asset.id, first.saved[0].asset.id); assert.equal(reply.available, 0); assert.equal(storageWrites(f), 1);
});
test('invalid final geometry anywhere rejects whole batch before saving valid first item', async t => {
  const f = await fixture(t), second = f.add({ x: 100, y: 1000, width: 320, height: 320 });
  await assert.rejects(saveProductShots(projectId, assetId, f.body([{ candidateId: f.candidate.id, manualInsets: zero }, { candidateId: second.id, manualInsets: { ...zero, left: 200 } }])), code('crop_too_small'));
  assert.equal(storageWrites(f), 0); assert.equal(dbWrites(f), 0);
});
for (const failure of ['upload', 'insert']) test(`manual ${failure} failure is bounded with compensation, other saves continue`, async t => {
  const f = await fixture(t), second = f.add({ x: 100, y: 1000, width: 320, height: 320 });
  const add = f.state.objects.add.bind(f.state.objects); let n = 0;
  if (failure === 'upload') { f.state.failure = 'upload'; }
  else f.state.objects.add = path => { if (++n === 2) f.state.failure = 'insert'; return add(path); };
  const reply = await saveProductShots(projectId, assetId, f.body([{ candidateId: f.candidate.id, manualInsets: zero }, { candidateId: second.id, manualInsets: zero }]));
  assert.equal(reply.failed.length, failure === 'upload' ? 2 : 1); assert.equal(reply.failed[0].code, failure === 'upload' ? 'upload' : 'database');
  assert.equal(f.state.objects.size, failure === 'upload' ? 1 : 2); assert.equal(f.state.assets.length, failure === 'upload' ? 1 : 2);
  assert.doesNotMatch(JSON.stringify(reply.failed), /private-db|private-storage|secret-test-key/);
});
test('upload cleanup failure reports recovery and preserves existing source', async t => {
  const f = await fixture(t); f.state.failure = 'upload'; f.state.failCleanup = true;
  assert.equal((await saveProductShots(projectId, assetId, f.body())).failed[0].code, 'recovery'); assert.equal(f.state.assets.length, 1);
});
test('INSERT lost ack reuses committed manual crop on subsequent explicit save', async t => {
  const f = await fixture(t); f.state.ackLost = true;
  const first = await saveProductShots(projectId, assetId, f.body()), second = await saveProductShots(projectId, assetId, f.body());
  assert.equal(first.failed.length, 0); assert.equal(second.saved[0].asset.id, first.saved[0].asset.id); assert.equal(f.state.assets.length, 2); assert.equal(storageWrites(f), 1);
});
test('uncertain INSERT read never deletes a possibly committed manual file', async t => {
  const f = await fixture(t); f.state.ackLost = true;
  const add = f.state.objects.add.bind(f.state.objects); f.state.objects.add = path => { f.state.failRecoveryRead = true; return add(path); };
  await assert.rejects(saveProductShots(projectId, assetId, f.body()));
  assert.equal(f.state.assets.length, 2); assert.equal(f.state.objects.size, 2); assert.equal(f.state.requests.filter(r => r.method === 'DELETE').length, 0);
});
test('V1 and V2 route return safe result summaries, never storage paths or raw metadata', async t => {
  const f = await fixture(t);
  for (const body of [{ candidateIds: [f.candidate.id] }, f.body()]) {
    if ('expectedRevision' in body) body.expectedRevision = f.row.metadata.detailExtraction.revision;
    const response = await route(body), reply = await response.json(); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(reply.saved[0].candidateId, f.candidate.id); assert.ok(reply.saved[0].asset.id);
    assert.deepEqual(Object.keys(reply.saved[0].asset).sort(), ['assetType', 'height', 'id', 'mimeType', 'width']);
    assert.doesNotMatch(JSON.stringify(reply), /storagePath|storage_path|metadata|checkpoint|sourceFingerprint|temporary-test-token/);
  }
});
test('route maps small crop 400 and stale revision 409; same-origin/body limit unchanged', async t => {
  const f = await fixture(t);
  const tooSmall = await route(f.body([{ candidateId: f.candidate.id, manualInsets: { ...zero, left: 200 } }]));
  assert.equal(tooSmall.status, 400); assert.equal((await tooSmall.json()).code, 'crop_too_small');
  const stale = await route({ ...f.body(), expectedRevision: randomUUID() }); assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'conflict');
  const foreign = await POST(makeRequest(f.body(), 'https://evil.example'), { params: Promise.resolve({ projectId, assetId }) }); assert.equal(foreign.status, 403);
  const huge = await route(' '.repeat(8193)); assert.equal(huge.status, 400); assert.equal(dbWrites(f), 0); assert.equal(storageWrites(f), 0);
});

test('source/base/orientation changes invalidate review basis while ordering and revision do not', async t => {
  const f = await fixture(t), initial = (await getExtractionReview(projectId, assetId)).result.candidates[0].basisKey;
  f.add({ x: 100, y: 1000, width: 320, height: 320 }); f.row.metadata.detailExtraction.latestResult.candidates.reverse();
  f.row.metadata.detailExtraction.revision = randomUUID();
  assert.equal((await getExtractionReview(projectId, assetId)).result.candidates.find(c => c.id === f.candidate.id).basisKey, initial);
  f.row.metadata.detailExtraction.latestResult.sourceOrientation = 2;
  assert.notEqual((await getExtractionReview(projectId, assetId)).result.candidates.find(c => c.id === f.candidate.id).basisKey, initial);
});
test('forged out-of-source canonical candidate and foreign candidate ID reject before writes', async t => {
  const f = await fixture(t);
  await assert.rejects(saveProductShots(projectId, assetId, f.body([{ candidateId: 'f'.repeat(64), manualInsets: zero }])), code('stale'));
  const c = f.add({ x: 700, y: 200, width: 320, height: 320 });
  await assert.rejects(saveProductShots(projectId, assetId, f.body([{ candidateId: c.id, manualInsets: zero }])), code('invalid_rect'));
  assert.equal(storageWrites(f), 0); assert.equal(dbWrites(f), 0);
});
for (const boundary of ['parent', 'hash', 'dimensions']) test(`manual duplicate does not reuse mismatched ${boundary}`, async t => {
  const f = await fixture(t); await saveProductShots(projectId, assetId, f.body());
  const old = f.state.assets[1];
  if (boundary === 'parent') old.metadata.derivation.parentAssetId = otherId;
  else if (boundary === 'hash') old.metadata.derivation.sourceFingerprint = 'f'.repeat(64);
  else old.width--;
  const before = structuredClone(old), next = await saveProductShots(projectId, assetId, f.body());
  assert.equal(next.saved[0].existing, false); assert.deepEqual(old, before); assert.equal(f.state.assets.length, 3);
});
test('manual multi-save preserves first and third success around a transient Storage failure', async t => {
  const f = await fixture(t), second = f.add({ x: 100, y: 1000, width: 320, height: 320 }), third = f.add({ x: 100, y: 2000, width: 320, height: 320 });
  const originalFetch = globalThis.fetch; let uploads = 0;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url ?? String(input);
    if (url.startsWith(process.env.SUPABASE_URL + '/storage/v1/object/product-assets/') && init?.method === 'POST' && ++uploads === 2)
      return new Response(JSON.stringify({ message: 'private failure' }), { status: 503 });
    return originalFetch(input, init);
  };
  const reply = await saveProductShots(projectId, assetId, f.body([f.candidate, second, third].map(c => ({ candidateId: c.id, manualInsets: zero }))));
  assert.deepEqual(reply.saved.map(s => s.candidateId), [f.candidate.id, third.id]); assert.equal(reply.failed[0].candidateId, second.id);
  assert.equal(reply.failed[0].code, 'upload'); assert.equal(f.state.assets.length, 3); assert.equal(f.state.objects.size, 3); assert.equal(uploads, 3);
});
test('same-final repeated items cannot retry an uncertain INSERT inside the same batch', async t => {
  const f = await fixture(t), second = f.add(f.candidate.rect, 'detail_closeup'); f.state.ackLost = true;
  const originalFetch = globalThis.fetch; t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
    if (url.origin === process.env.SUPABASE_URL && url.pathname === '/rest/v1/assets' && url.searchParams.has('id')
      && url.searchParams.get('id') !== 'eq.' + assetId && (init?.method ?? 'GET') === 'GET')
      return new Response(JSON.stringify({ message: 'unknown INSERT acknowledgement' }), { status: 503 });
    return originalFetch(input, init);
  };
  const reply = await saveProductShots(projectId, assetId, f.body([f.candidate, second].map(c => ({ candidateId: c.id, manualInsets: zero }))));
  assert.equal(reply.saved.length, 0); assert.deepEqual(reply.failed.map(f => f.code), ['recovery', 'recovery']);
  assert.equal(f.state.assets.length, 2); assert.equal(storageWrites(f), 1); assert.equal(f.state.requests.filter(r => r.method === 'DELETE').length, 0);
});

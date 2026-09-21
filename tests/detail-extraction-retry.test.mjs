import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { startAssetDb, assetRow, projectId, productId, assetId, otherId } from './helpers/asset-db.mjs';
import { m2Corpus, region, failures } from './fixtures/v0.2/m2-tile-recovery.mjs';
import { retryProductShots, aggregateCheckpoint, retryRequestSchema } from '../src/features/detail-extraction/retry.ts';
import { analyzeProductShots, saveProductShots } from '../src/features/detail-extraction/service.ts';
import { buildCheckpointInput, createCheckpoint, completedTileCheckpoint, failedTileCheckpoint, recordTileCheckpoint,
  checkpointReadModel, checkpointInputFingerprint, tileLayoutFingerprint, tileIdentity } from '../src/features/detail-extraction/checkpoint.ts';
import { decodeSource, imageTiles, tileDataUrl } from '../src/features/detail-extraction/images.ts';
import { buildExtractionProductContext, productContextFingerprint } from '../src/features/detail-extraction/product-context.ts';
import { EXTRACTION_PROMPT, RELEVANCE_PROMPT, getExtractionModel, createExtractionProvider } from '../src/features/detail-extraction/provider.ts';
import { readExtraction } from '../src/features/detail-extraction/schemas.ts';
import { ExtractionError } from '../src/features/detail-extraction/errors.ts';
import { POST } from '../src/app/api/projects/[projectId]/assets/[assetId]/extract-product-shots/retry/route.ts';

const code = expected => error => error.code === expected;
const now = '2026-09-21T00:00:00.000Z';
const output = () => ({ schemaVersion: 2, regions: [structuredClone(region)] });
async function fixture(t, sample = m2Corpus[1], height = 6000, model = 'test-vision-v1') {
  const db = await startAssetDb(); t.after(() => db.close());
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (target, init) => {
    const url = new URL(typeof target === 'string' ? target : target instanceof URL ? target.href : target.url);
    assert.equal(url.hostname, '127.0.0.1', 'No external network calls');
    return originalFetch(target, init);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const bytes = await sharp({ create: { width: 400, height, channels: 3, background: '#999' } }).png().toBuffer();
  const image = await decodeSource(bytes, 'image/png'), layout = await imageTiles(image);
  const context = buildExtractionProductContext(db.state.product, null);
  const input = buildCheckpointInput(image, productContextFingerprint(context), model, layout, `${EXTRACTION_PROMPT}\n${RELEVANCE_PROMPT}`);
  let cache = createCheckpoint(input, layout, randomUUID());
  for (const tile of layout) {
    const logical = height === 6000 ? sample.before[tile.index] : tile.index === layout.length - 1 ? sample.before[1] : sample.before[0];
    cache = recordTileCheckpoint(cache, logical.status === 'completed' ? completedTileCheckpoint(input, tile, logical.result)
      : failedTileCheckpoint(input, tile, logical.failure));
  }
  const extraction = { schemaVersion: 2, revision: randomUUID(), saveLease: null, checkpoint: cache, checkpointWriteError: null,
    latestResultInputFingerprint: checkpointInputFingerprint(input), latestResult: aggregateCheckpoint(cache, now),
    attempt: { status: 'completed', runId: cache.runId, startedAt: now, finishedAt: now, errorCode: null } };
  const row = assetRow({ size_bytes: bytes.length, metadata: { custom: { untouched: true }, source: { original: true }, detailExtraction: extraction } });
  db.state.assets.push(row); db.state.objects.add(row.storage_path); db.state.objectBytes.set(row.storage_path, bytes);
  const calls = [], prepared = [];
  const f = { ...db, row, image, layout, calls, prepared, behavior: () => output(),
    processing: { prepareTile: async (source, tile) => { prepared.push(tile.index); return tileDataUrl(source, tile); }, aggregate: aggregateCheckpoint } };
  f.provider = { model, analyze: async dataUrl => { assert.ok(dataUrl.startsWith('data:image/jpeg;base64,'));
    const index = prepared.at(-1); calls.push(index); return f.behavior(index); } };
  f.retry = (request = {}, processing = f.processing) => retryProductShots(projectId, assetId,
    { expectedRevision: row.metadata.detailExtraction.revision, ...request }, () => f.provider, processing);
  f.tileId = index => row.metadata.detailExtraction.checkpoint.tiles.find(tile => tile.index === index).tileId;
  return f;
}
const checkpoint = f => f.row.metadata.detailExtraction.checkpoint;
const state = f => f.row.metadata.detailExtraction;
const patches = f => f.state.requests.filter(r => r.method === 'PATCH');

for (const sample of m2Corpus) test(`retry service reuses ${sample.id}: ${sample.title}`, async t => {
  const f = await fixture(t, sample), before = structuredClone(checkpoint(f));
  const previous = structuredClone(state(f).latestResult);
  if (sample.id === 'T5') f.behavior = () => { throw new ExtractionError('timeout'); };
  if (sample.id === 'T6') f.state.objectBytes.set(f.row.storage_path, await sharp(f.image.bytes).negate().png().toBuffer());
  if (sample.id === 'T7') f.state.product.name = 'changed identity';
  if (sample.expected.stale) {
    await assert.rejects(f.retry(), code('checkpoint_stale')); assert.equal(f.calls.length, 0); assert.equal(patches(f).length, 0); return;
  }
  const reply = await f.retry();
  assert.deepEqual(f.calls, sample.expected.retryTargets); assert.deepEqual(f.prepared, f.calls);
  for (const tile of before.tiles.filter(tile => tile.status === 'completed')) assert.deepEqual(checkpoint(f).tiles[tile.index], tile);
  if (sample.id === 'T5') { assert.deepEqual(state(f).latestResult, previous); assert.equal(reply.runStatus, 'partial'); assert.equal(reply.code, 'provider_failure'); }
  else assert.equal(reply.runStatus, sample.id === 'T4' ? 'partial' : 'complete');
  assert.equal(reply.attemptedTileCount, f.calls.length);
  assert.equal(reply.revision, state(f).revision);
  assert.equal(JSON.stringify(reply).includes('data:image'), false); assert.equal('checkpoint' in reply, false);
});
test('two failures in reverse requested order encode/call exactly indices 1,3; fresh full aggregation identical', async t => {
  const f = await fixture(t);
  checkpoint(f).tiles[3] = failedTileCheckpoint(checkpoint(f).input, f.layout[3], failures.timeout);
  state(f).latestResult = aggregateCheckpoint(checkpoint(f), now);
  const reply = await f.retry({ requestedTileIds: [f.tileId(3), f.tileId(1)] });
  assert.deepEqual(f.calls, [1, 3]); assert.deepEqual(f.prepared, [1, 3]); assert.equal(reply.succeededTileCount, 2);
  const fresh = structuredClone(checkpoint(f)); fresh.tiles = f.layout.map(tile => completedTileCheckpoint(fresh.input, tile, output()));
  assert.deepEqual(state(f).latestResult, aggregateCheckpoint(fresh, state(f).latestResult.analyzedAt));
  assert.equal(reply.runStatus, 'complete');
  const retryResult = structuredClone(state(f).latestResult); let fullCalls = 0;
  await analyzeProductShots(projectId, assetId, true, () => ({ model: f.provider.model, analyze: async () => { fullCalls++; return output(); } }));
  assert.equal(fullCalls, 4); assert.deepEqual({ ...state(f).latestResult, analyzedAt: retryResult.analyzedAt }, retryResult);
});
test('partial request calls only one of two failures; other remains retryable', async t => {
  const f = await fixture(t); checkpoint(f).tiles[3] = failedTileCheckpoint(checkpoint(f).input, f.layout[3], failures.timeout);
  const retained = structuredClone(checkpoint(f).tiles[3]);
  const reply = await f.retry({ requestedTileIds: [f.tileId(1)] });
  assert.deepEqual(f.calls, [1]); assert.deepEqual(checkpoint(f).tiles[3], retained);
  assert.equal(reply.runStatus, 'partial'); assert.equal(reply.remainingFailedTileCount, 1);
  assert.deepEqual(checkpointReadModel(state(f), checkpoint(f).input).retryableTileIds, [f.tileId(3)]);
});
test('mixed retry outcome preserves success and leaves one failure without automatic retry', async t => {
  const f = await fixture(t); checkpoint(f).tiles[3] = failedTileCheckpoint(checkpoint(f).input, f.layout[3], failures.timeout);
  f.behavior = index => { if (index === 3) throw new Error('private-provider-message'); return output(); };
  const reply = await f.retry();
  assert.deepEqual(f.calls, [1, 3]); assert.equal(reply.succeededTileCount, 1); assert.equal(reply.failedTileCount, 1);
  assert.equal(reply.remainingFailedTileCount, 1); assert.equal(reply.runStatus, 'partial');
  assert.equal(JSON.stringify(state(f)).includes('private-provider-message'), false);
});
for (const successes of [0, 1, 4]) test(`all failed -> ${successes} recovered tiles`, async t => {
  const f = await fixture(t, m2Corpus[3]);
  checkpoint(f).tiles[3] = failedTileCheckpoint(checkpoint(f).input, f.layout[3], failures.timeout);
  const prior = structuredClone(checkpoint(f)); prior.tiles = f.layout.map(tile => completedTileCheckpoint(prior.input, tile, output()));
  state(f).latestResult = aggregateCheckpoint(prior, now); const previous = structuredClone(state(f).latestResult);
  f.behavior = index => { if (index >= successes) throw new ExtractionError('provider'); return output(); };
  const reply = await f.retry(); assert.equal(f.calls.length, 4);
  assert.equal(reply.runStatus, successes === 0 ? 'failed' : successes === 4 ? 'complete' : 'partial');
  if (!successes) assert.deepEqual(state(f).latestResult, previous);
});
test('16 tiles with one failure encode and call exactly one tile', async t => {
  const f = await fixture(t, m2Corpus[1], 28928); const reply = await f.retry();
  assert.deepEqual(f.calls, [15]); assert.deepEqual(f.prepared, [15]); assert.equal(reply.runStatus, 'complete');
});
for (const dimension of ['model', 'policyVersion', 'promptFingerprint', 'normalizationVersion', 'layoutPolicyFingerprint', 'geometry'])
  test(`stale ${dimension} blocks provider before claim`, async t => {
    const f = await fixture(t), cache = checkpoint(f);
    if (dimension === 'model') f.provider.model = 'changed-model';
    else if (dimension === 'geometry') {
      cache.layout[1].y += 1; cache.layout[1].height -= 1;
      cache.input.layoutFingerprint = tileLayoutFingerprint(cache.layout);
      cache.tiles[1].geometry.y += 1; cache.tiles[1].geometry.height -= 1;
      cache.tiles[1].tileId = tileIdentity(cache.input, cache.layout[1]);
    } else cache.input[dimension] = typeof cache.input[dimension] === 'number' ? cache.input[dimension] + 1 : 'f'.repeat(64);
    await assert.rejects(f.retry(), code('checkpoint_stale')); assert.equal(f.calls.length, 0); assert.equal(patches(f).length, 0);
  });
for (const mode of ['success', 'unknown', 'non_retryable']) test(`invalid target ${mode} makes zero calls`, async t => {
  const f = await fixture(t), id = mode === 'unknown' ? 'f'.repeat(64) : f.tileId(mode === 'success' ? 0 : 1);
  if (mode === 'non_retryable') checkpoint(f).tiles[1].failure = failures.local_processing_error;
  await assert.rejects(f.retry({ requestedTileIds: [id] }), code('invalid_retry_target')); assert.equal(f.calls.length, 0);
});
test('strict bounded request rejects fabricated state, empty/duplicate/too many IDs and invalid revision', () => {
  const valid = { expectedRevision: randomUUID() }, id = 'a'.repeat(64);
  for (const extra of [{ model: 'forged' }, { geometry: {} }, { checkpoint: {} }, { storagePath: 'forged' }, { sourceFingerprint: id },
    { requestedTileIds: [] }, { requestedTileIds: [id, id] }, { requestedTileIds: Array(17).fill(id) }, { expectedRevision: 'bad' }])
    assert.equal(retryRequestSchema.safeParse({ ...valid, ...extra }).success, false);
});
for (const version of [1, 2]) test(`legacy result v${version} remains readable; retry requires explicit full analysis`, async t => {
  const f = await fixture(t); state(f).schemaVersion = 1;
  delete state(f).checkpoint; delete state(f).checkpointWriteError; delete state(f).latestResultInputFingerprint;
  if (version === 1) { const r = state(f).latestResult; r.schemaVersion = 1; r.policyVersion = 1; delete r.productContextFingerprint;
    r.candidates.forEach(c => { delete c.visualKind; delete c.targetProductRelevance; delete c.containsTargetProduct; delete c.relevanceReason; }); }
  const before = structuredClone(state(f)); assert.ok(readExtraction(f.row.metadata));
  await assert.rejects(f.retry(), code('checkpoint_missing')); assert.equal(f.calls.length, 0); assert.deepEqual(state(f), before);
});
test('malformed checkpoint isolates valid candidates, zero provider calls', async t => {
  const f = await fixture(t); state(f).checkpoint = { broken: true };
  const result = structuredClone(state(f).latestResult);
  await assert.rejects(f.retry(), code('checkpoint_invalid')); assert.equal(f.calls.length, 0);
  assert.deepEqual(readExtraction(f.row.metadata).latestResult, result);
});
test('incomplete full extraction never fabricates missing tile failures', async t => {
  const f = await fixture(t); checkpoint(f).tiles.pop();
  await assert.rejects(f.retry(), code('checkpoint_incomplete')); assert.equal(f.calls.length, 0);
});
test('duplicate explicit request with old revision or successful target cannot redispatch', async t => {
  const f = await fixture(t), request = { expectedRevision: state(f).revision, requestedTileIds: [f.tileId(1)] };
  await f.retry(request); await assert.rejects(f.retry(request), code('conflict'));
  await assert.rejects(f.retry({ requestedTileIds: request.requestedTileIds }), code('invalid_retry_target'));
  assert.equal(f.calls.length, 1);
});
for (const mode of ['revision', 'new_run', 'input']) test(`concurrent ${mode} prevents old retry writes`, async t => {
  const f = await fixture(t); let concurrent;
  f.behavior = () => {
    if (mode === 'revision') state(f).revision = randomUUID();
    if (mode === 'new_run') { state(f).attempt.runId = randomUUID(); checkpoint(f).runId = state(f).attempt.runId; }
    if (mode === 'input') checkpoint(f).input.model = 'concurrent';
    f.row.metadata.anotherFeature = { keep: true }; concurrent = structuredClone(f.row.metadata);
    return output();
  };
  await assert.rejects(f.retry(), code('conflict')); assert.deepEqual(f.row.metadata, concurrent); assert.deepEqual(f.calls, [1]);
});
test('revision CAS rejects race between read and PATCH without clobbering other metadata', async t => {
  const f = await fixture(t); let concurrent;
  f.state.beforePatch = payload => {
    if (!concurrent && payload.metadata.detailExtraction.checkpoint.tiles[1].status === 'completed') {
      state(f).revision = randomUUID(); f.row.metadata.other = { preserved: true }; concurrent = structuredClone(f.row.metadata);
    }
  };
  await assert.rejects(f.retry(), code('conflict')); assert.deepEqual(f.row.metadata, concurrent);
});
test('live retry rejects simultaneous retry and full extraction without extra provider calls', async t => {
  const f = await fixture(t); let release, ready;
  const started = new Promise(resolve => { ready = resolve; }), gate = new Promise(resolve => { release = resolve; });
  f.behavior = async () => { ready(); await gate; return output(); };
  const first = f.retry(); await started;
  await assert.rejects(f.retry(), code('busy'));
  await assert.rejects(analyzeProductShots(projectId, assetId, true, () => f.provider), code('busy'));
  release(); await first; assert.equal(f.calls.length, 1);
});
test('local interruption preserves first new success, remaining failures and prior latestResult', async t => {
  const f = await fixture(t, m2Corpus[3]), before = structuredClone(checkpoint(f)), previous = structuredClone(state(f).latestResult);
  const normalPrepare = f.processing.prepareTile;
  f.processing.prepareTile = async (image, tile) => { if (tile.index === 1) throw new Error('private-local-exception'); return normalPrepare(image, tile); };
  await assert.rejects(f.retry(), code('unexpected'));
  assert.deepEqual(f.calls, [0]); assert.equal(checkpoint(f).tiles[0].status, 'completed');
  assert.deepEqual(checkpoint(f).tiles.slice(1), before.tiles.slice(1)); assert.deepEqual(state(f).latestResult, previous);
  assert.equal(state(f).attempt.status, 'failed'); assert.equal(JSON.stringify(state(f)).includes('private-local'), false);
  // Explicit recovery does not call the first completed tile again.
  f.processing.prepareTile = normalPrepare; await f.retry(); assert.deepEqual(f.calls, [0, 1, 2]);
});
test('expired interrupted retry can be explicitly resumed; live lease cannot', async t => {
  const f = await fixture(t); state(f).attempt.status = 'analyzing'; state(f).attempt.startedAt = new Date().toISOString();
  await assert.rejects(f.retry(), code('busy')); assert.equal(f.calls.length, 0);
  state(f).attempt.startedAt = '2020-01-01T00:00:00.000Z'; await f.retry(); assert.deepEqual(f.calls, [1]);
});
test('aggregation failure keeps successes and previous result; explicit no-target operation repairs without AI', async t => {
  const f = await fixture(t), previous = structuredClone(state(f).latestResult);
  f.processing.aggregate = () => { throw new Error('private-aggregation'); };
  await assert.rejects(f.retry(), code('unexpected')); assert.equal(checkpoint(f).tiles[1].status, 'completed');
  assert.deepEqual(state(f).latestResult, previous);
  f.processing.aggregate = aggregateCheckpoint; const reply = await f.retry();
  assert.equal(reply.code, 'no_retryable_tiles'); assert.equal(reply.attemptedTileCount, 0); assert.equal(reply.latestResultUpdated, true);
  assert.equal(reply.runStatus, 'complete'); assert.equal(state(f).latestResult.completedTiles, 4); assert.deepEqual(f.calls, [1]);
});
test('oversized retry cache rejected after one paid-equivalent call; prior entries/latestResult unchanged', async t => {
  const f = await fixture(t, m2Corpus[1], 28928);
  const large = { schemaVersion: 2, regions: Array.from({ length: 8 }, () => ({ ...region, rationale: '\u0001'.repeat(180), relevanceReason: '\u0001'.repeat(120) })) };
  checkpoint(f).tiles = f.layout.map(tile => tile.index === 15 ? checkpoint(f).tiles[15] : completedTileCheckpoint(checkpoint(f).input, tile, large));
  assert.ok(Buffer.byteLength(JSON.stringify(checkpoint(f))) < 256 * 1024);
  const before = structuredClone(checkpoint(f).tiles), previous = structuredClone(state(f).latestResult);
  f.behavior = () => large;
  await assert.rejects(f.retry(), code('persistence_failure')); assert.deepEqual(f.calls, [15]);
  assert.deepEqual(checkpoint(f).tiles, before); assert.deepEqual(state(f).latestResult, previous);
  for (const p of patches(f)) assert.ok(Buffer.byteLength(JSON.stringify(p.payload.metadata.detailExtraction.checkpoint)) <= 256 * 1024);
});
test('DB persistence failure stops dispatch and preserves already committed tile', async t => {
  const f = await fixture(t, m2Corpus[3]);
  f.behavior = index => { if (index === 1) f.state.failure = 'patch-analyzing'; return output(); };
  await assert.rejects(f.retry(), code('persistence_failure')); assert.deepEqual(f.calls, [0, 1]);
  assert.equal(checkpoint(f).tiles[0].status, 'completed'); assert.equal(checkpoint(f).tiles[1].status, 'failed');
});
test('dispatch uncertainty replaces prior not_dispatched billing before a persistence interruption', async t => {
  const f = await fixture(t); checkpoint(f).tiles[1].failure.billing = 'not_dispatched';
  f.behavior = () => {
    assert.equal(checkpoint(f).tiles[1].failure.billing, 'unknown');
    f.state.failure = 'patch-analyzing'; return output();
  };
  await assert.rejects(f.retry(), code('persistence_failure'));
  assert.deepEqual(f.calls, [1]); assert.equal(checkpoint(f).tiles[1].status, 'failed');
  assert.equal(checkpoint(f).tiles[1].failure.billing, 'unknown');
});
test('lost DB acknowledgment is reconciled without redispatch', async t => {
  const f = await fixture(t); f.behavior = () => { f.state.patchAckLost = 'analyzing'; return output(); };
  const reply = await f.retry(); assert.equal(reply.runStatus, 'complete'); assert.deepEqual(f.calls, [1]);
});
test('changed product during provider call prevents publishing old-input aggregate', async t => {
  const f = await fixture(t), previous = structuredClone(state(f).latestResult);
  f.behavior = () => { f.state.product.name = 'new identity'; return output(); };
  await assert.rejects(f.retry(), code('checkpoint_stale')); assert.deepEqual(state(f).latestResult, previous);
  assert.equal(checkpoint(f).tiles[1].status, 'completed');
});
for (const change of ['source', 'context', 'model']) test(`input ${change} changes during preparation: zero dispatch`, async t => {
  const f = await fixture(t), prepare = f.processing.prepareTile, previous = structuredClone(state(f).latestResult);
  f.processing.prepareTile = async (image, tile) => {
    const bytes = await prepare(image, tile);
    if (change === 'source') f.state.objectBytes.set(f.row.storage_path, await sharp(f.image.bytes).negate().png().toBuffer());
    if (change === 'context') f.state.product.name = 'changed before dispatch';
    if (change === 'model') f.provider.model = 'changed before dispatch';
    return bytes;
  };
  await assert.rejects(f.retry(), code('checkpoint_stale')); assert.equal(f.calls.length, 0);
  assert.equal(checkpoint(f).tiles[1].status, 'failed'); assert.deepEqual(state(f).latestResult, previous);
});
test('successful empty regions replace failure without inventing candidates', async t => {
  const f = await fixture(t); f.behavior = () => ({ schemaVersion: 2, regions: [] });
  const reply = await f.retry(); assert.equal(reply.runStatus, 'complete'); assert.equal(reply.succeededTileCount, 1);
  assert.deepEqual(checkpoint(f).tiles[1].result.regions, []);
  assert.deepEqual(state(f).latestResult.candidates, aggregateCheckpoint(checkpoint(f), now).candidates);
});
for (const malformed of ['schema', 'geometry']) test(`invalid provider ${malformed} remains a bounded failure`, async t => {
  const f = await fixture(t), previous = structuredClone(state(f).latestResult);
  f.behavior = () => malformed === 'schema' ? { schemaVersion: 99, raw: 'private' }
    : { schemaVersion: 2, regions: [{ ...region, box: { xMin: 900, xMax: 100, yMin: 0, yMax: 900 } }] };
  const reply = await f.retry(); assert.equal(reply.code, 'provider_failure'); assert.deepEqual(f.calls, [1]);
  assert.equal(checkpoint(f).tiles[1].status, 'failed'); assert.deepEqual(state(f).latestResult, previous);
});
test('NMS may remove a prior candidate; its saved Derived and unrelated metadata survive retry', async t => {
  const f = await fixture(t);
  checkpoint(f).tiles[0].result = { schemaVersion: 2, regions: [{ ...region, box: { xMin: 50, xMax: 950, yMin: 880, yMax: 980 } }] };
  state(f).latestResult = aggregateCheckpoint(checkpoint(f), now);
  const savedId = state(f).latestResult.candidates[0].id;
  await saveProductShots(projectId, assetId, { candidateIds: [savedId] });
  const derived = structuredClone(f.state.assets.slice(1)), objects = [...f.state.objects];
  f.behavior = () => ({ schemaVersion: 2, regions: [{ ...region, confidence: 1, box: { xMin: 50, xMax: 950, yMin: 10, yMax: 110 } }] });
  await f.retry(); assert.deepEqual(f.state.assets.slice(1), derived); assert.deepEqual([...f.state.objects], objects);
  assert.equal(state(f).latestResult.candidates.some(c => c.id === savedId), false);
  assert.deepEqual(f.row.metadata.custom, { untouched: true }); assert.deepEqual(f.row.metadata.source, { original: true });
  assert.ok(f.state.requests.filter(r => r.method === 'PATCH').every(r => r.path.endsWith('/assets')));
});
test('existing selection is client-local; server does not invent or persist explicit selections', () => {
  const ui = readFileSync(new URL('../src/features/detail-extraction/components/extraction-panel.tsx', import.meta.url), 'utf8');
  assert.ok(ui.includes('const [selected, setSelected] = useState'));
  assert.ok(ui.includes('key={result.analyzedAt}'));
  assert.equal(ui.includes('retryProductShots'), false);
});
function routeRequest(body, overrides = {}) {
  return new Request('http://localhost/api/retry', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json', ...overrides }, body: JSON.stringify(body) });
}
const routeParams = () => ({ params: Promise.resolve({ projectId, assetId }) });
test('actual retry route no-op returns bounded counters/revision, no cache/URLs/model/context', async t => {
  const f = await fixture(t, m2Corpus[0], 6000, getExtractionModel()), previous = structuredClone(state(f));
  const response = await POST(routeRequest({ expectedRevision: state(f).revision }), routeParams());
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const value = await response.json(); assert.equal(value.code, 'no_retryable_tiles'); assert.equal(value.attemptedTileCount, 0);
  assert.equal(value.revision, previous.revision); assert.deepEqual(state(f), previous); assert.equal(patches(f).length, 0);
  for (const field of ['checkpoint', 'input', 'model', 'asset', 'sourceFingerprint', 'storagePath']) assert.equal(field in value, false);
});
test('actual route enforces same origin, JSON bound, schema and legacy 409', async t => {
  const f = await fixture(t); const revision = state(f).revision;
  assert.equal((await POST(routeRequest({ expectedRevision: revision }, { origin: 'http://other.test' }), routeParams())).status, 403);
  assert.equal((await POST(routeRequest({ expectedRevision: revision, payload: 'x'.repeat(9000) }), routeParams())).status, 400);
  assert.equal((await POST(routeRequest({ expectedRevision: revision, model: 'forged' }), routeParams())).status, 400);
  delete state(f).checkpoint;
  const response = await POST(routeRequest({ expectedRevision: revision }), routeParams());
  assert.equal(response.status, 409); assert.equal((await response.json()).code, 'checkpoint_missing'); assert.equal(patches(f).length, 0);
});
test('ownership / Derived recursion rejected before provider', async t => {
  const f = await fixture(t); f.row.product_id = otherId;
  await assert.rejects(f.retry(), code('not_found')); f.row.product_id = productId;
  f.row.metadata.derivation = { kind: 'detail_image_crop' };
  await assert.rejects(f.retry(), code('recursive')); assert.equal(f.calls.length, 0);
});
test('actual provider SDK transport makes one attempt for 429 and 500, with no automatic retry', async () => {
  for (const status of [429, 500]) {
    let calls = 0;
    const provider = createExtractionProvider({ apiKey: 'synthetic-test', model: 'test-model' }, async () => {
      calls++; return Response.json({ error: { message: 'synthetic provider failure' } }, { status });
    });
    await assert.rejects(provider.analyze('data:image/jpeg;base64,AA==', new AbortController().signal,
      buildExtractionProductContext({ name: 'synthetic' }, null)), code('provider'));
    assert.equal(calls, 1);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { startAssetDb, assetRow, projectId, productId, assetId } from './helpers/asset-db.mjs';
import { region } from './fixtures/v0.2/m2-tile-recovery.mjs';
import { analyzeProductShots, saveProductShots } from '../src/features/detail-extraction/service.ts';
import { checkpointReadModel, checkpointInputFingerprint, completedTileCheckpoint } from '../src/features/detail-extraction/checkpoint.ts';
import { readExtractionAsset, persistTileCheckpoint, compareExtractionState } from '../src/features/detail-extraction/persistence.ts';
import { createSupabaseServerClient } from '../src/lib/supabase/server.ts';
import { normalizeCandidates } from '../src/features/detail-extraction/geometry.ts';
import { ExtractionError } from '../src/features/detail-extraction/errors.ts';
import { readExtraction } from '../src/features/detail-extraction/schemas.ts';

async function fixture(t) {
  const db = await startAssetDb(); t.after(() => db.close());
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    assert.equal(new URL(typeof url === 'string' ? url : url.url ?? url.href).hostname, '127.0.0.1');
    return originalFetch(url, options);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const bytes = await sharp({ create: { width: 400, height: 6000, channels: 3, background: '#ddd' } }).png().toBuffer();
  const row = assetRow({ size_bytes: bytes.length, asset_type: 'detail', metadata: { custom: { keep: true }, source: { marker: 'original' } } });
  db.state.assets.push(row); db.state.objects.add(row.storage_path); db.state.objectBytes.set(row.storage_path, bytes);
  let calls = 0;
  const provider = { model: 'test-vision-v1', analyze: async () => { calls++; return { schemaVersion: 2, regions: [structuredClone(region)] }; } };
  return { ...db, row, provider, analyze: force => analyzeProductShots(projectId, assetId, force, () => provider), get calls() { return calls; } };
}
const patches = f => f.state.requests.filter(request => request.method === 'PATCH');

test('partial full extraction persists success/success/failure/success before next dispatch', async t => {
  const f = await fixture(t), original = structuredClone(f.row.metadata); let index = 0;
  f.provider.analyze = async () => {
    assert.equal(f.row.metadata.detailExtraction.checkpoint.tiles.length, index);
    if (index++ === 2) throw new ExtractionError('provider');
    return { schemaVersion: 2, regions: [region] };
  };
  await f.analyze(false);
  const state = f.row.metadata.detailExtraction, view = checkpointReadModel(state, state.checkpoint.input);
  assert.equal(index, 4); assert.equal(view.runStatus, 'partial'); assert.equal(view.successfulTileCount, 3); assert.equal(view.failedTileCount, 1);
  assert.deepEqual(state.latestResult.failedTiles, [2]); assert.equal(patches(f).length, 6);
  assert.deepEqual(f.row.metadata.custom, original.custom); assert.deepEqual(f.row.metadata.source, original.source);
  assert.equal(f.state.assets.length, 1); assert.equal(f.state.objects.size, 1);
  assert.ok(f.state.requests.filter(r => r.method === 'PATCH').every(r => r.path.endsWith('/assets')));
});
test('normal checkpoint preserves exact existing candidate normalization and relevance; model change invalidates reuse', async t => {
  const f = await fixture(t); await f.analyze(false);
  const state = f.row.metadata.detailExtraction, cache = state.checkpoint;
  const expected = normalizeCandidates(cache.layout.map(tile => ({ tile, region })), cache.input.sourceDimensions, cache.input.sourceFingerprint);
  assert.deepEqual(state.latestResult.candidates, expected.candidates);
  const count = f.calls, writes = patches(f).length;
  assert.equal((await f.analyze(false)).reused, true); assert.equal(f.calls, count); assert.equal(patches(f).length, writes);
  f.provider.model = 'different-model'; assert.equal((await f.analyze(false)).reused, false); assert.equal(f.calls, count * 2);
});
test('all failed run retains previous latestResult and bounded failed checkpoint', async t => {
  const f = await fixture(t); await f.analyze(false); const previous = structuredClone(f.row.metadata.detailExtraction.latestResult);
  f.provider.analyze = async () => { throw new Error('raw-private-error https://private/?token=secret'); };
  await assert.rejects(f.analyze(true));
  const state = f.row.metadata.detailExtraction;
  assert.deepEqual(state.latestResult, previous); assert.equal(checkpointReadModel(state, state.checkpoint.input).runStatus, 'failed');
  assert.equal(state.attempt.status, 'failed'); assert.equal(JSON.stringify(state).includes('raw-private-error'), false);
});
test('database failure after first durable success stops calls and preserves previous result/checkpoint', async t => {
  const f = await fixture(t); await f.analyze(false); const previous = structuredClone(f.row.metadata.detailExtraction.latestResult);
  let calls = 0; f.provider.analyze = async () => {
    if (++calls === 2) f.state.failure = 'patch-analyzing';
    return { schemaVersion: 2, regions: [region] };
  };
  await assert.rejects(f.analyze(true), e => e.code === 'database');
  assert.equal(calls, 2); assert.equal(f.row.metadata.detailExtraction.checkpoint.tiles.length, 1);
  assert.equal(f.row.metadata.detailExtraction.checkpoint.tiles[0].status, 'completed');
  assert.deepEqual(f.row.metadata.detailExtraction.latestResult, previous);
});
test('unsafe checkpoint string disables caching without dropping valid current candidates', async t => {
  const f = await fixture(t); let calls = 0;
  f.provider.analyze = async () => ({ schemaVersion: 2, regions: [{ ...region,
    rationale: ++calls === 2 ? 'https://example.test/private' : region.rationale }] });
  await f.analyze(false);
  const state = f.row.metadata.detailExtraction;
  assert.equal(calls, 4); assert.equal(state.checkpointWriteError, 'unsafe'); assert.equal(state.checkpoint.tiles.length, 1);
  assert.equal(state.latestResult.completedTiles, 4); assert.equal(JSON.stringify(state.checkpoint).includes('https://'), false);
  assert.deepEqual(checkpointReadModel(state, state.checkpoint.input).retryableTileIds, []);
});
test('escaped oversize during 16-tile run preserves bounded prior checkpoint and publishes candidates', async t => {
  const f = await fixture(t);
  const bytes = await sharp({ create: { width: 400, height: 28928, channels: 3, background: '#ddd' } }).png().toBuffer();
  f.state.objectBytes.set(f.row.storage_path, bytes); f.row.size_bytes = bytes.length;
  let calls = 0;
  f.provider.analyze = async () => { calls++; return { schemaVersion: 2, regions: Array.from({ length: 8 }, () => ({ ...region,
    rationale: '\u0001'.repeat(180), relevanceReason: '\u0001'.repeat(120) })) }; };
  await f.analyze(false);
  const state = f.row.metadata.detailExtraction;
  assert.equal(calls, 16); assert.equal(state.checkpointWriteError, 'oversized');
  assert.ok(state.checkpoint.tiles.length > 0 && state.checkpoint.tiles.length < 16);
  assert.equal(state.latestResult.completedTiles, 16); assert.equal(state.attempt.status, 'completed');
  for (const request of patches(f)) assert.ok(Buffer.byteLength(JSON.stringify(request.payload.metadata.detailExtraction.checkpoint)) <= 256 * 1024);
});
test('concurrent metadata writer survives checkpoint CAS retry; lost acknowledgment reconciles', async t => {
  const f = await fixture(t); let changed = false;
  f.state.beforePatch = payload => {
    if (!changed && payload.metadata.detailExtraction.checkpoint.tiles.length === 1) {
      changed = true; f.row.metadata.otherFeature = { kept: true }; f.row.metadata.detailExtraction.revision = randomUUID();
    }
  };
  f.state.patchAckLost = 'analyzing'; await f.analyze(false);
  assert.equal(changed, true); assert.deepEqual(f.row.metadata.otherFeature, { kept: true });
  assert.equal(f.row.metadata.detailExtraction.checkpoint.tiles.length, 4);
  assert.ok(patches(f).slice(1).every(p => p.query.includes('revision') && p.query.length < 1000));
});
test('slow old run cannot overwrite replacement run checkpoint', async t => {
  const f = await fixture(t); let calls = 0, replacement;
  f.provider.analyze = async () => {
    calls++;
    replacement = structuredClone(f.row.metadata.detailExtraction); replacement.attempt.runId = randomUUID();
    replacement.checkpoint.runId = replacement.attempt.runId; replacement.revision = randomUUID();
    f.row.metadata.detailExtraction = replacement;
    return { schemaVersion: 2, regions: [region] };
  };
  await assert.rejects(f.analyze(false), e => e.code === 'conflict');
  assert.equal(calls, 1); assert.deepEqual(f.row.metadata.detailExtraction, replacement);
});
test('input ownership mismatch and oversized checkpoint reject before DB mutation', async t => {
  const f = await fixture(t); await f.analyze(false);
  const client = createSupabaseServerClient(), scope = { projectId, productId, assetId }, asset = await readExtractionAsset(client, scope);
  const state = readExtraction(asset.metadata), cache = state.checkpoint, count = patches(f).length;
  f.row.metadata.detailExtraction.attempt.status = 'analyzing';
  await assert.rejects(persistTileCheckpoint(client, scope, asset, state.attempt.runId, 'f'.repeat(64),
    completedTileCheckpoint(cache.input, cache.layout[0], cache.tiles[0].result)), e => e.code === 'conflict');
  assert.equal(patches(f).length, count);
  await assert.rejects(compareExtractionState(client, asset, { ...state, checkpoint: { giant: '가'.repeat(256 * 1024) } }), e => e.code === 'oversized');
  assert.equal(patches(f).length, count); assert.ok(checkpointInputFingerprint(cache.input));
});
test('malformed checkpoint retains candidate review and Derived save; opaque subtree preserved', async t => {
  const f = await fixture(t); await f.analyze(false); const state = f.row.metadata.detailExtraction;
  state.checkpoint = { broken: true };
  const read = readExtraction(f.row.metadata); assert.equal(read.latestResult.candidates.length, state.latestResult.candidates.length);
  const result = await saveProductShots(projectId, assetId, { candidateIds: [read.latestResult.candidates[0].id] });
  assert.equal(result.saved.length, 1); assert.equal(result.saved[0].asset.metadata.derivation.schemaVersion, 1);
  assert.deepEqual(f.row.metadata.detailExtraction.checkpoint, { broken: true });
});

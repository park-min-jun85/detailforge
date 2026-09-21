import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { input, tiles, region, m2Corpus } from './fixtures/v0.2/m2-tile-recovery.mjs';
import { buildCheckpointInput, createCheckpoint, completedTileCheckpoint, failedTileCheckpoint, recordTileCheckpoint,
  validateCheckpoint, serializeCheckpoint, checkpointReadModel, checkpointRunStatus, checkpointCompatible,
  checkpointInputFingerprint, tileIdentity, tileLayoutFingerprint, failureCheckpoint } from '../src/features/detail-extraction/checkpoint.ts';
import { readExtraction } from '../src/features/detail-extraction/schemas.ts';
import { normalizeCandidates } from '../src/features/detail-extraction/geometry.ts';
import { ExtractionError } from '../src/features/detail-extraction/errors.ts';

const identity = (value = input, layout = tiles) => ({ ...buildCheckpointInput({ fingerprint: value.sourceFingerprint,
  dimensions: value.sourceDimensions, orientation: value.sourceOrientation }, value.productContextFingerprint, value.model, layout, 'synthetic prompt'), ...value });
const stateFor = cache => ({ schemaVersion: 2, revision: randomUUID(), saveLease: null, latestResult: null, checkpoint: cache,
  attempt: { status: 'completed', runId: cache.runId, startedAt: '2026-09-21T00:00:00.000Z', finishedAt: '2026-09-21T00:01:00.000Z', errorCode: null } });
function cacheFor(sample) {
  const value = identity(sample.cacheInput);
  let cache = createCheckpoint(value, tiles, randomUUID());
  for (const tile of sample.before) {
    const rect = tiles[tile.index];
    cache = recordTileCheckpoint(cache, tile.status === 'completed' ? completedTileCheckpoint(value, rect, tile.result)
      : failedTileCheckpoint(value, rect, tile.failure));
  }
  return cache;
}

for (const sample of m2Corpus) test(`production checkpoint ${sample.id}: ${sample.title}`, () => {
  let cache = cacheFor(sample);
  const view = checkpointReadModel(stateFor(cache), identity(sample.input));
  assert.equal(view.runStatus, sample.expected.runStatus);
  assert.equal(view.compatibility, sample.expected.stale ? 'stale' : 'compatible');
  assert.deepEqual(view.retryableTileIds, sample.expected.retryTargets.map(index => tileIdentity(cache.input, tiles[index])));
  assert.deepEqual(validateCheckpoint(JSON.parse(serializeCheckpoint(cache))), cache);
  if (sample.transition) {
    const original = structuredClone(cache);
    for (const index of sample.transition.targetedIndices) {
      const after = sample.transition.after[index];
      cache = recordTileCheckpoint(cache, after.status === 'completed' ? completedTileCheckpoint(cache.input, tiles[index], after.result)
        : failedTileCheckpoint(cache.input, tiles[index], after.failure));
    }
    assert.equal(checkpointRunStatus(cache), sample.transition.afterRunStatus);
    for (const index of sample.transition.preservedIndices) assert.deepEqual(cache.tiles[index], original.tiles[index]);
  }
});

test('tile identity matches frozen golden and ignores key order / response fields', () => {
  const value = identity();
  assert.equal(tileIdentity(value, tiles[0]), '29fecfa6f6c8a29ded04e4f7fdec867a639133d68af6359aa32647b3b83d3628');
  assert.equal(tileIdentity(value, { height: 2048, width: 400, y: 0, x: 0, index: 0, confidence: .1 }), tileIdentity(value, tiles[0]));
  assert.equal(checkpointInputFingerprint(value), checkpointInputFingerprint(Object.fromEntries(Object.entries(value).reverse())));
});
for (const field of ['sourceFingerprint', 'productContextFingerprint', 'model', 'policyVersion', 'promptVersion', 'normalizationVersion',
  'tilingVersion', 'promptFingerprint', 'layoutFingerprint', 'layoutPolicyFingerprint']) test(`${field} change is stale without deleting cache`, () => {
  const cache = cacheFor(m2Corpus[1]), before = serializeCheckpoint(cache);
  const changed = { ...cache.input, [field]: typeof cache.input[field] === 'number' ? cache.input[field] + 1 : field === 'model' ? 'another-model' : 'f'.repeat(64) };
  assert.equal(checkpointCompatible(cache, changed), false);
  assert.equal(serializeCheckpoint(cache), before);
});
test('geometry sequence changes layout identity, invalid geometry/ID/duplicate/index are rejected', () => {
  assert.notEqual(tileLayoutFingerprint(tiles), tileLayoutFingerprint(tiles.map((tile, i) => i === 1 ? { ...tile, y: 1800 } : tile)));
  for (const mutate of [c => c.tiles[0].tileId = 'f'.repeat(64), c => c.tiles[0].geometry.x++, c => c.tiles.push(c.tiles[0]),
    c => c.layout[0].index++, c => c.tiles[0].result.regions[0].box.xMax = 1]) {
    const cache = cacheFor(m2Corpus[0]); mutate(cache); assert.throws(() => validateCheckpoint(cache), e => e.code === 'invalid');
  }
});
test('completed checkpoint cannot be overwritten; key order alone does not change it', () => {
  const cache = cacheFor(m2Corpus[0]);
  assert.deepEqual(recordTileCheckpoint(cache, Object.fromEntries(Object.entries(cache.tiles[0]).reverse())), cache);
  const changed = structuredClone(cache.tiles[0]); changed.result.regions[0].confidence = .1;
  assert.throws(() => recordTileCheckpoint(cache, changed));
});
test('checkpoint reconstructed candidates preserve count, IDs, relevance and selection', () => {
  const cache = cacheFor(m2Corpus[0]);
  const expected = normalizeCandidates(tiles.map(tile => ({ tile, region })), input.sourceDimensions, input.sourceFingerprint);
  const actual = normalizeCandidates(cache.tiles.flatMap(tile => tile.result.regions.map(region => ({ region, tile: { index: tile.index, ...tile.geometry } }))), input.sourceDimensions, input.sourceFingerprint);
  assert.deepEqual(actual, expected);
  assert.deepEqual(cache.tiles[0].result.regions[0], region);
});
test('incomplete/live/unknown/mismatched owner caches do not offer execution targets', () => {
  const empty = createCheckpoint(identity(), tiles, randomUUID());
  assert.equal(checkpointRunStatus(empty), 'incomplete');
  assert.equal(checkpointReadModel(stateFor(empty), empty.input).pendingTileCount, 4);
  const cache = cacheFor(m2Corpus[1]), state = stateFor(cache);
  assert.deepEqual(checkpointReadModel(state).retryableTileIds, []);
  state.attempt.status = 'analyzing'; assert.deepEqual(checkpointReadModel(state, cache.input).retryableTileIds, []);
  state.attempt.status = 'completed'; state.attempt.runId = randomUUID();
  assert.deepEqual(checkpointReadModel(state, cache.input).retryableTileIds, []);
});
test('legacy result and malformed checkpoint reads are isolated without mutation', () => {
  const state = stateFor(cacheFor(m2Corpus[0]));
  const result = { schemaVersion: 2, policyVersion: 2, productContextFingerprint: input.productContextFingerprint,
    sourceFingerprint: input.sourceFingerprint, sourceDimensions: input.sourceDimensions, coordinateSpace: input.coordinateSpace,
    sourceOrientation: 1, provider: 'openai', model: input.model, analyzedAt: '2026-09-21T00:00:00.000Z', tileCount: 4,
    completedTiles: 4, failedTiles: [], partialAnalysis: false, candidates: [], truncatedCandidates: false };
  state.latestResult = result; state.checkpoint = { malformed: true };
  const before = JSON.stringify(state), read = readExtraction({ detailExtraction: state });
  assert.deepEqual(read.latestResult, result); assert.equal(checkpointReadModel(read).availability, 'invalid');
  assert.equal(JSON.stringify(state), before);
  for (const version of [1, 2]) {
    const legacyResult = { ...result, schemaVersion: version };
    if (version === 1) { legacyResult.policyVersion = 1; delete legacyResult.productContextFingerprint; }
    const legacy = { ...state, schemaVersion: 1, latestResult: legacyResult }; delete legacy.checkpoint;
    assert.ok(readExtraction({ detailExtraction: legacy }));
    assert.equal(checkpointReadModel(readExtraction({ detailExtraction: legacy })).hasCheckpoint, false);
  }
});
function maximumCache(text) {
  const layout = Array.from({ length: 16 }, (_, index) => ({ index, x: 0, y: index * 1792, width: 400, height: 2048 }));
  const value = identity({ ...input, sourceDimensions: { width: 400, height: layout.at(-1).y + 2048 } }, layout);
  const cache = createCheckpoint(value, layout, randomUUID());
  cache.tiles = layout.map(tile => completedTileCheckpoint(value, tile, { schemaVersion: 2,
    regions: Array.from({ length: 8 }, () => ({ ...region, rationale: text.repeat(180), relevanceReason: text.repeat(120) })) }));
  return cache;
}
test('16 x 8 Korean regions fit 256 KiB; serialization validates actual UTF-8 bytes', t => {
  const cache = maximumCache('가'), start = performance.now(), text = serializeCheckpoint(cache);
  assert.ok(Buffer.byteLength(text, 'utf8') > text.length);
  assert.ok(Buffer.byteLength(text, 'utf8') <= 256 * 1024);
  assert.equal(validateCheckpoint(JSON.parse(text)).tiles.length, 16);
  assert.ok(performance.now() - start < 5000);
  t.diagnostic(`maximum Korean checkpoint: ${Buffer.byteLength(text, 'utf8')} bytes`);
});
test('escaped JSON exceeds byte bound and rejects before persistence; no truncation', t => {
  const cache = maximumCache('\u0001');
  assert.ok(Buffer.byteLength(JSON.stringify(cache)) > 256 * 1024);
  assert.throws(() => serializeCheckpoint(cache), e => e.code === 'oversized');
  assert.equal(cache.tiles[0].result.regions[0].rationale.length, 180);
  t.diagnostic(`maximum escaped checkpoint: ${Buffer.byteLength(JSON.stringify(cache), 'utf8')} bytes`);
});
test('tile and region bounds are enforced independently', () => {
  const cache = maximumCache('가'); cache.tiles[0].result.regions.push(region);
  assert.throws(() => validateCheckpoint(cache), e => e.code === 'invalid');
  const another = maximumCache('가'); another.layout.push({ ...another.layout[15], index: 16 });
  assert.throws(() => validateCheckpoint(another), e => e.code === 'invalid');
});
for (const text of ['https://example.test/?token=private', 'data:image/png;base64,AAAA', 'Authorization: Bearer private',
  'C:\\Users\\private', '/home/private/file', 'sk-syntheticcredential12345', 'OPENAI_API_KEY']) test(`unsafe checkpoint string rejected: ${text.split(':')[0]}`, () => {
  const cache = cacheFor(m2Corpus[0]); cache.tiles[0].result.regions[0].rationale = text;
  assert.throws(() => serializeCheckpoint(cache), e => e.code === 'unsafe');
});
test('JSONB invalid NUL / unmatched surrogate rejected', () => {
  for (const text of ['\0', '\ud800']) {
    const cache = cacheFor(m2Corpus[0]); cache.tiles[0].result.regions[0].rationale = text;
    assert.throws(() => serializeCheckpoint(cache), e => e.code === 'jsonb');
  }
});
test('raw provider error never enters bounded failure summary', () => {
  const failure = failureCheckpoint(new Error('https://private/?token=secret Authorization: Bearer private'.repeat(1000)), 'provider', true);
  assert.deepEqual(failure, { kind: 'provider_error', code: 'provider', retryable: true, billing: 'unknown' });
  assert.equal(failureCheckpoint(new ExtractionError('invalid_rect'), 'validation', true).retryable, false);
  assert.equal(failureCheckpoint(new ExtractionError('timeout'), 'local', false).billing, 'not_dispatched');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { m2Corpus, input, tiles, region } from './fixtures/v0.2/m2-tile-recovery.mjs';
import { validateM2Corpus, validateCacheProjection, contractTileId, cacheProjection, serializedBytes, CACHE_BYTE_LIMIT } from './helpers/v0.2-contracts.mjs';
import { planTiles } from '../src/features/detail-extraction/images.ts';
import { candidateId, normalizeCandidates } from '../src/features/detail-extraction/geometry.ts';
import { readExtraction, tileOutputSchema } from '../src/features/detail-extraction/schemas.ts';
import { extractionContextStatus } from '../src/features/detail-extraction/selection.ts';
import { analyzeProductShots, saveProductShots } from '../src/features/detail-extraction/service.ts';
import { ExtractionError } from '../src/features/detail-extraction/errors.ts';
import { startAssetDb, assetRow, projectId, assetId } from './helpers/asset-db.mjs';

test('M2 corpus is complete, deterministic contract data without mutation', () => {
  const before = structuredClone(m2Corpus);
  assert.equal(validateM2Corpus(m2Corpus), true); assert.deepEqual(m2Corpus, before);
});
for (const c of m2Corpus) test(`M2 ${c.id}: ${c.title} (data contract, not implemented retry)`, () => {
  const cache = validateCacheProjection(cacheProjection(c.cacheInput, c.before));
  assert.equal(cache.tiles.length, 4);
  assert.equal(cache.tiles.filter(t => t.status === 'completed').length, c.before.filter(t => t.status === 'completed').length);
  for (const index of c.expected.retryTargets) assert.equal(cache.tiles[index].status, 'failed');
  if (c.transition) for (const index of c.transition.preservedIndices) assert.deepEqual(c.transition.after[index], c.before[index]);
});
test('reference tile identity golden vector; not production candidate identity', () => {
  assert.equal(contractTileId(input, tiles[0]), '29fecfa6f6c8a29ded04e4f7fdec867a639133d68af6359aa32647b3b83d3628');
  assert.equal(contractTileId(input, { ...tiles[0], score: .01, result: {}, status: 'failed' }), contractTileId(input, tiles[0]));
  assert.equal(contractTileId({ ...input, model: 'other-model' }, tiles[0]), contractTileId(input, tiles[0]));
  // Model/policy are cache compatibility, not tile geometric identity.
  for (const patch of [{ sourceFingerprint: 'c'.repeat(64) }, { productContextFingerprint: 'd'.repeat(64) }])
    assert.notEqual(contractTileId({ ...input, ...patch }, tiles[0]), contractTileId(input, tiles[0]));
  for (const patch of [{ index: 1 }, { y: 1 }, { height: 2047 }])
    assert.notEqual(contractTileId(input, { ...tiles[0], ...patch }), contractTileId(input, tiles[0]));
});
test('current planTiles is deterministic and matches frozen half-open pixel ranges', () => {
  assert.deepEqual(planTiles(input.sourceDimensions), tiles);
  assert.deepEqual(planTiles(input.sourceDimensions, Array(6000).fill(false)), tiles);
  assert.equal(tiles.at(-1).y + tiles.at(-1).height, 6000);
  const whiteRows = Array(6000).fill(false); whiteRows.fill(true, 2052, 2068);
  assert.deepEqual(planTiles(input.sourceDimensions, whiteRows), planTiles(input.sourceDimensions, whiteRows));
  assert.notDeepEqual(planTiles(input.sourceDimensions, whiteRows), tiles);
});
test('current candidate identity ignores relevance but is not a tile identity', () => {
  const entry = { region, tile: tiles[0] };
  const a = normalizeCandidates([entry], input.sourceDimensions, input.sourceFingerprint).candidates[0];
  const b = normalizeCandidates([{ ...entry, region: { ...region, targetProductRelevance: .1, containsTargetProduct: false } }], input.sourceDimensions, input.sourceFingerprint).candidates[0];
  assert.equal(a.id, b.id); assert.notEqual(a.defaultSelected, b.defaultSelected);
  assert.equal(a.id, candidateId(input.sourceFingerprint, a.rect, a.regionType));
  assert.notEqual(a.id, contractTileId(input, tiles[0]));
});
test('completed tile with zero regions is still success, not a retry target', () => {
  const corpus = structuredClone(m2Corpus); corpus[0].before[0].result.regions = [];
  assert.equal(validateM2Corpus(corpus), true);
  assert.deepEqual(corpus[0].expected.retryTargets, []);
});
test('cache compatibility is key-order independent but model/policy/orientation/layout input changes are stale', () => {
  const corpus = structuredClone(m2Corpus);
  corpus[1].input = Object.fromEntries(Object.entries(corpus[1].input).reverse());
  assert.equal(validateM2Corpus(corpus), true);
  for (const patch of [{ model: 'other-model' }, { promptVersion: 2 }, { policyVersion: 3 }, { tilingVersion: 2 },
    { normalizationVersion: 2 }, { sourceOrientation: 2 }, { sourceDimensions: { width: 400, height: 6001 } }]) {
    const changed = structuredClone(m2Corpus); Object.assign(changed[1].input, patch);
    changed[1].expected = { runStatus: 'partial', reusableIndices: [], retryTargets: [], stale: true };
    assert.equal(validateM2Corpus(changed), true);
  }
});
const invalidCases = [
  ['duplicate case ID', c => { c[1].id = 'T1'; }],
  ['missing case', c => { c.pop(); }],
  ['wrong run status', c => { c[1].expected.runStatus = 'complete'; }],
  ['successful tile in retry targets', c => { c[1].expected.retryTargets = [0, 1]; }],
  ['stale cache reuse', c => { c[5].expected.reusableIndices = [0]; }],
  ['successful result changed during retry', c => { c[7].transition.after[0].result.regions[0].rationale = 'changed'; }],
  ['Derived deleted during retry', c => { c[4].transition.derivedAfter = []; }],
  ['failure/result ambiguity', c => { c[1].before[1].result = { schemaVersion: 2, regions: [] }; }],
  ['raw error leakage', c => { c[1].before[1].failure.message = 'raw provider error'; }],
  ['unknown failure kind', c => { c[1].before[1].failure.kind = 'anything'; }],
  ['non-contiguous index', c => { c[0].before[1].index = 6; }],
  ['geometry outside source', c => { c[0].before[3].height = 625; }],
];
for (const [name, mutate] of invalidCases) test(`M2 validator rejects ${name}`, () => {
  const corpus = structuredClone(m2Corpus); mutate(corpus); assert.throws(() => validateM2Corpus(corpus));
});
function maximumCache(character) {
  const maxInput = { ...input, sourceDimensions: { width: 400, height: 28928 }, model: 'x'.repeat(200) };
  const maxRegion = { ...region, rationale: character.repeat(180), relevanceReason: character.repeat(120) };
  const records = Array.from({ length: 16 }, (_, index) => ({ index, x: 0, y: index * 1792, width: 400, height: 2048,
    status: 'completed', result: { schemaVersion: 2, regions: Array.from({ length: 8 }, () => structuredClone(maxRegion)) } }));
  return cacheProjection(maxInput, records);
}
test('cache UTF-8 cap measures 16x8 max-length Korean regions, not just JS character count', () => {
  const cache = maximumCache('한'); assert.equal(serializedBytes(cache), 155616);
  assert.ok(serializedBytes(cache) < CACHE_BYTE_LIMIT); assert.doesNotThrow(() => validateCacheProjection(cache));
});
test('schema-valid escaped control strings can exceed 256KiB; reject without truncating', () => {
  const cache = maximumCache('\u0000'), before = structuredClone(cache);
  cache.tiles.forEach(t => tileOutputSchema.parse(t.result));
  assert.equal(serializedBytes(cache), 270816);
  assert.throws(() => validateCacheProjection(cache), /256KiB/); assert.deepEqual(cache, before);
});
test('cache rejects 17 tiles, 9 regions and raw image/envelope fields', () => {
  const cache = maximumCache('한'); cache.tiles.push(structuredClone(cache.tiles[0])); assert.throws(() => validateCacheProjection(cache));
  cache.tiles.pop(); cache.tiles[0].result.regions.push(structuredClone(region)); assert.throws(() => validateCacheProjection(cache));
  cache.tiles[0].result.regions.pop(); cache.rawResponse = {}; assert.throws(() => validateCacheProjection(cache));
});
test('pending/in-flight checkpoint data is not a settled failed retry target', () => {
  const cache = cacheProjection(input, m2Corpus[0].before);
  cache.tiles[1] = { tileId: cache.tiles[1].tileId, index: 1, geometry: cache.tiles[1].geometry, status: 'pending' };
  cache.tiles[2] = { tileId: cache.tiles[2].tileId, index: 2, geometry: cache.tiles[2].geometry, status: 'in_flight' };
  assert.doesNotThrow(() => validateCacheProjection(cache));
  assert.deepEqual(cache.tiles.filter(t => t.status === 'failed').map(t => t.index), []);
  const corpus = structuredClone(m2Corpus); delete corpus[0].before[1].result; corpus[0].before[1].status = 'pending';
  assert.throws(() => validateM2Corpus(corpus), /settled/);
});
for (const version of [1, 2]) test(`current legacy result v${version} stays readable without invented cache`, () => {
  const normalized = normalizeCandidates([{ region, tile: tiles[0] }], input.sourceDimensions, input.sourceFingerprint);
  const candidates = normalized.candidates.map(candidate => {
    if (version === 2) return candidate;
    const { visualKind, targetProductRelevance, containsTargetProduct, relevanceReason, ...legacy } = candidate;
    void visualKind; void targetProductRelevance; void containsTargetProduct; void relevanceReason; return legacy;
  });
  const latestResult = { schemaVersion: version, policyVersion: version, sourceFingerprint: input.sourceFingerprint,
    sourceDimensions: input.sourceDimensions, sourceOrientation: 1, coordinateSpace: input.coordinateSpace,
    provider: 'openai', model: 'test-vision-v1', analyzedAt: '2026-01-01T00:00:00.000Z', tileCount: 4, completedTiles: 3,
    failedTiles: [1], partialAnalysis: true, truncatedCandidates: false, candidates,
    ...(version === 2 ? { productContextFingerprint: input.productContextFingerprint } : {}) };
  const metadata = { detailExtraction: { schemaVersion: 1, revision: '30000000-0000-4000-8000-000000000001', saveLease: null,
    attempt: { status: 'completed', runId: '30000000-0000-4000-8000-000000000002', startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:01.000Z', errorCode: null }, latestResult } };
  const before = structuredClone(metadata), parsed = readExtraction(metadata);
  assert.ok(parsed); assert.deepEqual(metadata, before); assert.equal('tiles' in parsed.latestResult, false);
  assert.equal(extractionContextStatus(parsed.latestResult, 'd'.repeat(64)), version === 1 ? 'legacy' : 'stale');
});

async function serviceFixture(t) {
  const db = await startAssetDb(); t.after(() => db.close());
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = (target, init) => {
    const url = new URL(typeof target === 'string' ? target : target instanceof URL ? target.href : target.url);
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'External network forbidden');
    return fetchBefore(target, init);
  };
  t.after(() => { globalThis.fetch = fetchBefore; });
  const bytes = await sharp({ create: { width: 400, height: 6000, channels: 3, background: '#999999' } }).png().toBuffer();
  const row = assetRow({ size_bytes: bytes.length, metadata: { testNamespace: { preserved: true } } });
  db.state.assets.push(row); db.state.objects.add(row.storage_path); db.state.objectBytes.set(row.storage_path, bytes);
  return { ...db, row };
}
test('BEFORE service: partial reuses whole result; force calls all 4; failed rerun preserves success and Derived', async t => {
  const f = await serviceFixture(t); let calls = 0, mode = 'partial';
  const factory = () => ({ model: 'test-vision-v1', analyze: async () => {
    const index = calls++ % 4;
    if (mode === 'failed' || (mode === 'partial' && index === 1)) throw new ExtractionError('timeout');
    return { schemaVersion: 2, regions: [structuredClone(region)] };
  } });
  const first = await analyzeProductShots(projectId, assetId, false, factory);
  const partial = first.asset.metadata.detailExtraction;
  assert.equal(calls, 4); assert.equal(partial.attempt.status, 'completed'); assert.equal(partial.latestResult.completedTiles, 3);
  assert.deepEqual(partial.latestResult.failedTiles, [1]); assert.equal(partial.latestResult.partialAnalysis, true);
  assert.equal('tiles' in partial.latestResult, false);
  assert.equal((await analyzeProductShots(projectId, assetId, false, factory)).reused, true); assert.equal(calls, 4);
  await saveProductShots(projectId, assetId, { candidateIds: [partial.latestResult.candidates[0].id] });
  const derived = structuredClone(f.state.assets.slice(1)), objects = [...f.state.objects];
  const previous = structuredClone(f.row.metadata.detailExtraction.latestResult);
  mode = 'failed'; await assert.rejects(() => analyzeProductShots(projectId, assetId, true, factory), e => e.code === 'timeout');
  assert.equal(calls, 8); assert.equal(f.row.metadata.detailExtraction.attempt.status, 'failed');
  assert.deepEqual(f.row.metadata.detailExtraction.latestResult, previous);
  assert.deepEqual(f.state.assets.slice(1), derived); assert.deepEqual([...f.state.objects], objects);
  mode = 'success'; await analyzeProductShots(projectId, assetId, true, factory);
  assert.equal(calls, 12, 'Current force is 4 more calls, not future failed-only 1');
  assert.equal(f.row.metadata.detailExtraction.latestResult.partialAnalysis, false);
  assert.deepEqual(f.row.metadata.testNamespace, { preserved: true });
});
test('BEFORE service: initial all-failed run has failed attempt and no latestResult', async t => {
  const f = await serviceFixture(t); let calls = 0;
  await assert.rejects(() => analyzeProductShots(projectId, assetId, false, () => ({ model: 'test-vision-v1', analyze: async () => {
    calls++; throw new ExtractionError('provider');
  } })), e => e.code === 'provider');
  assert.equal(calls, 4); assert.equal(f.row.metadata.detailExtraction.attempt.status, 'failed');
  assert.equal(f.row.metadata.detailExtraction.latestResult, null);
});

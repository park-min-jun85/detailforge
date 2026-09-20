// Test-only executable data contracts. No provider, persistence, retry executor or semantic classifier.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { tileOutputSchema } from '../../src/features/detail-extraction/schemas.ts';
import { normalizeCandidates } from '../../src/features/detail-extraction/geometry.ts';
import { COPY_INTENTS, validateCommerceCopy, messageDuplication } from '../../src/features/page-quality/commerce.ts';
import { copyQuality, factCoverage } from '../../src/features/page-quality/policy.ts';
import { sectionContentSchema } from '../../src/features/section-engine/schemas.ts';

export const CACHE_BYTE_LIMIT = 256 * 1024;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const geometry = z.strictObject({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative(),
  width: z.number().int().positive(), height: z.number().int().positive() });
const inputSchema = z.strictObject({ sourceFingerprint: hash, productContextFingerprint: hash,
  sourceDimensions: z.strictObject({ width: z.number().int().positive().max(6000), height: z.number().int().positive().max(60000) }),
  sourceOrientation: z.number().int().min(1).max(8), coordinateSpace: z.literal('orientation_normalized_pixels'),
  model: z.string().min(1).max(200), tileOutputSchemaVersion: z.literal(2),
  tilingVersion: z.number().int().positive(), promptVersion: z.number().int().positive(),
  policyVersion: z.number().int().positive(), normalizationVersion: z.number().int().positive(),
});
export const failureSchema = z.strictObject({
  kind: z.enum(['provider_error', 'timeout', 'structured_output_invalid', 'local_processing_error']),
  code: z.enum(['provider', 'timeout', 'invalid_response', 'invalid_rect']),
  retryable: z.boolean(), billing: z.enum(['not_dispatched', 'unknown']),
}).superRefine((f, ctx) => {
  const code = { provider_error: 'provider', timeout: 'timeout', structured_output_invalid: 'invalid_response', local_processing_error: 'invalid_rect' }[f.kind];
  if (f.code !== code || (f.kind === 'local_processing_error' && f.retryable)) ctx.addIssue({ code: 'custom', message: 'Failure policy mismatch' });
});
const tileCommon = { tileId: hash, index: z.number().int().min(0).max(15), geometry };
const cachedTileSchema = z.discriminatedUnion('status', [
  z.strictObject({ ...tileCommon, status: z.literal('pending') }),
  z.strictObject({ ...tileCommon, status: z.literal('in_flight') }),
  z.strictObject({ ...tileCommon, status: z.literal('completed'), result: tileOutputSchema }),
  z.strictObject({ ...tileCommon, status: z.literal('failed'), failure: failureSchema }),
]);
const cacheSchema = z.strictObject({ schemaVersion: z.literal(1), input: inputSchema, tiles: z.array(cachedTileSchema).min(1).max(16) });
const expectedSchema = z.strictObject({ runStatus: z.enum(['complete', 'partial', 'failed']), reusableIndices: z.array(z.number().int()),
  retryTargets: z.array(z.number().int()), stale: z.boolean() });
const classifications = ['allow', 'warning', 'reject'];
export const REPETITION_CATEGORIES = ['exact_text', 'normalized_text', 'fact_reuse', 'title_body_redundancy',
  'cross_section_purpose', 'visual_message_reuse', 'meta_observation'];

// Reference identity protocol only: no existing production tileId helper exists.
// JSON tuple fixes ordering; output, scores, status and attempt counters cannot enter identity.
export function contractTileId(input, tile) {
  return createHash('sha256').update(JSON.stringify(['detailforge.tile', 1,
    input.sourceFingerprint, input.productContextFingerprint,
    tile.index, tile.x, tile.y, tile.width, tile.height])).digest('hex');
}
export function cacheProjection(input, records) {
  return { schemaVersion: 1, input: structuredClone(input), tiles: records.map(({ index, x, y, width, height, ...state }) => ({
    tileId: contractTileId(input, { index, x, y, width, height }), index, geometry: { x, y, width, height }, ...structuredClone(state),
  })) };
}
const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
export function validateCacheProjection(value) {
  const cache = cacheSchema.parse(value);
  assert.ok(bytes(value) <= CACHE_BYTE_LIMIT, 'Cache exceeds 256KiB UTF-8 JSON cap');
  assert.ok(cache.input.sourceDimensions.width * cache.input.sourceDimensions.height <= 40_000_000, 'Pixel limit');
  const ids = new Set();
  cache.tiles.forEach((tile, index) => {
    assert.equal(tile.index, index, 'Ordered contiguous tile indices');
    assert.ok(!ids.has(tile.tileId), 'Duplicate tile identity'); ids.add(tile.tileId);
    assert.equal(tile.tileId, contractTileId(cache.input, { index, ...tile.geometry }), 'Identity mismatch');
    const g = tile.geometry, dim = cache.input.sourceDimensions;
    assert.equal(g.x, 0); assert.equal(g.width, dim.width);
    assert.ok(g.y + g.height <= dim.height, 'Tile outside source');
    if (index === 0) assert.equal(g.y, 0);
    else { const prev = cache.tiles[index - 1].geometry; assert.ok(g.y > prev.y && g.y <= prev.y + prev.height, 'Tile ordering/coverage'); }
    if (tile.status === 'completed') normalizeCandidates(tile.result.regions.map(region => ({ region, tile: { index, ...g } })), dim, cache.input.sourceFingerprint);
  });
  const last = cache.tiles.at(-1).geometry;
  assert.equal(last.y + last.height, cache.input.sourceDimensions.height, 'Last pixel range missing');
  return cache;
}
const runStatus = records => {
  assert.ok(records.every(t => ['completed', 'failed'].includes(t.status)), 'Terminal run requires settled tiles');
  const successes = records.filter(t => t.status === 'completed').length;
  return successes === records.length ? 'complete' : successes ? 'partial' : 'failed';
};
export function validateM2Corpus(corpus) {
  assert.deepEqual(corpus.map(c => c.id), Array.from({ length: 8 }, (_, i) => `T${i + 1}`), 'M2 completeness/order');
  for (const c of corpus) {
    assert.equal(c.provenance, 'synthetic'); assert.ok(c.title);
    inputSchema.parse(c.input); inputSchema.parse(c.cacheInput); expectedSchema.parse(c.expected);
    validateCacheProjection(cacheProjection(c.cacheInput, c.before));
    const stale = !isDeepStrictEqual(c.input, c.cacheInput);
    assert.equal(c.expected.stale, stale, c.id);
    assert.equal(c.expected.runStatus, runStatus(c.before), c.id);
    const reusable = c.before.filter(t => t.status === 'completed').map(t => t.index);
    const failed = c.before.filter(t => t.status === 'failed' && t.failure.retryable).map(t => t.index);
    assert.deepEqual(c.expected.reusableIndices, stale ? [] : reusable, c.id);
    assert.deepEqual(c.expected.retryTargets, stale ? [] : failed, c.id);
    if (c.transition) {
      const tx = c.transition;
      assert.equal(tx.action, 'explicit_retry'); assert.equal(stale, false);
      assert.deepEqual(tx.targetedIndices, c.expected.retryTargets);
      assert.deepEqual(tx.preservedIndices, reusable);
      validateCacheProjection(cacheProjection(c.input, tx.after));
      assert.equal(tx.after.length, c.before.length);
      assert.equal(tx.afterRunStatus, runStatus(tx.after));
      for (let i = 0; i < c.before.length; i++) {
        assert.equal(contractTileId(c.input, c.before[i]), contractTileId(c.input, tx.after[i]));
        if (!tx.targetedIndices.includes(i)) assert.deepEqual(tx.after[i], c.before[i], 'Success changed');
      }
      assert.deepEqual(tx.derivedAfter, tx.derivedBefore, 'Derived deletion is not a retry side effect');
    }
  }
  return true;
}

export function validateM3Corpus(corpus) {
  assert.deepEqual(corpus.map(c => c.id), Array.from({ length: 22 }, (_, i) => `C${i + 1}`), 'M3 completeness/order');
  for (const c of corpus) {
    assert.ok(c.title && c.pageContext.productName && c.provenance.reference);
    assert.ok(['synthetic', 'historical_minimal_quote'].includes(c.provenance.kind));
    assert.ok(classifications.includes(c.expected.classification)); assert.ok(c.expected.rationale);
    assert.ok(c.expected.categories.every(x => REPETITION_CATEGORIES.includes(x)));
    assert.equal(new Set(c.expected.categories).size, c.expected.categories.length);
    const evidence = new Map(c.pageContext.evidence.map(e => [e.id, e]));
    assert.equal(evidence.size, c.pageContext.evidence.length);
    assert.equal(new Set(c.pageContext.assets).size, c.pageContext.assets.length);
    const keys = new Set(); assert.ok(c.sections.length);
    for (const s of c.sections) {
      const content = sectionContentSchema.parse(s.content);
      assert.equal(s.copyIntent, COPY_INTENTS[content.type]); assert.ok(s.purpose);
      assert.ok(!keys.has(content.plannerKey)); keys.add(content.plannerKey);
      const visit = value => {
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
          if (key === 'evidenceIds') for (const id of child) assert.ok(evidence.has(id), 'Unknown evidence');
          else if (key === 'assetIds') for (const id of child) assert.ok(c.pageContext.assets.includes(id), 'Unknown asset');
          else if (Array.isArray(child)) child.forEach(visit);
          else if (typeof child === 'object') visit(child);
        }
      };
      visit(content);
      for (const id of content.evidenceIds) {
        const e = evidence.get(id);
        if (e.kind === 'visual_observation') assert.ok(content.assetIds.includes(e.assetId), 'Visual/asset mismatch');
      }
      if (content.type === 'specification') for (const row of content.rows) {
        assert.ok(row.evidenceIds.some(id => evidence.get(id)?.label === row.label && evidence.get(id)?.value === row.value), 'Canonical row changed');
      }
    }
  }
  return true;
}

// Observes existing production helpers only. This is NOT the future M3 classifier.
export function observeCurrentCopy(c) {
  const contents = c.sections.map(s => s.content);
  const messages = c.sections.map(s => ({ ...s.content, purpose: s.purpose }));
  const commerceRejects = contents.flatMap((s, i) => {
    try { validateCommerceCopy(s); return []; } catch (error) { return [{ index: i, reason: error.reason }]; }
  });
  const duplication = messageDuplication(messages), quality = copyQuality(contents);
  return { commerceRejects, duplicatePairs: duplication.duplicates,
    duplicateTitleCount: quality.duplicateTitleCount, duplicateCopyCount: quality.duplicateCopyCount,
    factOverBudgetIds: factCoverage(c.pageContext.evidence, contents).filter(f => f.uses > f.marketingBudget).map(f => f.factId) };
}
export const serializedBytes = bytes;

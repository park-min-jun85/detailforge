// TASK037_M2_CORPUS_V1 — synthetic contract data, never a persisted production cache.
export const input = {
  sourceFingerprint: 'a'.repeat(64), productContextFingerprint: 'b'.repeat(64),
  sourceDimensions: { width: 400, height: 6000 }, sourceOrientation: 1,
  coordinateSpace: 'orientation_normalized_pixels',
  model: 'test-vision-v1', tileOutputSchemaVersion: 2,
  tilingVersion: 1, promptVersion: 1, policyVersion: 2, normalizationVersion: 1,
};
export const tiles = [
  { index: 0, x: 0, y: 0, width: 400, height: 2048 },
  { index: 1, x: 0, y: 1792, width: 400, height: 2048 },
  { index: 2, x: 0, y: 3584, width: 400, height: 2048 },
  { index: 3, x: 0, y: 5376, width: 400, height: 624 },
];
export const region = {
  regionType: 'product_photo', confidence: .9, productVisibility: .9, standaloneUsability: .9,
  textDensity: 'none', box: { xMin: 50, yMin: 100, xMax: 950, yMax: 850 }, rationale: '합성 제품 영역',
  visualKind: 'photo', targetProductRelevance: .9, containsTargetProduct: true, relevanceReason: '합성 대상 제품',
};
// Current public error codes, plus test-only causal categories. No raw errors/messages.
export const failures = {
  provider_error: { kind: 'provider_error', code: 'provider', retryable: true, billing: 'unknown' },
  timeout: { kind: 'timeout', code: 'timeout', retryable: true, billing: 'unknown' },
  structured_output_invalid: { kind: 'structured_output_invalid', code: 'invalid_response', retryable: true, billing: 'unknown' },
  local_processing_error: { kind: 'local_processing_error', code: 'invalid_rect', retryable: false, billing: 'unknown' },
};
const success = index => ({ ...tiles[index], status: 'completed', result: { schemaVersion: 2, regions: [structuredClone(region)] } });
const failed = (index, kind = 'timeout') => ({ ...tiles[index], status: 'failed', failure: { ...failures[kind] } });
const state = (failedIndices = [], kinds = []) => tiles.map(tile => failedIndices.includes(tile.index)
  ? failed(tile.index, kinds[failedIndices.indexOf(tile.index)] ?? 'timeout') : success(tile.index));
const expected = (runStatus, reusableIndices, retryTargets, stale = false) => ({ runStatus, reusableIndices, retryTargets, stale });
const sample = (id, title, before, exp, extra = {}) => ({ id, title, provenance: 'synthetic', input: structuredClone(input),
  cacheInput: structuredClone(input), before, expected: exp, ...extra });
export const m2Corpus = [
  sample('T1', '4 tiles completed', state(), expected('complete', [0, 1, 2, 3], [])),
  sample('T2', '1 tile failed', state([1]), expected('partial', [0, 2, 3], [1])),
  sample('T3', 'non-contiguous failures', state([0, 2], ['provider_error', 'structured_output_invalid']), expected('partial', [1, 3], [0, 2])),
  sample('T4', 'all failed; deterministic local error is not blindly retryable',
    state([0, 1, 2, 3], Object.keys(failures)), expected('failed', [], [0, 1, 2])),
  sample('T5', 'explicit retry fails again; success and Derived remain', state([1]), expected('partial', [0, 2, 3], [1]), {
    transition: { action: 'explicit_retry', targetedIndices: [1], after: state([1]), afterRunStatus: 'partial',
      preservedIndices: [0, 2, 3], derivedBefore: ['test-derived-a'], derivedAfter: ['test-derived-a'] },
  }),
  sample('T6', 'source bytes changed', state([1]), expected('partial', [], [], true), {
    input: { ...structuredClone(input), sourceFingerprint: 'c'.repeat(64) },
  }),
  sample('T7', 'product identity context changed', state([1]), expected('partial', [], [], true), {
    input: { ...structuredClone(input), productContextFingerprint: 'd'.repeat(64) },
  }),
  sample('T8', 'same tile retry succeeds; merge without changing successes', state([1]), expected('partial', [0, 2, 3], [1]), {
    transition: { action: 'explicit_retry', targetedIndices: [1], after: state(), afterRunStatus: 'complete',
      preservedIndices: [0, 2, 3], derivedBefore: ['test-derived-a'], derivedAfter: ['test-derived-a'] },
  }),
];

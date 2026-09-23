export const dimensions = { width: 800, height: 4000 };
export const base = { x: 80, y: 100, width: 600, height: 500 };
export const insets = { left: 20, top: 10, right: 30, bottom: 40 };
export function candidate(id, overrides = {}) {
  return { id, basisKey: `basis-${id}`, rect: { ...base }, regionType: 'product_photo', defaultSelected: true,
    saveAllowed: true, confidence: .9, textDensity: 'none', rationale: '로컬 합성 이미지 후보',
    edgeTruncated: false, exclusion: null, visualKind: 'photo', targetProductRelevance: .95, ...overrides };
}
export function review(candidates = [candidate('A'), candidate('B', { rect: { ...base, y: 700 } }),
  candidate('C', { rect: { ...base, y: 1300 }, defaultSelected: false, exclusion: 'low_relevance' }),
  candidate('P', { rect: { ...base, y: 1900 }, saveAllowed: false, defaultSelected: false })]) {
  return { revision: '52000000-0000-4000-8000-000000000001', active: false, hasAttempt: true,
    status: 'partial', total: 2, successful: 1, failed: 1, retryable: 1,
    result: { candidates, sourceDimensions: { ...dimensions }, sourceOrientation: 1,
      coordinateSpace: 'orientation_normalized_pixels', truncatedCandidates: false }, savedCandidateIds: [], savedCrops: [] };
}

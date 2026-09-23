import test from 'node:test';
import assert from 'node:assert/strict';
import { applyManualDraft, buildCropSaveRequest, cropAlreadySaved, cropValidation, emptyCropWorkspace,
  keyboardInsetDelta, maxEdgeInset, moveCropEdge, pointerInset, reconcileCropWorkspace, removeManualDraft,
  settleCropSave, ZERO_INSETS } from '../src/features/detail-extraction/manual-crop-client.ts';
import { manualCropRect } from '../src/features/detail-extraction/crop-geometry.ts';
import { requestCropSave, requestCropSaveV2 } from '../src/features/detail-extraction/client.ts';
import { base, candidate, dimensions, insets, review } from './fixtures/v0.2.1/manual-crop-ui.mjs';
const initial = () => reconcileCropWorkspace(emptyCropWorkspace(), review());
const apply = (w, id = 'A', values = insets) => applyManualDraft(w, w.review.result.candidates.find(c => c.id === id), values);
test('D1 same ID/base/basis on new revision preserves pixel draft and selection', () => {
  const before = apply(initial()), next = reconcileCropWorkspace(before, { ...review(), revision: 'new-revision' });
  assert.deepEqual(next.drafts, before.drafts); assert.deepEqual(next.selected, before.selected);
  assert.equal(buildCropSaveRequest(next).expectedRevision, 'new-revision'); assert.equal(next.notice, '');
});
test('D2 removed candidate drops draft and selection with notice', () => {
  const next = reconcileCropWorkspace(apply(initial()), review([candidate('B')]));
  assert.equal(next.drafts.A, undefined); assert.equal(next.selected.A, undefined); assert.ok(next.notice);
});
test('D3 new ID at same pixels cannot inherit another candidate draft', () => {
  const next = reconcileCropWorkspace(apply(initial()), review([candidate('N')]));
  assert.deepEqual(next.drafts, {}); assert.equal(next.selected.N, true);
});
for (const change of ['rect', 'basis', 'dimensions']) test(`D4 ${change} change marks retained draft stale and prevents auto fallback`, () => {
  const r = review();
  if (change === 'rect') r.result.candidates[0].rect.x++;
  if (change === 'basis') r.result.candidates[0].basisKey += '-new';
  if (change === 'dimensions') r.result.sourceDimensions.height++;
  const next = reconcileCropWorkspace(apply(initial()), r);
  assert.equal(next.drafts.A.stale, true); assert.deepEqual(next.drafts.A.insets, insets); assert.ok(next.notice);
  assert.ok(!buildCropSaveRequest(next).items.some(i => i.candidateId === 'A'));
  assert.equal(apply(next).drafts.A.stale, false);
});
test('D5 reorder never moves a draft to another ID', () => {
  const before = apply(initial()), r = review(); r.result.candidates.reverse();
  const next = reconcileCropWorkspace(before, r); assert.deepEqual(next.drafts, before.drafts);
});
test('D6 pixel workspace has no signed URL dependency; repeated refresh preserves values', () => {
  const before = apply(initial()); let next = before;
  for (let i = 0; i < 5; i++) next = reconcileCropWorkspace(next, review());
  assert.deepEqual(next, before); assert.equal(JSON.stringify(next.drafts).includes('http'), false);
});
for (const checked of [true, false]) test(`Apply/cancel-equivalent/remove preserve selected=${checked}`, () => {
  const before = initial(); before.selected.A = checked;
  const next = apply(before); assert.equal(next.selected.A, checked); assert.deepEqual(before.drafts, {});
  assert.equal(removeManualDraft(next, 'A').selected.A, checked); assert.deepEqual(removeManualDraft(next, 'A').drafts, {});
});
test('explicit unchecked default true and checked default false survive retry with drafts', () => {
  let w = initial(); w.selected.A = false; w.selected.C = true; w = apply(apply(w), 'C');
  const next = reconcileCropWorkspace(w, review()); assert.equal(next.selected.A, false); assert.equal(next.selected.C, true);
  assert.deepEqual(next.drafts, w.drafts);
});
test('builder sends selected eligible IDs only, manual insets present, automatic absent', () => {
  let w = apply(initial()); w = apply(w, 'C'); w.selected.P = true;
  assert.deepEqual(buildCropSaveRequest(w), { schemaVersion: 2, expectedRevision: w.review.revision,
    items: [{ candidateId: 'A', manualInsets: insets }, { candidateId: 'B' }] });
});
test('explicit zero override survives builder; removal returns automatic path', () => {
  const w = apply(initial(), 'A', ZERO_INSETS);
  assert.deepEqual(buildCropSaveRequest(w).items[0].manualInsets, ZERO_INSETS);
  assert.equal(Object.hasOwn(buildCropSaveRequest(removeManualDraft(w, 'A')).items[0], 'manualInsets'), false);
});
test('missing result/revision cannot build a save; invalid draft cannot silently become auto', () => {
  assert.equal(buildCropSaveRequest(emptyCropWorkspace()), null);
  const w = apply(initial()); w.drafts.A.insets.left = 9999;
  assert.ok(!buildCropSaveRequest(w).items.some(i => i.candidateId === 'A'));
});
test('partial A saved/B failed/C reused clears only successful selection and drafts, keeps final receipt', () => {
  let w = apply(apply(apply(initial()), 'B'), 'C'); w.selected.C = true;
  const next = settleCropSave(w, ['A', 'C']);
  assert.deepEqual(next.selected, { A: false, B: true, C: false, P: false });
  assert.deepEqual(Object.keys(next.drafts), ['B']); assert.deepEqual(next.drafts.B, w.drafts.B);
  assert.deepEqual(next.receipts.A.finalRect, manualCropRect(base, dimensions, insets));
  assert.equal(cropAlreadySaved(next, next.review.result.candidates[0]), true);
  assert.deepEqual(Object.keys(w.drafts), ['A', 'B', 'C']);
});
test('receipt survives confirmed final geometry refresh, then new variant is independently saveable', () => {
  const w = settleCropSave(apply(initial()), ['A']), r = review();
  r.savedCrops.push({ assetId: 'derived', finalRect: w.receipts.A.finalRect, adjustmentMode: 'manual' });
  const next = reconcileCropWorkspace(w, r); assert.deepEqual(next.receipts, w.receipts);
  const variant = apply(next, 'A', ZERO_INSETS); variant.selected.A = true;
  assert.equal(cropAlreadySaved(variant, r.result.candidates[0]), false);
  assert.ok(buildCropSaveRequest(variant).items.some(i => i.candidateId === 'A'));
});
test('saved manual final rect filters duplicate but different variant is not saved by base ID', () => {
  const w = apply(initial()); w.review.savedCrops.push({ finalRect: manualCropRect(base, dimensions, insets) });
  assert.equal(cropAlreadySaved(w, w.review.result.candidates[0]), true);
  assert.equal(cropAlreadySaved(apply(w, 'A', ZERO_INSETS), w.review.result.candidates[0]), false);
});
for (const values of [{ ...insets, left: -1 }, { ...insets, top: .5 }, { ...insets, right: NaN },
  { ...insets, bottom: Infinity }, { left: 200, right: 200, top: 100, bottom: 100 }]) test(`invalid numeric input ${JSON.stringify(values)} blocks Apply`, () => {
  assert.equal(cropValidation(base, dimensions, values).rect, null);
});
test('client geometry is exact shared server F; minimum area boundary accepted', () => {
  assert.deepEqual(cropValidation(base, dimensions, insets).rect, { x: 100, y: 110, width: 550, height: 450 });
  assert.ok(cropValidation(base, dimensions, { left: 440, right: 0, top: 100, bottom: 0 }).rect);
});
for (const edge of ['left', 'top', 'right', 'bottom']) test(`${edge} pointer round/clamp respects inward minimum and keyboard physical direction`, () => {
  const moved = moveCropEdge(base, insets, edge, 1e6), bound = maxEdgeInset(base, insets, edge);
  assert.equal(moved[edge], bound); assert.ok(cropValidation(base, dimensions, moved).rect);
  assert.equal(moveCropEdge(base, insets, edge, -100)[edge], 0);
  assert.equal(moveCropEdge(base, insets, edge, 20.5)[edge], 21);
  const horizontal = edge === 'left' || edge === 'right', sign = edge === 'right' || edge === 'bottom' ? -1 : 1;
  assert.equal(keyboardInsetDelta(edge, horizontal ? 'ArrowRight' : 'ArrowDown', false), sign);
  assert.equal(keyboardInsetDelta(edge, horizontal ? 'ArrowLeft' : 'ArrowUp', true), -10 * sign);
  assert.equal(keyboardInsetDelta(edge, 'Enter', false), 0);
  assert.equal(pointerInset(edge, insets, { x: 20, y: 20 }), insets[edge] + sign * 20);
});
test('V1 transport preserved; V2 sends exact zero body/revision to existing route without caching', async t => {
  const original = globalThis.fetch, requests = []; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, init) => { requests.push({ url, ...init, body: JSON.parse(init.body) }); return Response.json({ saved: [], failed: [], available: 30 }); };
  await requestCropSave('project', 'asset', ['A']);
  const body = buildCropSaveRequest(apply(initial(), 'A', ZERO_INSETS)); await requestCropSaveV2('project', 'asset', body);
  assert.deepEqual(requests[0].body, { candidateIds: ['A'] }); assert.deepEqual(requests[1].body, body);
  assert.equal(requests[1].cache, 'no-store'); assert.equal(requests[0].url, requests[1].url);
});

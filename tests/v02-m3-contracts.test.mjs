import test from 'node:test';
import assert from 'node:assert/strict';
import { m3Corpus, currentBaseline } from './fixtures/v0.2/m3-copy-repetition.mjs';
import { validateM3Corpus, observeCurrentCopy } from './helpers/v0.2-contracts.mjs';
import { COPY_INTENTS, messageSignature, validateMessageDistinctness } from '../src/features/page-quality/commerce.ts';
import { titleSimilarity } from '../src/features/page-quality/policy.ts';

test('M3 corpus integrity and all 22 desired labels are data, not a future semantic classifier', () => {
  const before = structuredClone(m3Corpus); assert.equal(validateM3Corpus(m3Corpus), true); assert.deepEqual(m3Corpus, before);
  assert.equal(m3Corpus.filter(c => c.expected.classification === 'allow').length, 9);
  assert.equal(m3Corpus.filter(c => c.expected.classification === 'warning').length, 7);
  assert.equal(m3Corpus.filter(c => c.expected.classification === 'reject').length, 6);
});
// TASK-041 preserves the frozen BEFORE data; only C13's hard-meta observation changed.
const task041Delta = { C13: [[0], [], [], 0] };
for (const c of m3Corpus) test(`CURRENT vs frozen BEFORE ${c.id}: ${c.title}`, () => {
  const before = structuredClone(c), observed = observeCurrentCopy(c);
  assert.deepEqual([observed.commerceRejects.map(x => x.index), observed.duplicatePairs.map(x => [x.first, x.second]),
    observed.factOverBudgetIds, observed.duplicateCopyCount], task041Delta[c.id] ?? currentBaseline[c.id]);
  assert.equal(observed.duplicateTitleCount, 0);
  observed.commerceRejects.forEach(x => assert.equal(x.reason, 'meta_observation'));
  const messages = c.sections.map(s => ({ ...s.content, purpose: s.purpose }));
  if (observed.duplicatePairs.length) assert.throws(() => validateMessageDistinctness(messages), e => e.reason === 'duplicate_purpose');
  else assert.doesNotThrow(() => validateMessageDistinctness(messages));
  assert.deepEqual(c, before);
});
test('taxonomy freezes all ten production type mappings, including feature_from_fact', () => {
  assert.deepEqual(COPY_INTENTS, { hero: 'identity', keyBenefits: 'benefit_from_fact', feature: 'feature_from_fact',
    imageText: 'visual_description', gallery: 'visual_description', detail: 'detail_description', useCase: 'usage_hypothesis',
    option: 'selection_information', specification: 'specification', notice: 'notice' });
});
test('signature set order and limited particle normalization are deterministic, not semantic understanding', () => {
  const section = { type: 'imageText', purpose: '펼친 제품의 전체 외관', evidenceIds: ['F1', 'V1', 'F1'], assetIds: ['test-asset'] };
  assert.deepEqual(messageSignature(section), messageSignature({ ...section, purpose: '펼친 제품 전체 외관', evidenceIds: ['V1', 'F1'] }));
  assert.equal(titleSimilarity('앞면 지퍼 여밈 디자인', '앞면  지퍼 여밈 디자인!'), 1);
});
for (const [name, mutate] of [
  ['missing case', c => c.pop()],
  ['duplicate case ID', c => { c[1].id = 'C1'; }],
  ['missing context', c => { delete c[0].pageContext; }],
  ['wrong classification', c => { c[0].expected.classification = 'success'; }],
  ['unknown category', c => { c[5].expected.categories = ['duplicate']; }],
  ['wrong copy intent', c => { c[0].sections[0].copyIntent = 'visual_description'; }],
  ['unknown evidence', c => { c[0].sections[0].content.evidenceIds = ['F99']; }],
  ['wrong visual asset', c => { c[3].sections[0].content.assetIds = [c[3].pageContext.assets[1]]; }],
  ['canonical value change', c => { c[0].sections[1].content.rows[0].value = 'invented'; }],
]) test(`M3 validator rejects ${name}`, () => {
  const corpus = structuredClone(m3Corpus); mutate(corpus); assert.throws(() => validateM3Corpus(corpus));
});

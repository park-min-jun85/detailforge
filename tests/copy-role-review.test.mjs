import './register-renderer.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { m3Corpus } from './fixtures/v0.2/m3-copy-repetition.mjs';
import { reviewCopyRoles } from '../src/features/page-quality/copy-review.ts';
import { copyQuality } from '../src/features/page-quality/policy.ts';
import { validateCommerceCopy, validateMessageDistinctness, detectMetaObservationCopy, COMMERCE_COPY_VERSION } from '../src/features/page-quality/commerce.ts';
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { QualitySummary } = await import('../src/features/page-quality/summary.tsx');
const { SectionRenderer } = await import('../src/features/detail-renderer/section-renderer.tsx');

for (const c of m3Corpus) test(`TASK-041 ${c.id}: ${c.expected.classification}`, () => {
  const before = structuredClone(c), contents = c.sections.map(s => s.content);
  const quality = copyQuality(contents);
  let rejected = false;
  try {
    contents.forEach(validateCommerceCopy);
    validateMessageDistinctness(c.sections.map(s => ({ ...s.content, purpose: s.purpose })));
  } catch { rejected = true; }
  const classification = rejected ? 'reject' : quality.warnings.includes('repetitive_copy') ? 'warning' : 'allow';
  assert.equal(classification, c.expected.classification);
  if (['C6','C10','C19','C20','C21'].includes(c.id)) assert.ok(quality.copyReview.some(f => f.reason === 'title_body_redundancy'));
  if (['C9','C11'].includes(c.id)) {
    const finding = quality.copyReview.find(f => f.reason === 'fact_reuse');
    assert.deepEqual(finding.sectionIndices, contents.map((_, i) => i));
    assert.equal(new Set(finding.intents).size, contents.length);
  }
  if (c.expected.classification === 'allow') assert.deepEqual(quality.copyReview, []);
  assert.deepEqual(c, before);
});
const visual = (title, body) => ({ ...structuredClone(m3Corpus.find(c => c.id === 'C10').sections[0].content), title, body });
for (const [title, body] of [
  ['앞면 지퍼 여밈', '앞면 지퍼 여밈과 목둘레 봉제선'],
  ['앞면 지퍼 여밈', '뒷면 지퍼 여밈'],
  ['앞면 지퍼 여밈', '앞면 지퍼 여밈이 없습니다'],
  ['앞면 지퍼 여밈', '앞면 지퍼 여밈과 2개 포켓'],
  ['포켓', '양쪽 포켓'],
  ['긴 한글 제품의 앞면 지퍼 여밈 디자인', '긴 한글 제품의 앞면 지퍼 여밈 디자인과 목둘레의 봉제선 외관'],
  ['앞면 지퍼 여밈', null],
]) test(`additional information/negation/null stays distinct: ${body}`, () => {
  assert.deepEqual(reviewCopyRoles([visual(title, body)]), []);
});
test('NFKC, punctuation and repeated whitespace preserve the bounded restatement signal', () => {
  assert.equal(reviewCopyRoles([visual('앞면　지퍼 여밈', '앞면에는  지퍼 여밈이 적용되어 있습니다!')])[0].reason, 'title_body_redundancy');
});
test('shared evidence, roles and assets are reviewed without inventing evidence or mutating fields', () => {
  const contents = m3Corpus.find(c => c.id === 'C9').sections.map(s => structuredClone(s.content));
  const before = structuredClone(contents), finding = reviewCopyRoles(contents).find(f => f.reason === 'fact_reuse');
  assert.deepEqual(finding.evidenceIds, ['F3']);
  assert.deepEqual(finding.intents, ['identity', 'feature_from_fact']);
  assert.notDeepEqual(contents[0].assetIds, contents[1].assetIds);
  assert.deepEqual(contents, before);
  contents[1].evidenceIds = ['F2'];
  assert.deepEqual(reviewCopyRoles(contents), []);
});
test('new scene-report pattern is bounded; grounded nouns and use/selection instructions survive', () => {
  assert.equal(COMMERCE_COPY_VERSION, 3);
  for (const text of ['모델이 착용하고 있는 모습입니다.', '사람이 착용하고 있는 모습이다.']) {
    assert.equal(detectMetaObservationCopy(text, { type: 'imageText' }).hasMetaObservation, true);
  }
  for (const text of ['착용 상태의 전체 실루엣', '모델의 앞면 지퍼 여밈 디자인', '구매 전 옵션을 확인해 주세요.', '착용하고 있는 모습이 아닌 제품의 전체 실루엣']) {
    assert.equal(detectMetaObservationCopy(text, { type: 'imageText' }).hasMetaObservation, false);
  }
});
test('legacy review exposes affected sections and roles outside the renderer, without modifying content', () => {
  const contents = m3Corpus.find(c => c.id === 'C11').sections.map(s => s.content), before = structuredClone(contents);
  const html = renderToStaticMarkup(createElement(QualitySummary, { sections: contents.map(content => ({ content })), assets: [] }));
  assert.match(html, /1번 · 상품 정체성과 첫 인상/);
  assert.match(html, /2번 · 새로운 구체적 특징/);
  assert.match(html, /같은 사실 근거/);
  const rendered = renderToStaticMarkup(createElement(SectionRenderer, { content: contents[0], assets: [], style: { layout: 'stack' } }));
  assert.doesNotMatch(rendered, /같은 사실 근거|검토해 주세요/);
  assert.deepEqual(contents, before);
});

import './register-renderer.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, provider, sectionOutput, protectedSnapshot } from './helpers/section-fixtures.mjs';
import { projectId } from './helpers/section-db.mjs';
import { generateSections, getSectionView } from '../src/features/section-engine/service.ts';
import { regenerateSection, applySectionCandidate } from '../src/features/section-regeneration/service.ts';
import { draftOf, editorSectionSchema } from '../src/features/detail-editor/schemas.ts';
import { saveSection } from '../src/features/detail-editor/service.ts';
import { getPlannerView } from '../src/features/page-planner/service.ts';
import { plannerStateSchema } from '../src/features/page-planner/schemas.ts';
import { copyQuality } from '../src/features/page-quality/policy.ts';
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { CandidateComparison } = await import('../src/features/section-regeneration/components/candidate-comparison.tsx');

const report = '모델이 착용하고 있는 모습입니다.';
test('C13 full generation rejects once before replacement and preserves source, plan and existing rows', () => fixture(async state => {
  await generateSections(projectId, {}, provider);
  const rows = structuredClone(state.sections), protectedData = protectedSnapshot(state), view = await getSectionView(projectId);
  let calls = 0;
  await assert.rejects(() => generateSections(projectId, { replaceExisting: true, expectedRevision: view.revision }, () => ({
    model: 'mock', generate: async input => { calls++; const out = sectionOutput(input); out.sections[0].subheadline = report; return out; },
  })), e => e.code === 'copy_quality');
  assert.equal(calls, 1);
  assert.deepEqual(state.sections, rows);
  assert.deepEqual(protectedSnapshot(state), protectedData);
}));
test('C13 manual save and legacy read remain allowed; regen rejects once without changing any row', () => fixture(async state => {
  await generateSections(projectId, {}, provider);
  const row = editorSectionSchema.parse(state.sections[0]), draft = draftOf(row);
  draft.fields.subheadline = report;
  await saveSection(projectId, row.id, { ...draft, revision: row.updated_at });
  const rows = structuredClone(state.sections), protectedData = protectedSnapshot(state);
  await getSectionView(projectId);
  assert.ok(copyQuality(state.sections.map(s => s.content)).warnings.includes('meta_observation_copy'));
  let calls = 0;
  await assert.rejects(() => regenerateSection(projectId, row.id, { revision: state.sections[0].updated_at }, () => ({
    model: 'mock', generate: async input => { calls++; const { meta, ...content } = structuredClone(input.current.content); void meta; return { schemaVersion: 1, content }; },
  })), e => e.code === 'copy_quality');
  assert.equal(calls, 1);
  assert.deepEqual(state.sections, rows);
  assert.deepEqual(protectedSnapshot(state), protectedData);
}));
test('restatement stays warning in full generation and candidate-first regen; explicit apply preserves immutable data', () => fixture(async state => {
  let fullCalls = 0;
  await generateSections(projectId, {}, () => ({ model: 'mock', generate: async input => {
    fullCalls++; const out = sectionOutput(input);
    out.sections[0].subheadline = `${out.sections[0].headline}를 소개합니다`;
    return out;
  } }));
  assert.equal(fullCalls, 1);
  assert.ok(copyQuality(state.sections.map(s => s.content)).copyReview.some(f => f.reason === 'title_body_redundancy'));
  const rows = structuredClone(state.sections), protectedData = protectedSnapshot(state), row = state.sections[0];
  let regenCalls = 0;
  const signed = await regenerateSection(projectId, row.id, { revision: row.updated_at }, () => ({ model: 'mock', generate: async input => {
    regenCalls++; const { meta, ...content } = structuredClone(input.current.content); void meta;
    return { schemaVersion: 1, content };
  } }));
  assert.equal(regenCalls, 1);
  assert.deepEqual(state.sections, rows);
  const html = renderToStaticMarkup(createElement(CandidateComparison, { current: editorSectionSchema.parse(row), candidate: signed.candidate,
    sections: state.sections.map(s => editorSectionSchema.parse(s)), busy: false, onApply() {}, onKeep() {} }));
  assert.match(html, /후보 검토/);
  assert.match(html, /제목과 본문이 같은 정보/);
  assert.doesNotMatch(html, /disabled=""/);
  const applied = await applySectionCandidate(projectId, row.id, signed);
  assert.equal(applied.content.subheadline, row.content.subheadline);
  assert.deepEqual(applied.style, row.style);
  assert.deepEqual(applied.content.assetIds, row.content.assetIds);
  assert.deepEqual(state.sections.slice(1), rows.slice(1));
  assert.deepEqual(protectedSnapshot(state), protectedData);
}));
test('new plan records v3; v1/v2/unversioned legacy reads remain valid and stale never calls AI or writes', () => fixture(async state => {
  assert.equal(state.page.plan.latestResult.commerceCopyVersion, 3);
  for (const version of [undefined, 1, 2]) {
    const legacy = structuredClone(state.page.plan);
    if (version === undefined) delete legacy.latestResult.commerceCopyVersion;
    else legacy.latestResult.commerceCopyVersion = version;
    // Historical input fingerprints differ because commerceCopyVersion is hashed.
    legacy.latestResult.inputFingerprint = 'a'.repeat(64);
    assert.ok(plannerStateSchema.safeParse(legacy).success);
    state.page.plan = legacy;
    const before = structuredClone(state.page), requestIndex = state.requests.length;
    const view = await getPlannerView(projectId);
    assert.equal(view.stale, true);
    assert.deepEqual(view.state.latestResult, legacy.latestResult);
    assert.deepEqual(state.page, before);
    assert.ok(state.requests.slice(requestIndex).every(r => r.method === 'GET'));
  }
}));

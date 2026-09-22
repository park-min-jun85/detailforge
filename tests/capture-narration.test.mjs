import './register-renderer.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { h1, captureReject, captureAllow, existingReject } from './fixtures/v0.2/capture-narration.mjs';
import { detectMetaObservationCopy, validateCommerceCopy, commerceText } from '../src/features/page-quality/commerce.ts';
import { copyQuality, QUALITY_LABELS } from '../src/features/page-quality/policy.ts';
import { fixture, provider, sectionOutput, protectedSnapshot } from './helpers/section-fixtures.mjs';
import { projectId } from './helpers/section-db.mjs';
import { generateSections, getSectionView } from '../src/features/section-engine/service.ts';
import { regenerateSection, applySectionCandidate } from '../src/features/section-regeneration/service.ts';
import { signCandidate } from '../src/features/section-regeneration/candidate.ts';
import { draftOf, editorSectionSchema } from '../src/features/detail-editor/schemas.ts';
import { saveSection } from '../src/features/detail-editor/service.ts';
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { QualitySummary } = await import('../src/features/page-quality/summary.tsx');
const { SectionRenderer } = await import('../src/features/detail-renderer/section-renderer.tsx');
const actual = JSON.parse(readFileSync(new URL('./fixtures/v0.2/task042-first-sections.json', import.meta.url))).sections;
const visual = text => ({ ...actual[1], intro: text });

for (const text of captureReject) test(`capture narration rejected: ${text}`, () => {
  assert.ok(detectMetaObservationCopy(text, {type:'gallery'}).patterns.includes('capture_narration'));
  assert.throws(() => validateCommerceCopy(visual(text)), e => e.reason === 'meta_observation');
});
for (const text of captureAllow) test(`capture negative stays allowed: ${text}`, () => {
  assert.equal(detectMetaObservationCopy(text, {type:'gallery'}).hasMetaObservation, false);
  assert.doesNotThrow(() => validateCommerceCopy(visual(text)));
});
for (const text of existingReject) test(`existing report family rejected: ${text}`, () => {
  assert.throws(() => validateCommerceCopy(visual(text)), e => e.reason === 'meta_observation');
});
test('TASK-042 replay identifies only actual gallery intro and preserves every other field', () => {
  const before = structuredClone(actual);
  const findings = actual.flatMap(s => commerceText(s).filter(text => detectMetaObservationCopy(text,{type:s.type}).hasMetaObservation));
  assert.deepEqual(findings, [h1]);
  assert.throws(() => validateCommerceCopy(actual[1]), e => e.reason === 'meta_observation');
  for (const s of actual.filter(s => s.type !== 'gallery')) assert.doesNotThrow(() => validateCommerceCopy(s));
  assert.doesNotThrow(() => validateCommerceCopy({...actual[1],intro:null}));
  assert.equal(actual[2].rows.length,6);
  assert.equal(actual[3].optionSnapshot.confirmed.groups[0].values.length,6);
  assert.deepEqual(actual,before);
});
test('capture title validation also covers canonical section headings but exempts exact data values', () => {
  for (const type of ['gallery','specification','option','notice']) {
    assert.throws(() => validateCommerceCopy({...visual(null),type,title:'외관을 담은 모습'}), e => e.reason === 'meta_observation');
  }
  assert.doesNotThrow(() => validateCommerceCopy({...actual[2],rows:[{label:'원문',value:h1,evidenceIds:['F1']}]}));
  assert.doesNotThrow(() => validateCommerceCopy({...actual[3],optionSnapshot:{confirmed:{groups:[{name:'원문',values:[{label:h1}]}]}}}));
});
test('bounded clauses, normalization and negation do not become global 담 substring matching', () => {
  assert.ok(detectMetaObservationCopy('제품의 전체 외관을　담았습니다!').patterns.includes('capture_narration'));
  for (const text of ['사진 보관함입니다. 제품 실루엣이 나타납니다.', '사진 보관함\n제품 실루엣이 나타납니다.', '외관을 설명합니다. 소지품을 담았습니다.', '외관을 담을 수 있는 가방']) {
    assert.equal(detectMetaObservationCopy(text).patterns.includes('capture_narration'),false);
  }
});
test('manual H1 warning is Korean and remains outside the shared renderer; original prose is preserved', () => {
  const before=structuredClone(actual), sections=actual.map(content=>({content}));
  const review=renderToStaticMarkup(createElement(QualitySummary,{sections,assets:[]}));
  assert.ok(review.includes(QUALITY_LABELS.meta_observation_copy));
  assert.doesNotMatch(review,/capture_narration|meta_observation_copy/);
  const final=renderToStaticMarkup(createElement(SectionRenderer,{content:actual[1],assets:[],style:{layout:'stack'}}));
  assert.ok(final.includes(h1));
  assert.ok(!final.includes(QUALITY_LABELS.meta_observation_copy));
  assert.deepEqual(actual,before);
});
test('H1 whole generation rejects once before replacing canonical rows and protected inputs', () => fixture(async state => {
  await generateSections(projectId,{},provider);
  const rows=structuredClone(state.sections), upstream=protectedSnapshot(state), options=structuredClone(state.options), view=await getSectionView(projectId);
  let calls=0;
  await assert.rejects(()=>generateSections(projectId,{replaceExisting:true,expectedRevision:view.revision},()=>({model:'mock',generate:async input=>{
    calls++;const out=sectionOutput(input);out.sections[0].subheadline=h1;return out;
  }})),e=>e.code==='copy_quality');
  assert.equal(calls,1);assert.deepEqual(state.sections,rows);assert.deepEqual(protectedSnapshot(state),upstream);assert.deepEqual(state.options,options);
}));
test('H1 manual save is warning only; individual regen rejects once with canonical unchanged', () => fixture(async state => {
  await generateSections(projectId,{},provider);
  const row=editorSectionSchema.parse(state.sections[0]),draft=draftOf(row);
  draft.fields.subheadline=h1;await saveSection(projectId,row.id,{...draft,revision:row.updated_at});
  assert.equal(state.sections[0].content.subheadline,h1);
  assert.ok(copyQuality(state.sections.map(s=>s.content)).warnings.includes('meta_observation_copy'));
  const rows=structuredClone(state.sections),upstream=protectedSnapshot(state);let calls=0;
  await assert.rejects(()=>regenerateSection(projectId,row.id,{revision:state.sections[0].updated_at},()=>({model:'mock',generate:async input=>{
    calls++;const {meta,...content}=structuredClone(input.current.content);void meta;return {schemaVersion:1,content};
  }})),e=>e.code==='copy_quality');
  assert.equal(calls,1);assert.deepEqual(state.sections,rows);assert.deepEqual(protectedSnapshot(state),upstream);
}));
test('apply revalidates old signed candidate against patched guard without a Planner version bump', () => fixture(async state => {
  await generateSections(projectId,{},provider);const row=state.sections[0];
  const signed=await regenerateSection(projectId,row.id,{revision:row.updated_at},()=>({model:'mock',generate:async input=>{
    const {meta,...content}=structuredClone(input.current.content);void meta;return {schemaVersion:1,content};
  }}));
  const oldCandidate=signCandidate({...signed.candidate,content:{...signed.candidate.content,subheadline:h1}});
  const rows=structuredClone(state.sections),upstream=protectedSnapshot(state);
  await assert.rejects(()=>applySectionCandidate(projectId,row.id,oldCandidate),e=>e.code==='copy_quality');
  assert.deepEqual(state.sections,rows);assert.deepEqual(protectedSnapshot(state),upstream);
}));

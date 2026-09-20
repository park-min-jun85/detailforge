import './register-renderer.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { detectMetaObservationCopy, validateCommerceCopy } from '../src/features/page-quality/commerce.ts';
import { copyQuality } from '../src/features/page-quality/policy.ts';
import { cropImage } from '../src/features/detail-extraction/images.ts';
import { fixture, provider, sectionOutput, protectedSnapshot } from './helpers/section-fixtures.mjs';
import { projectId } from './helpers/section-db.mjs';
import { generateSections, getSectionView } from '../src/features/section-engine/service.ts';
import { regenerateSection } from '../src/features/section-regeneration/service.ts';
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { EditorStatus } = await import('../src/features/detail-editor/components/editor-status.tsx');
const visual = body => ({ type:'imageText', plannerKey:'visual', title:'제품 표면', body, assetIds:[randomUUID()], evidenceIds:['V1'] });

for (const body of ['패드 표면 근접 모습', '흰색 패드 표면 일부와 손으로 누른 구도.', '크림색 의류의 목둘레와 앞여밈 일부, 봉제선이 드러난 근접 구성.']) {
  test(`TASK-032 camera framing rejected without altering the copy: ${body}`, () => {
    const section=visual(body), before=structuredClone(section);
    assert.throws(()=>validateCommerceCopy(section), e=>e.reason==='meta_observation');
    assert.ok(copyQuality([section]).warnings.includes('meta_observation_copy'));
    assert.deepEqual(section,before);
  });
}
test('product structure, neutral appearance and exact Fact/Option values remain valid',()=>{
  for(const body of ['앞면 지퍼 여밈 디자인','착용 상태의 전체 실루엣','목둘레 봉제선','양쪽 포켓 구성',null]) assert.doesNotThrow(()=>validateCommerceCopy(visual(body)));
  for(const type of ['specification','option']) assert.doesNotThrow(()=>validateCommerceCopy({type,title:'상품 안내',rows:[{label:'원문',value:'근접 구성'}],items:[{label:'근접 모습'}]}));
  assert.equal(detectMetaObservationCopy('구매 전 옵션을 확인해 주세요.',{type:'notice'}).hasMetaObservation,false);
  assert.equal(detectMetaObservationCopy('이미지에서 확인할 수 있습니다.').hasMetaObservation,true);
});
test('camera framing failure preserves full generation success and protected upstream',()=>fixture(async state=>{
  await generateSections(projectId,{},provider);
  const before=structuredClone(state.sections), upstream=protectedSnapshot(state), view=await getSectionView(projectId);let calls=0;
  await assert.rejects(()=>generateSections(projectId,{replaceExisting:true,expectedRevision:view.revision},()=>({model:'mock',generate:async input=>{calls++;const out=sectionOutput(input);out.sections[0].subheadline='제품 표면 근접 모습';return out;}})),e=>e.code==='copy_quality');
  assert.equal(calls,1);assert.deepEqual(state.sections,before);assert.deepEqual(protectedSnapshot(state),upstream);
}));
test('individual camera framing rejection is candidate-first with previous data retained',()=>fixture(async state=>{
  await generateSections(projectId,{},provider);const before=structuredClone(state.sections),upstream=protectedSnapshot(state),row=state.sections[0];let calls=0;
  await assert.rejects(()=>regenerateSection(projectId,row.id,{revision:row.updated_at},()=>({model:'mock',generate:async input=>{calls++;const {meta,...content}=structuredClone(input.current.content);void meta;content.subheadline='제품 표면 근접 모습';return {schemaVersion:1,content};}})),e=>e.code==='copy_quality');
  assert.equal(calls,1);assert.deepEqual(state.sections,before);assert.deepEqual(protectedSnapshot(state),upstream);
}));
test('Editor refresh announces reading, not saving, even with an unsaved draft',()=>{
  const html=renderToStaticMarkup(createElement(EditorStatus,{action:'refresh',dirty:true,orderDirty:true,message:'저장되었습니다.'}));
  assert.match(html,/role="status"/);assert.match(html,/최신 섹션을 불러오는 중/);assert.doesNotMatch(html,/저장 중|저장되었습니다/);
});
test('Editor write/recovery status and dirty status remain distinct',()=>{
  const status=(action,dirty=false,orderDirty=false)=>renderToStaticMarkup(createElement(EditorStatus,{action,dirty,orderDirty,message:''}));
  assert.match(status('save'),/저장 중/);assert.match(status('recover'),/이전 순서를 복구/);
  assert.match(status('apply'),/AI 후보를 적용/);assert.match(status('options'),/확정 옵션을 반영/);assert.match(status('generate'),/AI가 이 섹션/);
  assert.match(status(null,true),/저장되지 않은 변경사항/);assert.match(status(null,false,true),/저장되지 않은 순서 변경/);
});

// Deliberately synthetic pixels: border handling must not depend on a supplier/product ID.
const W=400,H=400,zero={top:0,right:0,bottom:0,left:0};
function pixels(border=0,shade=255){const data=Buffer.alloc(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const edge=x<border||x>=W-border||y<border||y>=H-border;data.set(edge?[shade,shade,shade,255]:[75+(x%20),95+(y%20),115,255],(y*W+x)*4);}return data;}
function paint(data,x,y,w,h,color){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)data.set(color,(yy*W+xx)*4);}
async function verifyCrop(raw,expected){const bytes=await sharp(raw,{raw:{width:W,height:H,channels:4}}).png().toBuffer(),before=Buffer.from(bytes),fingerprint=createHash('sha256').update(bytes).digest('hex');
  const out=await cropImage({bytes,mime:'image/png',dimensions:{width:W,height:H},fingerprint,orientation:1},{x:0,y:0,width:W,height:H});
  const insets=out.trim?.insets??zero;assert.deepEqual(insets,expected);for(const n of Object.values(insets))assert.ok(n<=12);
  const expectedPixels=await sharp(bytes).extract({left:insets.left,top:insets.top,width:W-insets.left-insets.right,height:H-insets.top-insets.bottom}).ensureAlpha().raw().toBuffer();
  assert.deepEqual(await sharp(out.bytes).ensureAlpha().raw().toBuffer(),expectedPixels);assert.deepEqual(bytes,before);return insets;
}
test('crop fixture: uniform white border shrinks while source pixels remain exact',()=>verifyCrop(pixels(5),{top:5,right:5,bottom:5,left:5}));
test('crop fixture: thin light-gray border shrinks; darker ambiguous frame stays',async()=>{await verifyCrop(pixels(3,240),{top:3,right:3,bottom:3,left:3});await verifyCrop(pixels(3,200),zero);});
test('crop fixture: product touching edge prevents trim through that product',async()=>{const raw=pixels(5);paint(raw,0,100,100,200,[180,195,220,255]);await verifyCrop(raw,{top:5,right:5,bottom:5,left:0});});
test('crop fixture: text next to product survives instead of being treated as whitespace',async()=>{const raw=pixels(5);paint(raw,0,145,3,28,[35,35,35,255]);await verifyCrop(raw,{top:5,right:5,bottom:5,left:0});});
test('crop fixture: multiple panels and internal separator remain intact',async()=>{const raw=pixels();paint(raw,195,0,10,400,[255,255,255,255]);await verifyCrop(raw,zero);});
test('crop fixture: already clean crop remains unchanged',()=>verifyCrop(pixels(),zero));

test('new copy policy writes version 2 while stored version 1 and missing version remain readable',()=>fixture(async state=>{
  const {latestPlanSchema}=await import('../src/features/page-planner/schemas.ts');
  const current=structuredClone(state.page.plan.latestResult);assert.equal(current.commerceCopyVersion,2);
  assert.ok(latestPlanSchema.safeParse(current).success);
  assert.ok(latestPlanSchema.safeParse({...current,commerceCopyVersion:1}).success);
  const {commerceCopyVersion,...legacy}=current;void commerceCopyVersion;assert.ok(latestPlanSchema.safeParse(legacy).success);
  assert.equal(latestPlanSchema.safeParse({...current,commerceCopyVersion:3}).success,false);
}));

test('partial extraction explains full reanalysis cost and preserved successful data',async()=>{
  const {ExtractionPanel}=await import('../src/features/detail-extraction/components/extraction-panel.tsx');
  const {extractionStateSchema}=await import('../src/features/detail-extraction/schemas.ts');
  const time='2026-09-20T00:00:00Z',hash='a'.repeat(64);
  const state=extractionStateSchema.parse({schemaVersion:1,revision:randomUUID(),saveLease:null,attempt:{status:'completed',runId:randomUUID(),startedAt:time,finishedAt:time,errorCode:null},latestResult:{schemaVersion:2,policyVersion:2,sourceFingerprint:hash,productContextFingerprint:hash,sourceDimensions:{width:400,height:4000},coordinateSpace:'orientation_normalized_pixels',sourceOrientation:1,provider:'openai',model:'mock',analyzedAt:time,tileCount:3,completedTiles:2,failedTiles:[1],partialAnalysis:true,truncatedCandidates:false,candidates:[]}});
  const asset={id:randomUUID(),originalFilename:'source.png',metadata:{detailExtraction:state}},before=structuredClone(asset);
  const html=renderToStaticMarkup(createElement(ExtractionPanel,{projectId,asset,assets:[asset],previewUrl:null,busy:false,currentContextFingerprint:hash,begin:()=>true,end:()=>{},refresh:async()=>{},update:()=>{},close:()=>{}}));
  assert.match(html,/전체 구간을 다시 분석/);assert.match(html,/AI 비용/);assert.match(html,/이전 성공 후보와 저장 이미지는 유지/);assert.match(html,/제품컷 재분석/);
  assert.deepEqual(asset,before);
});

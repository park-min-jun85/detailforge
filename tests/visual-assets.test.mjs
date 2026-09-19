import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {assetRowSchema} from '../src/features/assets/schemas.ts';
import {buildVisualAssetInventory,heroEligible,visualPromptAsset,assetProvenanceLabel,validateVisualComposition,nearDuplicate} from '../src/features/visual-assets/policy.ts';
import {buildPlannerInput} from '../src/features/page-planner/evidence.ts';
import {validatePagePlan,latestPlanSchema,pagePlanSchema} from '../src/features/page-planner/schemas.ts';
import {buildPlannerMessages} from '../src/features/page-planner/prompts.ts';
import {buildSectionInput,validateSectionOutput} from '../src/features/section-engine/grounding.ts';
import {buildEvidenceRegistry} from '../src/features/product-analysis/evidence.ts';
import {buildValidationEvidence} from '../src/features/fact-validation/evidence.ts';
import {planPage,getPlannerView} from '../src/features/page-planner/service.ts';
import {assetRow,projectId,productId,startPlannerDb} from './helpers/page-planner.mjs';
import {completedAnalysis} from './helpers/analysis.mjs';
import {context,seedValidation,seedStrategy,planResult,mockProvider} from './helpers/planner-fixtures.mjs';
import {sectionOutput} from './helpers/section-fixtures.mjs';
const parentId=randomUUID(), cropId=randomUUID();
const derivation=(patch={})=>({schemaVersion:1,kind:'detail_image_crop',parentAssetId:parentId,sourceFingerprint:'a'.repeat(64),candidateId:'b'.repeat(64),sourceRect:{x:0,y:0,width:500,height:500},sourceDimensions:{width:860,height:12900},coordinateSpace:'orientation_normalized_pixels',suggestedRole:'product',confidence:.9,extractedAt:'2026-09-19T00:00:00Z',provider:'openai',model:'fixture',...patch});
const original=(patch={})=>assetRowSchema.parse(assetRow({metadata:{aiAnalysis:completedAnalysis()},...patch}));
const source=()=>original({id:parentId,storage_path:`projects/${projectId}/products/${productId}/${parentId}.png`,width:860,height:12900});
const crop=(patch={})=>original({id:cropId,storage_path:`projects/${projectId}/products/${productId}/${cropId}.png`,width:500,height:500,metadata:{derivation:derivation()},...patch});
const inv=(assets,checks)=>buildVisualAssetInventory(assets,projectId,productId,checks);
const row=a=>({id:a.id,project_id:a.projectId,product_id:a.productId,storage_path:a.storagePath,original_filename:a.originalFilename,mime_type:a.mimeType,size_bytes:a.sizeBytes,width:a.width,height:a.height,asset_type:a.assetType,metadata:a.metadata,created_at:a.createdAt,sort_order:a.sortOrder});
async function fixture(fn){const db=await startPlannerDb();try{db.state.assets=[row(source()),row(crop())];seedStrategy(db.state);seedValidation(db.state);await fn(db.state);}finally{await db.close();}}

test('saved derivation schema, parent and independent original inventory',()=>{const x=inv([source(),crop(),original()]);assert.equal(x.filter(a=>a.visual.kind==='derived').length,1);assert.equal(x.filter(a=>a.visual.kind==='normal').length,1);assert.equal(x.find(a=>a.assetId===parentId).visual.suppressed,true);});
test('unsaved candidate and its false positive never create an asset',()=>{const a=source();a.metadata.detailExtraction={candidates:[{suggestedRole:'product',rationale:'injection'}]};assert.equal(inv([a]).length,1);assert.equal(inv([a])[0].visual.kind,'long_source');assert.doesNotMatch(JSON.stringify(inv([a])),/injection|candidates/);});
test('malformed provenance cannot become approved',()=>{const a=crop();delete a.metadata.derivation.sourceRect;assert.equal(inv([a])[0].visual.kind,'unusable');});
test('foreign ownership is unusable in pure inventory',()=>{assert.equal(inv([crop({product_id:randomUUID()})])[0].visual.kind,'unusable');});
test('missing or broken file cannot suppress parent',()=>{const a=inv([source(),crop()],{[cropId]:{width:500,height:500,usable:false}});assert.equal(a.find(x=>x.assetId===cropId).visual.kind,'unusable');assert.equal(a.find(x=>x.assetId===parentId).visual.fallback,true);});
test('no saved children permits long fallback',()=>assert.equal(inv([source()])[0].visual.fallback,true));
test('deleted parent leaves valid independent crop',()=>{const a=inv([crop()])[0];assert.equal(a.visual.parentMissing,true);assert.equal(a.visual.available,true);});
test('deleted derived absent from next inventory and parent fallback restored',()=>{assert.equal(inv([source()]).some(a=>a.assetId===cropId),false);assert.equal(inv([source()])[0].visual.suppressed,false);});
test('completed role overrides extraction hint',()=>{const a=crop();a.metadata.aiAnalysis=completedAnalysis({role:'detail'});const v=inv([a])[0].visual;assert.equal(v.role,'detail');assert.equal(v.roleSource,'analysis');});
test('unanalysed derived role is placement hint only',()=>{const a=inv([crop()])[0];assert.equal(a.analysis,null);assert.equal(a.visual.roleSource,'hint');assert.equal(a.visual.role,'product');});
test('extreme source never hero despite good formal score',()=>assert.equal(heroEligible(inv([source()])[0]),false));
test('330 square original remains hero and has higher base priority',()=>{const a=inv([original(),crop()]);assert.equal(a.find(x=>x.visual.kind==='normal').visual.heroEligible,true);assert.ok(a.find(x=>x.visual.kind==='normal').visual.basePriority>a.find(x=>x.visual.kind==='derived').visual.basePriority);});
for(const role of ['product','usage']) test('saved '+role+' hint can provide Hero visual without fabricating V',()=>{const a=crop();a.metadata.derivation.suggestedRole=role;assert.equal(heroEligible(inv([a])[0]),true);});
for(const warning of ['cropped','blurry','low_visibility','heavy_text']) test('formal quality warning '+warning+' excludes derived hero',()=>{const a=crop();a.metadata.aiAnalysis=completedAnalysis({warnings:[warning]});assert.equal(heroEligible(inv([a])[0]),false);});
test('mixed requires formal analysis and detail needs high suitability',()=>{const a=crop();a.metadata.derivation.suggestedRole='mixed';assert.equal(heroEligible(inv([a])[0]),false);a.metadata.aiAnalysis=completedAnalysis({role:'detail',heroSuitability:.75});assert.equal(heroEligible(inv([a])[0]),false);a.metadata.aiAnalysis.heroSuitability=.9;assert.equal(heroEligible(inv([a])[0]),true);});
test('suppressed source rejected even if AI supplies current valid ID',()=>assert.throws(()=>validateVisualComposition([{type:'detail',assetIds:[parentId]}],inv([source(),crop()]))));
test('fallback long source max once and never spec notice hero',()=>{const a=inv([source()]);validateVisualComposition([{type:'detail',assetIds:[parentId]}],a);assert.throws(()=>validateVisualComposition([{type:'detail',assetIds:[parentId]},{type:'gallery',assetIds:[parentId]}],a));for(const type of ['hero','specification','notice'])assert.throws(()=>validateVisualComposition([{type,assetIds:[parentId]}],a));});
test('normal visual reuse Hero and Feature allowed',()=>{const a=inv([original()]);assert.doesNotThrow(()=>validateVisualComposition([{type:'hero',assetIds:[a[0].assetId]},{type:'feature',assetIds:[a[0].assetId]}],a));});
test('different long sources still share one page-wide fallback allowance',()=>{const second=source();second.id=randomUUID();second.storagePath=second.storagePath.replace(parentId,second.id);const a=inv([source(),second]);assert.throws(()=>validateVisualComposition([{type:'gallery',assetIds:[parentId,second.id]}],a));});
test('near duplicate crops refused but distinct crops retained',()=>{const a=crop(),b=crop({id:randomUUID()});const x=inv([a,b]);assert.equal(nearDuplicate(...x),true);assert.throws(()=>validateVisualComposition([{type:'gallery',assetIds:x.map(a=>a.assetId)}],x));b.metadata.derivation.sourceRect.y=600;assert.equal(nearDuplicate(...inv([a,b])),false);});
test('gallery retains existing eight image bound',()=>{const p=planResult({evidence:[]});p.sections[1].type='gallery';p.sections[1].assetIds=Array.from({length:9},()=>randomUUID());assert.equal(pagePlanSchema.safeParse(p).success,false);});
test('prompt projection excludes provenance hashes rectangles timestamps and candidates',()=>{const x=inv([crop()]);const text=JSON.stringify(visualPromptAsset(x[0]));assert.doesNotMatch(text,/candidateId|sourceFingerprint|sourceRect|parentAssetId|extractedAt|confidence/);assert.match(text,/heroEligible/);});
test('editor informational badge survives parent deletion',()=>{assert.match(assetProvenanceLabel(crop(),[source(),crop()]),/추출 이미지.*원본:/);assert.match(assetProvenanceLabel(crop(),[crop()]),/원본 삭제됨.*독립/);});
test('derived visual never enters Fact registry or Validation targets',()=>fixture(s=>{const c=context(s), before=structuredClone(c);assert.equal(buildEvidenceRegistry(c).evidence.filter(e=>e.kind==='visual_observation').length,1);assert.deepEqual(buildValidationEvidence(c).targets,buildValidationEvidence({...c,assets:[c.assets[0]]}).targets);assert.deepEqual(c,before);}));
test('new unanalysed crop changes Planner only, not strategy or Fact Validation fingerprints',()=>fixture(s=>{const c=context(s),before={...c,assets:c.assets.filter(a=>a.id!==cropId)};assert.equal(buildEvidenceRegistry(c).inputFingerprint,buildEvidenceRegistry(before).inputFingerprint);assert.equal(buildValidationEvidence(c).inputFingerprint,buildValidationEvidence(before).inputFingerprint);assert.notEqual(buildPlannerInput(c).inputFingerprint,buildPlannerInput(before).inputFingerprint);assert.equal(buildPlannerInput(c).validationStatus,'ready');}));
test('inventory fingerprint deterministic; timestamps candidate strings and model irrelevant',()=>fixture(s=>{const c=context(s),before=buildPlannerInput(c).inputFingerprint;c.assets.reverse();c.assets.find(a=>a.id===cropId).createdAt='2026-09-18T00:00:00Z';c.assets.find(a=>a.id===cropId).metadata.derivation.extractedAt='2026-09-18T00:00:00Z';c.assets.find(a=>a.id===parentId).metadata.detailExtraction={candidates:['new unsaved candidate']};assert.equal(buildPlannerInput(c).inputFingerprint,before);}));
for(const change of ['add','delete','analysis','parent','candidate','sourceHash']) test('visual change '+change+' changes Plan fingerprint',()=>fixture(s=>{const c=context(s),before=buildPlannerInput(c).inputFingerprint;const a=c.assets.find(a=>a.id===cropId);if(change==='add')c.assets.push(crop({id:randomUUID()}));if(change==='delete')c.assets=c.assets.filter(x=>x.id!==cropId);if(change==='analysis')a.metadata.aiAnalysis=completedAnalysis();if(change==='parent')a.metadata.derivation.parentAssetId=randomUUID();if(change==='candidate')a.metadata.derivation.candidateId='c'.repeat(64);if(change==='sourceHash')a.metadata.derivation.sourceFingerprint='d'.repeat(64);assert.notEqual(buildPlannerInput(c).inputFingerprint,before);}));
test('hint-only derived survives Planner + Section grounding with specs image optional and upstream immutable',()=>fixture(s=>{const before=structuredClone(s),c=buildPlannerInput(context(s));let p=planResult({...c.input,evidence:c.input.evidence.filter(e=>e.kind==='supported_fact')});p.heroAssetId=cropId;p.sections[0].assetIds=[cropId];p=validatePagePlan(p,c.input.evidence,c.assetSnapshot);const latest=latestPlanSchema.parse({provider:'openai',model:'mock',plannedAt:new Date().toISOString(),inputFingerprint:c.inputFingerprint,evidenceSnapshot:c.input.evidence,factPolicySnapshot:c.factPolicy,assetSnapshot:c.assetSnapshot,strategySnapshot:null,plan:p});const input=buildSectionInput(latest),o=validateSectionOutput(sectionOutput(input),latest);assert.deepEqual(o.sections[0].assetIds,[cropId]);assert.deepEqual(o.sections[3].assetIds,[]);assert.equal(o.sections[3].rows.length,1);assert.deepEqual(s,before);const bad=structuredClone(o);bad.sections[1].assetIds=[parentId];assert.throws(()=>validateSectionOutput(bad,latest));assert.doesNotMatch(JSON.stringify(buildPlannerMessages(c.input)),/sourceFingerprint|sourceRect|candidateId|extractedAt/);}));
test('legacy Plan still readable, does not suppress or rewrite old source references',()=>{const a={assetId:parentId,analysis:completedAnalysis()};delete a.analysis.status;for(const k of ['provider','model','attemptId','analyzedAt'])delete a.analysis[k];assert.doesNotThrow(()=>validateVisualComposition([{type:'detail',assetIds:[parentId]},{type:'notice',assetIds:[parentId]}],[a]));});
test('Storage missing crop makes plan stale, preserves saved Plan, restores fallback',()=>fixture(async s=>{s.assets=[row(original())];seedStrategy(s);seedValidation(s);await planPage(projectId,mockProvider);const old=structuredClone(s.page.plan);s.missingPaths=[s.assets[0].storage_path];const view=await getPlannerView(projectId);assert.equal(view.stale,true);assert.equal(view.assets[0].visual.kind,'unusable');assert.deepEqual(s.page.plan,old);}));
import {confirmedSource} from '../src/features/product-options/confirmed-source.ts';
import {buildConfirmedOptionSnapshot} from '../src/features/section-engine/options.ts';
import {inspectVisualAssets} from '../src/features/visual-assets/inspection.ts';
import {createSupabaseServerClient} from '../src/lib/supabase/server.ts';
import {startAssetDb} from './helpers/asset-db.mjs';
import sharp from 'sharp';

test('option-role group visual keeps confirmed UUID values and no inferred image mapping',()=>fixture(s=>{
 const a=s.assets.find(a=>a.id===cropId);a.metadata.derivation.suggestedRole='option';
 const options=confirmedSource({id:randomUUID(),productId,version:1,options:{schemaVersion:1,groups:[{id:randomUUID(),name:'옵션',values:['아이보리 90','아이보리 95','코코아 90','코코아 95','브라운 90','브라운 95'].map(label=>({id:randomUUID(),label}))}]},updatedAt:new Date().toISOString()});
 const before=structuredClone(options),c=buildPlannerInput({...context(s),confirmedOptions:options}),p=planResult({...c.input,evidence:c.input.evidence.filter(e=>e.kind==='supported_fact')});
 p.sections[2]={...p.sections[2],type:'option',assetIds:[cropId],evidenceIds:[]};validatePagePlan(p,c.input.evidence,c.assetSnapshot,options);
 const latest={provider:'openai',model:'mock',plannedAt:new Date().toISOString(),inputFingerprint:c.inputFingerprint,evidenceSnapshot:c.input.evidence,factPolicySnapshot:c.factPolicy,assetSnapshot:c.assetSnapshot,strategySnapshot:null,optionsSnapshot:options,plan:p};
 const output=validateSectionOutput(sectionOutput(buildSectionInput(latest)),latest);assert.deepEqual(output.sections[2].assetIds,[cropId]);
 const snapshot=buildConfirmedOptionSnapshot(options,new Date().toISOString());assert.deepEqual(snapshot.confirmed,before);assert.equal(snapshot.confirmed.groups[0].values.length,6);assert.doesNotMatch(JSON.stringify(snapshot),/assetId/);
}));
test('unknown dimensions decoded read-only and missing file excluded',async()=>{
 const db=await startAssetDb();try{
 const a=original({width:null,height:null});db.state.assets=[row(a)];db.state.objects.add(a.storagePath);db.state.objectBytes.set(a.storagePath,await sharp({create:{width:330,height:330,channels:3,background:'white'}}).png().toBuffer());
 const client=createSupabaseServerClient(),before=structuredClone(db.state.assets);const inspected=await inspectVisualAssets(client,[a],projectId,productId);assert.deepEqual(inspected[a.id],{width:330,height:330,usable:true});assert.deepEqual(db.state.assets,before);assert.ok(db.state.requests.every(r=>r.method==='GET'||r.path.includes('/object/sign/')));
 db.state.objects.clear();assert.equal((await inspectVisualAssets(client,[a],projectId,productId))[a.id].usable,false);
 }finally{await db.close();}
});
test('signature-valid but undecodable source marked unusable',async()=>{
 const db=await startAssetDb();try{const a=original({width:null,height:null});db.state.objects.add(a.storagePath);db.state.objectBytes.set(a.storagePath,Buffer.from([137,80,78,71,13,10,26,10,0]));assert.equal((await inspectVisualAssets(createSupabaseServerClient(),[a],projectId,productId))[a.id].usable,false);}finally{await db.close();}
});
import {SECTION_POLICY} from '../src/features/section-engine/prompts.ts';
test('real QA regression: V-only hero highlight is rejected; prompt requires F or empty claim lists',()=>fixture(s=>{
 s.assets=[row(original())];seedStrategy(s);seedValidation(s);const c=buildPlannerInput(context(s)),p=planResult(c.input),latest={provider:'openai',model:'mock',plannedAt:new Date().toISOString(),inputFingerprint:c.inputFingerprint,evidenceSnapshot:c.input.evidence,factPolicySnapshot:c.factPolicy,assetSnapshot:c.assetSnapshot,strategySnapshot:null,plan:p};
 const o=sectionOutput(buildSectionInput(latest));o.sections[0].highlights=[{text:'패드 묶음이 보이는 제품 이미지',evidenceIds:['V1']}];assert.throws(()=>validateSectionOutput(o,latest),/Claim item requires supported fact/);assert.match(SECTION_POLICY,/EVERY hero.highlights item/);o.sections[0].highlights=[];assert.doesNotThrow(()=>validateSectionOutput(o,latest));
}));

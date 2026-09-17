import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isNonFactualPlaceholder,normalizeFactValue,filterFactualSpecifications,isFactualSpecification} from '../src/features/products/fact-normalization.ts';
import {toManualFacts,toManualSource} from '../src/features/products/mappers.ts';
import {saveProductInformation} from '../src/features/products/persistence.ts';
import {getProductDetail} from '../src/features/products/queries.ts';
import {saveImport} from '../src/features/wholesale-import/service.ts';
import {issueTicket,readTicket} from '../src/features/wholesale-import/tickets.ts';
import {candidateSchema} from '../src/features/wholesale-import/schemas.ts';
import {buildEvidenceRegistry} from '../src/features/product-analysis/evidence.ts';
import {buildValidationEvidence} from '../src/features/fact-validation/evidence.ts';
import {isValidationStale,validateFactOutput} from '../src/features/fact-validation/schemas.ts';
import {buildPlannerInput} from '../src/features/page-planner/evidence.ts';
import {buildSectionInput,validateSectionOutput} from '../src/features/section-engine/grounding.ts';
import {startProductDb,projectId} from './helpers/product-db.mjs';
import {context,seedValidation,planResult} from './helpers/planner-fixtures.mjs';
import {sectionOutput} from './helpers/section-fixtures.mjs';
const examples=JSON.parse(readFileSync(new URL('./fixtures/wholesale-placeholder-products.json',import.meta.url),'utf8'));
const inputFor=p=>({productName:p.name,brand:'',category:p.category,description:'원문 설명: 상세페이지 참조',sourceUrl:`https://domeme.domeggook.com/s/${p.id}`,specifications:structuredClone(p.specifications)});
const candidateFor=p=>candidateSchema.parse({sourceType:'wholesale_url',sourceUrl:`https://domeme.domeggook.com/s/${p.id}`,sourceHost:'domeme.domeggook.com',fetchedAt:'2026-09-17T00:00:00.000Z',extractionMethod:'metadata',product:{name:p.name,brand:null,category:p.category,description:'원문 설명: 상세페이지 참조',specifications:p.specifications},images:[],warnings:[]});
async function fixture(t){const db=await startProductDb();t.after(()=>db.close());return db.state;}

for(const value of ['별도표기',' 별도 표기 ','상세페이지 참조','상세 페이지 참조','상세설명 참조','상세 설명 참조','상세정보 참조','상세 정보 참조','해당없음','해당 없음','정보없음','정보 없음','미상','없음','-','--','---','X','x',' X / X ','x/x','x / x','/','/ /','|',',','.',' ... ','','  '])
test(`non-factual whole value excluded: ${JSON.stringify(value)}`,()=>{
 assert.equal(isNonFactualPlaceholder(value),true);assert.equal(normalizeFactValue(value),null);
 assert.deepEqual(filterFactualSpecifications([{name:'색상',value}]),[]);
});
for(const value of ['ABS / PC','화이트 / 블랙','1 / 2','0','0W','중국','수입산 / 아시아 / 중국','가로 / 세로','중국 / OEM','별도표기된 제품','상세페이지 참조 후 선택','X100','XL','-5','없음 표시 스티커'])
test(`meaningful complete value retained: ${value}`,()=>{
 assert.equal(isNonFactualPlaceholder(value),false);assert.equal(normalizeFactValue(value),value);
 assert.deepEqual(filterFactualSpecifications([{name:'스펙',value}]),[{name:'스펙',value}]);
});
test('labels conservative; similar labels and contradictory actual values never merged',()=>{
 const specs=[{name:'모델명',value:'별도표기'},{name:'품명 및 모델명',value:'컬리 집업 베스트'},{name:'원산지',value:'수입산'},{name:'제조국',value:'대한민국'},...['-','','항목'].map(name=>({name,value:'실제 값'}))];
 const before=structuredClone(specs);assert.deepEqual(filterFactualSpecifications(specs),specs.slice(1,4));assert.deepEqual(specs,before);
 for(const name of ['상품번호','상품포장 부피/무게','원산지','제조국 또는 원산지','제조사','색상','재질','X'])assert.equal(isFactualSpecification({name,value:'0'}),true);
});
test('normalization is deterministic/idempotent without mutating source or inventing null pairs',()=>{
 const source=inputFor(examples[1]),before=structuredClone(source);const result=toManualFacts(source);
 assert.deepEqual(source,before);assert.deepEqual(toManualSource(source).specifications,source.specifications);
 assert.deepEqual(filterFactualSpecifications(result.specifications),result.specifications);assert.equal(result.specifications.length,4);
 assert.ok(result.specifications.every(row=>typeof row.value==='string'));assert.equal(result.description,undefined);
 const optional=toManualFacts({...source,brand:'별도표기',category:'해당 없음'});assert.equal(optional.brand,undefined);assert.equal(optional.category,undefined);
});
for(const p of examples)test(`wholesale ${p.id}: source/candidate preserved; saved Facts only factual subset`,async t=>{
 const s=await fixture(t),c=candidateFor(p),before=structuredClone(c),token=issueTicket(projectId,c),values=inputFor(p);
 assert.equal((await saveImport(projectId,{token,revision:'',values,selectedImageUrls:[]})).status,'success');
 assert.deepEqual(c,before);assert.deepEqual(readTicket(projectId,token).candidate,before);
 assert.deepEqual(s.product.raw_data.specifications,p.specifications);assert.deepEqual(s.product.raw_data.provenance.extracted,c.product);
 assert.deepEqual(s.facts.source_snapshot,s.product.raw_data);assert.deepEqual(s.facts.facts,toManualFacts(values));
 assert.equal(s.facts.facts.specifications.length,p.id==='67695797'?5:4);
 assert.deepEqual((await getProductDetail(projectId)).values.specifications,p.specifications);
});
test('user override is evaluated on final input while original placeholder provenance remains',async t=>{
 const s=await fixture(t),c=candidateFor(examples[1]),token=issueTicket(projectId,c),values=inputFor(examples[1]);
 values.specifications.find(row=>row.name==='색상').value='아이보리';
 assert.equal((await saveImport(projectId,{token,revision:'',values,selectedImageUrls:[]})).status,'success');
 assert.ok(s.facts.facts.specifications.some(row=>row.name==='색상'&&row.value==='아이보리'));
 assert.equal(s.product.raw_data.provenance.extracted.specifications.find(row=>row.name==='색상').value,'상세페이지 참조');
 assert.equal(s.facts.source_snapshot.specifications.find(row=>row.name==='색상').value,'아이보리');
 assert.equal(isFactualSpecification({name:'색상',value:'아이보리'}),true);
});
test('manual saves apply same normalization and preserve raw input and earlier analysis/validation',async t=>{
 const s=await fixture(t),values=inputFor(examples[1]);assert.equal((await saveProductInformation(projectId,'',values)).status,'success');
 const protectedAnalysis={keep:'analysis'},protectedValidation={keep:'validation'};s.product.ai_analysis=protectedAnalysis;s.facts.validation=protectedValidation;
 values.specifications.find(row=>row.name==='색상').value='아이보리';
 assert.equal((await saveProductInformation(projectId,s.product.updated_at,values)).status,'success');
 assert.deepEqual(s.facts.facts,toManualFacts(values));assert.deepEqual(s.product.raw_data.specifications,values.specifications);
 assert.deepEqual(s.product.ai_analysis,protectedAnalysis);assert.deepEqual(s.facts.validation,protectedValidation);
});
test('legacy stored placeholders remain read-only until an explicit save normalizes them',async t=>{
 const s=await fixture(t),values=inputFor(examples[1]);await saveProductInformation(projectId,'',values);
 s.facts.facts={productName:values.productName,category:values.category,specifications:structuredClone(values.specifications)};
 const before=structuredClone(s.facts);s.requests=[];await getProductDetail(projectId);
 assert.deepEqual(s.facts,before);assert.ok(s.requests.every(r=>r.method==='GET'));
 await saveProductInformation(projectId,s.product.updated_at,values);assert.equal(s.facts.facts.specifications.length,4);
});
test('saved Facts reach analysis F registry and validation targets; raw placeholders remain only source evidence',async t=>{
 const s=await fixture(t);await saveProductInformation(projectId,'',inputFor(examples[1]));s.assets=[];s.product.ai_analysis={};
 const ctx=context(s),analysis=buildEvidenceRegistry(ctx),validation=buildValidationEvidence(ctx);
 assert.ok(analysis.evidence.filter(e=>e.kind==='product_fact').every(e=>!isNonFactualPlaceholder(e.value)));
 assert.ok(validation.targets.every(e=>!isNonFactualPlaceholder(e.value)));
 assert.ok(!validation.targets.some(e=>['색상','재질','모델명','상품포장 부피/무게','제조사'].includes(e.label)));
 assert.match(validation.evidence.find(e=>e.id==='S1').value,/상세페이지 참조/);
 assert.match(analysis.evidence.find(e=>e.kind==='unverified_source_statement').value,/상세페이지 참조/);
 const invalid={schemaVersion:1,warnings:[],facts:[...validation.targets,{factId:'F99',label:'색상',value:'상세페이지 참조'}].map(f=>({...f,status:'supported',confidence:.7,evidenceIds:['S1'],reason:'fixture'}))};
 assert.throws(()=>validateFactOutput(invalid,validation.targets,validation.evidence));
});
test('fingerprint distinguishes Fact edits from source-only edits and stale remains conservative',()=>{
 const raw=inputFor(examples[1]),base={projectId,productId:'6645f432-b847-4e28-9ee7-f41beccccf46',facts:toManualFacts(raw),sourceSnapshot:toManualSource(raw),assets:[],productAnalysis:{},description:null};
 const first=buildValidationEvidence(base);assert.equal(buildValidationEvidence(structuredClone(base)).inputFingerprint,first.inputFingerprint);
 const changed=structuredClone(base);changed.sourceSnapshot.specifications.find(row=>row.name==='색상').value='상세 설명 참조';
 assert.deepEqual(changed.facts,base.facts);const second=buildValidationEvidence(changed);assert.deepEqual(first.targets,second.targets);
 assert.notEqual(second.inputFingerprint,first.inputFingerprint);assert.equal(isValidationStale({latestResult:{inputFingerprint:first.inputFingerprint}},second.inputFingerprint),true);
 assert.equal(buildEvidenceRegistry(base).inputFingerprint,buildEvidenceRegistry(changed).inputFingerprint);
 changed.facts.specifications.push({name:'색상',value:'아이보리'});assert.notEqual(buildValidationEvidence(changed).inputFingerprint,second.inputFingerprint);
 assert.notEqual(buildEvidenceRegistry(changed).inputFingerprint,buildEvidenceRegistry(base).inputFingerprint);
});
test('Planner and Section specification input/output use filtered supported facts without enrichment',async t=>{
 const s=await fixture(t);await saveProductInformation(projectId,'',inputFor(examples[1]));s.assets=[];s.product.ai_analysis={};seedValidation(s);
 const built=buildPlannerInput(context(s));assert.equal(built.validationStatus,'ready');
 const plan=planResult(built.input);plan.sections.find(row=>row.type==='specification').evidenceIds=built.input.evidence.map(e=>e.id);
 const latest={plan,evidenceSnapshot:built.input.evidence,assetSnapshot:built.assetSnapshot,strategySnapshot:built.input.strategy,factPolicySnapshot:built.factPolicy};
 const sectionInput=buildSectionInput(latest),generated=validateSectionOutput(sectionOutput(sectionInput),latest);
 assert.doesNotMatch(JSON.stringify({input:built.input,sectionInput,generated}),/상세페이지 참조|별도표기|X \/ X/);
 const rows=generated.sections.find(row=>row.type==='specification').rows;
 assert.ok(rows.some(row=>row.label==='원산지'&&row.value==='수입산'));assert.ok(rows.some(row=>row.label==='제조국'&&row.value==='대한민국'));
 const before=structuredClone(generated);const target=generated.sections.find(row=>row.type==='specification').rows[0];target.value='상세페이지 참조';assert.throws(()=>validateSectionOutput(generated,latest));assert.ok(before);
});

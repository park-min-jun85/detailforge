import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { optionGroupsSchema,optionDraftSchema,normalizeOptionDraft,optionSourceSchema,isOptionPlaceholder } from '../src/features/product-options/schemas.ts';
import { saveProductOptions } from '../src/features/product-options/persistence.ts';
import { getProductOptions,getConfirmedProductOptions } from '../src/features/product-options/queries.ts';
import { readOptionRequest,optionResponse } from '../src/features/product-options/http.ts';
import { buildOptionSectionSource } from '../src/features/section-engine/options.ts';
import { candidateSchema } from '../src/features/wholesale-import/schemas.ts';
import { requestOptions } from '../src/features/product-options/client.ts';
import { startOptionsDb,projectId,productId,otherProductId } from './helpers/options-db.mjs';
const group=(name,labels)=>({id:randomUUID(),name,values:labels.map(label=>({id:randomUUID(),label}))});
const options=(groups=[group('색상',['아이보리','블랙']),group('사이즈',['S','M','L'])])=>({schemaVersion:1,groups});
const input=(data=options(),version=0,id=productId)=>({productId:id,expectedVersion:version,options:data});
async function db(t){const d=await startOptionsDb();t.after(()=>d.close());return d.state;}
const code=name=>error=>error.code===name;
test('canonical schema trims group/value and keeps stable IDs/order',()=>{
 const data=options([group(' 색상 ',[' 아이보리 ',' 블랙 '])]),out=optionGroupsSchema.parse(data);
 assert.equal(out.groups[0].name,'색상');assert.deepEqual(out.groups[0].values.map(v=>v.label),['아이보리','블랙']);
 assert.equal(out.groups[0].id,data.groups[0].id);assert.deepEqual(out.groups[0].values.map(v=>v.id),data.groups[0].values.map(v=>v.id));
});
test('maximum 10 groups accepted; 11 rejected',()=>{assert.equal(optionGroupsSchema.parse(options(Array.from({length:10},(_,i)=>group('G'+i,['0'])))).groups.length,10);assert.throws(()=>optionGroupsSchema.parse(options(Array.from({length:11},(_,i)=>group('G'+i,['0'])))));});
test('maximum 30 values per group; 31 rejected',()=>{assert.equal(optionGroupsSchema.parse(options([group('색상',Array.from({length:30},(_,i)=>String(i)))])).groups[0].values.length,30);assert.throws(()=>optionGroupsSchema.parse(options([group('색상',Array.from({length:31},(_,i)=>String(i)))])));});
test('maximum 100 total values; 101 rejected before normalization',()=>{
 const data=options(Array.from({length:4},(_,i)=>group('G'+i,Array.from({length:25},(_,j)=>String(j)))));assert.ok(optionGroupsSchema.safeParse(data).success);
 data.groups[0].values.push({id:randomUUID(),label:''});assert.equal(optionDraftSchema.safeParse(data).success,false);
});
test('group/value length bounds and whitespace-only canonical values',()=>{
 for(const data of [options([group('a'.repeat(101),['v'])]),options([group('g',['v'.repeat(201)])]),options([group('   ',['v'])]),options([group('g',['   '])])])assert.throws(()=>optionGroupsSchema.parse(data));
});
test('duplicate group names normalized for case/repeated whitespace',()=>{assert.throws(()=>optionGroupsSchema.parse(options([group('  Color  Choice ',['a']),group('color choice',['b'])])));});
test('duplicate labels normalized; white and off-white remain distinct',()=>{assert.throws(()=>optionGroupsSchema.parse(options([group('색상',[' WHITE ','white'])])));assert.ok(optionGroupsSchema.safeParse(options([group('색상',['화이트','오프화이트'])])).success);});
test('IDs must be UUIDs and globally unique including cross-group values',()=>{
 const data=options();data.groups[1].values[0].id=data.groups[0].values[0].id;assert.throws(()=>optionGroupsSchema.parse(data));
 data.groups[0].id='0';assert.throws(()=>optionGroupsSchema.parse(data));
});
test('completely empty draft group omitted; named group with zero choices rejected',()=>{
 assert.deepEqual(normalizeOptionDraft(options([group('',[' '])])).confirmed.groups,[]);
 assert.throws(()=>normalizeOptionDraft(options([group('색상',[])])));assert.throws(()=>normalizeOptionDraft(options([group('색상',[' '])])));
});
test('blank value rows removed consistently and raw snapshot retained',()=>{
 const data=options([group('색상',['아이보리',' '])]),out=normalizeOptionDraft(data);
 assert.equal(out.confirmed.groups[0].values.length,1);assert.deepEqual(out.sourceSnapshot.groups,data.groups);
});
for(const value of ['상세페이지 참조','별도 표기','상세 설명 참조','정보 없음','미상','X / X','/ /','|'])test(`option placeholder excluded with raw preserved: ${value}`,()=>{
 const data=options([group('선택',['아이보리',value])]),before=structuredClone(data),out=normalizeOptionDraft(data);
 assert.equal(out.confirmed.groups[0].values.length,1);assert.deepEqual(out.sourceSnapshot.groups,data.groups);assert.deepEqual(data,before);
 assert.throws(()=>optionGroupsSchema.parse(data));
});
for(const value of ['없음','해당 없음','X','0','화이트 / 블랙','ABS / PC','별도표기된 제품'])test(`manual option semantics retained without splitting: ${value}`,()=>{
 assert.equal(isOptionPlaceholder(value),false);const out=normalizeOptionDraft(options([group('선택',[value])]));assert.deepEqual(out.confirmed.groups[0].values.map(v=>v.label),[value]);
});
test('all-placeholder named group is an actionable error',()=>assert.throws(()=>normalizeOptionDraft(options([group('색상',['상세페이지 참조'])]))));
test('source manual and future wholesale source are separate from confirmed schema',()=>{
 const data=normalizeOptionDraft(options());assert.ok(optionSourceSchema.safeParse(data.sourceSnapshot).success);
 assert.ok(optionSourceSchema.safeParse({inputMethod:'wholesale_url',sourceUrl:'https://example.com/p',groups:[{name:'색상',values:['상세페이지 참조']}]}).success);
 assert.ok(!optionGroupsSchema.safeParse({schemaVersion:1,groups:[{name:'색상',values:['블랙']}]}).success);
});
test('create returns canonical row; read does not write and one row per Product',async t=>{
 const s=await db(t),data=options();assert.equal((await getProductOptions(projectId)).version,0);assert.equal(s.options.length,0);
 const saved=await saveProductOptions(projectId,input(data));assert.equal(saved.version,1);assert.deepEqual(saved.options,data);assert.equal(s.options.length,1);
 assert.deepEqual(await getProductOptions(projectId),saved);assert.deepEqual(s.options[0].source_snapshot,{inputMethod:'manual',...data});
 await assert.rejects(saveProductOptions(projectId,input(data)),code('conflict'));assert.equal(s.options.length,1);
});
test('update changes label and version while stable row/group/value IDs remain',async t=>{
 const s=await db(t),data=options(),first=await saveProductOptions(projectId,input(data));data.groups[0].values[1].label='차콜';
 const second=await saveProductOptions(projectId,input(data,1));assert.equal(second.id,first.id);assert.equal(second.version,2);assert.deepEqual(second.options,data);assert.equal(s.options.length,1);
});
test('stale version fails without overwriting latest options',async t=>{
 const s=await db(t),data=options();await saveProductOptions(projectId,input(data));data.groups[0].values[0].label='그레이';await saveProductOptions(projectId,input(data,1));const before=structuredClone(s.options);
 await assert.rejects(saveProductOptions(projectId,input(options(),1)),code('conflict'));assert.deepEqual(s.options,before);
});
test('CAS detects a write between read and update',async t=>{const s=await db(t),data=options();await saveProductOptions(projectId,input(data));s.race=true;await assert.rejects(saveProductOptions(projectId,input(data,1)),code('conflict'));assert.equal(s.options[0].version,2);assert.deepEqual(s.options[0].source_snapshot,{});});
test('simultaneous inserts respect unique Product row',async t=>{
 const s=await db(t);const results=await Promise.allSettled([saveProductOptions(projectId,input()),saveProductOptions(projectId,input())]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(s.options.length,1);
});
test('no Product means no mutation',async t=>{const s=await db(t);s.products=[];assert.equal((await getProductOptions(projectId)).productId,null);await assert.rejects(saveProductOptions(projectId,input()),code('product_required'));assert.ok(s.requests.every(r=>r.method==='GET'));});
test('Product ownership checks reject mismatched IDs and unknown Project',async t=>{
 const s=await db(t);await assert.rejects(saveProductOptions(projectId,input(options(),0,otherProductId)),code('not_found'));
 await assert.rejects(getConfirmedProductOptions(projectId,otherProductId),code('not_found'));await assert.rejects(saveProductOptions(randomUUID(),input()),code('not_found'));assert.ok(s.requests.every(r=>r.method==='GET'));
});
test('invalid project UUID and malformed input never write',async t=>{const s=await db(t);await assert.rejects(saveProductOptions('invalid',input()),code('not_found'));await assert.rejects(saveProductOptions(projectId,{...input(),source_snapshot:{}}),code('invalid_input'));assert.equal(s.options.length,0);});
test('manual Options saves leave Product/raw/Facts/Validation/Analysis/Asset byte-identical',async t=>{
 const s=await db(t),before=JSON.stringify({products:s.products,facts:s.facts,assets:s.assets});const first=await saveProductOptions(projectId,input());await saveProductOptions(projectId,input(options([]),first.version));
 assert.equal(JSON.stringify({products:s.products,facts:s.facts,assets:s.assets}),before);assert.ok(s.requests.filter(r=>r.method!=='GET').every(r=>r.table==='product_options'));
});
test('delete value/group and delete all preserve remaining IDs and array order',async t=>{
 const s=await db(t),data=options();await saveProductOptions(projectId,input(data));data.groups[0].values.splice(0,1);data.groups.push(group('구성',['2개','1개']));
 let result=await saveProductOptions(projectId,input(data,1));assert.deepEqual(result.options,data);data.groups.splice(1,1);result=await saveProductOptions(projectId,input(data,2));assert.deepEqual(result.options,data);
 result=await saveProductOptions(projectId,input(options([]),3));assert.deepEqual(result.options.groups,[]);assert.equal(s.options.length,1);assert.equal(result.version,4);
});
test('write acknowledgement loss recovered by exact persisted payload; no extra mutation',async t=>{
 const s=await db(t);s.ackLost=true;const first=await saveProductOptions(projectId,input());assert.equal(first.version,1);s.ackLost=true;const next=await saveProductOptions(projectId,input(first.options,1));assert.equal(next.version,2);assert.equal(s.requests.filter(r=>r.method!=='GET').length,2);
});
test('DB errors private, previous data preserved on write failure',async t=>{
 const s=await db(t),saved=await saveProductOptions(projectId,input()),before=structuredClone(s.options);s.failWrite=true;
 const response=await optionResponse(()=>saveProductOptions(projectId,input(options(),saved.version)));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private-database|secret-test/);assert.deepEqual(s.options,before);
});
test('invalid persisted options fail closed rather than becoming confirmed read model',async t=>{
 const s=await db(t);await saveProductOptions(projectId,input());s.options[0].groups.groups[0].values[0].label='상세페이지 참조';await assert.rejects(getConfirmedProductOptions(projectId,productId),code('unavailable'));
});
test('confirmed read model and deterministic Section mapping preserve only saved choices',async t=>{
 await db(t);const empty=await getConfirmedProductOptions(projectId,productId);assert.equal(empty.hasOptions,false);assert.deepEqual(buildOptionSectionSource(empty).items,[]);
 const data=options();await saveProductOptions(projectId,input(data));const view=await getConfirmedProductOptions(projectId,productId),before=structuredClone(view),mapped=buildOptionSectionSource(view);
 assert.deepEqual(mapped.items,data.groups.flatMap(g=>g.values.map(v=>({groupId:g.id,valueId:v.id,label:g.name,value:v.label}))));assert.deepEqual(view,before);assert.equal(mapped.sourceVersion,1);assert.deepEqual(buildOptionSectionSource(view),mapped);
 assert.throws(()=>buildOptionSectionSource({...view,options:options([group('색상',['상세페이지 참조'])])}));assert.throws(()=>buildOptionSectionSource({...view,hasOptions:false}));
});
test('Section source does not truncate choices to legacy eight-row content limit',()=>{
 const data=options(Array.from({length:4},(_,i)=>group('G'+i,Array.from({length:25},(_,j)=>String(j)))));
 assert.equal(buildOptionSectionSource({productId,version:1,hasOptions:true,options:data}).items.length,100);
});
test('ImportCandidate optional options backward compatible and not guessed/split',()=>{
 const candidate={sourceType:'wholesale_url',sourceUrl:'https://example.com/p',sourceHost:'example.com',fetchedAt:'2026-09-17T00:00:00.000Z',extractionMethod:'dom',product:{name:'상품',brand:null,category:null,description:null,specifications:[{name:'색상',value:'화이트 / 블랙'}]},images:[],warnings:[]};
 assert.equal(candidateSchema.parse(candidate).options,undefined);const extended={...candidate,options:[{name:'색상',values:['화이트 / 블랙','상세페이지 참조']}]};assert.deepEqual(candidateSchema.parse(extended).options,extended.options);
});
test('HTTP origin, declared and streamed body limits; no-store and safe errors',async()=>{
 const req=(body,headers={})=>new Request('http://localhost/api/options',{method:'PUT',headers:{origin:'http://localhost',...headers},body});
 await assert.rejects(readOptionRequest(req('{}',{origin:'https://attacker.test'})),code('forbidden'));
 await assert.rejects(readOptionRequest(req('{}',{'content-length':'128001'})),code('invalid_input'));await assert.rejects(readOptionRequest(req('x'.repeat(128001))),code('invalid_input'));
 assert.deepEqual(await readOptionRequest(req('{}')),{});const result=await optionResponse(async()=>{throw Error('private-db secret');});assert.equal(result.headers.get('cache-control'),'private, no-store');assert.doesNotMatch(await result.text(),/private-db|secret/);
});
test('client conflict/error response does not accept internal error messages',async t=>{
 const previous=globalThis.fetch;t.after(()=>{globalThis.fetch=previous;});globalThis.fetch=async()=>Response.json({ok:false,code:'conflict',message:'secret-test-key'},{status:409});const result=await requestOptions(projectId,input());assert.equal(result.ok,false);assert.match(result.message,/최신 옵션/);assert.doesNotMatch(result.message,/secret/);
});
test('migration matches unique/FK/check/trigger/RLS and generated mapping',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/0005_add_product_options.sql',import.meta.url),'utf8');
 for(const pattern of [/product_id uuid not null unique references public.products\(id\) on delete cascade/i,/jsonb_typeof\(groups\) = 'object'/,/jsonb_typeof\(source_snapshot\) = 'object'/,/execute function public.set_updated_at\(\)/,/enable row level security/i,/revoke all privileges.*anon, authenticated/i,/grant all privileges.*service_role/i])assert.match(sql,pattern);
 assert.doesNotMatch(sql,/create\s+(?:or replace\s+)?function|create policy|drop |truncate /i);
 const types=readFileSync(new URL('../src/lib/supabase/database.types.ts',import.meta.url),'utf8');assert.match(types,/product_options: \{/);assert.match(types,/product_options_product_id_fkey/);
});

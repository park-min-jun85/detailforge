import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { startOptionsDb, projectId, productId, otherProductId } from './helpers/options-db.mjs';
import { previewImportedOptions, prepareImportedOptions } from '../src/features/product-options/import-service.ts';
import { saveProductOptions } from '../src/features/product-options/persistence.ts';
import { getProductOptions } from '../src/features/product-options/queries.ts';
import { inspectProductResponse, inspectSelectOpt } from '../src/features/wholesale-import/domeme-api/inspection.ts';
import { DomemeApiError } from '../src/features/wholesale-import/domeme-api/errors.ts';
import { domemeProductNumber } from '../src/features/product-options/import-contract.ts';
import { issueOptionTicket, readOptionTicket } from '../src/features/product-options/import-tickets.ts';
import { compareImportedOptions, applyImportedAdditions } from '../src/features/product-options/import-merge.ts';
import { importedOptionSourceSchema, optionSourceSchema } from '../src/features/product-options/schemas.ts';
import { optionResponse } from '../src/features/product-options/http.ts';
const sourceUrl='https://domeme.domeggook.com/s/67695797';
const lookup={productId,expectedVersion:0};
const code=name=>error=>error.code===name;
const wire=(labels=['A 90','A 95','B 90','B 95','C 90','C 95'])=>({type:'combination',set:[{name:'옵션',opts:labels,changeKey:labels.map((_,i)=>i)}],
 data:Object.fromEntries(labels.map((_,i)=>[String(i).padStart(2,'0'),{sup:1,hid:0,qty:1}]))});
const provider=(data=wire())=>async no=>inspectProductResponse({domeggook:{basis:{no},selectOpt:JSON.stringify(data)}},no);
async function db(t){const db=await startOptionsDb();db.state.products[0].source_url=sourceUrl;t.after(()=>db.close());return db.state;}
async function preview(version=0,data=wire()){return previewImportedOptions(projectId,{...lookup,expectedVersion:version},provider(data));}
async function prepare(p,selectedIds=p.additions.filter(a=>a.action==='add').map(a=>a.id)){
 return prepareImportedOptions(projectId,{...lookup,expectedVersion:p.expectedVersion,token:p.token,selectedIds});
}
async function save(prepared,version=0){return saveProductOptions(projectId,{...lookup,expectedVersion:version,...prepared});}
const group=(name,labels)=>({id:randomUUID(),name,values:labels.map(label=>({id:randomUUID(),label}))});
const groups=items=>({schemaVersion:1,groups:items});

test('saved URL accepts only exact Domeme HTTPS short-product paths',()=>{
 for(const url of [sourceUrl,sourceUrl+'/'])assert.equal(domemeProductNumber(url),'67695797');
 for(const url of [null,'',sourceUrl+'?no=1',sourceUrl+'#x',sourceUrl.replace('https:','http:'),sourceUrl.replace('domeme.','domeme.evil.'),sourceUrl.replace('.com/','.com.evil/'),'https://localhost/s/1','https://127.0.0.1/s/1','https://domeme.domeggook.com:444/s/1','https://user:pw@domeme.domeggook.com/s/1','https://domeme.domeggook.com./s/1','https://domeme.domeggook.com/s/01','https://domeme.domeggook.com/s/1/other'])assert.equal(domemeProductNumber(url),null);
});
test('API six atomic values become candidates; preview and apply perform only reads',async t=>{
 const s=await db(t),before=structuredClone(s.products),p=await preview();
 assert.equal(p.status,'simple_groups');assert.equal(p.groups.length,1);assert.deepEqual(p.groups[0].values,wire().set[0].opts);
 const draft=await prepare(p);assert.equal(draft.options.groups[0].values.length,6);assert.equal(s.options.length,0);
 assert.deepEqual(s.products,before);assert.ok(s.requests.every(r=>r.method==='GET'));
});
test('single-product choice remains one raw value; slash and color-size labels not split',async t=>{
 await db(t);for(const label of ['단일상품','A / B','아이보리 90']){const p=await preview(0,wire([label]));assert.equal(p.status,'simple_groups');assert.deepEqual(p.groups[0].values,[label]);}
});
test('combination type with full cartesian product is allowed, partial combinations restricted',()=>{
 const full={type:'combination',set:[{name:'G',opts:['A','B']},{name:'H',opts:['1','2']}],data:Object.fromEntries(['00_00','00_01','01_00','01_01'].map(k=>[k,{sup:1,hid:0,qty:1}]))};
 assert.equal(inspectSelectOpt(true,JSON.stringify(full)).status,'simple_groups');delete full.data['01_01'];assert.equal(inspectSelectOpt(true,JSON.stringify(full)).status,'combination_restricted');
});
test('nonidentity changeKey and disagreeing orgSet rejected instead of guessed',()=>{
 for(const changeKey of [[1,0,2,3,4,5],{0:0},[0]]){const data=wire();data.set[0].changeKey=changeKey;assert.equal(inspectSelectOpt(true,JSON.stringify(data)).status,'unsupported');}
 const data=wire();data.orgSet=[{name:'other',opts:['X']}];assert.equal(inspectSelectOpt(true,JSON.stringify(data)).status,'unsupported');
});
test('actual restrictions cannot get an actionable ticket, existing options unchanged',async t=>{
 const s=await db(t),first=await save({options:groups([group('수동',['유지'])])});const before=structuredClone(s.options);
 for(const row of [{hid:1},{hid:2},{qty:0},{sup:0}]){const data=wire();Object.assign(data.data['00'],row);const p=await preview(first.version,data);assert.equal(p.status,'combination_restricted');assert.equal(p.token,null);assert.equal(p.additions.length,0);}
 assert.deepEqual(s.options,before);
});
test('missing, null, empty and bad JSON never become an empty replacement',async t=>{
 const s=await db(t);for(const selectOpt of [undefined,null,'','{','{}']){
 const p=await previewImportedOptions(projectId,lookup,async no=>inspectProductResponse({domeggook:{basis:{no},...(selectOpt===undefined?{}:{selectOpt})}},no));
 assert.notEqual(p.status,'confirmed_none');assert.equal(p.token,null);assert.equal(p.additions.length,0);
 }assert.equal(s.options.length,0);
});
test('auth/quota/provider errors safe and no fallback or mutation',async t=>{
 const s=await db(t);for(const [upstream,expected]of[['authentication','api_authentication'],['forbidden','api_authentication'],['rate_limited','api_rate_limited'],['unavailable','api_failed']]){
 let calls=0;await assert.rejects(previewImportedOptions(projectId,lookup,async()=>{calls++;throw new DomemeApiError(upstream);}),code(expected));assert.equal(calls,1);
 }assert.ok(s.requests.every(r=>r.method==='GET'));
});
test('no product or unsupported stored URL never calls supplier',async t=>{
 const s=await db(t);let calls=0;const api=async()=>{calls++;};
 s.products[0].source_url='http://127.0.0.1/';await assert.rejects(previewImportedOptions(projectId,lookup,api),code('source_url'));
 s.products=[];await assert.rejects(previewImportedOptions(projectId,lookup,api),code('product_required'));assert.equal(calls,0);
});
test('client URL/product injection and mismatched API product rejected',async t=>{
 await db(t);await assert.rejects(previewImportedOptions(projectId,{...lookup,url:sourceUrl},provider()),code('invalid_input'));
 await assert.rejects(previewImportedOptions(projectId,{...lookup,productId:otherProductId},provider()),code('not_found'));
 await assert.rejects(previewImportedOptions(projectId,lookup,async()=>({productNo:'1'})),code('api_failed'));
});
test('URL/version changed during API request is rejected before ticket issuance',async t=>{
 const s=await db(t);await assert.rejects(previewImportedOptions(projectId,lookup,async no=>{s.products[0].source_url=sourceUrl+'/';return provider()(no);}),code('source_changed'));
 s.products[0].source_url=sourceUrl;await assert.rejects(previewImportedOptions(projectId,lookup,async no=>{await save({options:groups([])});return provider()(no);}),code('conflict'));
});
test('forged and cross-project/product tickets fail without mutation',async t=>{
 const s=await db(t),p=await preview();
 await assert.rejects(prepare({...p,token:p.token.slice(0,-1)+(p.token.endsWith('0')?'1':'0')}),code('expired'));
 s.projects.push({id:otherProductId});s.products.push({id:otherProductId,project_id:otherProductId,source_url:sourceUrl});
 await assert.rejects(prepareImportedOptions(otherProductId,{productId:otherProductId,expectedVersion:0,token:p.token,selectedIds:[]}),code('expired'));
 assert.equal(s.options.length,0);
});
test('ticket expiry verified with injected clock; token carries no payload',()=>{
 const source={inputMethod:'domeme_api',schemaVersion:1,supplier:'domeme',productNo:'1',sourceUrl:'https://domeme.domeggook.com/s/1',apiVersion:'4.6',fetchedAt:new Date().toISOString(),fingerprint:'a'.repeat(64),groups:[]};
 const scope={projectId:randomUUID(),productId:randomUUID(),sourceUrl:source.sourceUrl,productNo:'1',expectedVersion:0};
 const issued=issueOptionTicket({...scope,kind:'candidate',expiresAt:2000,source,previous:null,current:groups([]),additions:[]},1000);
 assert.ok(readOptionTicket(issued.token,scope,'candidate',1999));assert.throws(()=>readOptionTicket(issued.token,scope,'candidate',2000),code('expired'));assert.doesNotMatch(issued.token,/domeme|sourceUrl|fetchedAt/);
});
test('source URL and base version revalidated at apply and save',async t=>{
 const s=await db(t),p=await preview(),draft=await prepare(p);s.products[0].source_url=sourceUrl+'/';
 await assert.rejects(prepare(p),code('source_changed'));await assert.rejects(save(draft),code('source_changed'));
 s.products[0].source_url=sourceUrl;await save({options:groups([])});await assert.rejects(prepare(p),code('conflict'));await assert.rejects(save(draft),code('conflict'));
});
test('first explicit save stores canonical options and server provenance in one row',async t=>{
 const s=await db(t),p=await preview(),draft=await prepare(p);assert.equal(s.options.length,0);
 const result=await save(draft);assert.equal(result.version,1);assert.deepEqual(result.options,draft.options);
 const source=s.options[0].source_snapshot;assert.equal(source.inputMethod,'domeme_api');assert.equal(source.productNo,'67695797');assert.deepEqual(source.groups,p.groups);
 assert.equal(source.bindings[0].id,result.options.groups[0].id);assert.deepEqual(source.bindings[0].values.map(v=>v.id),result.options.groups[0].values.map(v=>v.id));
 assert.deepEqual((await getProductOptions(projectId)).options,result.options);assert.equal(s.requests.filter(r=>r.method!=='GET').length,1);
});
test('same candidate apply and repeat lookup retain provisional UUIDs, no duplicate append',async t=>{
 await db(t);const p=await preview(),first=await prepare(p),second=await prepare(p),again=await prepare(await preview());
 assert.deepEqual(first.options,second.options);assert.deepEqual(first.options,again.options);
 const saved=await save(first),next=await prepare(await preview(saved.version));assert.deepEqual(next.options,saved.options);
});
test('manual rename/add/delete and order survive reimport with provenance and UUIDs',async t=>{
 const s=await db(t),first=await save(await prepare(await preview())),originalSource=structuredClone(s.options[0].source_snapshot);
 const edited=structuredClone(first.options);edited.groups[0].name='내 옵션';edited.groups[0].values[0].label='직접 수정';const deletedId=edited.groups[0].values.pop().id;
 edited.groups[0].values.unshift({id:randomUUID(),label:'내 추가 값'});
 const second=await save({options:edited},1);assert.deepEqual(s.options[0].source_snapshot,originalSource);
 const p=await preview(2);assert.ok(p.additions.some(a=>a.id===deletedId&&a.action==='deleted'));
 const draft=await prepare(p);assert.deepEqual(draft.options,second.options);const third=await save(draft,2);assert.deepEqual(third.options,edited);
});
test('deleted group and delete-all tombstones prevent automatic resurrection',async t=>{
 await db(t);await save(await prepare(await preview()));await save({options:groups([])},1);const p=await preview(2);
 assert.ok(p.additions.every(a=>a.action==='deleted'));assert.deepEqual((await prepare(p)).options.groups,[]);
});
test('supplier additions are opt-in; exact original mapping preserves edited names',async t=>{
 await db(t);const first=await save(await prepare(await preview(0,wire(['A','B']))));const edited=structuredClone(first.options);edited.groups[0].values[0].label='edited';await save({options:edited},1);
 const p=await preview(2,wire(['B','A','C']));const added=p.additions.filter(a=>a.action==='add');assert.deepEqual(added.map(a=>a.label),['C']);
 assert.deepEqual((await prepare(p,[])).options,edited);const draft=await prepare(p,[added[0].id]);assert.deepEqual(draft.options.groups[0].values.map(v=>v.label),['edited','B','C']);
 assert.equal(draft.options.groups[0].values[0].id,edited.groups[0].values[0].id);
});
test('supplier removed values retained and renamed candidates marked ambiguous',async t=>{
 await db(t);const saved=await save(await prepare(await preview(0,wire(['A','B']))));const p=await preview(1,wire(['A','C']));
 assert.equal(p.additions.find(a=>a.label==='C').action,'ambiguous');assert.deepEqual((await prepare(p)).options,saved.options);
});
test('supplier group rename never matches by order or similar spelling',async t=>{
 await db(t);const saved=await save(await prepare(await preview()));const data=wire();data.set[0].name='옵션2';const p=await preview(1,data);
 assert.ok(p.additions.every(a=>a.action==='ambiguous'));assert.deepEqual((await prepare(p)).options,saved.options);
});
test('manual same-name group not reclassified or duplicated',async t=>{
 const s=await db(t),saved=await save({options:groups([group('옵션',['A 90'])])}),p=await preview(1);
 assert.ok(p.additions.every(a=>a.action==='manual_duplicate'));const draft=await prepare(p);assert.deepEqual(draft.options,saved.options);
 await save(draft,1);assert.deepEqual(s.options[0].source_snapshot.bindings,[]);
});
test('tampered selections or browser source_snapshot rejected',async t=>{
 await db(t);const p=await preview();await assert.rejects(prepare(p,[randomUUID()]),code('invalid_input'));await assert.rejects(prepare(p,[p.additions[0].id,p.additions[0].id]),code('invalid_input'));
 await assert.rejects(saveProductOptions(projectId,{...lookup,options:groups([]),source_snapshot:{inputMethod:'domeme_api'}}),code('invalid_input'));
});
test('candidate token cannot be used directly as prepared save token',async t=>{
 const s=await db(t),p=await preview();await assert.rejects(save({options:groups([]),importToken:p.token}),code('expired'));assert.equal(s.options.length,0);
});
test('bounds after merging are enforced without truncation or mutation',async t=>{
 const s=await db(t);await save({options:groups(Array.from({length:10},(_,i)=>group('manual'+i,['v'])))});const p=await preview(1);
 await assert.rejects(prepare(p),code('invalid_input'));assert.equal(s.options[0].groups.groups.length,10);
});
test('CAS race rejects imported save, never retries with newer version',async t=>{
 const s=await db(t);await save(await prepare(await preview()));const draft=await prepare(await preview(1));s.race=true;
 await assert.rejects(save(draft,1),code('conflict'));assert.equal(s.options[0].version,2);assert.equal(s.requests.filter(r=>r.method==='PATCH').length,1);
});
test('lost write acknowledgement reconciles once; resubmission cannot overwrite',async t=>{
 const s=await db(t),draft=await prepare(await preview());s.ackLost=true;const saved=await save(draft);assert.equal(saved.version,1);
 await assert.rejects(save(draft),code('conflict'));assert.equal(s.requests.filter(r=>r.method!=='GET').length,1);
});
test('unique insert race permits only one imported save',async t=>{
 const s=await db(t),draft=await prepare(await preview());const results=await Promise.allSettled([save(draft),save(draft)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(s.options.length,1);
});
test('option workflow preserves every unrelated data object and only writes product_options',async t=>{
 const s=await db(t);s.sections=[{unchanged:1}];s.plan={keep:1};const before=JSON.stringify([s.projects,s.products,s.facts,s.assets,s.sections,s.plan]);
 await save(await prepare(await preview()));assert.equal(JSON.stringify([s.projects,s.products,s.facts,s.assets,s.sections,s.plan]),before);
 assert.ok(s.requests.filter(r=>r.method!=='GET').every(r=>r.table==='product_options'));
});
test('manual and legacy empty/wholesale snapshots remain readable',()=>{
 for(const source of [{},{inputMethod:'manual',...groups([])},{inputMethod:'wholesale_url',sourceUrl,groups:[]}])assert.ok(optionSourceSchema.safeParse(source).success);
});
test('provenance binding count bounded instead of unbounded history',()=>{
 const previous={inputMethod:'domeme_api',schemaVersion:1,supplier:'domeme',productNo:'1',sourceUrl,apiVersion:'4.6',fetchedAt:new Date().toISOString(),fingerprint:'a'.repeat(64),groups:[],bindings:Array.from({length:20},(_,i)=>({name:'g'+i,id:randomUUID(),values:Array.from({length:10},(_,j)=>({label:String(j),id:randomUUID()}))}))};
 assert.ok(importedOptionSourceSchema.safeParse(previous).success);const incoming=[{name:'new',values:['new']}],comparison=compareImportedOptions(groups([]),null,incoming);
 assert.throws(()=>applyImportedAdditions(groups([]),previous,{...previous,groups:incoming},comparison.additions,comparison.additions.map(a=>a.id)),code('invalid_input'));
});
test('safe HTTP failure response never returns raw provider message',async t=>{
 await db(t);const response=await optionResponse(()=>previewImportedOptions(projectId,lookup,async()=>{throw new Error('secret aid=request-url seller-phone');}));
 assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/aid=|seller-phone|request-url/);assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('UI preserves draft on failure and only explicit button requests lookup',()=>{
 const panel=readFileSync(new URL('../src/features/product-options/components/option-import-panel.tsx',import.meta.url),'utf8');
 const manager=readFileSync(new URL('../src/features/product-options/components/options-manager.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(panel,/useEffect|setInterval/);assert.match(panel,/window\.confirm/);assert.match(panel,/setPreview\(null\)/);
 assert.match(manager,/if \(!result.ok\) \{ setError\(result.message\); return; \}/);assert.match(manager,/후보 출처 해제/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { diagnoseDomemeProduct, diagnoseApprovedProducts, API_MAX_BYTES, DIAGNOSTIC_PRODUCTS } from '../src/features/wholesale-import/domeme-api/client.ts';
import { inspectSelectOpt, inspectProductResponse } from '../src/features/wholesale-import/domeme-api/inspection.ts';
import { DomemeApiError, safeDomemeError } from '../src/features/wholesale-import/domeme-api/errors.ts';

// Synthetic fixtures only; not a captured supplier response or proof of live option extraction.
const key = 'mock-secret-DO-NOT-LOG';
const productNo = '67399861';
const payload = selectOpt => ({ domeggook: { basis: { no: productNo }, selectOpt, seller: { phone: 'DO-NOT-RETURN' } } });
const option = () => ({ type: 'combination', set: [{ name: '색상', opts: ['화이트', '블랙'] }, { name: '크기', opts: ['S', 'M'] }], data:
  Object.fromEntries(['00_00','00_01','01_00','01_01'].map(k => [k, { sup: '1', hid: '0', qty: '2', hash: 'not-an-id', supPrice: 100 }])) });
const inspect = value => inspectSelectOpt(true, JSON.stringify(value));
const errorCode = code => error => { assert.equal(error.code, code); assert.equal(error.cause, undefined); return true; };
function response(body, status = 200, headers = {}) {
  const stream = Readable.from([typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)]);
  stream.statusCode = status; stream.headers = headers;
  return stream;
}
function mock(body = payload(null), status = 200, headers = {}) {
  const calls = [];
  return { calls, key, resolver: async () => [{ address: '8.8.8.8', family: 4 }], transport: async (target, signal) => {
    calls.push({ url: new URL(target.url), signal }); return response(body, status, headers);
  } };
}
test('missing key fails before transport/DNS and uses no environment fallback', async () => {
  const deps = mock(); deps.key = '';
  await assert.rejects(diagnoseDomemeProduct(productNo, deps), errorCode('key_missing')); assert.equal(deps.calls.length, 0);
});
test('fixed HTTPS GET parameters: no session, market, allItem or arbitrary URL', async () => {
  const deps = mock(); await diagnoseDomemeProduct(productNo, deps);
  assert.equal(deps.calls.length, 1); const url = deps.calls[0].url;
  assert.equal(url.origin + url.pathname, 'https://www.domeggook.com/ssl/api/');
  assert.deepEqual(Object.fromEntries(url.searchParams), {ver:'4.6',mode:'getItemView',aid:key,no:productNo,om:'json'});
  await assert.rejects(diagnoseDomemeProduct('https://localhost/', deps), errorCode('invalid_product'));
});
test('HTTP 200 API body errors are not successful product responses', async () => {
  for (const code of [20,401,403,429,10,40]) {
    const expected = [20,401].includes(code) ? 'authentication' : code===403 ? 'forbidden' : code===429 ? 'rate_limited' : 'api_error';
    for (const body of [{code,message:key},{domeggook:{code,message:key}},{domeggook:{errors:[{code,message:key}]}}])
      await assert.rejects(diagnoseDomemeProduct(productNo,mock(body)),errorCode(expected));
  }
});
test('product mismatch and unknown wrapper rejected, not an empty option result', async () => {
  await assert.rejects(diagnoseDomemeProduct(productNo,mock({domeggook:{basis:{no:'1'},selectOpt:null}})),errorCode('product_mismatch'));
  assert.throws(()=>inspectProductResponse({itemInfo:{no:productNo}},productNo),errorCode('invalid_response'));
});
test('missing, null, empty, bad JSON and unsupported are distinct from confirmed none', () => {
  const cases = [[false,undefined,'unverified','missing'],[true,null,'unverified','null'],[true,'','unverified','string'],[true,'{','invalid_json','string'],[true,{},'unsupported','object'],[true,'{}','unsupported','string'],[true,'null','unsupported','string']];
  for (const [present,value,status,type] of cases) { const result=inspectSelectOpt(present,value); assert.equal(result.status,status);assert.equal(result.fieldType,type);assert.equal(result.groups,undefined);assert.notEqual(result.status,'confirmed_none'); }
});
test('supported combination summary keeps explicit groups but produces no canonical options/IDs', () => {
  const result=inspect(option()); assert.equal(result.status,'simple_groups');assert.equal(result.combinations.length,4);
  assert.deepEqual(result.groups,[{name:'색상',values:['화이트','블랙']},{name:'크기',values:['S','M']}]);
  assert.equal(JSON.stringify(result).includes('supPrice'),false);assert.equal(JSON.stringify(result).includes('not-an-id'),false);
});
test('partial combination is never flattened into independently saleable choices', () => {
  const source=option();delete source.data['01_01'];assert.equal(inspect(source).status,'combination_restricted');
});
test('hidden, ended, non-supply and zero-stock combinations prevent simple groups', () => {
  for (const row of [{hid:1},{hid:2},{sup:0},{qty:0}]) { const source=option();Object.assign(source.data['01_01'],row);assert.equal(inspect(source).status,'combination_restricted'); }
});
test('unknown state and invalid combination indexes are unsupported', () => {
  for (const row of [{hid:7},{qty:-1},{sup:'unknown'},{qty:undefined}]) { const source=option();Object.assign(source.data['00_00'],row);assert.equal(inspect(source).status,'unsupported'); }
  const source=option();source.data['99_00']=source.data['00_00'];assert.equal(inspect(source).status,'unsupported');
});
test('unrecognized type, duplicate/placeholder choices and model limits not silently normalized', () => {
  const source=option();source.type='undocumented';assert.equal(inspect(source).status,'unsupported');
  for (const value of ['화이트','상세페이지 참조']) {const source=option();source.set[0].opts[1]=value;assert.equal(inspect(source).status,'unsupported');}
  const source2=option();source2.set[0].name='a'.repeat(101);assert.equal(inspect(source2).status,'unsupported');
});
test('input and unrelated seller fields are not mutated or returned', async () => {
  const source=payload(JSON.stringify(option())),before=structuredClone(source);
  const result=await diagnoseDomemeProduct(productNo,mock(source));assert.deepEqual(source,before);
  assert.equal(JSON.stringify(result).includes('DO-NOT-RETURN'),false);
  assert.equal(result.wrapper,'domeggook');assert.equal(result.selectOptPath,'domeggook.selectOpt');
});
test('all redirect statuses refused without following location or retrying', async () => {
  for (const status of [301,302,303,307,308]) { const deps=mock('',status,{location:'http://127.0.0.1/?aid='+key});await assert.rejects(diagnoseDomemeProduct(productNo,deps),errorCode('redirect'));assert.equal(deps.calls.length,1); }
});
test('HTTP auth, permission, quota and server errors are safe', async () => {
  for(const [status,code] of [[401,'authentication'],[403,'forbidden'],[407,'forbidden'],[429,'rate_limited'],[500,'unavailable']]) await assert.rejects(diagnoseDomemeProduct(productNo,mock(key,status)),errorCode(code));
});
test('declared and streamed response bounds; compressed response rejected', async () => {
  await assert.rejects(diagnoseDomemeProduct(productNo,mock('',200,{'content-length':String(API_MAX_BYTES+1)})),errorCode('too_large'));
  await assert.rejects(diagnoseDomemeProduct(productNo,mock(Buffer.alloc(API_MAX_BYTES+1))),errorCode('too_large'));
  await assert.rejects(diagnoseDomemeProduct(productNo,mock('',200,{'content-encoding':'gzip'})),errorCode('invalid_response'));
});
test('bad JSON and UTF8 are bounded safe errors',async()=>{
  for(const bytes of ['not-json',Buffer.from([0xff,0xfe])])await assert.rejects(diagnoseDomemeProduct(productNo,mock(bytes)),errorCode('invalid_response'));
});
test('private DNS rejected before any HTTP request',async()=>{
  const deps=mock();deps.resolver=async()=>[{address:'127.0.0.1',family:4}];await assert.rejects(diagnoseDomemeProduct(productNo,deps),errorCode('unavailable'));assert.equal(deps.calls.length,0);
});
test('aborted request and stalled body are terminated without retry',async()=>{
  const deps=mock();deps.signal=AbortSignal.abort();await assert.rejects(diagnoseDomemeProduct(productNo,deps),errorCode('timeout'));
  const controller=new AbortController(),stream=new Readable({read(){}});stream.statusCode=200;stream.headers={};
  const stalled=mock();stalled.signal=controller.signal;stalled.transport=async()=>{setTimeout(()=>controller.abort(),10);return stream;};
  await assert.rejects(diagnoseDomemeProduct(productNo,stalled),errorCode('timeout'));assert.equal(stream.destroyed,true);
});
test('network cause, key and credential URL cannot escape errors',async()=>{
  const deps=mock();deps.transport=async()=>{throw new Error('https://www.domeggook.com/ssl/api/?aid='+key);};
  try{await diagnoseDomemeProduct(productNo,deps);assert.fail('expected error');}catch(error){const serialized=JSON.stringify({error:String(error),stack:error.stack,...safeDomemeError(error)});assert.equal(serialized.includes(key),false);assert.equal(serialized.includes('?aid='),false);assert.equal(error.cause,undefined);}
});
test('even credential reflections in allowed option labels are rejected',async()=>{
  const source=option();source.set[0].name=key;await assert.rejects(diagnoseDomemeProduct(productNo,mock(payload(JSON.stringify(source)))),errorCode('invalid_response'));
});
test('approved batch is ordered and sequential, once per product',async()=>{
  const calls=[];let active=0;await diagnoseApprovedProducts(async no=>{assert.equal(active++,0);calls.push(no);await Promise.resolve();active--;return {productNo:no};});assert.deepEqual(calls,[...DIAGNOSTIC_PRODUCTS]);
});
test('batch stops immediately on authentication, permission, quota or unknown failure',async()=>{
  for(const code of ['authentication','forbidden','rate_limited','unavailable']){const calls=[];await assert.rejects(diagnoseApprovedProducts(async no=>{calls.push(no);throw new DomemeApiError(code);}),errorCode(code));assert.deepEqual(calls,[DIAGNOSTIC_PRODUCTS[0]]);}
});
test('diagnostic dependency boundary has no DB/Storage/AI mutations or app endpoint',()=>{
  for(const file of ['client.ts','inspection.ts','errors.ts']){const text=readFileSync(new URL('../src/features/wholesale-import/domeme-api/'+file,import.meta.url),'utf8');assert.match(text,/import "server-only"/);assert.doesNotMatch(text,/supabase|openai|\.insert\(|\.update\(|\.delete\(|writeFile|console\./i);}
  const script=readFileSync(new URL('../scripts/diagnose-domeme-options.mjs',import.meta.url),'utf8');assert.match(script,/\.\.\/\.env\.local/);assert.doesNotMatch(script,/createSupabase|writeFile|OPENAI_API_KEY/);
});
test('CLI without explicit flag makes no live call and prints only usage',()=>{
  const result=spawnSync(process.execPath,['--conditions=react-server','--import','./tests/register.mjs','scripts/diagnose-domeme-options.mjs'],{encoding:'utf8',cwd:new URL('../',import.meta.url)});
  assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/--approved-three/);
});
test('observed single-dimension wire shape: labels stay atomic, never color/size splitting',()=>{
  const source={type:'combination',optSort:'uninterpreted',set:[{name:'옵션',opts:['A 1','A 2','B 1'],changeKey:[0,1,2]}],orgSet:[],data:Object.fromEntries(['00','01','02'].map(key=>[key,{sup:1,hid:0,qty:3}]))};
  const result=inspect(source);assert.equal(result.status,'simple_groups');assert.deepEqual(result.groups,[{name:'옵션',values:['A 1','A 2','B 1']}]);
  source.data['02'].hid=1;source.data['02'].qty=0;assert.equal(inspect(source).status,'combination_restricted');
});
test('unsupported type none and empty set are not an authoritative no-options marker',()=>{
  for(const value of [{type:'none',set:[],data:{}},[],false,0])assert.equal(inspect(value).status,'unsupported');
});
test('invalid payload cannot be masked by a valid-looking basis next to an API error',async()=>{
  const data=payload(null);data.domeggook.errors={code:403,message:key};await assert.rejects(diagnoseDomemeProduct(productNo,mock(data)),errorCode('forbidden'));
});
test('batch preserves earlier output and stops before third product on second error',async()=>{
  const calls=[];await assert.rejects(diagnoseApprovedProducts(async no=>{calls.push(no);if(calls.length===2)throw new DomemeApiError('rate_limited');return {productNo:no};}),errorCode('rate_limited'));assert.deepEqual(calls,DIAGNOSTIC_PRODUCTS.slice(0,2));
});
test('diagnostic does not normalize whitespace or drop group values in its report',()=>{
  const source=option();source.set[0].opts[0]='  A / B  ';assert.equal(inspect(source).groups[0].values[0],'  A / B  ');
});

test('unrecognized nonempty error containers fail closed without exposing their text',async()=>{
  for(const errors of [{message:key},[{message:key}],key]){
    const source=payload(JSON.stringify(option()));source.domeggook.errors=errors;
    await assert.rejects(diagnoseDomemeProduct(productNo,mock(source)),errorCode('api_error'));
  }
});

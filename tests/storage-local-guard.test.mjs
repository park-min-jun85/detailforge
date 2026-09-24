import test from 'node:test';
import assert from 'node:assert/strict';
import {localFetch,validateLocalEndpoints} from './helpers/storage-local.mjs';
const api='http://127.0.0.1:58321',db='postgresql://postgres:local-fixture@127.0.0.1:58322/postgres';
test('Storage runtime rejects remote API, lookalike localhost and unexpected local ports',()=>{
  for(const target of ['https://example.supabase.co','http://localhost:58321','http://127.0.0.1:54321','http://127.0.0.1.example.test:58321'])assert.throws(()=>validateLocalEndpoints(target,db));
});
test('Storage runtime rejects remote DB even when API is local',()=>{
  for(const target of [db.replace('127.0.0.1','example.test'),db.replace('58322','54322'),db.replace('postgresql:','https:')])assert.throws(()=>validateLocalEndpoints(api,target));
  assert.equal(validateLocalEndpoints(api,db).dbUrl.port,'58322');
});
test('Storage fetch cannot send credentials to a remote target in any input form',()=>{
  let calls=0;const guarded=localFetch(()=>{calls++;});
  for(const target of ['https://example.test/object',new URL('https://example.test/object'),new Request('https://example.test/object')])assert.throws(()=>guarded(target,{headers:{Authorization:'fixture'}}));
  assert.equal(calls,0);
});
test('Storage fetch forces redirect error and bounded timeout even if caller requests follow',async()=>{
  let options;await localFetch((_url,init)=>{options=init;return Promise.resolve(new Response('fixture'));})(new URL(api+'/storage/v1/object'),{redirect:'follow',headers:{Authorization:'fixture'}});
  assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);assert.equal(options.headers.Authorization,'fixture');
});
test('Storage fetch and endpoint guard reject embedded URL credentials',()=>{
  assert.throws(()=>validateLocalEndpoints(api.replace('http://','http://user:pass@'),db));
  assert.throws(()=>localFetch(()=>assert.fail('Must not fetch'))(api.replace('http://','http://user:pass@')));
});

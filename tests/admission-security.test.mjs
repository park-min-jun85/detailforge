import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {validateLocalEndpoints,localFetch} from './helpers/admission-local.mjs';
import {withUserClient} from '../src/lib/supabase/user.ts';
test('admission guard only accepts its exact isolated local endpoints',()=>{
  validateLocalEndpoints('http://127.0.0.1:58421','postgresql://postgres:local@127.0.0.1:58422/postgres');
  for(const api of ['https://example.com','http://localhost:58421','http://127.0.0.1:58321','http://user:pass@127.0.0.1:58421'])
    assert.throws(()=>validateLocalEndpoints(api,'postgresql://postgres:local@127.0.0.1:58422/postgres'));
});
test('admission guard rejects nonlocal DB hosts and ports',()=>{
  for(const db of ['postgresql://remote.example:58422/db','postgresql://127.0.0.1:5432/db'])assert.throws(()=>validateLocalEndpoints('http://127.0.0.1:58421',db));
});
test('admission transport refuses remote target before calling fetch',async()=>{
  let calls=0;const guarded=localFetch(async()=>{calls++;return new Response();});
  await assert.rejects(async()=>guarded('https://example.com'));assert.equal(calls,0);
});
test('admission transport cannot follow redirects',async()=>{
  let options;await localFetch(async(_url,init)=>{options=init;return new Response();})('http://127.0.0.1:58421/auth/v1/user',{redirect:'follow'});
  assert.equal(options.redirect,'error');assert.ok(options.signal);
});
test('server context rejects absent or anonymous identity before invoking service',async()=>{
  for(const user of [null,{id:'1645f432-b847-4e28-9ee7-f41beccccf46',is_anonymous:true}]){
    let calls=0;await assert.rejects(withUserClient({auth:{getUser:async()=>({data:{user},error:null})}},async()=>calls++));assert.equal(calls,0);
  }
});
test('production privileged client import is confined to finite admission and export boundaries',()=>{
  const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p+'/'+e.name):[p+'/'+e.name]);
  const uses=walk('src').filter(p=>/\.tsx?$/.test(p)&&/import.*createSupabaseAdminClient/.test(readFileSync(p,'utf8')));
  assert.deepEqual(uses,['src/features/detail-export/authorization.ts','src/lib/abuse/privileged.ts']);assert.equal(existsSync('src/lib/supabase/server.ts'),false);
  for(const p of walk('src/features').filter(p=>p.endsWith('.ts')))assert.doesNotMatch(readFileSync(p,'utf8'),/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
});

// Real application -> GoTrue identity -> user JWT/RLS -> narrowly scoped ledger.
// Run: node --conditions=react-server --import ./tests/register.mjs tests/admission-runtime.supabase.mjs
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {connectLocal,output,workdir,migration,tables,localFetch} from './helpers/admission-local.mjs';
import {withUserClient,createUserDataClient} from '../src/lib/supabase/user.ts';
import {getProjects} from '../src/features/projects/queries.ts';
import {getProductDetail} from '../src/features/products/queries.ts';
import {getAssetContext,listAssets,uploadAsset,deleteAsset} from '../src/features/assets/service.ts';
import {analyzeAsset} from '../src/features/asset-analysis/service.ts';
import {issueUpload,withPaidOperation} from '../src/lib/abuse/admission.ts';
import {analysisResult} from './helpers/analysis.mjs';
import {verifyAbandonedUploads} from './helpers/admission-abuse.mjs';
mkdirSync(output,{recursive:true});
const run=randomUUID().replaceAll('-',''),checks=[],users=[],secrets=[],originalFetch=globalThis.fetch;
const savedEnv={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY};
let phase='setup',providerCalls=0,appMode=false,adminDataRequests=0,adminStorageRequests=0,privilegedRpcRequests=0,deletedUsers=0;
const report={status:'RUNNING',checks,run,remoteDbMutations:0,remoteAuthMutations:0,remoteStorageMutations:0,externalProviderCalls:0};
const save=()=>writeFileSync(join(output,'runtime.json'),JSON.stringify(report,null,2)+'\n');
const check=async(name,fn)=>{phase=name;await fn();checks.push({name,status:'PASS'});};
const ok=r=>{assert.equal(r.error,null,r.error?.code??r.error?.statusCode);return r.data;};
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
let c,admin;
try {
  c=connectLocal();const {local,api,sql,file}=c;secrets.push(...Object.values(local).filter(v=>typeof v==='string'&&v.length>12));
  process.env.SUPABASE_URL=api.origin;process.env.SUPABASE_SERVICE_ROLE_KEY=local.SERVICE_ROLE_KEY;
  const transport=localFetch(async(input,init)=>{
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
    const headers=new Headers(init?.headers ?? (input instanceof Request?input.headers:undefined));
    if(appMode && headers.get('apikey')===local.SERVICE_ROLE_KEY){
      if(url.pathname.startsWith('/rest/v1/rpc/'))privilegedRpcRequests++;
      else if(url.pathname.startsWith('/rest/v1/'))adminDataRequests++;
      else if(url.pathname.startsWith('/storage/'))adminStorageRequests++;
    }
    return originalFetch(input,init);
  });
  globalThis.fetch=transport;
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport}};
  admin=createClient(api.origin,local.SERVICE_ROLE_KEY,options);
  const platform=join(workdir,'platform.sql');
  if(!existsSync(platform))writeFileSync(platform,c.dump(['--schema-only','--exclude-schema=public','--exclude-schema=app_private']));
  if(sql('postgres',"select to_regclass('public.projects') is null")==='t')
    for(const f of readdirSync('supabase/migrations').filter(f=>/^000[1-8]_/.test(f)).sort())file('postgres','supabase/migrations/'+f);
  for(const label of ['a','b']){
    const email=`srv-${label}-${run}@example.test`,password='Local-'+randomUUID();secrets.push(password);
    const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
    const client=createClient(api.origin,local.ANON_KEY,options);
    const session=ok(await client.auth.signInWithPassword({email,password})).session;secrets.push(session.access_token,session.refresh_token);
    assert.equal(ok(await client.auth.getUser()).user.id,user.id);
    const p=randomUUID(),q=randomUUID();ok(await client.from('projects').insert({id:p,owner_id:user.id,name:'TASK060 '+run}));
    ok(await client.from('products').insert({id:q,project_id:p,name:'Fixture'}));users.push({id:user.id,client,p,q});
  }
  const [a,b]=users,anon=createClient(api.origin,local.ANON_KEY,options);
  const bytes=await sharp({create:{width:8,height:8,channels:3,background:'#123456'}}).png().toBuffer();
  const legacy=randomUUID(),legacyPath=`projects/${b.p}/products/${b.q}/${legacy}.png`,pending=randomUUID();
  ok(await admin.storage.from('product-assets').upload(legacyPath,bytes,{contentType:'image/png'}));
  ok(await b.client.from('assets').insert({id:legacy,project_id:b.p,product_id:b.q,storage_path:legacyPath,original_filename:'legacy.png',mime_type:'image/png',size_bytes:bytes.length}));
  sql('postgres',`insert into app_private.asset_upload_intents(asset_id,owner_id,project_id,product_id,storage_path,expires_at) values('${pending}','${b.id}','${b.p}','${b.q}','projects/${b.p}/products/${b.q}/${pending}.png',now()+interval '5 minutes')`);
  const snapshot=()=>sql('postgres',`select jsonb_build_object(${[...tables.map(t=>['public',t]),['storage','objects'],['app_private','asset_upload_intents']].map(([s,t])=>`'${s}.${t}',(select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from ${s}.${t} r)`).join(',')})`);
  const policies=()=>sql('postgres',"set search_path=pg_catalog;select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in ('public','storage')");
  const before=snapshot(),beforePolicies=policies();
  await check('MIG-01 upgrade preserves all business rows, objects, existing intents and policies',()=>{
    if(sql('postgres',"select to_regclass('app_private.admissions') is null")==='t')file('postgres',migration);
    else {
      // Re-run against a preserved TASK-060 local volume using the exact current
      // function bodies. The fresh clone below still executes the full SQL file.
      const source=readFileSync(migration,'utf8');
      const functions=source.slice(source.indexOf('create function public.reserve_admission'),source.indexOf('revoke all on function public.reserve_admission'));
      sql('postgres','begin;'+functions.replaceAll('create function public.','create or replace function public.')+'commit;');
    }
    assert.equal(snapshot(),before);assert.equal(policies(),beforePolicies);
  });
  await check('MIG-02 existing object bytes preserved through upgrade',async()=>{
    assert.deepEqual(Buffer.from(await ok(await b.client.storage.from('product-assets').download(legacyPath)).arrayBuffer()),bytes);
  });
  await check('MIG-03 fresh 0001 through 0009 on genuine platform schema',()=>{
    const fresh='df060_'+run;sql('postgres',`create database ${fresh} template template0`);sql(fresh,readFileSync(platform,'utf8'));
    sql(fresh,'create schema if not exists public;grant usage on schema public to anon,authenticated,service_role;');
    for(const f of readdirSync('supabase/migrations').filter(f=>/^000[1-9]_/.test(f)).sort())file(fresh,'supabase/migrations/'+f);
    assert.equal(sql(fresh,'select count(*) from app_private.admission_limits'),'0');report.freshDatabase=fresh;
  });
  await check('SEC-01 user/anon cannot invoke privileged RPCs or mutate private ledger',async()=>{
    for(const role of ['anon','authenticated'])assert.equal(sql('postgres',`select has_function_privilege('${role}','public.reserve_admission(uuid,uuid,uuid,text,text,text,uuid,text)','EXECUTE') or has_table_privilege('${role}','app_private.admissions','INSERT')`),'f');
    assert.ok((await a.client.rpc('reserve_admission',{p_actor:a.id,p_project:a.p,p_product:a.q,p_operation:'upload',p_key:hash('x'),p_fingerprint:hash('x')})).error);
  });
  await check('SEC-02 absent operating limits fails closed',async()=>{
    sql('postgres','delete from app_private.admission_limits');
    await assert.rejects(issueUpload(a.client,a.p,a.q,'image/png',bytes.length));
  });
  const config={upload_user_slots:3,upload_global_slots:30,user_bytes:10485760*100,global_bytes:10485760*1000,uploads_per_hour:1000,
    ai_user_concurrency:2,ai_global_concurrency:20,ai_user_hour:1000,ai_global_hour:10000,ai_user_day:10000,ai_global_day:100000};
  sql('postgres',`insert into app_private.admission_limits(${Object.keys(config).join(',')}) values(${Object.values(config).join(',')})`);
  const limit=(name,value)=>{assert.ok(name in config);sql('postgres',`update app_private.admission_limits set ${name}=${Number(value)}`);};
  appMode=true;
  await check('SRV-01 own Project through application query and verified JWT',async()=>{
    const list=await withUserClient(a.client,()=>getProjects());assert.equal(list.success,true);assert.deepEqual(list.data.projects.map(p=>p.id),[a.p]);
  });
  await check('SRV-02 foreign exact Project unavailable through application service',async()=>{
    await assert.rejects(withUserClient(a.client,()=>getAssetContext(b.p)),e=>e.status===404);
    await assert.rejects(withUserClient(b.client,()=>getAssetContext(a.p)),e=>e.status===404);
  });
  await check('SRV-03 own Product application read',async()=>assert.equal((await withUserClient(a.client,()=>getProductDetail(a.p))).status,'ready'));
  await check('SRV-04 foreign Product application read denied',async()=>assert.equal((await withUserClient(a.client,()=>getProductDetail(b.p))).status,'not-found'));
  let asset;
  await check('SRV-07 own production intent -> JWT upload -> Asset -> consume',async()=>{
    asset=await withUserClient(a.client,()=>uploadAsset(a.p,{name:'fixture.png',mime:'image/png',bytes}));
    assert.equal(sql('postgres',`select state from app_private.admissions where asset_id='${asset.id}'`),'consumed');
  });
  await check('SRV-05 own application Asset sign passes Storage RLS',async()=>{
    const list=await withUserClient(a.client,()=>listAssets(a.p));assert.ok(list.items[0].previewUrl);
    assert.deepEqual(Buffer.from(await (await transport(list.items[0].previewUrl)).arrayBuffer()),bytes);
  });
  await check('SRV-06 foreign Asset sign denied by application before Storage',async()=>await assert.rejects(withUserClient(a.client,()=>listAssets(b.p))));
  await check('SRV-08 foreign Product upload admission denied before privileged RPC',async()=>{
    const before=privilegedRpcRequests;await assert.rejects(issueUpload(a.client,b.p,b.q,'image/png',bytes.length));
    await assert.rejects(issueUpload(a.client,a.p,b.q,'image/png',bytes.length));assert.equal(privilegedRpcRequests,before);
  });
  await check('SRV-09 fabricated path/asset identity cannot be supplied to issuance',async()=>{
    await assert.rejects(issueUpload(a.client,a.p,b.q,'image/png',bytes.length));
    const ticket=await issueUpload(a.client,a.p,a.q,'image/png',bytes.length);
    assert.match(ticket.path,new RegExp(`^projects/${a.p}/products/${a.q}/[a-f0-9-]+\\.png$`));
    assert.notEqual(ticket.id,legacy);await ticket.settle('released');
  });
  await check('SRV-10 12 concurrent upload reservations admit exactly limit 3',async()=>{
    const outcomes=await Promise.allSettled(Array.from({length:12},()=>issueUpload(a.client,a.p,a.q,'image/png',bytes.length)));
    const accepted=outcomes.filter(r=>r.status==='fulfilled');assert.equal(accepted.length,3);assert.equal(outcomes.length-accepted.length,9);
    const active=Number(sql('postgres',`select count(*) from app_private.asset_upload_intents where owner_id='${a.id}' and finalized_at is null`));assert.equal(active,3);
    report.uploadConcurrency={limit:3,attempts:12,accepted:3,rejected:9,activeBeforeRelease:active};
    for(const item of accepted)await item.value.settle('released');
    assert.equal(sql('postgres',`select count(*) from app_private.asset_upload_intents where owner_id='${a.id}' and finalized_at is null`),'0');
    report.uploadConcurrency.activeAfterRelease=0;
  });
  await check('QUOTA-01 actual bytes cap includes existing objects and full reservations',async()=>{
    limit('user_bytes',3*10485760);limit('upload_user_slots',10);
    const r=await Promise.allSettled(Array.from({length:7},()=>issueUpload(a.client,a.p,a.q,'image/png',bytes.length)));
    assert.equal(r.filter(r=>r.status==='fulfilled').length,2);for(const x of r)if(x.status==='fulfilled')await x.value.settle('released');
    limit('user_bytes',config.user_bytes);limit('upload_user_slots',config.upload_user_slots);
  });
  await check('SRV-11 expired reservation cannot consume; cleanup never refunds ambiguous object',async()=>{
    const ticket=await issueUpload(a.client,a.p,a.q,'image/png',bytes.length);
    sql('postgres',`update app_private.admissions set expires_at=clock_timestamp()-interval '1 second' where asset_id='${ticket.id}'`);
    await assert.rejects(ticket.settle('consumed'));
    ok(await admin.rpc('expire_admissions'));
    assert.equal(sql('postgres',`select state from app_private.admissions where asset_id='${ticket.id}'`),'released');
    await ticket.settle('released');
  });
  await verifyAbandonedUploads({c,a,b,admin,bytes,check,report,config,limit,issueUpload,ok});
  await check('REPLAY-01 deleting a pre-row object cannot replay the same Storage admission',async()=>{
    const ticket=await issueUpload(a.client,a.p,a.q,'image/png',bytes.length);
    ok(await a.client.storage.from('product-assets').upload(ticket.path,bytes,{contentType:'image/png'}));
    ok(await a.client.storage.from('product-assets').remove([ticket.path]));
    assert.ok((await a.client.storage.from('product-assets').upload(ticket.path,bytes,{contentType:'image/png'})).error);
    await ticket.settle('released');
  });
  await check('SRV-12 replay/double consume never creates another admission',async()=>{
    const before=Number(sql('postgres','select count(*) from app_private.admissions'));
    const args={p_actor:a.id,p_project:a.p,p_product:null,p_operation:'asset-analysis',p_key:hash(run+'replay'),p_fingerprint:hash('input')};
    const t=ok(await admin.rpc('reserve_admission',args));assert.ok((await admin.rpc('reserve_admission',args)).error);
    ok(await admin.rpc('settle_admission',{p_actor:a.id,p_id:t.id,p_outcome:'consumed'}));
    ok(await admin.rpc('settle_admission',{p_actor:a.id,p_id:t.id,p_outcome:'consumed'}));
    assert.equal(Number(sql('postgres','select count(*) from app_private.admissions')),before+1);
  });
  const provider=()=>({model:'local-fake-vision',async analyze(){providerCalls++;return analysisResult();}});
  await check('SRV-13 actual own analyzeAsset service reaches mock provider after admission',async()=>{
    await withUserClient(a.client,()=>analyzeAsset(a.p,asset.id,provider));assert.equal(providerCalls,1);
  });
  await check('SRV-14 foreign exact Asset never reaches provider',async()=>{
    const before=providerCalls;await assert.rejects(withUserClient(a.client,()=>analyzeAsset(b.p,legacy,provider)));
    await assert.rejects(withUserClient(b.client,()=>analyzeAsset(a.p,asset.id,provider)));assert.equal(providerCalls,before);
  });
  await check('SRV-15 quota denial blocks actual AI service before provider',async()=>{
    limit('ai_user_hour',1);const before=providerCalls;
    await assert.rejects(withUserClient(a.client,()=>analyzeAsset(a.p,asset.id,provider)));assert.equal(providerCalls,before);limit('ai_user_hour',config.ai_user_hour);
  });
  await check('AI-CONCURRENCY 8 concurrent admissions dispatch exactly limit 2',async()=>{
    let release;const gate=new Promise(r=>release=r);let entered=0;
    const work=Array.from({length:8},(_,i)=>withPaidOperation(a.client,a.p,'product-analysis',{run,i},async()=>{entered++;await gate;return true;}));
    // Rejections are observed immediately; successful operations hold leases.
    const settled=Promise.allSettled(work);
    for(let i=0;i<100&&entered<2;i++)await new Promise(r=>setTimeout(r,20));
    await new Promise(r=>setTimeout(r,300));assert.equal(entered,2);release();
    const r=await settled;assert.equal(r.filter(x=>x.status==='fulfilled').length,2);
    report.aiConcurrency={limit:2,attempts:8,accepted:2,rejected:6};
  });
  await check('SRV-16 anon user rejected before data/provider access',async()=>await assert.rejects(withUserClient(anon,()=>getProjects())));
  await check('SRV-17 missing and invalid sessions rejected',async()=>{
    await assert.rejects(createUserDataClient());
    const invalid=createClient(api.origin,local.ANON_KEY,{...options,global:{fetch:transport,headers:{Authorization:'Bearer invalid'}}});
    await assert.rejects(withUserClient(invalid,()=>getProjects()));
  });
  await check('SRV-18 no admin DB CRUD in ordinary application path',()=>assert.equal(adminDataRequests,0));
  await check('SRV-19 no admin Storage calls in ordinary application path',()=>assert.equal(adminStorageRequests,0));
  await check('SRV-20 all denied application requests caused zero provider dispatch',()=>assert.equal(providerCalls,1));
  await check('SEC-03 local origin/port and redirects restricted',async()=>{
    await assert.rejects(async()=>transport('https://example.com'));assert.equal(adminDataRequests+adminStorageRequests,0);
  });
  await check('STORAGE application own delete remains scoped',async()=>await withUserClient(a.client,()=>deleteAsset(a.p,asset.id)));
  await check('NAMESPACE deleted Project cannot transfer orphaned bytes to another actor',async()=>{
    const p=randomUUID(),q=randomUUID();ok(await a.client.from('projects').insert({id:p,owner_id:a.id,name:'orphan fixture'}));
    ok(await a.client.from('products').insert({id:q,project_id:p,name:'orphan fixture'}));
    const ticket=await issueUpload(a.client,p,q,'image/png',bytes.length);
    ok(await a.client.storage.from('product-assets').upload(ticket.path,bytes,{contentType:'image/png'}));
    ok(await a.client.from('assets').insert({id:ticket.id,project_id:p,product_id:q,storage_path:ticket.path,original_filename:'orphan.png',mime_type:'image/png',size_bytes:bytes.length}));
    await ticket.settle('consumed');
    ok(await a.client.from('projects').delete().eq('id',p));
    limit('user_bytes',10485760);
    await assert.rejects(issueUpload(a.client,a.p,a.q,'image/png',bytes.length));
    limit('user_bytes',config.user_bytes);
    assert.ok((await b.client.from('projects').insert({id:p,owner_id:b.id,name:'takeover'})).error);
    assert.ok((await b.client.storage.from('product-assets').download(ticket.path)).error);
    // Restore by the same actor solely to clean the fixture through owner RLS.
    ok(await a.client.from('projects').insert({id:p,owner_id:a.id,name:'cleanup'}));
    ok(await a.client.from('products').insert({id:q,project_id:p,name:'cleanup'}));
    ok(await a.client.storage.from('product-assets').remove([ticket.path]));
    ok(await a.client.from('projects').delete().eq('id',p));
  });
  report.authentication='Real GoTrue password sessions, public anon-key clients, getUser verification, user JWT DB/Storage requests';
  report.adminDataAcceptanceRequests=adminDataRequests;report.adminStorageAcceptanceRequests=adminStorageRequests;
  report.privilegedAdmissionRpcRequests=privilegedRpcRequests;report.mockProviderCalls=providerCalls;
  report.migrationSha256=hash(readFileSync(migration,'utf8'));report.status='PASS';
} catch(error){report.status='FAIL';report.phase=phase;report.error=String(error?.message??error).slice(0,1000);for(const s of secrets)report.error=report.error.replaceAll(s,'[redacted]');}
finally {
  appMode=false;
  if(c&&admin)for(const u of users){
    try{
      const objects=JSON.parse(c.sql('postgres',`select coalesce(jsonb_agg(name),'[]') from storage.objects where bucket_id='product-assets' and name like 'projects/${u.p}/%'`));
      if(objects.length)ok(await admin.storage.from('product-assets').remove(objects));
      if(c.sql('postgres',"select to_regclass('app_private.admissions') is not null")==='t')c.sql('postgres',`delete from app_private.admissions where actor='${u.id}'`);
      c.sql('postgres',`delete from public.projects where owner_id='${u.id}';`);
      ok(await admin.auth.admin.deleteUser(u.id));
      deletedUsers++;
    }catch{report.cleanupFailed=true;report.status='FAIL';}
  }
  globalThis.fetch=originalFetch;for(const [k,v]of Object.entries(savedEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  report.checkCount=checks.length;report.localAuthFixturesCreated=users.length;report.localAuthFixturesDeleted=deletedUsers;save();
}
console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;

// TASK-059 actual local GoTrue + Storage API. No remote credentials or mocked JWTs.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {connectLocal,localFetch,output,workdir,migration,tables} from './helpers/storage-local.mjs';

mkdirSync(output,{recursive:true});
const bucket='product-assets',run=randomUUID().replaceAll('-','').slice(0,12),checks=[],secrets=[];
const result={status:'RUNNING',run,checks,remoteDbMutations:0,remoteAuthMutations:0,remoteStorageMutations:0};
let phase='local preflight';
const save=(f,v)=>writeFileSync(join(output,f),JSON.stringify(v,null,2)+'\n');
const check=async(name,fn)=>{phase=name;await fn();checks.push({name,status:'PASS'});};
const ok=r=>{assert.equal(r.error,null,`Unexpected provider error: ${r.error?.code??r.error?.statusCode??'unknown'}`);return r.data;};
const deny=r=>{
  assert.ok(r.error,'Expected denied operation');
  const status=Number(r.error.statusCode ?? r.error.status);
  assert.ok(status>=400 && status<500,`Expected authorization/validation 4xx, got ${status}`);
};
const sqlDeny=(fn,re)=>{let error;try{fn();}catch(e){error=e;}assert.ok(error);assert.match(String(error.stderr),re);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const path=(p,q,id,ext='png')=>`projects/${p}/products/${q}/${id}.${ext}`;

try {
  const c=connectLocal(),{local,api,sql,file,guardedFetch}=c;
  secrets.push(...Object.values(local).filter(v=>typeof v==='string'&&v.length>12));
  result.serverVersion=sql('postgres','show server_version');
  result.migrationSha256=sha(readFileSync(migration));
  if(sql('postgres',"select to_regclass('public.projects') is null")==='t') {
    for(const f of readdirSync('supabase/migrations').filter(f=>/^000[1-7]_/.test(f)).sort())file('postgres','supabase/migrations/'+f);
  }
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:guardedFetch}};
  const admin=createClient(api.origin,local.SERVICE_ROLE_KEY,options),users=[];
  for(const label of ['A','B']) {
    const email=`stg-${label.toLowerCase()}-${run}@example.test`,password='Local-storage-'+randomUUID();secrets.push(password);
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true});ok(created);
    const client=createClient(api.origin,local.ANON_KEY,options);
    const login=ok(await client.auth.signInWithPassword({email,password}));assert.ok(login.session?.access_token);
    secrets.push(login.session.access_token,login.session.refresh_token);
    const claims=JSON.parse(Buffer.from(login.session.access_token.split('.')[1],'base64url').toString());
    const validated=ok(await client.auth.getUser());assert.equal(validated.user.id,created.data.user.id);
    assert.equal(claims.sub,validated.user.id);assert.equal(claims.role,'authenticated');assert.equal(client.supabaseKey,local.ANON_KEY);
    const p=randomUUID(),q=randomUUID();
    ok(await client.from('projects').insert({id:p,owner_id:validated.user.id,name:'STG '+run}));
    ok(await client.from('products').insert({id:q,project_id:p,name:'Storage fixture'}));
    users.push({label,client,id:validated.user.id,p,q,storage:client.storage.from(bucket),token:login.session.access_token});
  }
  const [a,b]=users,anon=createClient(api.origin,local.ANON_KEY,options),anonymous=anon.storage.from(bucket);
  await check('STG-24 actual A/B GoTrue signInWithPassword/getUser sessions; anon has none',async()=>assert.equal((await anon.auth.getSession()).data.session,null));
  result.authentication={method:'GoTrue password sessions verified by getUser; public anon-key SDK with authenticated JWT',users:2,anonSession:false,serviceRoleAcceptanceRequests:0};
  const tiny=async(color,format='png')=>sharp({create:{width:8,height:8,channels:3,background:color}}).toFormat(format).toBuffer();
  const bytesA=await tiny('#cc2200'),bytesB=await tiny('#0033cc');assert.notEqual(sha(bytesA),sha(bytesB));
  const upload=(u,name,bytes=bytesA,extra={})=>u.storage.upload(name,bytes,{contentType:'image/png',cacheControl:'60',upsert:false,...extra});
  const download=async(u,name)=>Buffer.from(await ok(await u.storage.download(name)).arrayBuffer());
  const insertAsset=(u,id,name)=>u.client.from('assets').insert({id,project_id:u.p,product_id:u.q,storage_path:name,original_filename:'fixture.png',mime_type:'image/png',metadata:{fixture:run}});
  const coreSnapshot=db=>sql(db,`select jsonb_build_object(${tables.map(t=>`'${t}',(select jsonb_agg(to_jsonb(r) order by id) from public.${t} r)`).join(',')})`);
  const objectsSnapshot=()=>sql('postgres',"select coalesce(jsonb_agg(to_jsonb(o) order by id),'[]') from storage.objects o where bucket_id='product-assets'");
  const policies=db=>JSON.parse(sql(db,"set search_path=pg_catalog; select coalesce(jsonb_agg(to_jsonb(p) order by tablename,policyname),'[]') from pg_policies p where schemaname='storage' and tablename in ('objects','buckets')"));
  const config=db=>JSON.parse(sql(db,"select to_jsonb(b) from storage.buckets b where id='product-assets'"));
  const catalogCheck=db=>{
    const p=policies(db),b=config(db);assert.equal(b.public,false);assert.equal(b.file_size_limit,10485760);assert.deepEqual(b.allowed_mime_types,['image/jpeg','image/png','image/webp']);
    assert.equal(p.length,5);assert.deepEqual(p.filter(p=>p.tablename==='objects').map(p=>p.cmd).sort(),['DELETE','INSERT','SELECT','UPDATE']);
    for(const policy of p.filter(p=>p.tablename==='objects'))assert.deepEqual(policy.roles,['authenticated']);
    const update=p.find(p=>p.cmd==='UPDATE');assert.equal(update.qual,'false');assert.equal(update.with_check,'false');
    assert.equal(p.find(p=>p.tablename==='buckets').permissive,'RESTRICTIVE');
    assert.equal(sql(db,"select count(*) from pg_class where oid in ('storage.objects'::regclass,'storage.buckets'::regclass) and relrowsecurity and pg_get_userbyid(relowner)='supabase_storage_admin'"),'2');
    return {bucket:b,policies:p};
  };
  // Cache genuine platform-only DDL before 0008. It contains no Auth row data.
  const baseline=join(workdir,'platform-before-0008.sql');
  if(!existsSync(baseline)) {
    assert.equal(policies('postgres').length,0,'Need a clean TASK-059 platform baseline');
    writeFileSync(baseline,c.dump(['--schema-only','--exclude-schema=public','--exclude-schema=app_private']));
  }
  const fresh='df059_fresh_'+run;result.freshDatabase=fresh;
  sql('postgres',`create database ${fresh} template template0`);sql(fresh,readFileSync(baseline,'utf8'));
  sql(fresh,'create schema if not exists public; grant usage on schema public to anon,authenticated,service_role;');
  const migrations=readdirSync('supabase/migrations').filter(f=>/^000[1-8]_.*\.sql$/.test(f)).sort();assert.equal(migrations.length,8);
  await check('MIG-01 fresh 0001–0008 applies with managed owners, bucket and policy catalog intact',()=>{
    for(const f of migrations)file(fresh,'supabase/migrations/'+f);save('catalog-fresh.json',catalogCheck(fresh));
  });
  const legacyId=randomUUID(),legacy=path(b.p,b.q,legacyId);
  // Fixture setup only; acceptance later downloads and hashes this legacy object as B.
  ok(await admin.storage.from(bucket).upload(legacy,bytesB,{contentType:'image/png',upsert:false}));ok(await insertAsset(b,legacyId,legacy));
  const beforeObjects=objectsSnapshot(),beforeRows=coreSnapshot('postgres');
  if(policies('postgres').length===0) {
    await check('MIG-02 unexpected permissive policy fails closed without changing rows/objects',()=>{
      sql('postgres','create policy task059_drift on storage.objects for select to authenticated using (true)');
      sqlDeny(()=>file('postgres',migration),/Unexpected existing Storage policies/);
      assert.equal(objectsSnapshot(),beforeObjects);assert.equal(coreSnapshot('postgres'),beforeRows);
      sql('postgres','drop policy task059_drift on storage.objects');
    });
    const bad='invalid-task059-'+run+'.png';ok(await admin.storage.from(bucket).upload(bad,bytesA,{contentType:'image/png'}));
    await check('MIG-03 malformed existing object fails closed and is not repaired/deleted',()=>{
      const prior=objectsSnapshot();sqlDeny(()=>file('postgres',migration),/Existing Storage path ownership mismatch/);assert.equal(objectsSnapshot(),prior);
    });
    ok(await admin.storage.from(bucket).remove([bad]));
    await check('MIG-04 upgrade preserves all Asset/core rows and existing object metadata',()=>{
      file('postgres',migration);assert.equal(coreSnapshot('postgres'),beforeRows);assert.equal(objectsSnapshot(),beforeObjects);
    });
  } else {
    await check('MIG-04 already applied primary verified; fresh DB covers chain on rerun',()=>catalogCheck('postgres'));
  }
  save('catalog-after.json',catalogCheck('postgres'));
  await check('MIG-05 raw repeat fails closed without metadata/data changes',()=>{
    const rows=coreSnapshot('postgres'),objects=objectsSnapshot(),p=policies('postgres');sqlDeny(()=>file('postgres',migration),/Unexpected existing Storage policies/);
    assert.equal(coreSnapshot('postgres'),rows);assert.equal(objectsSnapshot(),objects);assert.deepEqual(policies('postgres'),p);
  });
  await check('STG-01 private product-assets exists; JPEG/PNG/WebP and 10MiB bucket cap',()=>catalogCheck('postgres'));
  await check('STG-22 exact operation-specific policies and unchanged managed table owners',()=>catalogCheck('postgres'));
  await check('STG-23 no unexpected permissive policies; UPDATE false; bucket control restrictive',()=>assert.equal(policies('postgres').length,5));
  await check('SEC-01 non-CRUD Storage privileges removed; CRUD remains RLS-gated',()=>{
    for(const role of ['anon','authenticated'])for(const table of ['objects','buckets']) {
      assert.equal(sql('postgres',`select has_table_privilege('${role}','storage.${table}','TRUNCATE,REFERENCES,TRIGGER')`),'f');
      for(const op of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal(sql('postgres',`select has_table_privilege('${role}','storage.${table}','${op}')`),'t');
    }
    assert.equal(sql('postgres',"select count(*) from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls)"),'0');
  });
  await check('SEC-02 private intents: no user write/RPC; definer finalizer trigger-only and fixed search_path',()=>{
    for(const role of ['anon','authenticated'])assert.equal(sql('postgres',`select has_table_privilege('${role}','app_private.asset_upload_intents','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')`),'f');
    const functions=JSON.parse(sql('postgres',"select jsonb_agg(jsonb_build_object('name',proname,'definer',prosecdef,'config',proconfig,'owner',pg_get_userbyid(proowner),'authExec',has_function_privilege('authenticated',oid,'EXECUTE'),'anonExec',has_function_privilege('anon',oid,'EXECUTE'))) from pg_proc where pronamespace='app_private'::regnamespace"));
    for(const f of functions){assert.deepEqual(f.config,['search_path=""']);assert.equal(f.anonExec,false);assert.equal(f.authExec,f.name==='owns_asset_object');assert.equal(f.definer,f.name==='finalize_asset_upload_intent');assert.ok(!['anon','authenticated'].includes(f.owner));}
    result.functions=functions;
  });
  await check('STG-25 remote destinations blocked before fetch; redirects forbidden',async()=>{
    let called=false;assert.throws(()=>localFetch(()=>{called=true;})('https://example.supabase.co/storage/v1/object'));assert.equal(called,false);
    const r=await guardedFetch(api.origin+'/storage/v1/status');assert.ok(r.status<500);
  });
  const reserve=(u,id=randomUUID(),ext='png',expired=false,short=false)=>{
    const name=path(u.p,u.q,id,ext);
    sql('postgres',`insert into app_private.asset_upload_intents(asset_id,owner_id,project_id,product_id,storage_path,created_at,expires_at) values ('${id}','${u.id}','${u.p}','${u.q}','${name}',now() ${expired?"- interval '2 minutes'":''},now() ${expired?"- interval '1 minute'":short?"+ interval '2 seconds'":"+ interval '10 minutes'"})`);
    return {id,name};
  };
  for(const [u,bytes,caseId] of [[a,bytesA,'02'],[b,bytesB,'03']]) {
    const item=reserve(u);u.assetId=item.id;u.name=item.name;
    await check(`STG-${caseId} ${u.label} approved own upload BEFORE Asset row exists`,async()=>{
      assert.equal(sql('postgres',`select count(*) from public.assets where id='${u.assetId}'`),'0');ok(await upload(u,u.name,bytes));
    });
    await check(`STG-04 ${u.label} own download is exact fixture bytes`,async()=>assert.deepEqual(await download(u,u.name),bytes));
    await check(`STG-21 ${u.label} finalize Asset row consumes intent and path matches`,async()=>{
      ok(await insertAsset(u,u.assetId,u.name));assert.equal(sql('postgres',`select finalized_at is not null from app_private.asset_upload_intents where asset_id='${u.assetId}'`),'t');
      assert.equal(ok(await u.client.from('assets').select('storage_path').eq('id',u.assetId).single()).storage_path,u.name);
    });
  }
  await check('MIG-06 legacy service-created object remains readable as its Project owner B',async()=>assert.deepEqual(await download(b,legacy),bytesB));
  const beforeB=sql('postgres',`select to_jsonb(o) from storage.objects o where bucket_id='${bucket}' and name='${b.name}'`);
  for(const [u,other] of [[a,b],[b,a]]) {
    await check(`STG-05 ${u.label} exact foreign and missing download denied`,async()=>{deny(await u.storage.download(other.name));deny(await u.storage.download(path(other.p,other.q,randomUUID())));});
    await check(`STG-07 ${u.label} foreign namespace upload denied`,async()=>deny(await upload(u,path(other.p,other.q,randomUUID()))));
    await check(`STG-08 ${u.label} foreign upsert denied`,async()=>deny(await upload(u,other.name,bytesA,{upsert:true})));
    await check(`STG-09 ${u.label} foreign update denied`,async()=>deny(await u.storage.update(other.name,bytesA,{contentType:'image/png'})));
    await check(`STG-10 ${u.label} foreign delete has no effect`,async()=>{const r=await u.storage.remove([other.name]);if(!r.error)assert.deepEqual(r.data,[]);});
    await check(`STG-12 ${u.label} own signed URL returns exact bytes`,async()=>{
      const signed=ok(await u.storage.createSignedUrl(u.name,60));secrets.push(signed.signedUrl);
      const response=await guardedFetch(signed.signedUrl);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),u===a?bytesA:bytesB);
      const forged=new URL(signed.signedUrl);forged.pathname=forged.pathname.replace(u.name,other.name);
      assert.notEqual((await guardedFetch(forged)).status,200);
    });
    await check(`STG-13 ${u.label} foreign single and mixed batch sign cannot issue foreign URL`,async()=>{
      deny(await u.storage.createSignedUrl(other.name,60));const batch=ok(await u.storage.createSignedUrls([u.name,other.name],60));
      for(const item of batch)if(item.signedUrl)secrets.push(item.signedUrl);
      assert.ok(batch.find(i=>i.path===u.name).signedUrl);assert.ok(!batch.find(i=>i.path===other.name).signedUrl);
    });
    await check(`STG-15 ${u.label} own object listing`,async()=>assert.ok(ok(await u.storage.list(`projects/${u.p}/products/${u.q}`)).some(o=>o.name===u.name.split('/').at(-1))));
    for(const prefix of ['', 'projects',`projects/${other.p}`,`projects/${other.p}/products/${other.q}`])await check(`STG-16 ${u.label} listing ${prefix||'root'} excludes foreign namespace`,async()=>{
      const list=ok(await u.storage.list(prefix));assert.ok(list.every(o=>!JSON.stringify(o).includes(other.p)&&!JSON.stringify(o).includes(other.q)&&!JSON.stringify(o).includes(other.assetId)));
      if(prefix.includes(other.p))assert.deepEqual(list,[]);
    });
  }
  await check('STG-06 anon download and public URL cannot read private bytes',async()=>{
    deny(await anonymous.download(b.name));const url=anonymous.getPublicUrl(b.name).data.publicUrl;assert.notEqual((await guardedFetch(url)).status,200);
  });
  await check('STG-11 anon upload/upsert/update/delete cannot change B',async()=>{
    deny(await anonymous.upload(b.name,bytesA,{contentType:'image/png'}));deny(await anonymous.upload(b.name,bytesA,{contentType:'image/png',upsert:true}));deny(await anonymous.update(b.name,bytesA,{contentType:'image/png'}));
    const r=await anonymous.remove([b.name]);if(!r.error)assert.deepEqual(r.data,[]);
  });
  await check('STG-14 anon single/batch signing denied',async()=>{
    deny(await anonymous.createSignedUrl(b.name,60));const r=await anonymous.createSignedUrls([b.name],60);if(!r.error)assert.ok(r.data.every(o=>!o.signedUrl));
  });
  await check('STG-16 anon root/prefix listing exposes no metadata',async()=>{
    for(const prefix of ['', 'projects',`projects/${b.p}`,`projects/${b.p}/products/${b.q}`]){const r=await anonymous.list(prefix);if(!r.error)assert.deepEqual(r.data,[]);}
  });
  for(const [label,name] of [
    ['A project+B product',path(a.p,b.q,randomUUID())],['B project+A product',path(b.p,a.q,randomUUID())],
    ['A scope+B asset UUID',path(a.p,a.q,b.assetId)],['unknown project',path(randomUUID(),a.q,randomUUID())],
    ['unknown product',path(a.p,randomUUID(),randomUUID())],['unapproved asset',path(a.p,a.q,randomUUID())],
    ['malformed UUID',`projects/not-a-uuid/products/${a.q}/${randomUUID()}.png`],['extra folder',a.name+'/extra.png'],
    ['encoded traversal',`projects/${a.p}/products/${a.q}/%2e%2e/${randomUUID()}.png`],['unsupported extension',a.name.replace('.png','.svg')],
  ])await check(`STG-${label.includes('project+')||label.includes('asset UUID')?'17':'18'} ${label} upload denied`,async()=>deny(await upload(a,name)));
  await check('EXTRA own replace/update/upsert denied (application always creates new UUID)',async()=>{deny(await a.storage.update(a.name,bytesB,{contentType:'image/png'}));deny(await upload(a,a.name,bytesB,{upsert:true}));});
  await check('EXTRA move/copy foreign-to-own and own-to-foreign denied',async()=>{
    for(const [source,dest] of [[b.name,path(a.p,a.q,randomUUID())],[a.name,path(b.p,b.q,randomUUID())]]){deny(await a.storage.move(source,dest));deny(await a.storage.copy(source,dest));}
  });
  await check('EXTRA own copy/move and signed-upload URL denied even for approved destination',async()=>{
    const dest=reserve(a);deny(await a.storage.copy(a.name,dest.name));deny(await a.storage.move(a.name,dest.name));deny(await a.storage.createSignedUploadUrl(dest.name));
  });
  await check('EXTRA signed download URL expires; no permanent private URL',async()=>{
    const signed=ok(await a.storage.createSignedUrl(a.name,1));secrets.push(signed.signedUrl);
    await new Promise(resolve=>setTimeout(resolve,2200));
    const response=await guardedFetch(signed.signedUrl);assert.ok(response.status>=400 && response.status<500);
  });
  await check('EXTRA user metadata cannot transfer an owned object to B',async()=>{
    const item=reserve(a);ok(await upload(a,item.name,bytesA,{metadata:{owner_id:b.id,project_id:b.p,asset_id:b.assetId}}));
    deny(await b.storage.download(item.name));assert.deepEqual(await download(a,item.name),bytesA);ok(await a.storage.remove([item.name]));
  });
  await check('EXTRA same-owner mixed Project/Product and reserved Asset finalization mismatch denied',async()=>{
    const otherP=randomUUID(),otherQ=randomUUID();
    ok(await a.client.from('projects').insert({id:otherP,owner_id:a.id,name:'same owner scope'}));
    ok(await a.client.from('products').insert({id:otherQ,project_id:otherP,name:'other product'}));
    deny(await upload(a,path(a.p,otherQ,randomUUID())));
    sqlDeny(()=>reserve({...a,q:otherQ}),/23503/);
    const item=reserve(a),otherPath=path(otherP,otherQ,item.id);
    const r=await a.client.from('assets').insert({id:item.id,project_id:otherP,product_id:otherQ,storage_path:otherPath,original_filename:'mismatch.png'});
    assert.equal(r.error?.code,'23514');
    assert.equal(sql('postgres',`select finalized_at is null from app_private.asset_upload_intents where asset_id='${item.id}'`),'t');
    ok(await a.client.from('projects').delete().eq('id',otherP));
  });
  await check('EXTRA expired approval upload denied',async()=>deny(await upload(a,reserve(a,randomUUID(),'png',true).name)));
  await check('EXTRA Asset row alone cannot mint upload authorization',async()=>{
    const id=randomUUID(),name=path(a.p,a.q,id);ok(await insertAsset(a,id,name));deny(await upload(a,name));ok(await a.client.from('assets').delete().eq('id',id));
  });
  await check('EXTRA trusted intent validation rejects foreign owner and existing foreign Asset ID',()=>{
    sqlDeny(()=>reserve({...a,id:b.id}),/23514/);sqlDeny(()=>reserve(a,b.assetId),/23514/);
  });
  await check('EXTRA pre-row failure cleanup succeeds even after intent expiry',async()=>{
    const item=reserve(a,randomUUID(),'png',false,true);ok(await upload(a,item.name));
    await new Promise(resolve=>setTimeout(resolve,2200));
    assert.equal(sql('postgres',`select count(*) from public.assets where id='${item.id}'`),'0');
    assert.equal(sql('postgres',`select expires_at < now() from app_private.asset_upload_intents where asset_id='${item.id}'`),'t');
    ok(await a.storage.remove([item.name]));deny(await a.storage.download(item.name));
  });
  for(const [ext,mime,bytes] of [['jpg','image/jpeg',await tiny('#cc2200','jpeg')],['webp','image/webp',await tiny('#cc2200','webp')]])await check(`EXTRA own ${mime} format remains supported as .${ext}`,async()=>{
    const item=reserve(a,randomUUID(),ext);ok(await upload(a,item.name,bytes,{contentType:mime}));assert.deepEqual(await download(a,item.name),bytes);ok(await a.storage.remove([item.name]));
  });
  await check('EXTRA bucket MIME and 10MiB restrictions reject invalid upload',async()=>{
    deny(await upload(a,reserve(a).name,bytesA,{contentType:'image/svg+xml'}));deny(await upload(a,reserve(a).name,Buffer.alloc(10485761)));
  });
  await check('EXTRA A/anon cannot make bucket public/create/delete/reconfigure bucket',async()=>{
    for(const client of [a.client,anon]){deny(await client.storage.updateBucket(bucket,{public:true}));deny(await client.storage.deleteBucket(bucket));deny(await client.storage.createBucket('forged-'+run,{public:true}));}
    assert.equal(config('postgres').public,false);
  });
  await check('STG-20 B content hash and object metadata survive all A/anon attacks',async()=>{
    assert.deepEqual(await download(b,b.name),bytesB);assert.equal(sha(await download(b,b.name)),sha(bytesB));
    assert.equal(sql('postgres',`select to_jsonb(o) from storage.objects o where bucket_id='${bucket}' and name='${b.name}'`),beforeB);
    result.integrity={sha256A:sha(bytesA),sha256B:sha(bytesB),foreignBytesUnchanged:true,foreignMetadataUnchanged:true};
  });
  await check('EXTRA DB Asset path mutation cannot move Storage ownership',async()=>{
    const r=await a.client.from('assets').update({storage_path:b.name}).eq('id',a.assetId);assert.equal(r.error?.code,'23514');
  });
  for(const u of users)await check(`STG-19 ${u.label} own DELETE removes object`,async()=>{ok(await u.storage.remove([u.name]));deny(await u.storage.download(u.name));});
  await check('EXTRA finalized intent cannot be replayed after object AND Asset deletion',async()=>{
    ok(await a.client.from('assets').delete().eq('id',a.assetId));deny(await upload(a,a.name));
  });
  ok(await b.storage.remove([legacy]));
  for(const u of users){ok(await u.client.from('projects').delete().eq('id',u.p));assert.equal((await u.client.auth.signOut()).error,null);assert.equal((await admin.auth.admin.deleteUser(u.id)).error,null);}
  result.cleanup={localAuthUsersDeleted:2,ownerStorageCleanup:true,ownerProjectCleanup:true,fixturesOnly:true};
  result.matrix=Object.fromEntries(Array.from({length:25},(_,i)=>[`STG-${String(i+1).padStart(2,'0')}`,'PASS']));
  result.status='PASS';result.checkCount=checks.length;
} catch(error) {
  result.status='FAIL';result.failedPhase=phase;
  let detail=String(error.stderr??error.message??'Runtime failure');
  for(const value of secrets)detail=detail.replaceAll(value,'[REDACTED]');
  detail=detail.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED JWT]').replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[REDACTED DB URL]');
  result.failure=detail.slice(0,2500);process.exitCode=1;
}
save('runtime.json',result);console.log(JSON.stringify({status:result.status,checks:checks.length,failedPhase:result.failedPhase,failure:result.failure,matrix:result.matrix},null,2));

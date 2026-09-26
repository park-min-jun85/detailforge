// Opt-in actual GoTrue sessions + PostgREST RLS. No mocked JWTs or SET ROLE verdicts.
// See docs/tasks/TASK-058.md for the isolated local stack start/stop commands.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import ts from 'typescript';
import { connectLocal, catalog, tables, output, migration } from './helpers/rls-local.mjs';

mkdirSync(output,{recursive:true});
const checks=[], secrets=[];
const run=randomUUID().replaceAll('-','').slice(0,12);
const result={status:'RUNNING',run,checks,remoteDbMutations:0,remoteAuthMutations:0,remoteStorageMutations:0};
let phase='local-only preflight';
const check=async(name,fn)=>{phase=name;await fn();checks.push({name,status:'PASS'});};
const save=(name,value)=>writeFileSync(join(output,name),JSON.stringify(value,null,2)+'\n');
const okay=r=>{assert.equal(r.error,null,`Unexpected database error: ${r.error?.code}`);return r.data;};
const denied=(r,code='42501')=>assert.equal(r.error?.code,code,'Expected database rejection');
const empty=r=>assert.deepEqual(okay(r),[]);
const sqlReject=(fn,pattern)=>{let caught;try{fn();}catch(e){caught=e;}assert.ok(caught,'Expected SQL rejection');assert.match(String(caught.stderr),pattern);};
const tableList=tables.map(t=>`'${t}'`).join(',');
const mutate={projects:{name:'edited'},products:{name:'edited'},product_facts:{facts:{edited:true}},assets:{original_filename:'edited.png'},detail_pages:{width:900},sections:{content:{edited:true}},product_options:{groups:{schemaVersion:1,groups:[],edited:true}}};

function graph(owner) {
  const ids=Object.fromEntries(tables.map(t=>[t,randomUUID()]));
  return {
    projects:{id:ids.projects,owner_id:owner,name:'RLS fixture '+run},
    products:{id:ids.products,project_id:ids.projects,name:'fixture product'},
    product_facts:{id:ids.product_facts,product_id:ids.products,facts:{fixture:run}},
    assets:{id:ids.assets,project_id:ids.projects,product_id:ids.products,storage_path:`projects/${ids.projects}/products/${ids.products}/${ids.assets}.png`,original_filename:'fixture.png'},
    detail_pages:{id:ids.detail_pages,project_id:ids.projects},
    sections:{id:ids.sections,detail_page_id:ids.detail_pages,type:'hero'},
    product_options:{id:ids.product_options,product_id:ids.products},
  };
}
function newAsset(project,product) {
  const id=randomUUID();return {id,project_id:project,product_id:product,storage_path:`projects/${project}/products/${product}/${id}.png`,original_filename:'attack.png'};
}
function shapes(text) {
  const sf=ts.createSourceFile('db.ts',text,99,true);
  const node=sf.statements.find(n=>ts.isTypeAliasDeclaration(n)&&n.name.text==='Database');
  const member=(n,key)=>n.members.find(m=>m.name?.getText(sf).replaceAll('"','')===key).type;
  const data={};
  for(const table of member(member(node.type,'public'),'Tables').members) {
    data[table.name.getText(sf).replaceAll('"','')]={};
    for(const kind of ['Row','Insert','Update','Relationships'])data[table.name.getText(sf).replaceAll('"','')][kind]=member(table.type,kind).getText(sf).replace(/\s|;/g,'');
  }
  return data;
}

try {
  const c=connectLocal(),{sql,file,local,api,guardedFetch}=c;
  secrets.push(...Object.values(local).filter(v=>typeof v==='string'&&v.length>12));
  result.serverVersion=sql('postgres','show server_version');
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:guardedFetch}};
  // Privileged client is used ONLY for creating/deleting this run's Auth fixtures.
  const bootstrap=createClient(api.origin,local.SERVICE_ROLE_KEY,options);
  const identities=[];
  for(const label of ['a','b']) {
    const email=`rls-${label}-${run}@example.test`,password='Local-fixture-'+randomUUID();secrets.push(password);
    const created=await bootstrap.auth.admin.createUser({email,password,email_confirm:true});
    assert.equal(created.error,null);assert.ok(created.data.user?.id);
    const client=createClient(api.origin,local.ANON_KEY,options);
    const login=await client.auth.signInWithPassword({email,password});
    assert.equal(login.error,null);assert.ok(login.data.session?.access_token);
    secrets.push(login.data.session.access_token,login.data.session.refresh_token);
    const validated=await client.auth.getUser();
    assert.equal(validated.error,null);assert.equal(validated.data.user.id,created.data.user.id);
    const claims=JSON.parse(Buffer.from(login.data.session.access_token.split('.')[1],'base64url').toString());
    assert.equal(claims.role,'authenticated');assert.equal(claims.sub,created.data.user.id);
    assert.equal(client.supabaseKey,local.ANON_KEY);
    identities.push({client,id:created.data.user.id});
  }
  const [{client:a,id:A},{client:b,id:B}]=identities;
  const anon=createClient(api.origin,local.ANON_KEY,options);
  assert.equal((await anon.auth.getSession()).data.session,null);
  await check('AUTH actual password sessions A/B validated by GoTrue; anon has no session',()=>assert.notEqual(A,B));
  result.authentication={users:2,method:'GoTrue admin fixture create → signInWithPassword → getUser; public-key clients; role=authenticated',anon:'same public key, no session',serviceRoleAcceptanceRequests:0};

  const migrations=readdirSync('supabase/migrations').filter(f=>/^000[1-7]_.*\.sql$/.test(f)).sort();assert.equal(migrations.length,7);
  // Clone the genuine platform bootstrap, not any application public schema.
  // Auth data/password hashes remain in process memory only.
  // Later application migrations also own a private schema and named Storage
  // triggers/policies. Exclude those when cloning platform-only bootstrap;
  // primary REST acceptance still runs against all installed migrations.
  const schema=c.dump(['--schema-only','--exclude-schema=public','--exclude-schema=app_private'])
    .replace(/^CREATE (?:TRIGGER|POLICY) product_assets_[\s\S]*?;\r?\n/gm,'');
  const authData=c.dump(['--data-only','--table=auth.users','--table=auth.identities']);
  const fresh='df058_fresh_'+run,upgrade='df058_upgrade_'+run;
  result.databases={fresh,upgrade,rest:'postgres'};
  for(const db of [fresh,upgrade]) {
    sql('postgres',`create database ${db} template template0`);
    sql(db,schema);
    sql(db,'create schema if not exists public; grant usage on schema public to anon, authenticated, service_role;');
    sql(db,authData);
  }
  const finalCatalog=db=>{
    const rows=catalog(sql,db);assert.equal(rows.length,7);
    for(const t of rows) {
      assert.equal(t.rls,true,t.table);assert.equal(t.policies.length,4,t.table);
      assert.deepEqual(t.grants.anon,null);assert.deepEqual(t.grants.authenticated,['DELETE','INSERT','SELECT','UPDATE']);
      assert.deepEqual(t.grants.service_role,['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']);
      assert.deepEqual(t.policies.map(p=>p.cmd).sort(),['DELETE','INSERT','SELECT','UPDATE']);
      for(const p of t.policies) {
        assert.deepEqual(p.roles,['authenticated']);assert.equal(p.permissive,'PERMISSIVE');
        assert.equal(p.policyname,`${t.table}_owner_${p.cmd.toLowerCase()}`);
        if(p.cmd!=='INSERT')assert.ok(p.qual?.includes('auth.uid()'));
        if(['INSERT','UPDATE'].includes(p.cmd))assert.ok(p.with_check?.includes('auth.uid()'));
        if(p.cmd==='UPDATE')assert.equal(p.qual,p.with_check);
      }
    }
    assert.equal(rows.find(t=>t.table==='projects').columns.find(c=>c.name==='owner_id').notNull,true);
    return rows;
  };
  await check('RLS-19 empty database applies 0001–0007 and validates final catalog',()=>{
    for(const f of migrations)file(fresh,'supabase/migrations/'+f);save('catalog-fresh.json',finalCatalog(fresh));
  });

  for(const f of migrations.slice(0,6))file(upgrade,'supabase/migrations/'+f);
  save('catalog-before.json',catalog(sql,upgrade));
  const old=graph(A);
  const seed=(db,g)=>{for(const t of tables){const row=g[t];sql(db,`insert into public.${t} (${Object.keys(row).join(',')}) values (${Object.values(row).map(v=>`'${(typeof v==='object'?JSON.stringify(v):v).replaceAll("'","''")}'`).join(',')})`);}};
  // Exercise legacy NULL gate without guessing an owner or deleting old data.
  const legacy=randomUUID();sql(upgrade,`insert into public.projects(id,name) values ('${legacy}','unowned')`);
  await check('MIG-01 NULL gate fails atomically with no grants or constraints opened',()=>{
    sqlReject(()=>file(upgrade,migration),/Ownership backfill incomplete/);
    assert.equal(sql(upgrade,"select attnotnull from pg_attribute where attrelid='public.projects'::regclass and attname='owner_id'"),'f');
    for(const t of catalog(sql,upgrade)){assert.equal(t.grants.authenticated,null);assert.equal(t.policies.length,0);}
  });
  file(upgrade,'supabase/operations/backfill-project-owner.sql',[`bootstrap_user_id=${A}`,`project_ids=${JSON.stringify([legacy])}`,'apply=true']);
  seed(upgrade,old);
  const other=graph(B);seed(upgrade,other);
  const snapshot=db=>sql(db,`select jsonb_build_object(${tables.map(t=>`'${t}',(select jsonb_agg(to_jsonb(r) order by id) from public.${t} r)`).join(',')})`);
  const rejectionFixture=(label,setup,expected)=>check(label,()=>{
    const before=snapshot(upgrade);sql(upgrade,setup);
    const damaged=snapshot(upgrade);sqlReject(()=>file(upgrade,migration),expected);
    assert.equal(snapshot(upgrade),damaged,'Failure must not repair/delete data');
    sql(upgrade,`update public.assets set project_id='${old.projects.id}',storage_path='${old.assets.storage_path}' where id='${old.assets.id}'`);
    assert.equal(snapshot(upgrade),before);
  });
  await rejectionFixture('MIG-02 mixed Asset preflight fails without data repair',`update public.assets set project_id='${other.projects.id}' where id='${old.assets.id}'`,/Asset ownership chain mismatch/);
  await rejectionFixture('MIG-03 duplicate path preflight fails without data repair',`update public.assets set storage_path='${other.assets.storage_path}' where id='${old.assets.id}'`,/Duplicate Storage path/);
  await rejectionFixture('MIG-04 invalid path preflight fails without data repair',`update public.assets set storage_path='invalid' where id='${old.assets.id}'`,/Storage path relationship mismatch/);
  file(upgrade,'supabase/operations/finalize-project-owner.sql',['apply=true']);
  const before=snapshot(upgrade);
  await check('RLS-20 Stage C upgrade preserves every column/ID/owner/timestamp in all seven tables',()=>{
    file(upgrade,migration);assert.equal(snapshot(upgrade),before);save('catalog-upgrade.json',finalCatalog(upgrade));
  });
  await check('MIG-05 raw migration repeat refuses policy drift and preserves all data/catalog',()=>{
    const prior=catalog(sql,upgrade);sqlReject(()=>file(upgrade,migration),/Unexpected existing user-data policies/);
    assert.equal(snapshot(upgrade),before);assert.deepEqual(catalog(sql,upgrade),prior);
  });

  // The REST endpoint always uses postgres. Never change PostgREST configuration.
  if(sql('postgres',"select to_regclass('public.projects') is null")==='t') {
    for(const f of migrations.slice(0,6))file('postgres','supabase/migrations/'+f);
  }
  if(sql('postgres',`select count(*) from pg_policies where schemaname='public' and tablename in (${tableList})`)==='0') file('postgres',migration);
  sql('postgres',"notify pgrst, 'reload schema'");
  // Bounded readiness polling is read-only and cannot turn a denial into success.
  for(let attempt=0;attempt<30;attempt++) {
    const r=await a.from('projects').select('id').limit(0);
    if(!r.error)break;
    if(attempt===29)throw Error('PostgREST schema cache not ready');
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  const current=finalCatalog('postgres');save('catalog-after.json',current);
  await check('RLS-16 effective anon/authenticated/service_role grants on seven tables',()=>assert.equal(current.length,7));
  await check('RLS-17 exactly 28 authenticated operation-specific policies with old/new UPDATE checks',()=>assert.equal(current.reduce((n,t)=>n+t.policies.length,0),28));
  await check('RLS-18 all seven tables have RLS enabled',()=>assert.ok(current.every(t=>t.rls)));
  await check('DB-01 trigger function is invoker, fixed search_path, no user/public EXECUTE',()=>{
    const f=JSON.parse(sql('postgres',`select jsonb_build_object('definer',prosecdef,'config',proconfig,'owner',pg_get_userbyid(proowner),'anon',has_function_privilege('anon',oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',oid,'EXECUTE'),'service_role',has_function_privilege('service_role',oid,'EXECUTE')) from pg_proc where oid='public.enforce_ownership_immutability()'::regprocedure`));
    assert.equal(f.definer,false);assert.deepEqual(f.config,['search_path=""']);
    assert.equal(f.anon,false);assert.equal(f.authenticated,false);assert.equal(f.service_role,false);result.triggerFunction=f;
    assert.equal(sql('postgres',`select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where not t.tgisinternal and t.tgfoid='public.enforce_ownership_immutability()'::regprocedure
      and n.nspname='public' and c.relname in (${tableList})`),'7');
  });
  await check('DB-02 Authenticated/anon roles cannot bypass RLS or own public tables',()=>{
    assert.equal(sql('postgres',"select count(*) from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls)"),'0');
    assert.equal(sql('postgres',`select count(*) from pg_tables where schemaname='public' and tablename in (${tableList}) and tableowner in ('anon','authenticated')`),'0');
    assert.equal(sql('postgres',"select has_schema_privilege('authenticated','public','CREATE') or has_schema_privilege('anon','public','CREATE')"),'f');
  });
  await check('DB-04 no residual anon column grants or authenticated REFERENCES grants',()=>{
    assert.equal(sql('postgres',`select count(*) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in (${tableList}) and a.attnum>0 and not a.attisdropped
      and (has_column_privilege('anon',c.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES') or has_column_privilege('authenticated',c.oid,a.attnum,'REFERENCES'))`),'0');
  });
  phase='actual final schema type generation';
  const generated=c.cliRun(['gen','types','typescript','--db-url',c.dbUrl.href,'--schema','public']);
  writeFileSync(join(output,'database.types.ts.txt'),generated);
  // The write-source flag only updates the generated type artifact, never data.
  if(process.argv.includes('--write-types')) {
    const withHint=generated.replace('export type Database = {','export type Database = {\n  __InternalSupabase: {\n    PostgrestVersion: "14.5"\n  }');
    writeFileSync('src/lib/supabase/database.types.ts',withHint.trimEnd()+'\n');
  }
  await check('DB-03 actual generated Row/Insert/Update/Relationships match source',()=>assert.deepEqual(shapes(generated),shapes(readFileSync('src/lib/supabase/database.types.ts','utf8'))));

  const ga=graph(A),gb=graph(B),ga2=graph(A);
  for(const [label,client,g] of [['A',a,ga],['B',b,gb],['A2',a,ga2]]) {
    for(const t of tables)await check(`RLS-15 ${label} own ${t} INSERT`,async()=>assert.equal(okay(await client.from(t).insert(g[t]).select('id').single()).id,g[t].id));
  }
  for(const [label,client,g,foreign] of [['A',a,ga,gb],['B',b,gb,ga]]) {
    for(const t of tables) {
      await check(`RLS-15 ${label} own ${t} SELECT and UPDATE`,async()=>{
        assert.equal(okay(await client.from(t).select('*').eq('id',g[t].id).single()).id,g[t].id);
        const updated=okay(await client.from(t).update(mutate[t]).eq('id',g[t].id).select('*').single());
        for(const [key,value] of Object.entries(mutate[t]))assert.deepEqual(updated[key],value);
      });
      await check(`RLS-13 ${label} exact foreign/missing ${t} read/update/delete yield identical empty results`,async()=>{
        for(const id of [foreign[t].id,randomUUID()]) {
          empty(await client.from(t).select('*').eq('id',id));
          empty(await client.from(t).update(mutate[t]).eq('id',id).select('*'));
          empty(await client.from(t).delete().eq('id',id).select('*'));
        }
      });
    }
  }
  await check('RLS-01 A/B project list visibility is symmetric',async()=>{
    for(const [client,owner,foreign] of [[a,A,gb.projects.id],[b,B,ga.projects.id]]) {
      const rows=okay(await client.from('projects').select('id,owner_id'));
      assert.ok(rows.length>0);assert.ok(rows.every(r=>r.owner_id===owner));assert.ok(rows.every(r=>r.id!==foreign));
    }
  });
  await check('RLS-02 A cannot INSERT spoofed B owner',async()=>denied(await a.from('projects').insert({name:'spoof',owner_id:B})));
  await check('RLS-03 owner transfer rejected at DB',async()=>denied(await a.from('projects').update({owner_id:B}).eq('id',ga.projects.id),'23514'));
  await check('EXTRA foreign Project UPSERT cannot claim its exact ID using own owner_id',async()=>denied(await a.from('projects').upsert({...gb.projects,owner_id:A})));
  await check('EXTRA foreign Asset UPSERT rejected',async()=>denied(await a.from('assets').upsert({...gb.assets,original_filename:'spoof.png'})));
  await check('RLS-04 foreign project DELETE does not affect B',async()=>{empty(await a.from('projects').delete().eq('id',gb.projects.id).select());assert.equal(okay(await b.from('projects').select('id').eq('id',gb.projects.id).single()).id,gb.projects.id);});
  for(const [caseId,t] of [['05','products'],['06','product_facts'],['08','detail_pages'],['09','sections'],['10','product_options']]) {
    await check(`RLS-${caseId} foreign ${t} INSERT and UPSERT rejected`,async()=>{
      denied(await a.from(t).insert({...gb[t],id:randomUUID()}));
      denied(await a.from(t).upsert({...gb[t],...mutate[t]}));
    });
  }
  await check('RLS-08 catalog proves detail_pages has only project_id, no product_id',()=>assert.equal(current.find(t=>t.table==='detail_pages').columns.some(c=>c.name==='product_id'),false));
  for(const [label,project,product] of [['A-project B-product',ga.projects.id,gb.products.id],['B-project A-product',gb.projects.id,ga.products.id],['same-owner different-project',ga.projects.id,ga2.products.id]]) {
    await check(`RLS-07 ${label} mixed Asset INSERT rejected`,async()=>denied(await a.from('assets').insert(newAsset(project,product))));
    await check(`RLS-07 ${label} mixed Asset UPDATE rejected`,async()=>denied(await a.from('assets').update({project_id:project,product_id:product}).eq('id',ga.assets.id),'23514'));
  }
  const parents={products:['project_id','projects'],product_facts:['product_id','products'],assets:['product_id','products'],detail_pages:['project_id','projects'],sections:['detail_page_id','detail_pages'],product_options:['product_id','products']};
  for(const [t,[fk,parent]] of Object.entries(parents)) {
    for(const [label,target] of [['foreign',gb],['same-owner',ga2]])await check(`RLS-14 ${t}.${fk} ${label} reassignment rejected`,async()=>denied(await a.from(t).update({[fk]:target[parent].id}).eq('id',ga[t].id),'23514'));
  }
  await check('RLS-14 assets.project_id reassignment rejected',async()=>denied(await a.from('assets').update({project_id:gb.projects.id}).eq('id',ga.assets.id),'23514'));
  for(const t of tables) {
    await check(`RLS-11 anon ${t} SELECT denied`,async()=>denied(await anon.from(t).select('*').eq('id',ga[t].id)));
    await check(`RLS-12 anon ${t} INSERT/UPDATE/DELETE denied`,async()=>{
      denied(await anon.from(t).insert({...ga[t],id:randomUUID()}));
      denied(await anon.from(t).update(mutate[t]).eq('id',ga[t].id));
      denied(await anon.from(t).delete().eq('id',ga[t].id));
    });
    await check(`EXTRA ${t} primary key mutation rejected`,async()=>denied(await a.from(t).update({id:randomUUID()}).eq('id',ga[t].id),'23514'));
    await check(`EXTRA ${t} B data survives all A/anon attacks unchanged`,async()=>{
      const row=okay(await b.from(t).select('*').eq('id',gb[t].id).single());
      for(const [key,value] of Object.entries({...gb[t],...mutate[t]}))assert.deepEqual(row[key],value);
    });
  }
  await check('EXTRA owned same-value parent UPSERT remains compatible',async()=>{
    const row=okay(await a.from('products').upsert({...ga.products,name:'upserted'}).select().single());assert.equal(row.name,'upserted');
  });
  await check('EXTRA Asset storage path immutable',async()=>denied(await a.from('assets').update({storage_path:ga.assets.storage_path.replace('.png','.jpg')}).eq('id',ga.assets.id),'23514'));
  await check('EXTRA Asset invalid storage path INSERT rejected',async()=>denied(await a.from('assets').insert({...newAsset(ga.projects.id,ga.products.id),storage_path:gb.assets.storage_path}),'23514'));
  await check('EXTRA privileged composite FK sanity (not RLS acceptance)',()=>{
    sqlReject(()=>sql('postgres',`insert into public.assets(id,project_id,product_id,storage_path,original_filename) values ('${randomUUID()}','${ga.projects.id}','${ga2.products.id}','invalid','fixture')`),/23514/);
    const row=newAsset(ga.projects.id,ga2.products.id);
    sqlReject(()=>sql('postgres',`insert into public.assets(id,project_id,product_id,storage_path,original_filename) values ('${row.id}','${row.project_id}','${row.product_id}','${row.storage_path}','fixture')`),/23503/);
  });
  await check('EXTRA ownerless project INSERT cannot fall back to an implicit owner',async()=>denied(await a.from('projects').insert({name:'ownerless'})));
  // Direct delete proof for every table and both principals, in reverse FK order.
  for(const [label,client,g] of [['A',a,ga],['B',b,gb]]) {
    for(const t of [...tables].reverse())await check(`RLS-15 ${label} own ${t} DELETE`,async()=>{
      assert.equal(okay(await client.from(t).delete().eq('id',g[t].id).select('id').single()).id,g[t].id);
      empty(await client.from(t).select('id').eq('id',g[t].id));
    });
  }
  await check('EXTRA own root DELETE cascades only its owned graph',async()=>{
    okay(await a.from('projects').delete().eq('id',ga2.projects.id).select().single());
    for(const t of tables)empty(await a.from(t).select('id').eq('id',ga2[t].id));
  });
  // Auth cleanup is local fixture administration, not a RLS verdict. Isolated
  // clone databases/volumes retain migration evidence; no pre-existing data drops.
  for(const {client,id} of identities) {
    assert.equal((await client.auth.signOut()).error,null);
    assert.equal((await bootstrap.auth.admin.deleteUser(id)).error,null);
  }
  result.cleanup={restGraphsDeletedByOwners:3,localAuthUsersDeleted:2,clonedDatabasesRetained:true};
  result.matrix=Object.fromEntries(Array.from({length:20},(_,i)=>[`RLS-${String(i+1).padStart(2,'0')}`,'PASS']));
  result.matrixNotes={'RLS-08':'No product_id on detail_pages; dual-scope subcase N/A, real project-scoped attacks PASS'};
  result.status='PASS';result.checkCount=checks.length;
} catch(error) {
  result.status='FAIL';result.failedPhase=phase;
  let detail=String(error.stderr??error.message??'Runtime failed');
  for(const secret of secrets)detail=detail.replaceAll(secret,'[REDACTED]');
  detail=detail.replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[REDACTED DB URL]');
  result.failure=detail.slice(0,2000);process.exitCode=1;
}
save('runtime.json',result);
console.log(JSON.stringify({status:result.status,checkCount:checks.length,failedPhase:result.failedPhase,failure:result.failure,matrix:result.matrix,cleanup:result.cleanup},null,2));

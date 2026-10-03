// Actual PostgreSQL rehearsal. Only isolated TASK-065 databases are created/dropped.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
import {connectLocal,output} from './helpers/release-local.mjs';
mkdirSync(output,{recursive:true});
const {sql,platform,local}=connectLocal(),run=randomUUID().replaceAll('-','').slice(0,12),fresh='df065_fresh_'+run,upgrade='df065_upgrade_'+run;
const report={status:'RUNNING',checks:[],remoteMutations:0},migrations=readdirSync('supabase/migrations').filter(f=>/^\d.*sql$/.test(f)).sort();
const hash=v=>createHash('sha256').update(v).digest('hex');
const check=(name,fn)=>{fn();report.checks.push({name,status:'PASS'});};
const apply=(db,files)=>{for(const file of files)sql(readFileSync('supabase/migrations/'+file,'utf8'),db);};
const tables=['projects','products','product_facts','product_options','assets','detail_pages','sections'];
const dump=db=>{
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG')));
 Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:'58922',PGUSER:'supabase_admin',PGPASSWORD:decodeURIComponent(new URL(local.DB_URL).password)});
 return execFileSync(join(process.env.PG_BIN??'C:/Program Files/PostgreSQL/18/bin','pg_dump.exe'),['-h','127.0.0.1','-p','58922','-d',db,'--schema-only','--schema=public','--schema=app_private','--schema=storage'],{env,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).split('\n').filter(l=>!/^\\(?:un)?restrict /.test(l)).join('\n');
};
try{
 check('MIG-01 exact ordered chain 0001–0010 and unchanged v0.2.1 migration bytes',()=>{assert.equal(migrations.length,10);migrations.forEach((f,i)=>assert.equal(+f.slice(0,4),i+1));for(const file of migrations.slice(0,5)){const before=execFileSync('git',['show','v0.2.1:supabase/migrations/'+file]);assert.equal(hash(before),hash(execFileSync('git',['show','HEAD:supabase/migrations/'+file])));}});
 const bootstrap=platform();
 for(const db of [fresh,upgrade]){sql(`create database ${db} template template0`);sql(bootstrap,db);sql('create schema if not exists public;grant usage on schema public to anon,authenticated,service_role;',db);}
 check('MIG-02 fresh all ten migrations apply',()=>apply(fresh,migrations));
 check('MIG-03 upgrade v0.2.1 chain 0001–0005 applies',()=>apply(upgrade,migrations.slice(0,5)));
 const p=randomUUID(),q=randomUUID(),a=randomUUID(),d=randomUUID(),owner=randomUUID(),path=`projects/${p}/products/${q}/${a}.png`;
 sql(`insert into auth.users(id) values('${owner}');insert into public.projects(id,name) values('${p}','release legacy');
 insert into public.products(id,project_id,name) values('${q}','${p}','legacy product');
 insert into public.product_facts(product_id,facts) values('${q}','{"productName":"legacy product"}');
 insert into public.product_options(product_id) values('${q}');
 insert into public.assets(id,project_id,product_id,storage_path,original_filename) values('${a}','${p}','${q}','${path}','legacy.png');
 insert into public.detail_pages(id,project_id) values('${d}','${p}');insert into public.sections(detail_page_id,type) values('${d}','hero');
 insert into storage.buckets(id,name,public) values('product-assets','product-assets',false) on conflict(id) do nothing;
 insert into storage.objects(bucket_id,name,metadata) values('product-assets','${path}','{"size":123,"mimetype":"image/png"}');`,upgrade);
 const snapshot=()=>sql(`select jsonb_build_object(${tables.map(t=>`'${t}',(select jsonb_agg(to_jsonb(r)${t==='projects'?"-'owner_id'-'updated_at'":''} order by id) from public.${t} r)`).join(',')},'objects',(select jsonb_agg(to_jsonb(r) order by id) from storage.objects r))`,upgrade),before=snapshot();
 apply(upgrade,[migrations[5]]);
 check('MIG-04 missing ownership blocks 0007 atomically',()=>{let error;try{apply(upgrade,[migrations[6]]);}catch(e){error=e;}assert.ok(error);assert.match(String(error.stderr),/Ownership backfill incomplete/);assert.equal(sql("select count(*) from pg_policies where schemaname='public'",upgrade),'0');});
 check('MIG-05 explicit existing-project allowlist backfill',()=>{const command=`\\set bootstrap_user_id '${owner}'\n\\set project_ids '["${p}"]'\n\\set apply true\n`+readFileSync('supabase/operations/backfill-project-owner.sql','utf8');sql(command,upgrade);assert.equal(sql(`select owner_id from public.projects where id='${p}'`,upgrade),owner);});
 check('MIG-06 upgrade 0007–0010 applies with legacy rows and object metadata',()=>apply(upgrade,migrations.slice(6)));
 check('MIG-07 all legacy business content and object metadata preserved',()=>assert.equal(snapshot(),before));
 const one=dump(fresh),two=dump(upgrade);writeFileSync(join(output,'schema-fresh.sql'),one);writeFileSync(join(output,'schema-upgrade.sql'),two);
 check('MIG-08 full public/app_private/storage schema DDL identical (only pg_dump random restrict nonce removed)',()=>assert.equal(one,two));
 const bucket=db=>sql("select to_jsonb(b)-'created_at'-'updated_at' from storage.buckets b where id='product-assets'",db);
 check('MIG-09 bucket configuration identical/private/10MiB',()=>{assert.equal(bucket(fresh),bucket(upgrade));const b=JSON.parse(bucket(fresh));assert.equal(b.public,false);assert.equal(b.file_size_limit,10485760);assert.deepEqual(b.allowed_mime_types,['image/jpeg','image/png','image/webp']);report.bucket=b;});
 report.catalog=JSON.parse(sql(`set search_path=pg_catalog;select jsonb_build_object('tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner)) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','app_private')),'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in('public','app_private','storage')),'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'signature',pg_get_function_identity_arguments(p.oid),'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text) order by n.nspname,p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','app_private')))`,fresh));
 check('MIG-10 seven public tables RLS enabled,28 CRUD policies,5 storage policies and empty admission limits',()=>{assert.equal(report.catalog.tables.filter(t=>t.schema==='public'&&t.rls).length,7);assert.equal(report.catalog.policies.filter(p=>p.schemaname==='public').length,28);assert.equal(report.catalog.policies.filter(p=>p.schemaname==='storage').length,5);assert.equal(sql('select count(*) from app_private.admission_limits',fresh),'0');});
 report.migrations=migrations.map(f=>({file:f,sha256:hash(readFileSync('supabase/migrations/'+f))}));report.schemaSha256=hash(one);report.schemaDrift=0;report.serverVersion=sql('show server_version');report.legacyGraphRows=7;report.objectEvidence='Legacy storage.objects metadata preserved; actual object bytes/upgrade separately covered by TASK-059 runtime';report.status='PASS';
}catch(error){report.status='FAIL';report.failure=String(error.stderr??error.stack).slice(0,4000);process.exitCode=1;}
finally{for(const db of [fresh,upgrade]){assert.match(db,/^df065_(fresh|upgrade)_[a-f0-9]{12}$/);sql(`drop database if exists ${db} with(force)`);}report.scratchDatabasesRemoved=true;writeFileSync(join(output,'migration-runtime.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks.length,drift:report.schemaDrift,failure:report.failure}));}

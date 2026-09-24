// TASK-057A: opt-in local Supabase runtime verification, never the linked project.
// Start the isolated cache project described in docs/tasks/TASK-057A.md first.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import ts from 'typescript';

const workdir=resolve('node_modules/.cache/task057a/local'),out=resolve('artifacts/TASK-057A');
mkdirSync(out,{recursive:true});
assert.match(readFileSync(join(workdir,'supabase/config.toml'),'utf8'),/^project_id = "detailforge-task057a"$/m);
const cli=resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
const pgBin=process.env.PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin';
const cliRun=args=>execFileSync(cli,[...args,'--workdir',workdir],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:120000,maxBuffer:16*1024*1024});
const local=JSON.parse(cliRun(['status','-o','json']));
const api=new URL(local.API_URL),dbUrl=new URL(local.DB_URL);
assert.equal(api.origin,'http://127.0.0.1:56321');assert.equal(dbUrl.hostname,'127.0.0.1');assert.equal(dbUrl.port,'56322');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('PG')));
// Supabase's postgres role is intentionally not a superuser. Cloning the platform
// bootstrap DDL needs its local-only administrator; application SQL is unchanged.
Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:'56322',PGUSER:'supabase_admin',PGPASSWORD:decodeURIComponent(dbUrl.password),PGCLIENTENCODING:'UTF8'});
const exec=(name,args,input)=>execFileSync(join(pgBin,name+'.exe'),args,{env,input,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe'],timeout:60000,maxBuffer:32*1024*1024});
const psql=(db,args,input)=>exec('psql',['-X','-q','-A','-t','-w','-h','127.0.0.1','-p','56322','-d',db,'-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose',...args],input).trim();
const sql=(db,text)=>psql(db,[],text);
const file=(db,path,vars=[])=>psql(db,[...vars.flatMap(v=>['-v',v]),'-f',resolve(path)]);
const backfill=(db,user,ids,apply=false)=>JSON.parse(file(db,'supabase/operations/backfill-project-owner.sql',[`bootstrap_user_id=${user}`,`project_ids=${JSON.stringify(ids)}`,`apply=${apply}`]));
const final=(db,apply=false)=>JSON.parse(file(db,'supabase/operations/finalize-project-owner.sql',[`apply=${apply}`]));
const checks=[];let phase='preflight';
const check=(name,fn)=>{phase=name;fn();checks.push({name,status:'PASS'});};
const reject=(fn,expected)=>{let caught;try{fn();}catch(error){caught=error;}assert.ok(caught,'Expected database rejection');assert.match(String(caught.stderr??caught.message),expected);};
const run=randomUUID().replaceAll('-','').slice(0,12),fresh='df057a_fresh_'+run,upgrade='df057a_upgrade_'+run;
const PA=randomUUID(),PB=randomUUID(),OWNED=randomUUID(),absent=randomUUID();
const result={status:'RUNNING',run,databases:{fresh,upgrade},checks,remoteDbMutations:0,remoteAuthMutations:0};
try{
  check('unlinked isolated baseline has no application projects table',()=>assert.equal(sql('postgres',"select to_regclass('public.projects') is null"),'t'));
  result.serverVersion=sql('postgres','show server_version');
  phase='real local Auth API bootstrap';
  const auth=createClient(api.origin,local.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{
    const target=new URL(typeof input==='string'?input:input.url);assert.equal(target.origin,api.origin);return fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(10000)});
  }}});
  const users=[];
  for(const label of ['a','b']){
    const {data,error}=await auth.auth.admin.createUser({email:`user-${label}-${run}@example.test`,password:'Local-fixture-'+randomUUID(),email_confirm:true});
    assert.equal(error,null);assert.ok(data.user?.id);users.push(data.user.id);
  }
  const [A,B]=users;result.localAuthUsersCreated=2;
  check('two users created through actual loopback GoTrue API',()=>assert.equal(sql('postgres',`select count(*) from auth.users where id in ('${A}','${B}')`),'2'));
  phase='clone genuine Supabase bootstrap schema and API-created auth fixtures';
  // Capture in memory only: Auth data contains password hashes and must not be logged.
  const schema=exec('pg_dump',['-h','127.0.0.1','-p','56322','-d','postgres','--schema-only','--no-owner','--no-privileges']);
  const authData=exec('pg_dump',['-h','127.0.0.1','-p','56322','-d','postgres','--data-only','--no-owner','--no-privileges','--table=auth.users','--table=auth.identities']);
  for(const db of [fresh,upgrade]){sql('postgres',`create database ${db} template template0`);sql(db,schema);sql(db,authData);}
  const migrations=readdirSync('supabase/migrations').filter(f=>/^000[1-6]_.*\.sql$/.test(f)).sort();assert.equal(migrations.length,6);
  check('fresh applies all six unmodified migrations',()=>{for(const name of migrations)file(fresh,'supabase/migrations/'+name);});
  check('fresh has zero null-owner rows',()=>assert.equal(JSON.parse(file(fresh,'supabase/operations/audit-project-owner.sql')).nullOwnerProjects,0));
  check('owner UUID FK is RESTRICT and exactly one owner index exists',()=>{
    assert.equal(sql(fresh,"select confdeltype from pg_constraint where conname='projects_owner_id_fkey'"),'r');
    assert.equal(sql(fresh,"select count(*) from pg_indexes where schemaname='public' and tablename='projects'"),'2');
    assert.match(sql(fresh,"select indexdef from pg_indexes where indexname='projects_owner_id_idx'"),/\(owner_id\)/);
  });
  phase='generate Stage A types from actual local schema';
  const typesUrl=new URL(dbUrl);typesUrl.pathname='/'+fresh;
  const generated=cliRun(['gen','types','typescript','--db-url',typesUrl.href,'--schema','public']);
  writeFileSync(join(out,'database.stage-a.types.ts.txt'),generated);
  const shapes=text=>{
    const sf=ts.createSourceFile('db.ts',text,99,true);const node=sf.statements.find(n=>ts.isTypeAliasDeclaration(n)&&n.name.text==='Database');
    const member=(n,key)=>n.members.find(m=>m.name?.getText(sf).replaceAll('"','')===key).type;
    const tables=member(member(node.type,'public'),'Tables');const data={};
    for(const table of tables.members){const name=table.name.getText(sf).replaceAll('"','');data[name]={};
      for(const kind of ['Row','Insert','Update','Relationships'])data[name][kind]=member(table.type,kind).getText(sf).replace(/\s|;/g,'');}
    return data;
  };
  check('actual generated public table Row Insert Update Relationships match checked-in types',()=>assert.deepEqual(shapes(generated),shapes(readFileSync('src/lib/supabase/database.types.ts','utf8'))));
  result.databaseTypes='Stage A public table shapes match; generator metadata reported separately';
  check('fresh finalize dry-run does not enforce NOT NULL',()=>assert.equal(final(fresh).notNull,false));
  check('fresh finalize applies NOT NULL',()=>assert.equal(final(fresh,true).notNull,true));
  check('fresh rejects missing owner after finalize',()=>reject(()=>sql(fresh,"insert into public.projects(name) values ('missing')"),/23502/));
  check('fresh valid real Auth fixture owner allowed',()=>sql(fresh,`insert into public.projects(name,owner_id) values ('owned','${A}')`));
  check('fresh FK rejects nonexistent auth user',()=>reject(()=>sql(fresh,`insert into public.projects(name,owner_id) values ('missing user','${absent}')`),/23503/));
  check('fresh user deletion RESTRICT preserves project',()=>{reject(()=>sql(fresh,`delete from auth.users where id='${A}'`),/23503/);assert.equal(sql(fresh,'select count(*) from public.projects'),'1');});
  check('zero-row backfill is safe',()=>assert.equal(backfill(fresh,A,[],true).updated,0));
  check('v0.2.1 baseline migrations 0001 through 0005 apply',()=>{for(const name of migrations.slice(0,5))file(upgrade,'supabase/migrations/'+name);});
  phase='legacy full graph fixture';
  sql(upgrade,`insert into public.projects(id,name) values ('${PA}','legacy A'),('${PB}','legacy B'),('${OWNED}','owned B');
    insert into public.products(id,project_id,name) values ('${PA}','${PA}','product');
    insert into public.product_facts(product_id,facts) values ('${PA}','{"fixture":true}');
    insert into public.product_options(product_id) values ('${PA}');
    insert into public.assets(id,project_id,product_id,storage_path,original_filename) values ('${PA}','${PA}','${PA}','projects/${PA}/products/${PA}/${PA}.jpg','fixture.jpg');
    insert into public.detail_pages(id,project_id) values ('${PA}','${PA}');
    insert into public.sections(detail_page_id,type) values ('${PA}','hero');`);
  const snapshot=()=>sql(upgrade,`select jsonb_build_object(${['products','product_facts','product_options','assets','detail_pages','sections'].map(t=>`'${t}',(select jsonb_agg(to_jsonb(t) order by id) from public.${t} t)`).join(',')})`);
  const childBefore=snapshot();
  const rootsBefore=sql(upgrade,"select jsonb_agg(to_jsonb(p)-'owner_id'-'updated_at' order by id) from public.projects p");
  check('upgrade preserves legacy rows in nullable stage',()=>{file(upgrade,'supabase/migrations/0006_add_project_owner.sql');assert.equal(sql(upgrade,'select count(*) from public.projects where owner_id is null'),'3');});
  sql(upgrade,`update public.projects set owner_id='${B}' where id='${OWNED}'`);
  const ownedBefore=sql(upgrade,`select to_jsonb(p) from public.projects p where id='${OWNED}'`);
  result.nullRowsBefore=2;
  check('actual dry-run leaves two null rows unchanged',()=>{const r=backfill(upgrade,A,[PA,PB]);assert.equal(r.updated,0);assert.equal(r.nullOwnerProjects,2);assert.equal(r.eligibleProjects,2);});
  check('null-owner final gate fails closed',()=>reject(()=>final(upgrade,true),/Ownership backfill incomplete/));
  check('failed final gate leaves nullable constraint unchanged',()=>assert.equal(sql(upgrade,"select attnotnull from pg_attribute where attrelid='public.projects'::regclass and attname='owner_id'"),'f'));
  check('invalid UUID rejected',()=>reject(()=>backfill(upgrade,'bad',[PA,PB],true),/invalid input syntax for type uuid/));
  check('nonexistent user rejected',()=>reject(()=>backfill(upgrade,absent,[PA,PB],true),/Bootstrap auth user not found/));
  check('incomplete allowlist rejected',()=>reject(()=>backfill(upgrade,A,[PA],true),/Unowned projects missing/));
  check('existing owner cannot be overwritten',()=>reject(()=>backfill(upgrade,A,[PA,PB,OWNED],true),/Existing ownership conflicts/));
  check('duplicate allowlist rejected',()=>reject(()=>backfill(upgrade,A,[PA,PA,PB],true),/Duplicate project allowlist/));
  check('unknown allowlist entry rejected',()=>reject(()=>backfill(upgrade,A,[PA,PB,absent],true),/Unknown project allowlist/));
  check('negative runs left all project owners unchanged',()=>assert.equal(sql(upgrade,'select count(*) from public.projects where owner_id is null'),'2'));
  check('actual backfill changes only two null-owner rows',()=>{const r=backfill(upgrade,A,[PA,PB],true);assert.equal(r.updated,2);assert.equal(r.nullOwnerProjects,0);assert.equal(r.distinctOwners,2);result.nullRowsAfter=r.nullOwnerProjects;result.backfillUpdated=r.updated;});
  check('idempotent rerun changes zero rows',()=>assert.equal(backfill(upgrade,A,[PA,PB],true).updated,0));
  check('previous owned row and timestamp remain exact',()=>assert.equal(sql(upgrade,`select to_jsonb(p) from public.projects p where id='${OWNED}'`),ownedBefore));
  check('all child content and project non-owner fields preserved',()=>{assert.equal(snapshot(),childBefore);assert.equal(sql(upgrade,"select jsonb_agg(to_jsonb(p)-'owner_id'-'updated_at' order by id) from public.projects p"),rootsBefore);});
  check('finalize after backfill and repeat finalize succeed',()=>{assert.equal(final(upgrade,true).notNull,true);assert.equal(final(upgrade,true).notNull,true);});
  check('NOT NULL rejects new ownerless Project',()=>reject(()=>sql(upgrade,"insert into public.projects(name) values ('ownerless')"),/23502/));
  check('final ownership audit all gates zero',()=>{const a=JSON.parse(file(upgrade,'supabase/operations/audit-project-owner.sql'));assert.equal(a.nullOwnerProjects,0);assert.equal(a.assetProjectMismatches,0);assert.equal(a.duplicateStoragePaths,0);assert.equal(a.storagePathMismatches,0);result.audit=a;});
  check('no application RLS policies were added',()=>assert.equal(sql(upgrade,"select count(*) from pg_policies where schemaname='public' and tablename in ('projects','products','product_facts','assets','detail_pages','sections','product_options')"),'0'));
  phase='generate and compare finalized Stage C owner type';
  typesUrl.pathname='/'+upgrade;
  const finalizedTypes=cliRun(['gen','types','typescript','--db-url',typesUrl.href,'--schema','public']);
  writeFileSync(join(out,'database.stage-c.types.ts.txt'),finalizedTypes);
  check('Stage C generated owner is required/non-null; expected difference from Stage A source',()=>{
    const owner=shapes(finalizedTypes).projects;
    assert.match(owner.Row,/owner_id:string(?!\|null)/);
    assert.match(owner.Insert,/owner_id:string(?!\|null)/);
    assert.doesNotMatch(owner.Insert,/owner_id\?/);
  });
  result.finalizedTypes='Stage C owner_id is string and Insert required; source remains Stage A until final rollout';
  result.status='PASS';result.checkCount=checks.length;result.migrationChanges=0;
}catch(error){
  result.status='FAIL';result.failedPhase=phase;
  // Only synthetic local fixtures are used. Redact all known local credentials/URLs.
  let detail=String(error.stderr??error.message??'Runtime failure');
  for(const value of Object.values(local))if(typeof value==='string'&&value.length>12)detail=detail.replaceAll(value,'[REDACTED]');
  detail=detail.replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[REDACTED DB URL]');
  result.failure=detail.slice(0,3000);process.exitCode=1;
}
writeFileSync(join(out,'runtime.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));

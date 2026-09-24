// Opt-in real PostgreSQL rehearsal. No remote URL, existing DB, or app env input.
// Requires a complete PostgreSQL installation (PG_BIN may locate its bin folder).
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { A,B,PA,PB,LEGACY } from './helpers/ownership-db.mjs';
const bin=process.env.PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin';
const out=resolve('artifacts/TASK-057');mkdirSync(out,{recursive:true});
if(!existsSync(join(dirname(bin),'share/postgres.bki'))){
  const result={status:'NOT_RUN',reason:'Complete local PostgreSQL installation unavailable (postgres.bki missing).',remoteMutations:0};
  writeFileSync(join(out,'postgres.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));process.exit(2);
}
const root=resolve('node_modules/.cache/task057/pg-'+randomUUID()),data=join(root,'data');mkdirSync(root,{recursive:true});
const ext=process.platform==='win32'?'.exe':'';
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('PG')));
Object.assign(env,{PGHOST:'127.0.0.1',PGUSER:'postgres',PGDATABASE:'postgres'});
const exec=(name,args)=>execFileSync(join(bin,name+ext),args,{env,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:60000});
const net=createServer();await new Promise(r=>net.listen(0,'127.0.0.1',r));const port=net.address().port;await new Promise(r=>net.close(r));env.PGPORT=String(port);
const psql=(db,args)=>exec('psql',['-X','-q','-A','-t','-w','-h','127.0.0.1','-p',String(port),'-U','postgres','-d',db,'-v','ON_ERROR_STOP=1',...args]);
const sql=(db,text)=>psql(db,['-c',text]).trim();
const file=(db,path,vars=[])=>psql(db,[...vars.flatMap(v=>['-v',v]),'-f',resolve(path)]).trim();
const backfill=(db,user,ids,apply=false)=>JSON.parse(file(db,'supabase/operations/backfill-project-owner.sql',[`bootstrap_user_id=${user}`,`project_ids=${JSON.stringify(ids)}`,`apply=${apply}`]));
const final=(db,apply=false)=>JSON.parse(file(db,'supabase/operations/finalize-project-owner.sql',[`apply=${apply}`]));
let started=false,checks=0;
const check=fn=>{fn();checks++;};
try{
  exec('initdb',['-D',data,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']);
  exec('pg_ctl',['-D',data,'-l',join(root,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
  sql('postgres','create role anon; create role authenticated; create role service_role bypassrls;');
  const setup=db=>{
    sql('postgres',`create database ${db}`);
    sql(db,'create schema extensions; create schema auth; create table auth.users(id uuid primary key); create schema storage; create table storage.buckets(id text primary key,name text,public boolean);');
    for(const f of readdirSync('supabase/migrations').filter(f=>/^000[1-5]_/.test(f)).sort())file(db,'supabase/migrations/'+f);
  };
  setup('own_fresh');file('own_fresh','supabase/migrations/0006_add_project_owner.sql');
  check(()=>assert.equal(final('own_fresh',true).notNull,true));
  check(()=>assert.throws(()=>sql('own_fresh',"insert into public.projects(name) values ('no owner')")));
  sql('own_fresh',`insert into auth.users values ('${A}');`);
  check(()=>assert.equal(backfill('own_fresh',A,[],true).updated,0));
  sql('own_fresh',`insert into public.projects(name,owner_id) values ('owned','${A}');`);
  check(()=>assert.throws(()=>sql('own_fresh',`delete from auth.users where id='${A}'`)));
  check(()=>assert.equal(sql('own_fresh',"select count(*) from pg_indexes where indexname='projects_owner_id_idx'"),'1'));
  setup('own_upgrade');
  sql('own_upgrade',`insert into auth.users values ('${A}'),('${B}'); insert into public.projects(id,name) values ('${PA}','legacy A'),('${PB}','legacy B'),('${LEGACY}','already owned');`);
  // Full child graph, including Asset bytes reference: migrations never touch it.
  sql('own_upgrade',`insert into public.products(id,project_id,name) values ('${PA}','${PA}','product');
    insert into public.product_facts(product_id,facts) values ('${PA}','{"fixture":true}');
    insert into public.product_options(product_id) values ('${PA}');
    insert into public.assets(id,project_id,product_id,storage_path,original_filename) values ('${PA}','${PA}','${PA}','projects/${PA}/products/${PA}/${PA}.jpg','fixture.jpg');
    insert into public.detail_pages(id,project_id) values ('${PA}','${PA}');
    insert into public.sections(detail_page_id,type) values ('${PA}','hero');`);
  const snapshot=()=>sql('own_upgrade',`select jsonb_build_object(${['products','product_facts','product_options','assets','detail_pages','sections'].map(t=>`'${t}',(select jsonb_agg(to_jsonb(t) order by id) from public.${t} t)`).join(',')})`);
  const before=snapshot();file('own_upgrade','supabase/migrations/0006_add_project_owner.sql');
  sql('own_upgrade',`update public.projects set owner_id='${B}' where id='${LEGACY}';`);
  check(()=>assert.equal(backfill('own_upgrade',A,[PA,PB]).updated,0));
  check(()=>assert.equal(sql('own_upgrade','select count(*) from public.projects where owner_id is null'),'2'));
  check(()=>assert.throws(()=>final('own_upgrade',true)));
  check(()=>assert.throws(()=>backfill('own_upgrade','bad',[PA,PB],true)));
  check(()=>assert.throws(()=>backfill('own_upgrade','10000000-0000-4000-8000-000000000099',[PA,PB],true)));
  check(()=>assert.throws(()=>backfill('own_upgrade',A,[PA],true)));
  check(()=>assert.throws(()=>backfill('own_upgrade',A,[PA,PB,LEGACY],true)));
  check(()=>assert.throws(()=>backfill('own_upgrade',A,[PA,PA,PB],true)));
  check(()=>assert.equal(backfill('own_upgrade',A,[PA,PB],true).updated,2));
  check(()=>assert.equal(backfill('own_upgrade',A,[PA,PB],true).updated,0));
  check(()=>assert.equal(sql('own_upgrade',`select owner_id from public.projects where id='${LEGACY}'`),B));
  check(()=>assert.equal(snapshot(),before));
  check(()=>assert.equal(final('own_upgrade',true).notNull,true));
  check(()=>assert.equal(sql('own_upgrade','select count(*) from pg_policies where schemaname=\'public\''),'0'));
  const result={status:'PASS',checks,engine:'local PostgreSQL with minimal auth.users/storage.buckets schema fixtures; not Supabase Auth/RLS E2E',remoteMutations:0};
  writeFileSync(join(out,'postgres.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch{
  writeFileSync(join(out,'postgres.json'),JSON.stringify({status:'FAIL',checks,reason:'Local rehearsal failed; inspect only the isolated test cluster.',remoteMutations:0},null,2)+'\n');
  process.exitCode=1;
}finally{if(started)exec('pg_ctl',['-D',data,'-m','fast','-w','stop']);}

// Local-only fixture administration. Never load .env.local or a linked project.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';

export const tables = ['projects','products','product_facts','assets','detail_pages','sections','product_options'];
export const workdir = resolve('node_modules/.cache/task058/local');
export const output = resolve('artifacts/TASK-058');
export const migration = 'supabase/migrations/0007_enforce_database_ownership.sql';
const cli = resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
export function connectLocal() {
  assert.match(readFileSync(join(workdir,'supabase/config.toml'),'utf8'),/^project_id = "detailforge-task058"$/m);
  const cliRun = args => execFileSync(cli,[...args,'--workdir',workdir],{
    encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:120000,maxBuffer:32*1024*1024,
  });
  const local = JSON.parse(cliRun(['status','-o','json']));
  const api = new URL(local.API_URL), dbUrl = new URL(local.DB_URL);
  assert.equal(api.origin,'http://127.0.0.1:57321');
  assert.equal(dbUrl.hostname,'127.0.0.1'); assert.equal(dbUrl.port,'57322');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('PG')));
  Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:'57322',PGUSER:'supabase_admin',PGPASSWORD:decodeURIComponent(dbUrl.password),PGCLIENTENCODING:'UTF8'});
  const pg = (name,args,input) => execFileSync(join(process.env.PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin',name+'.exe'),args,{
    env,input,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe'],timeout:60000,maxBuffer:32*1024*1024,
  });
  const psql = (db,args,input) => pg('psql',['-X','-q','-A','-t','-w','-h','127.0.0.1','-p','57322','-d',db,'-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose',...args],input).trim();
  const sql = (db,text) => psql(db,[],text);
  const file = (db,path,vars=[]) => psql(db,[...vars.flatMap(v=>['-v',v]),'-f',resolve(path)]);
  const dump = args => pg('pg_dump',['-h','127.0.0.1','-p','57322','-d','postgres','--no-owner','--no-privileges',...args]);
  const guardedFetch = (input,init) => {
    const target = new URL(typeof input === 'string' ? input : input.url);
    assert.equal(target.origin,api.origin,'Non-local network target denied');
    return fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});
  };
  return {local,api,dbUrl,cliRun,sql,file,dump,guardedFetch};
}

export function catalog(sql,db) {
  return JSON.parse(sql(db,`set search_path = pg_catalog; select jsonb_agg(jsonb_build_object(
    'table', c.relname, 'rls', c.relrowsecurity,
    'columns', (select jsonb_agg(jsonb_build_object('name',a.attname,'notNull',a.attnotnull,'type',format_type(a.atttypid,a.atttypmod)) order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
    'constraints', (select jsonb_agg(jsonb_build_object('name',k.conname,'type',k.contype,'definition',pg_get_constraintdef(k.oid)) order by k.conname) from pg_constraint k where k.conrelid=c.oid),
    'indexes', (select jsonb_agg(indexdef order by indexname) from pg_indexes where schemaname='public' and tablename=c.relname),
    'policies', (select coalesce(jsonb_agg(to_jsonb(p) order by policyname),'[]') from pg_policies p where p.schemaname='public' and p.tablename=c.relname),
    'grants', (select jsonb_object_agg(r, (select jsonb_agg(priv order by priv) from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) priv where has_table_privilege(r,c.oid,priv))) from unnest(array['anon','authenticated','service_role']) r)
  ) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in (${tables.map(t=>`'${t}'`).join(',')})`));
}

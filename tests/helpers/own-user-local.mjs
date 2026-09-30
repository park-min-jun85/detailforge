import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
export const appOrigin='http://127.0.0.1:3064',apiOrigin='http://127.0.0.1:58821',mailOrigin='http://127.0.0.1:58824';
export const output=resolve('artifacts/TASK-064'),workdir=resolve('node_modules/.cache/task064/local');
export function localTarget(value) {
  const url=new URL(value);assert.ok([appOrigin,apiOrigin,mailOrigin].includes(url.origin),'Nonlocal Own-user target rejected');
  assert.equal(url.username,'');assert.equal(url.password,'');return url;
}
export const localFetch=(input,init)=>{localTarget(typeof input==='string'||input instanceof URL?input:input.url);
  return fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});};
export function connectLocal(){
  assert.equal(existsSync(join(workdir,'supabase/.temp/project-ref')),false,'Linked project refused');
  assert.match(readFileSync(join(workdir,'supabase/config.toml'),'utf8'),/^project_id = "detailforge-task064"$/m);
  const cli=resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
  const local=JSON.parse(execFileSync(cli,['status','-o','json','--workdir',workdir],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}));
  assert.equal(local.API_URL,apiOrigin);const db=new URL(local.DB_URL);
  assert.equal(db.protocol,'postgresql:');assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'58822');
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG')));
  Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:'58822',PGUSER:'supabase_admin',PGPASSWORD:decodeURIComponent(db.password),PGCLIENTENCODING:'UTF8'});
  const sql=(text,database='postgres')=>{
    assert.match(database,/^(postgres|df064_[a-z0-9_]+)$/);
    return execFileSync(join(process.env.PG_BIN??'C:/Program Files/PostgreSQL/18/bin','psql.exe'),
      ['-X','-q','-A','-t','-w','-h','127.0.0.1','-p','58822','-d',database,'-v','ON_ERROR_STOP=1'],
      {env,input:text,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe'],timeout:60000,maxBuffer:32*1024*1024}).trim();
  };
  const platform=()=>execFileSync(join(process.env.PG_BIN??'C:/Program Files/PostgreSQL/18/bin','pg_dump.exe'),
    ['-h','127.0.0.1','-p','58822','-d','postgres','--schema-only','--exclude-schema=public','--exclude-schema=app_private'],
    {env,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:32*1024*1024});
  return {local,sql,platform};
}

// TASK-061 only. Credentials remain in CLI memory; never load .env.local.
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const action=process.argv[2],workdir=resolve('node_modules/.cache/task061/local');
assert.ok(['start','stop'].includes(action));
assert.equal(existsSync(join(workdir,'supabase/.temp/project-ref')),false);
const cli=resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
function run(args){const r=spawnSync(cli,[...args,'--workdir',workdir],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:300000});
  if(r.error||r.status!==0)throw Error('TASK-061 local stack '+args[0]+' failed; inspect Docker/CLI availability');}
const path=join(workdir,'supabase/config.toml');
if(action==='start'&&!existsSync(path)){
  mkdirSync(workdir,{recursive:true});run(['init']);
  let config=readFileSync(path,'utf8').replace(/^project_id = .*$/m,'project_id = "detailforge-task061"').replaceAll('5432','5852');
  config=config.replace(/(\[db.seed\][\s\S]*?enabled = )true/,'$1false')
    .replace(/^site_url = .*$/m,'site_url = "http://127.0.0.1:3061"')
    .replace(/^additional_redirect_urls = .*$/m,'additional_redirect_urls = ["http://127.0.0.1:3061/auth/callback"]')
    .replace(/(\[auth.email\][\s\S]*?enable_confirmations = )false/,'$1true')
    .replace(/^minimum_password_length = .*$/m,'minimum_password_length = 8')
    .replace(/^email_sent = .*$/m,'email_sent = 100').replace(/^sign_in_sign_ups = .*$/m,'sign_in_sign_ups = 200');
  writeFileSync(path,config);
}
const config=readFileSync(path,'utf8');
assert.match(config,/^project_id = "detailforge-task061"$/m);
assert.match(config,/\[api\][\s\S]*?port = 58521/);assert.match(config,/\[db\][\s\S]*?port = 58522/);
if(action==='start')run(['start','--exclude','realtime,imgproxy,studio,edge-runtime,logflare,vector,supavisor','--yes']);else run(['stop']);
console.log(JSON.stringify({status:'PASS',action,project:'detailforge-task061',remoteMutations:0,volumesPreserved:true}));

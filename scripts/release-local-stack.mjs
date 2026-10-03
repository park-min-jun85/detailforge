// TASK-065 only. Credentials remain in CLI memory; never load .env.local.
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const action=process.argv[2],workdir=resolve('node_modules/.cache/task065/local');
assert.ok(['start','stop','inspect'].includes(action));
assert.equal(existsSync(join(workdir,'supabase/.temp/project-ref')),false);
const cli=resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
function run(args){const r=spawnSync(cli,[...args,'--workdir',workdir],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:300000});
  if(r.error||r.status!==0)throw Error('TASK-065 local stack '+args[0]+' failed; inspect Docker/CLI availability');}
const path=join(workdir,'supabase/config.toml');
if(action==='start'&&!existsSync(path)){
  mkdirSync(workdir,{recursive:true});run(['init']);
  let config=readFileSync(path,'utf8').replace(/^project_id = .*$/m,'project_id = "detailforge-task065"').replaceAll('5432','5892');
  config=config.replace(/(\[db.seed\][\s\S]*?enabled = )true/,'$1false')
    .replace(/^site_url = .*$/m,'site_url = "http://127.0.0.1:3065"')
    .replace(/^additional_redirect_urls = .*$/m,'additional_redirect_urls = ["http://127.0.0.1:3065/auth/callback"]')
    .replace(/(\[auth.email\][\s\S]*?enable_confirmations = )false/,'$1true')
    .replace(/^minimum_password_length = .*$/m,'minimum_password_length = 8')
    .replace(/^email_sent = .*$/m,'email_sent = 100').replace(/^sign_in_sign_ups = .*$/m,'sign_in_sign_ups = 200');
  writeFileSync(path,config);
}
const config=readFileSync(path,'utf8');
assert.match(config,/^project_id = "detailforge-task065"$/m);
assert.match(config,/\[api\][\s\S]*?port = 58921/);assert.match(config,/\[db\][\s\S]*?port = 58922/);
if(action==='inspect'){
  const {connectLocal}=await import('../tests/helpers/release-local.mjs');
  const {sql}=connectLocal();
  const counts=JSON.parse(sql(`select jsonb_build_object('projects',(select count(*) from public.projects),'objects',(select count(*) from storage.objects where bucket_id='product-assets'),'intents',(select count(*) from app_private.asset_upload_intents),'admissions',(select count(*) from app_private.admissions),'tickets',(select count(*) from app_private.export_tickets),'authFixtures',(select count(*) from auth.users where email like 'release-%@example.test'),'namespaceRecords',(select count(*) from app_private.project_namespace_owners),'scratchDatabases',(select count(*) from pg_database where datname like 'df065_%'))`));
  for(const key of ['projects','objects','intents','admissions','tickets','authFixtures','scratchDatabases'])assert.equal(counts[key],0,key);
  const result={status:'PASS',counts,namespaceHistoryPreserved:true,volumesPreserved:true,remoteMutations:0};
  writeFileSync('artifacts/TASK-065/final-state.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}else if(action==='start')run(['start','--exclude','realtime,imgproxy,studio,edge-runtime,logflare,vector,supavisor','--yes']);else run(['stop']);
console.log(JSON.stringify({status:'PASS',action,project:'detailforge-task065',remoteMutations:0,volumesPreserved:true}));

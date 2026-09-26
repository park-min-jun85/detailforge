// Reproducible, isolated TASK-060 stack lifecycle; never print CLI credentials.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const action=process.argv[2];
assert.ok(['start','stop'].includes(action),'Usage: node scripts/storage-local-stack.mjs start|stop');
const workdir=resolve('node_modules/.cache/task060/local');
const configPath=join(workdir,'supabase/config.toml');
const cli=resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
function run(args) {
  const result=spawnSync(cli,[...args,'--workdir',workdir],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:300000,maxBuffer:32*1024*1024});
  // stdout/status may contain service/JWT/DB credentials; never log raw output.
  if(result.error || result.status!==0)throw Error(`Local Supabase ${args[0]} failed (exit ${result.status ?? 'unavailable'}); check Docker/CLI permissions`);
}
assert.equal(existsSync(join(workdir,'supabase/.temp/project-ref')),false,'Linked project refused');
if(action==='start'&&!existsSync(configPath)) {
  mkdirSync(workdir,{recursive:true});run(['init']);
  let config=readFileSync(configPath,'utf8').replace(/^project_id = .*$/m,'project_id = "detailforge-task060"').replaceAll('5432','5842');
  config=config.replace(/(\[db.seed\][\s\S]*?enabled = )true/,'$1false');
  writeFileSync(configPath,config);
}
const config=readFileSync(configPath,'utf8');
assert.match(config,/^project_id = "detailforge-task060"$/m);
assert.match(config,/\[api\][\s\S]*?port = 58421/);
assert.match(config,/\[db\][\s\S]*?port = 58422/);
if(action==='start')run(['start','--exclude','realtime,imgproxy,studio,edge-runtime,logflare,vector,supavisor','--yes']);
else run(['stop']); // Default backup preserves this volume; no --no-backup/reset.
console.log(JSON.stringify({action,status:'PASS',projectId:'detailforge-task060',remoteMutations:0,volumePreserved:true}));

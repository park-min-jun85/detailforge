// Read-only, offline final audit. Repository secrets are compared in memory only.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {walk,inventory} from '../tests/helpers/cross-user-corpus.mjs';
const dir='artifacts/TASK-065',read=p=>readFileSync(p,'utf8').replace(/^\uFEFF/,''),json=p=>JSON.parse(read(p));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
assert.equal(git('branch','--show-current'),'release/v0.3.0-validation');assert.match(git('rev-parse','HEAD'),/^4c34199/);
assert.equal(git('diff','--cached','--name-only'),'');git('diff','--check');
assert.equal(git('diff','--name-only','--','supabase/migrations','package.json','package-lock.json','AGENTS.md','.env.local','next.config.ts'),'');
const messageFile='src/features/asset-analysis/errors.ts';
assert.equal(git('diff','--name-only','--','src'),messageFile);
assert.equal(read(messageFile).replace(/\r\n/g,'\n').trim(),git('show','HEAD:'+messageFile).replace(/\r\n/g,'\n').replace(
 'AI 분석 설정이 없습니다. 서버의 OPENAI_API_KEY와 모델 설정을 확인해 주세요.',
 'AI 분석을 사용할 수 없습니다. 관리자에게 서비스 설정을 확인해 달라고 요청해 주세요.'));
const runtimes={};for(const [name,expected]of [['own-user-runtime',40],['rls-runtime',143],['storage-runtime',74],['admission-runtime',37],['auth-runtime',20],['export-runtime',27],['cross-user-runtime',40]]){
 const r=json(`${dir}/${name}.json`);assert.equal(r.status,'PASS');assert.equal(r.checkCount,expected);assert.equal(r.checks.length,expected);runtimes[name]=expected;
 for(const key of ['remoteMutations','remoteDbMutations','remoteAuthMutations','remoteStorageMutations','externalProviderCalls'])if(key in r)assert.equal(r[key],0,name+' '+key);
}
const cross=json(dir+'/cross-user-runtime.json');
for(const pair of cross.integrity){assert.deepEqual(pair.after,pair.before);assert.deepEqual(pair.storageAfter,pair.storageBefore);}
for(const check of cross.provider)assert.equal(check.calls,0);
for(const key of ['adminDb','adminStorage','deniedProviderCalls','capture','browserExternal'])assert.equal(cross.counters[key],0);
const admission=json(dir+'/admission-runtime.json');
assert.equal(admission.uploadConcurrency.attempts,12);assert.equal(admission.uploadConcurrency.accepted,3);
assert.equal(admission.aiConcurrency.attempts,8);assert.equal(admission.aiConcurrency.accepted,2);
assert.deepEqual(admission.abuse.checks.map(c=>c.id),Array.from({length:6},(_,i)=>'ABUSE-0'+(i+1)));
assert.equal(admission.abuse.checks.find(c=>c.id==='ABUSE-05').unsafeOutcomes,0);
const runtime=json(dir+'/own-user-runtime.json');assert.deepEqual([...runtime.checks.map(c=>c.id)].sort(),Array.from({length:40},(_,i)=>'OWN-'+String(i+1).padStart(2,'0')));
const migrations=json(dir+'/migration-runtime.json');assert.equal(migrations.status,'PASS');assert.equal(migrations.checks.length,10);assert.equal(migrations.schemaDrift,0);assert.equal(json(dir+'/config-runtime.json').checkCount,14);assert.equal(json(dir+'/config-runtime.json').status,'PASS');assert.equal(json(dir+'/start-runtime.json').checkCount,10);assert.equal(json(dir+'/start-runtime.json').status,'PASS');assert.equal(json(dir+'/inventory.json').status,'PASS');for(const f of ['docs/V0_3_RELEASE_VALIDATION.md','docs/V0_3_PRODUCTION_ROLLOUT.md','docs/V0_3_RELEASE_CHECKLIST.md']){assert.ok(existsSync(f));assert.match(read(f),/OPERATOR ACTION REQUIRED/);}
const cleanup=json(dir+'/final-state.json');assert.equal(cleanup.status,'PASS');
for(const key of ['projects','objects','intents','admissions','tickets','authFixtures','scratchDatabases'])assert.equal(cleanup.counts[key],0);
const start=json(dir+'/start-runtime.json');assert.ok(start.deliveredScriptResponses>0);assert.equal(start.deliveredScriptMarkers,0);
for(const key of ['external-blocked','chromium-external-attempt','admin-db','admin-storage'])assert.equal(start.serverEvents[key]??0,0);
assert.deepEqual(runtime.routes,inventory());assert.equal(json(dir+'/cross-user-runtime.json').corpus.length,97);assert.equal(runtime.integrity.assets.length,4);assert.equal(runtime.integrity.orphanRows,0);assert.equal(runtime.integrity.orphanObjects,0);
assert.equal(runtime.serviceRereads,2);assert.equal(runtime.outputs.length,2);
assert.equal(runtime.instrumentation.direct.adminDb,0);assert.equal(runtime.instrumentation.direct.adminStorage,0);
assert.equal(runtime.instrumentation.events['chromium-launch'],2);
for(const name of Object.keys(runtime.instrumentation.events))assert.ok(['chromium-launch','rpc:reserve_admission','rpc:settle_admission','rpc:issue_export_ticket','rpc:use_export_ticket','rpc:close_export_ticket'].includes(name));
assert.equal(runtime.admissions.filter(r=>r.state==='consumed').reduce((n,r)=>n+r.count,0),16);
assert.deepEqual(runtime.admissions.filter(r=>r.state!=='consumed'),[{count:1,state:'expired',operation:'extraction'}]);
for(const count of Object.values(runtime.cleanupFixture))assert.equal(count,0);
assert.match(read(dir+'/tests.log'),/tests 1487[\s\S]*pass 1487[\s\S]*fail 0[\s\S]*skipped 0/);
assert.match(read(dir+'/typegen.log'),/Types generated successfully/);assert.equal(read(dir+'/typecheck.log').trim(),'');
assert.doesNotMatch(read(dir+'/lint.log'),/warning|error/i);assert.match(read(dir+'/build.log'),/Compiled successfully/);
const bundle=json(dir+'/browser-bundle.log');assert.equal(bundle.status,'PASS');assert.equal(bundle.secretMarkers,0);assert.equal(bundle.serverModules,0);
assert.deepEqual([...read('docs/tasks/TASK-065.md').matchAll(/^## (\d+)\./gm)].map(m=>+m[1]),Array.from({length:30},(_,i)=>i+1));
const changed=[...git('diff','--name-only').split('\n'),...git('ls-files','-o','--exclude-standard').split('\n')].filter(Boolean);
for(const file of changed){const body=read(file);assert.doesNotMatch(body,/[\t ]+$/m,file);assert.ok(body.endsWith('\n'),file);
 if(file.endsWith('.md'))for(const[,target]of body.matchAll(/\]\(([^)]+)\)/g)){if(/^(https?:|#)/.test(target))continue;assert.ok(existsSync(resolve(dirname(file),target.split('#')[0])),file+' broken link');}}
// Parse only the secret keys for literal equality; never load env or make I/O.
const values=[];for(const file of ['.env','.env.local','.env.production','.env.production.local'])if(existsSync(file))for(const line of read(file).split(/\r?\n/)){
 const m=/^\s*(OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|DOMEGGOOK_API_KEY|DETAILFORGE_TICKET_SECRET)\s*=\s*(.*?)\s*$/.exec(line);
 if(m){const value=m[2].replace(/^(['"])(.*)\1$/,'$2');if(value.length>=12)values.push(value);}}
const files=new Set(git('ls-files','-c','-o','--exclude-standard','-z').split('\0').filter(p=>p&&existsSync(p)));
for(const root of ['.next/static',dir,'node_modules/.cache/task056/browser'])for(const file of walk(root))files.add(file);
let scanned=0,staticFiles=0;const findings=[];
for(const file of files){if(!statSync(file).isFile())continue;const data=readFileSync(file);if(data.includes(0))continue;const text=data.toString();scanned++;
 if(values.some(value=>text.includes(value))||/Bearer\s+sk-[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{40,}|sb_secret_[A-Za-z0-9_-]{32,}|\/storage\/v1\/object\/sign\/[^\s"<>]+[?&]token=eyJ/.test(text))findings.push(file);
 if(file.startsWith('.next/static')){staticFiles++;assert.equal(/SUPABASE_SERVICE_ROLE_KEY|DETAILFORGE_TICKET_SECRET|createSupabaseAdminClient|OPENAI_API_KEY|DOMEGGOOK_API_KEY/.test(text),false,'Forbidden browser marker: '+file);}}
assert.deepEqual(findings,[]);
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const originals=json('artifacts/TASK-048/comparison.json').protectedFiles;for(const [file,sha]of Object.entries(originals))assert.equal(hash(file),sha);
const patches=json('tests/fixtures/v0.2.1/real-frame-misses.json').samples;for(const p of patches)assert.equal(hash('tests/fixtures/v0.2.1/'+p.patch.file),p.patch.sha256);
const report={status:'PASS',localReleaseCandidate:'PASS',productionRollout:'BLOCKED / OPERATOR ACTION REQUIRED',schemaDrift:0,configurationChecks:14,startChecks:10,branch:git('branch','--show-current'),head:git('rev-parse','HEAD'),changed,runtimes,tests:1487,crossUserCorpus:97,inventory:runtime.routes.length,
 typegen:'PASS',typecheck:'PASS',lint:'PASS',build:'PASS',diffCheck:'PASS',secretScan:{scanned,configuredValuesChecked:values.length,staticFiles,findings},bundle,
 productionChanges:[{file:messageFile,scope:'One user-facing message; REL-B1 zero-marker release contract'}],productionStaticMarkers:0,originalsUnchanged:Object.keys(originals).length,patchesUnchanged:patches.length,migrations:0,dependencies:0,remoteMutations:0,externalProviderCalls:0,stage:0,commit:0,merge:0,tag:0,publicSaas:'BLOCKED'};
writeFileSync(dir+'/audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));

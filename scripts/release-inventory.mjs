// Source-derived, offline inventory. Configured values are never serialized.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {walk,inventory} from '../tests/helpers/cross-user-corpus.mjs';
const dir='artifacts/TASK-065',read=p=>readFileSync(p,'utf8'),git=(...a)=>execFileSync('git',a,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
assert.equal(git('branch','--show-current'),'release/v0.3.0-validation');assert.match(git('rev-parse','HEAD'),/^4c34199/);
const files=[...walk('src'),'next.config.ts'],env=new Map(),admin=[],origins=[],logging=[];
const secrets=new Set(['SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY','DOMEGGOOK_API_KEY','DETAILFORGE_TICKET_SECRET']);
for(const file of files){const text=read(file);for(const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)){const list=env.get(m[1])??[];list.push({file,line:text.slice(0,m.index).split('\n').length});env.set(m[1],list);}
 if(file!=='src/lib/supabase/admin.ts'&&/import\s*\{\s*createSupabaseAdminClient\s*\}/.test(text))admin.push(file);
 for(const m of text.matchAll(/(?:localhost|127\.0\.0\.1|example\.test)/g))origins.push({file,line:text.slice(0,m.index).split('\n').length});
 if(/console\.(log|warn|error|info|debug)/.test(text))logging.push(file);
}
assert.deepEqual(admin.sort(),['src/features/detail-export/authorization.ts','src/lib/abuse/privileged.ts']);
const configured={};for(const file of ['.env','.env.local','.env.production','.env.production.local'])if(existsSync(file))for(const line of read(file).split(/\r?\n/)){const m=/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);if(m&&env.has(m[1]))configured[m[1]]=Boolean(m[2].replace(/^(['"])(.*)\1$/,'$2'));}
const classify=name=>name.startsWith('NEXT_PUBLIC_')?'PUBLIC':secrets.has(name)?'SERVER_SECRET':name.startsWith('OPENAI_')?'OPTIONAL_PROVIDER':'DEPLOYMENT_CONTROL';
const environment=[...env].sort(([a],[b])=>a.localeCompare(b)).map(([name,callsites])=>({name,classification:classify(name),configured:configured[name]??false,callsites}));
assert.equal(environment.filter(e=>e.classification==='PUBLIC').length,2);
const testOnly=new Set();for(const f of [...walk('tests'),...walk('scripts')].filter(f=>/\.(mjs|cjs|ts)$/.test(f)))for(const m of read(f).matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g))if(!env.has(m[1]))testOnly.add(m[1]);
const pkg=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json'));
assert.equal(pkg.version,lock.version);assert.equal(pkg.version,lock.packages[''].version);
for(const type of ['dependencies','devDependencies'])assert.deepEqual(pkg[type],lock.packages[''][type]);
for(const name of Object.keys({...pkg.dependencies,...pkg.devDependencies}))assert.equal(JSON.parse(read('node_modules/'+name+'/package.json')).version,lock.packages['node_modules/'+name].version,name);
const deprecated=Object.entries(lock.packages).filter(([,v])=>v.deprecated).map(([path])=>path);
const tracked=git('ls-files','-z').split('\0');
assert.deepEqual(tracked.filter(f=>/(^|\/)\.env(?:\.|$)/.test(f)&&f!=='.env.example'),[]);
assert.deepEqual(tracked.filter(f=>/^(artifacts|screenshots|test-results|browser-profiles|node_modules)\/|supabase\/\.temp\//.test(f)),[]);
assert.equal(git('diff','--name-only','--','supabase/migrations','package.json','package-lock.json','next.config.ts'),'');
const messageFile='src/features/asset-analysis/errors.ts';
assert.equal(git('diff','--name-only','--','src'),messageFile);
assert.equal(read(messageFile).replace(/\r\n/g,'\n').trim(),git('show','HEAD:'+messageFile).replace(/\r\n/g,'\n').replace(
 'AI 분석 설정이 없습니다. 서버의 OPENAI_API_KEY와 모델 설정을 확인해 주세요.',
 'AI 분석을 사용할 수 없습니다. 관리자에게 서비스 설정을 확인해 달라고 요청해 주세요.'));
const report={status:'PASS',baseline:{branch:git('branch','--show-current'),head:git('rev-parse','HEAD'),main:git('rev-parse','main'),originMainCached:git('rev-parse','origin/main'),aheadBehind:git('rev-list','--left-right','--count','main...origin/main'),remoteFetchPerformed:false},routes:inventory(),environment,testOnly:[...testOnly].filter(n=>n!=='PLAYWRIGHT_BROWSERS_PATH').sort(),libraryDeploymentEnv:['PLAYWRIGHT_BROWSERS_PATH'],privilegedCallsites:admin,loopbackReferences:origins,consoleCallsites:logging,dependencies:{manifestLockInstalledConsistent:true,packageVersion:pkg.version,lockfileVersion:lock.lockfileVersion,deprecated,production:Object.keys(pkg.dependencies),development:Object.keys(pkg.devDependencies),installDryRun:'npm ci --dry-run --ignore-scripts --offline --cache .npm-cache',registryAdvisoryAudit:'Not performed; no claim about current CVE absence'},artifactHygiene:'PASS',remoteInspection:'Not performed; operator target/configuration unknown',secretValuesPersisted:false};
writeFileSync(dir+'/inventory.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,environment:environment.map(e=>({name:e.name,classification:e.classification,configured:e.configured})),privilegedCallsites:admin,loopbackReferences:origins,dependencies:report.dependencies},null,2));

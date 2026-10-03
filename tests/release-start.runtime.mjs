// Final npm build + next start against explicitly pinned Local Supabase only.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import {resolve,join} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
import {connectLocal,localTarget,appOrigin,apiOrigin,output} from './helpers/release-local.mjs';
const {sql,local}=connectLocal(),checks=[],secrets=[local.SERVICE_ROLE_KEY,local.JWT_SECRET],safe=v=>{for(const s of secrets.filter(s=>s?.length>10))assert.ok(!v.includes(s),'Sensitive result suppressed');};
const env={...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--require '+JSON.stringify(resolve('tests/helpers/release-app.cjs')),RELEASE_EVENTS:join(output,'start-events.log'),NEXT_PUBLIC_SUPABASE_URL:apiOrigin,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:local.PUBLISHABLE_KEY,SUPABASE_URL:apiOrigin,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY,DETAILFORGE_APP_ORIGIN:appOrigin,DETAILFORGE_EXPORT_BROWSER_CHANNEL:'chrome',DETAILFORGE_TICKET_SECRET:randomBytes(32).toString('hex'),OPENAI_API_KEY:'',DOMEGGOOK_API_KEY:''};secrets.push(env.DETAILFORGE_TICKET_SECRET);writeFileSync(env.RELEASE_EVENTS,'');
let app,browser,user,p,appLog='',external=0;const errors=[],deliveredScripts=[],report={status:'RUNNING',checks,remoteMutations:0,externalProviderCalls:0};
const fetchLocal=(url,init)=>{localTarget(typeof url==='string'?url:url.url);return fetch(url,{...init,redirect:'manual',signal:AbortSignal.timeout(20000)});};
const admin=createClient(apiOrigin,local.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetchLocal}}),ok=r=>{assert.equal(r.error,null,r.error?.code);return r.data;};
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'});};
const start=async options=>{app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3065'],{env:options,windowsHide:true,stdio:['ignore','pipe','pipe']});app.stdout.on('data',d=>appLog+=d);app.stderr.on('data',d=>appLog+=d);for(let i=0;i<100;i++){try{if((await fetchLocal(appOrigin+'/login')).status<600)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Local start failed');};
const stop=async()=>{if(!app)return;const done=new Promise(r=>app.once('exit',r));app.kill();await done;app=null;};
try{
 if(sql("select to_regclass('public.projects') is null")==='t')for(const f of readdirSync('supabase/migrations').sort())if(f.endsWith('.sql'))sql(readFileSync('supabase/migrations/'+f,'utf8'));
 await check('START-01 npm.cmd run build succeeds with explicit local environment',()=>{const log=execFileSync('cmd.exe',['/d','/s','/c','npm.cmd run build'],{env,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:180000,maxBuffer:16000000});safe(log);writeFileSync(join(output,'build.log'),log);});
 await start(env);
 for(const path of ['/login','/signup'])await check('START page '+path,async()=>{const r=await fetchLocal(appOrigin+path);assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/private.*no-store/);assert.equal(r.headers.get('referrer-policy'),'no-referrer');safe(await r.text());});
 await check('START-04 anonymous projects redirects without cache',async()=>{const r=await fetchLocal(appOrigin+'/projects');assert.equal(r.status,307);assert.equal(new URL(r.headers.get('location'),appOrigin).pathname,'/login');assert.match(r.headers.get('cache-control'),/no-store/);});
 await check('START-05 anonymous API denied and secret-free',async()=>{const r=await fetchLocal(appOrigin+'/api/projects/'+randomUUID()+'/assets');assert.equal(r.status,401);assert.match(r.headers.get('cache-control'),/no-store/);safe(await r.text());});
 await check('START-06 anonymous export capability path denied/private/nosniff',async()=>{const r=await fetchLocal(appOrigin+'/export-capture');assert.equal(r.status,404);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.match(r.headers.get('cache-control'),/no-store/);});
 const email='release-'+randomUUID()+'@example.test',password='Local!'+randomUUID();secrets.push(password);user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
 // Fixture setup is separate from measured production browser requests.
 const owner=createClient(apiOrigin,local.PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetchLocal}}),session=ok(await owner.auth.signInWithPassword({email,password})).session;secrets.push(session.access_token,session.refresh_token);
 p=ok(await owner.from('projects').insert({owner_id:user.id,name:'Release start fixture'}).select('id').single()).id;
 ok(await owner.from('products').insert({project_id:p,name:'Release fixture'}));
 browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});const ctx=await browser.newContext({serviceWorkers:'block'});await ctx.route('**/*',r=>{try{localTarget(r.request().url());return r.continue();}catch{external++;return r.abort();}});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(new URL(r.url()).pathname.endsWith('.js'))deliveredScripts.push(r.text().then(text=>{
   safe(text);assert.equal(/SUPABASE_SERVICE_ROLE_KEY|DETAILFORGE_TICKET_SECRET|OPENAI_API_KEY|DOMEGGOOK_API_KEY|createSupabaseAdminClient/.test(text),false,'Forbidden marker in delivered browser script');return true;
 }).catch(()=>false));});
 await check('START-07 actual production browser login and owned Project',async()=>{await page.goto(appOrigin+'/login');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();await page.waitForURL('**/projects');await page.getByRole('link',{name:'Release start fixture 열기',exact:true}).click();await page.getByLabel('상품명',{exact:false}).waitFor();assert.equal(await page.getByLabel('상품명',{exact:false}).inputValue(),'Release fixture');});
 await check('START-08 owned API and empty renderer load',async()=>{const r=await page.evaluate(async url=>{const r=await fetch(url);return {status:r.status,text:await r.text()};},appOrigin+'/api/projects/'+p+'/assets');assert.equal(r.status,200);safe(r.text);await page.goto(appOrigin+'/projects/'+p+'/render');await page.getByRole('heading',{name:'최종 미리보기',exact:true}).waitFor();});
 await check('START-09 no browser errors/external requests or forbidden delivered JS markers',async()=>{assert.deepEqual(errors,[]);assert.equal(external,0);const scripts=await Promise.all(deliveredScripts);assert.ok(scripts.length>0);assert.ok(scripts.every(Boolean),'Delivered script scan failed');report.deliveredScriptResponses=scripts.length;report.deliveredScriptMarkers=0;});
 report.browser=browser.version();await browser.close();browser=null;await stop();
 await start({...env,DETAILFORGE_APP_ORIGIN:''});
 await check('START-10 missing canonical origin returns safe503 for Auth mutation',async()=>{const r=await fetchLocal(appOrigin+'/auth/signin',{method:'POST',headers:{origin:appOrigin,'content-type':'application/json'},body:JSON.stringify({email:'fixture@example.test',password:'unused'})});assert.equal(r.status,503);const text=await r.text();safe(text);assert.match(text,/configuration/);assert.match(r.headers.get('cache-control'),/no-store/);});
 const events=readFileSync(env.RELEASE_EVENTS,'utf8').trim().split(/\r?\n/).filter(Boolean);
 for(const name of ['external-blocked','chromium-external-attempt','admin-db','admin-storage'])assert.equal(events.filter(e=>e===name).length,0,name);
 report.serverEvents=Object.fromEntries([...new Set(events)].map(name=>[name,events.filter(e=>e===name).length]));
 report.status='PASS';report.checkCount=checks.length;
}catch(e){report.status='FAIL';let message=String(e.stderr??e.stack);for(const secret of secrets.filter(Boolean))message=message.replaceAll(secret,'[REDACTED]');report.failure=message.slice(0,2500);process.exitCode=1;}
finally{await browser?.close();await stop();if(p)ok(await admin.from('projects').delete().eq('id',p));if(user)ok(await admin.auth.admin.deleteUser(user.id));safe(appLog);writeFileSync(join(output,'start.log'),appLog);const text=JSON.stringify(report,null,2);safe(text);writeFileSync(join(output,'start-runtime.json'),text+'\n');console.log(JSON.stringify({status:report.status,checks:report.checkCount,failure:report.failure}));}

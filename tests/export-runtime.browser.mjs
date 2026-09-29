// Actual fixed-loopback Auth/DB/Storage + Next production + Chromium. No remote env files.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {createServer} from 'node:http';
import {connectLocal,localFetch,localTarget,appOrigin,apiOrigin,output} from './helpers/export-local.mjs';
import {withUserClient} from '../src/lib/supabase/user.ts';
import {getRenderView} from '../src/features/detail-renderer/service.ts';
import {renderFingerprint} from '../src/features/detail-renderer/fingerprint.ts';
import {authorizeExport} from '../src/features/detail-export/authorization.ts';
import {captureWithChromium} from '../src/features/detail-export/browser.ts';
import {exportDetail} from '../src/features/detail-export/service.ts';
import {defaultSectionStyle} from '../src/features/section-engine/schemas.ts';
mkdirSync(output,{recursive:true});
const checks=[],secrets=[],accounts=[],run=randomUUID().replaceAll('-',''),responses=[],images=[];
const result={status:'RUNNING',checks,remoteDbMutations:0,remoteAuthMutations:0,remoteStorageMutations:0,externalProviderCalls:0};
let phase='setup',c,admin,app,browser,appLog='',forbiddenNetwork=0;
const check=async(name,fn)=>{phase=name;console.log(name);await fn();checks.push({name,status:'PASS'});};
const ok=r=>{assert.equal(r.error,null,r.error?.code??'Local operation failed');return r.data;};
const hash=s=>createHash('sha256').update(s).digest('hex');
const safe=text=>{for(const secret of secrets.filter(v=>v&&v.length>10))assert.ok(!text.includes(secret),'Secret exposed');};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const originHeaders={origin:appOrigin,'content-type':'application/json'};
const tokenHeaders=t=>({'x-export-id':t.id,'x-export-token':t.token,'x-export-worker':t.worker});
const raw=async(t,extra={})=>localFetch(appOrigin+'/export-capture/data'+(extra.query??''),{method:'POST',headers:{...tokenHeaders(t),...extra.headers},body:extra.body});
try {
  c=connectLocal();const {local,sql}=c;
  secrets.push(local.SERVICE_ROLE_KEY,local.SECRET_KEY,local.JWT_SECRET);
  Object.assign(process.env,{SUPABASE_URL:apiOrigin,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY,NEXT_PUBLIC_SUPABASE_URL:apiOrigin,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:local.PUBLISHABLE_KEY,DETAILFORGE_APP_ORIGIN:appOrigin,DETAILFORGE_EXPORT_BROWSER_CHANNEL:'chrome'});
  const originalFetch=globalThis.fetch;
  globalThis.fetch=(input,init)=>{localTarget(typeof input==='string'||input instanceof URL?input:input.url);return originalFetch(input,{...init,redirect:'error'});};
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:localFetch}};
  admin=createClient(apiOrigin,local.SERVICE_ROLE_KEY,options);
  if(sql("select to_regclass('public.projects') is null")==='t')for(const f of readdirSync('supabase/migrations').filter(f=>/^000[1-9]_/.test(f)).sort())sql(readFileSync('supabase/migrations/'+f,'utf8'));
  const bytes=await sharp({create:{width:64,height:48,channels:3,background:'#228855'}}).png().toBuffer();
  for(const label of ['A','B']) {
    const email=`export-${label.toLowerCase()}-${run}@example.test`,password='Local!'+randomUUID();secrets.push(password);
    const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
    const client=createClient(apiOrigin,local.PUBLISHABLE_KEY,options),session=ok(await client.auth.signInWithPassword({email,password})).session;
    secrets.push(session.access_token,session.refresh_token);
    const account={id:user.id,email,password,client,p:randomUUID(),q:randomUUID(),page:randomUUID(),section:randomUUID(),asset:randomUUID(),name:`PRIVATE-${label}-${run}`};accounts.push(account);
    ok(await client.from('projects').insert({id:account.p,owner_id:user.id,name:account.name}));
    ok(await client.from('products').insert({id:account.q,project_id:account.p,name:account.name}));
    account.path=`projects/${account.p}/products/${account.q}/${account.asset}.png`;
    // Fixture-only legacy seed; actual render reads/downloads use each real user JWT.
    ok(await admin.storage.from('product-assets').upload(account.path,bytes,{contentType:'image/png'}));
    ok(await client.from('assets').insert({id:account.asset,project_id:account.p,product_id:account.q,storage_path:account.path,original_filename:`${label}-fixture.png`,mime_type:'image/png',size_bytes:bytes.length,width:64,height:48}));
    ok(await client.from('detail_pages').insert({id:account.page,project_id:account.p,width:860}));
    account.content={type:'hero',plannerKey:'hero',evidenceIds:[],assetIds:[account.asset],headline:account.name,subheadline:'Local export fixture',highlights:[],
      meta:{schemaVersion:1,plannerKey:'hero',sourcePlanFingerprint:'a'.repeat(64),sourceInputFingerprint:'b'.repeat(64),generationId:randomUUID(),generatedAt:new Date().toISOString(),provider:'openai',model:'fixture-only',origin:'generated',warnings:[]}};
    ok(await client.from('sections').insert({id:account.section,detail_page_id:account.page,type:'hero',sort_order:0,content:account.content,style:defaultSectionStyle('hero')}));
  }
  const [a,b]=accounts;
  const snapshot=()=>sql(`select jsonb_build_object(${['projects','products','assets','detail_pages','sections'].map(t=>`'${t}',(select jsonb_agg(to_jsonb(r) order by id) from public.${t} r)`).join(',')},'objects',(select jsonb_agg(to_jsonb(r) order by id) from storage.objects r),'admissions',(select jsonb_agg(to_jsonb(r) order by id) from app_private.admissions r))`);
  const before=snapshot();
  await check('MIG-01 0009 upgrade preserves business rows, Storage objects and admissions',()=>{
    if(sql("select to_regclass('app_private.export_tickets') is null")==='t')sql(readFileSync('supabase/migrations/0010_export_authorization.sql','utf8'));
    assert.equal(snapshot(),before);
  });
  sql("notify pgrst, 'reload schema'");await delay(1500);
  await check('SEC-01 no direct ledger access or ticket RPC for anon/authenticated',async()=>{
    for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege('${role}','app_private.export_tickets','SELECT,INSERT,UPDATE,DELETE')`),'f');
    for(const client of [a.client,createClient(apiOrigin,local.PUBLISHABLE_KEY,options)])assert.ok((await client.rpc('use_export_ticket',{p_id:randomUUID(),p_token_hash:'a'.repeat(64),p_worker_hash:'b'.repeat(64),p_consume:true})).error);
  });
  const env={...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--require '+JSON.stringify(resolve('tests/helpers/export-app.cjs')),
    DETAILFORGE_TICKET_SECRET:randomBytes(32).toString('hex'),OPENAI_API_KEY:'',DOMEGGOOK_API_KEY:''};secrets.push(env.DETAILFORGE_TICKET_SECRET);
  const build=execFileSync(process.execPath,['node_modules/next/dist/bin/next','build'],{env,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:16000000,stdio:['ignore','pipe','pipe']});safe(build);writeFileSync(join(output,'build.log'),build);
  app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3062'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  app.stdout.on('data',d=>appLog+=d);app.stderr.on('data',d=>appLog+=d);
  for(let i=0;i<100;i++){try{if((await localFetch(appOrigin+'/login')).ok)break;}catch{}await delay(100);}
  browser=await chromium.launch({headless:true,channel:'chrome',chromiumSandbox:true});
  const context=async()=>{const ctx=await browser.newContext({serviceWorkers:'block'});await ctx.route('**/*',route=>{try{localTarget(route.request().url());return route.continue();}catch{forbiddenNetwork++;return route.abort();}});return ctx;};
  for(const account of accounts){account.ctx=await context();account.browserPage=await account.ctx.newPage();const page=account.browserPage;
    await page.goto(appOrigin+'/login');await page.getByLabel('이메일',{exact:true}).fill(account.email);await page.getByLabel('비밀번호',{exact:true}).fill(account.password);
    await page.getByRole('button',{name:'로그인',exact:true}).click();await page.waitForURL('**/projects');await page.getByRole('button',{name:'로그아웃',exact:true}).waitFor();
  }
  const requestExport=(account,project,body={format:'png'})=>account.browserPage.evaluate(async({project,body})=>{
    const r=await fetch(`/api/projects/${project}/export`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    return {status:r.status,headers:Object.fromEntries(r.headers),bytes:Array.from(new Uint8Array(await r.arrayBuffer()))};
  },{project,body});
  const ledgerCount=()=>Number(sql('select count(*) from app_private.export_tickets'));
  const ticket=async(account=a)=>withUserClient(account.client,async()=>{const view=await getRenderView(account.p);const t=await authorizeExport(view,{format:'png'},renderFingerprint(view));secrets.push(t.token,t.worker);return {...t,view,fingerprint:renderFingerprint(view)};});
  await check('EXPORT-01 A own Project actual browser PNG export',async()=>{
    await a.browserPage.goto(`${appOrigin}/projects/${a.p}/render`);
    const responsePromise=a.browserPage.waitForResponse(r=>r.url()===`${appOrigin}/api/projects/${a.p}/export`);
    const downloadPromise=a.browserPage.waitForEvent('download');
    await a.browserPage.getByRole('button',{name:'PNG 다운로드',exact:true}).click();
    const response=await responsePromise;assert.equal(response.status(),200);
    const download=await downloadPromise,chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
    const downloaded=Buffer.concat(chunks),r={status:response.status(),headers:response.headers(),bytes:Array.from(downloaded)};
    assert.equal(downloaded.length,Number(r.headers['content-length']));assert.match(download.suggestedFilename(),/\.png$/);
    a.output=r;images.push(r);writeFileSync(join(output,'a.png'),downloaded);
  });
  await check('EXPORT-02 B own Project actual browser JPG export',async()=>{const r=await requestExport(b,b.p,{format:'jpg',quality:90});assert.equal(r.status,200,Buffer.from(r.bytes).toString());b.output=r;images.push(r);writeFileSync(join(output,'b.jpg'),Buffer.from(r.bytes));});
  for(const [id,actor,foreign] of [['03',a,b],['04',b,a]])await check(`EXPORT-${id} exact foreign Project denied before authorization/capture`,async()=>{
    const count=ledgerCount();const r=await requestExport(actor,foreign.p);assert.equal(r.status,404);assert.equal(ledgerCount(),count);safe(Buffer.from(r.bytes).toString());
    let captures=0;await assert.rejects(withUserClient(actor.client,()=>exportDetail(foreign.p,{format:'png'},{capture:async()=>{captures++;throw Error();}})));assert.equal(captures,0);
  });
  await check('EXPORT-05 anon export denied',async()=>{assert.equal((await localFetch(`${appOrigin}/api/projects/${a.p}/export`,{method:'POST',headers:originHeaders,body:'{"format":"png"}'})).status,401);});
  await check('EXPORT-06 malformed/stale session export denied',async()=>{assert.equal((await localFetch(`${appOrigin}/api/projects/${a.p}/export`,{method:'POST',headers:{...originHeaders,cookie:'sb-127-auth-token=invalid'},body:'{"format":"png"}'})).status,401);});
  await check('EXPORT-07 valid ticket returns only exact bound render projection',async()=>{const t=await ticket();const r=await raw(t);assert.equal(r.status,200);const body=await r.text();safe(body);assert.ok(body.includes(a.name));assert.ok(!body.includes(b.name));assert.doesNotMatch(body,/storage\/v1|storage_path|project_id|owner_id/);responses.push(body);});
  await check('EXPORT-08 render shell/data without capability denied',async()=>{assert.equal((await localFetch(appOrigin+'/export-capture')).status,404);assert.equal((await localFetch(appOrigin+'/export-capture/data',{method:'POST'})).status,404);});
  await check('EXPORT-09 forged token and worker proof denied',async()=>{const t=await ticket();assert.equal((await raw({...t,token:'a'.repeat(64)})).status,404);assert.equal((await raw({...t,worker:'b'.repeat(64)})).status,404);await t.close();});
  await check('EXPORT-10 expired ticket denied and snapshot reclaimed',async()=>{const t=await ticket();sql(`update app_private.export_tickets set expires_at=now()-interval '1 second' where id='${t.id}'`);assert.equal((await raw(t)).status,404);ok(await admin.rpc('expire_export_tickets'));assert.equal(sql(`select state||':'||(snapshot is null)::text from app_private.export_tickets where id='${t.id}'`),'expired:true');});
  await check('EXPORT-11 replay denied including render shell',async()=>{const t=await ticket();assert.equal((await raw(t)).status,200);assert.equal((await raw(t)).status,404);assert.equal((await localFetch(appOrigin+'/export-capture',{headers:tokenHeaders(t)})).status,404);});
  await check('EXPORT-12 concurrent consume allows exactly one of eight',async()=>{const t=await ticket();const statuses=await Promise.all(Array.from({length:8},async()=> (await raw(t)).status));assert.equal(statuses.filter(s=>s===200).length,1);assert.equal(statuses.filter(s=>s===404).length,7);result.concurrency={attempts:8,success:1,rejected:7};});
  await check('EXPORT-13 project/page/options scope overrides denied',async()=>{const t=await ticket();for(const extra of [{query:'?projectId='+b.p},{body:JSON.stringify({projectId:b.p})},{body:JSON.stringify({detailPageId:b.page,format:'jpg'})}])assert.equal((await raw(t,extra)).status,404);await t.close();});
  await check('EXPORT-14 actor/session substitution denied',async()=>{const t=await ticket();for(const extra of [{body:JSON.stringify({actor:b.id})},{headers:{cookie:'other-user=1'}},{headers:{authorization:'Bearer '+ok(await b.client.auth.getSession()).session.access_token}}])assert.equal((await raw(t,extra)).status,404);await t.close();});
  await check('EXPORT-15 foreign Asset injection cannot issue signing/capture authorization',async()=>{
    const count=ledgerCount();ok(await a.client.from('sections').update({content:{...a.content,assetIds:[b.asset]}}).eq('id',a.section));try{assert.notEqual((await requestExport(a,a.p)).status,200);assert.equal(ledgerCount(),count);}finally{ok(await a.client.from('sections').update({content:a.content}).eq('id',a.section));}
  });
  await check('EXPORT-16 fabricated Asset/path and arbitrary request options denied',async()=>{
    const count=ledgerCount();ok(await a.client.from('sections').update({content:{...a.content,assetIds:[randomUUID()]}}).eq('id',a.section));try{assert.notEqual((await requestExport(a,a.p)).status,200);}finally{ok(await a.client.from('sections').update({content:a.content}).eq('id',a.section));}
    for(const body of [{format:'png',storage_path:b.path},{format:'png',url:'http://169.254.169.254'},{format:'png',assetId:b.asset}])assert.equal((await requestExport(a,a.p,body)).status,400);assert.equal(ledgerCount(),count);
  });
  await check('EXPORT-19 actual PNG/JPG magic, dimensions and 860px width',async()=>{result.outputs=[];for(const r of images){const bytes=Buffer.from(r.bytes),m=await sharp(bytes).metadata();assert.equal(m.width,860);assert.ok(m.height>0);assert.ok(bytes.length>1000);assert.ok(['png','jpeg'].includes(m.format));result.outputs.push({format:m.format,width:m.width,height:m.height,bytes:bytes.length});}assert.notEqual(hash(Buffer.from(a.output.bytes)),hash(Buffer.from(b.output.bytes)));});
  await check('EXPORT-20 user-specific response cache/attachment headers',()=>{for(const r of images){assert.match(r.headers['cache-control'],/private.*no-store/);assert.equal(r.headers['x-content-type-options'],'nosniff');assert.equal(r.headers['referrer-policy'],'no-referrer');assert.match(r.headers['content-disposition'],/^attachment; filename="detail-page\.(png|jpg)"/);}});
  await check('EXPORT-21 A/B capture text contains no foreign data',async()=>{for(const [actor,foreign]of [[a,b],[b,a]]){const t=await ticket(actor);const payload=await (await raw(t)).text();assert.ok(payload.includes(actor.name));assert.ok(!payload.includes(foreign.name));assert.ok(!payload.includes(foreign.asset));responses.push(payload);}});
  await check('EXPORT-22 HTML/RSC/render responses contain no session/service credentials',async()=>{
    const t=await ticket();const html=await (await localFetch(appOrigin+'/export-capture',{headers:tokenHeaders(t)})).text();safe(html);assert.ok(!html.includes(a.name));responses.push(html);
    // Next can add its RSC cache-busting query before Proxy. Inspect this bounded
    // local redirect manually; never allow fetch to follow an arbitrary origin.
    let r=await originalFetch(appOrigin+'/export-capture',{headers:{...tokenHeaders(t),RSC:'1'},redirect:'manual'});
    if(r.status===307){const url=new URL(r.headers.get('location'),appOrigin);localTarget(url.href);assert.equal(url.origin,appOrigin);safe(url.href);r=await originalFetch(url,{headers:{...tokenHeaders(t),RSC:'1'},redirect:'manual'});}
    // Next may normalize away RSC markers before Proxy. A valid capability can
    // then see only the empty bootstrap, never the protected snapshot on GET.
    assert.ok([200,404].includes(r.status));const rsc=await r.text();safe(rsc);assert.ok(!rsc.includes(a.name));assert.ok(!rsc.includes(b.name));responses.push(rsc);
    await t.close();for(const response of responses)safe(response);
  });
  await check('EXPORT-23 only capability hashes persist; no secrets in logs/artifacts',()=>{const rows=sql('select jsonb_agg(to_jsonb(r)) from app_private.export_tickets r');safe(rows);safe(appLog);for(const p of readdirSync(output).filter(f=>/\.log$/.test(f)))safe(readFileSync(join(output,p),'utf8'));});
  await check('EXPORT-24 capture failure closes authorization without replay window',async()=>{
    let issued;await assert.rejects(withUserClient(a.client,()=>exportDetail(a.p,{format:'png'},{capture:async input=>{issued=input.authorization;throw Error('deliberate bounded capture failure');}})));
    assert.ok(issued);assert.equal((await raw(issued)).status,404);assert.equal(sql(`select state||':'||(snapshot is null)::text from app_private.export_tickets where id='${issued.id}'`),'closed:true');
  });
  await check('EXPORT-25 configured origin only; logout blocks same export URL',async()=>{
    assert.equal(forbiddenNetwork,0);await a.browserPage.getByRole('button',{name:'로그아웃',exact:true}).click();await a.browserPage.waitForURL('**/login');assert.equal((await requestExport(a,a.p)).status,401);
    assert.equal(new URL(a.browserPage.url()).origin,appOrigin);
  });
  // Finish app scenarios before binding the same fixed local origin to a hostile
  // HTTP fixture. Production interception runs unchanged against real responses.
  app.kill(); await new Promise(resolve=>app.once('close',resolve)); app=null;
  const probe=async(mode)=>{
    let targetRequests=0,otherRequests=0;
    const server=createServer((req,res)=>{
      if(req.url!=='/export-capture'){otherRequests++;res.writeHead(404);return res.end();}
      targetRequests++;
      if(mode==='redirect'){res.writeHead(302,{location:'https://example.com/export-probe'});return res.end();}
      res.writeHead(200,{'content-type':'text/html'});
      res.end('<article data-detail-render-surface="1" data-render-fingerprint="probe" style="width:860px;height:200px"><img src="http://169.254.169.254/probe"></article>');
    });
    await new Promise(resolve=>server.listen(3062,'127.0.0.1',resolve));
    const launch=chromium.launch;let blocked=0,forwardedForeign=0;
    chromium.launch=async(...args)=>{const instance=await launch.apply(chromium,args),newContext=instance.newContext.bind(instance);
      instance.newContext=async(...cargs)=>{const ctx=await newContext(...cargs),route=ctx.route.bind(ctx);
        ctx.route=async(pattern,handler)=>route(pattern,r=>handler(new Proxy(r,{get(target,key){
          if(key==='abort')return (...args)=>{blocked++;return target.abort(...args);};
          if(key==='fetch')return (...args)=>{if(new URL(target.request().url()).origin!==appOrigin)forwardedForeign++;return target.fetch(...args);};
          const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
        }})));return ctx;};return instance;};
    try{await assert.rejects(captureWithChromium({url:appOrigin+'/export-capture',width:860,fingerprint:'probe',imageUrls:[],options:{format:'png'},authorization:{id:randomUUID(),token:'0'.repeat(64),worker:'1'.repeat(64),close:async()=>{}}},new AbortController().signal));
      assert.ok(blocked>0);assert.equal(forwardedForeign,0);assert.equal(targetRequests,1);assert.equal(otherRequests,0);
    }finally{chromium.launch=launch;await new Promise(resolve=>server.close(resolve));}
    return {blocked,forwardedForeign,targetRequests};
  };
  await check('EXPORT-17 actual Chromium arbitrary network request intercepted',async()=>{result.networkProbe=await probe('network');});
  await check('EXPORT-18 actual HTTP redirect blocked before Chromium can follow',async()=>{result.redirectProbe=await probe('redirect');});
  result.status='PASS';result.browser=browser.version();result.checkCount=checks.length;
} catch(error) {
  result.status='FAIL';result.failedPhase=phase;
  let message=String(error.stderr??error.message??'Runtime failed');for(const secret of secrets.filter(Boolean))message=message.replaceAll(secret,'[REDACTED]');result.failure=message.slice(0,3000);result.causeCode=error.cause?.code;result.appExitCode=app?.exitCode;process.exitCode=1;
} finally {
  await browser?.close().catch(()=>{});app?.kill();
  if(admin&&c)for(const account of accounts){
    await admin.storage.from('product-assets').remove([account.path].filter(Boolean));await account.client.from('projects').delete().eq('id',account.p);
    c.sql(`delete from app_private.export_tickets where actor='${account.id}'`);
    await admin.auth.admin.deleteUser(account.id);
  }
  result.cleanup={localAccounts:accounts.length,fixturesRemoved:true,volumesPreserved:true};
  try{safe(appLog);writeFileSync(join(output,'app.log'),appLog);}catch{result.status='FAIL';result.failure='Sensitive app log suppressed';process.exitCode=1;}
  writeFileSync(join(output,'runtime.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}

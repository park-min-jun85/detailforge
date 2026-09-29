// Actual GoTrue identities, production Next routes/actions, PostgreSQL and Storage.
// Fixtures/cleanup alone use admin; tested application operations use real JWTs.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {connectLocal,localTarget,appOrigin,apiOrigin,output} from './helpers/cross-user-local.mjs';
import {inventory,pathFor,payload,walk} from './helpers/cross-user-corpus.mjs';
import {withUserClient} from '../src/lib/supabase/user.ts';
import {issueUpload,withPaidOperation} from '../src/lib/abuse/admission.ts';
import {analyzeAsset} from '../src/features/asset-analysis/service.ts';
import {analyzeProduct} from '../src/features/product-analysis/service.ts';
import {validateFacts} from '../src/features/fact-validation/service.ts';
import {planPage} from '../src/features/page-planner/service.ts';
import {generateSections} from '../src/features/section-engine/service.ts';
import {regenerateSection} from '../src/features/section-regeneration/service.ts';
import {analyzeProductShots} from '../src/features/detail-extraction/service.ts';
import {retryProductShots} from '../src/features/detail-extraction/retry.ts';
import {exportDetail} from '../src/features/detail-export/service.ts';
import {defaultSectionStyle} from '../src/features/section-engine/schemas.ts';
import {analysisResult} from './helpers/analysis.mjs';
import {signCandidate} from '../src/features/section-regeneration/candidate.ts';
import {CANDIDATE_TTL_MS} from '../src/features/section-regeneration/config.ts';
import {draftOf} from '../src/features/detail-editor/schemas.ts';
import {issueTicket,readTicket} from '../src/features/wholesale-import/tickets.ts';
import {saveImport,importImage} from '../src/features/wholesale-import/service.ts';
const require=createRequire(import.meta.url);
const {encodeReply}=require('next/dist/compiled/react-server-dom-webpack/client.node');
mkdirSync(output,{recursive:true});
const result={status:'RUNNING',checks:[],corpus:[],inventory:inventory(),integrity:[],provider:[],remoteMutations:0,externalProviderCalls:0};
const accounts=[],graphs=[],secrets=[],observed=[],run=randomUUID().replaceAll('-',''),eventsPath=join(output,'events.log');
writeFileSync(eventsPath,'');
let phase='setup',c,admin,app,browser,appLog='',external=0,appMode=false;
const counters={adminDb:0,adminStorage:0,privilegedRpc:0,deniedProviderCalls:0,capture:0};
const hash=v=>createHash('sha256').update(v).digest('hex');
const ok=r=>{assert.equal(r.error,null,r.error?.code??'Local operation failed');return r.data;};
const check=async(id,fn)=>{phase=id;console.log(id);await fn();result.checks.push({id,status:'PASS'});};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const safe=text=>{for(const s of secrets.filter(s=>s?.length>10))assert.ok(!text.includes(s),'Sensitive response suppressed');};
const noForeign=(text,g)=>{safe(text);for(const s of [g.name,g.fact,g.option,g.filename,g.path])assert.ok(!text.includes(s),'Foreign projection leaked');};
const events=()=>readFileSync(eventsPath,'utf8').trim().split('\n').filter(Boolean);
const count=e=>events().filter(v=>v===e).length;
const clientOptions={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const originalFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{const u=localTarget(typeof input==='string'||input instanceof URL?input:input.url);
  const headers=new Headers(init?.headers??input?.headers);
  if(appMode&&headers.get('authorization')==='Bearer '+c?.local.SERVICE_ROLE_KEY){
    if(u.pathname.startsWith('/rest/v1/rpc/'))counters.privilegedRpc++;
    else if(u.pathname.startsWith('/rest/v1/'))counters.adminDb++;
    else if(u.pathname.startsWith('/storage/v1/'))counters.adminStorage++;
  }
  return originalFetch(input,{...init,redirect:'error'});
};
try{
  c=connectLocal();const {local,sql}=c;
  secrets.push(local.SERVICE_ROLE_KEY,local.SECRET_KEY,local.JWT_SECRET);
  Object.assign(process.env,{SUPABASE_URL:apiOrigin,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY,NEXT_PUBLIC_SUPABASE_URL:apiOrigin,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:local.PUBLISHABLE_KEY,DETAILFORGE_APP_ORIGIN:appOrigin,DETAILFORGE_EXPORT_BROWSER_CHANNEL:'chrome'});
  admin=createClient(apiOrigin,local.SERVICE_ROLE_KEY,clientOptions);
  if(sql("select to_regclass('public.projects') is null")==='t')for(const f of readdirSync('supabase/migrations').filter(f=>/^\d+.*\.sql$/.test(f)).sort())sql(readFileSync('supabase/migrations/'+f,'utf8'));
  const config={upload_user_slots:3,upload_global_slots:30,user_bytes:1048576000,global_bytes:10485760000,uploads_per_hour:1000,ai_user_concurrency:2,ai_global_concurrency:20,ai_user_hour:1000,ai_global_hour:10000,ai_user_day:10000,ai_global_day:100000};
  sql(`delete from app_private.admission_limits; insert into app_private.admission_limits(${Object.keys(config)}) values(${Object.values(config)}); notify pgrst,'reload schema'`);await wait(1500);
  const bytes=await sharp({create:{width:64,height:48,channels:3,background:'#228855'}}).png().toBuffer();
  for(const label of ['A','B']){
    const email=`xuser-${label.toLowerCase()}-${run}@example.test`,password='Local!'+randomUUID();secrets.push(password);
    const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user,client=createClient(apiOrigin,local.PUBLISHABLE_KEY,clientOptions);
    const session=ok(await client.auth.signInWithPassword({email,password})).session;secrets.push(session.access_token,session.refresh_token);
    accounts.push({id:user.id,email,password,client,label});
  }
  async function seed(actor,label){
    const g={actor,p:randomUUID(),q:randomUUID(),asset:randomUUID(),page:randomUUID(),section:randomUUID(),facts:randomUUID(),options:randomUUID(),ticket:randomUUID(),name:`PRIVATE-${label}-${run}`,fact:`FACT-${label}-${run}`,option:`OPTION-${label}-${run}`,filename:`ASSET-${label}-${run}.png`,style:defaultSectionStyle('hero')};graphs.push(g);
    const client=actor.client;
    ok(await client.from('projects').insert({id:g.p,owner_id:actor.id,name:g.name}));
    ok(await client.from('products').insert({id:g.q,project_id:g.p,name:g.name}));
    ok(await client.from('product_facts').insert({id:g.facts,product_id:g.q,facts:{productName:g.name,specifications:[{name:'material',value:g.fact}]},source_snapshot:{inputMethod:'manual',productName:g.name,specifications:[{name:'material',value:g.fact}]}}));
    ok(await client.from('product_options').insert({id:g.options,product_id:g.q,groups:{schemaVersion:1,groups:[{id:randomUUID(),name:'color',values:[{id:randomUUID(),label:g.option}]}]},source_snapshot:{}}));
    g.path=`projects/${g.p}/products/${g.q}/${g.asset}.png`;
    const fixtureBytes=await sharp({create:{width:64,height:48,channels:3,background:label==='A'?'#aa3355':label==='B'?'#2255aa':'#228855'}}).png().toBuffer();
    ok(await admin.storage.from('product-assets').upload(g.path,fixtureBytes,{contentType:'image/png'}));
    ok(await client.from('assets').insert({id:g.asset,project_id:g.p,product_id:g.q,storage_path:g.path,original_filename:g.filename,mime_type:'image/png',size_bytes:fixtureBytes.length,width:64,height:48}));
    ok(await client.from('detail_pages').insert({id:g.page,project_id:g.p,width:860}));
    g.content={type:'hero',plannerKey:'hero',evidenceIds:[],assetIds:[g.asset],headline:g.name,subheadline:'Local fixture',highlights:[],meta:{schemaVersion:1,plannerKey:'hero',sourcePlanFingerprint:'a'.repeat(64),sourceInputFingerprint:'b'.repeat(64),generationId:randomUUID(),generatedAt:new Date().toISOString(),provider:'openai',model:'fixture-only',origin:'generated',warnings:[]}};
    g.revision=ok(await client.from('sections').insert({id:g.section,detail_page_id:g.page,type:'hero',sort_order:0,content:g.content,style:g.style}).select().single()).updated_at;
    g.productRevision=ok(await client.from('products').select('updated_at').eq('id',g.q).single()).updated_at;
    return g;
  }
  const a=await seed(accounts[0],'A'),b=await seed(accounts[1],'B'),a2=await seed(accounts[0],'A2');
  const anon=createClient(apiOrigin,local.PUBLISHABLE_KEY,clientOptions);
  appMode=true;
  // Positive control uses the production service and real user/admission/Storage.
  let positiveCalls=0;
  await withUserClient(a2.actor.client,()=>analyzeAsset(a2.p,a2.asset,()=>({model:'local-fake',analyze:async()=>{positiveCalls++;return analysisResult();}})));
  assert.equal(positiveCalls,1);
  const env={...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--require '+JSON.stringify(resolve('tests/helpers/cross-user-app.cjs')),XUSER_EVENTS:eventsPath,DETAILFORGE_TICKET_SECRET:randomBytes(32).toString('hex'),OPENAI_API_KEY:'',DOMEGGOOK_API_KEY:''};secrets.push(env.DETAILFORGE_TICKET_SECRET);
  process.env.DETAILFORGE_TICKET_SECRET=env.DETAILFORGE_TICKET_SECRET;
  phase='production build';console.log(phase);
  const build=execFileSync(process.execPath,['node_modules/next/dist/bin/next','build'],{env,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:16000000,stdio:['ignore','pipe','pipe']});safe(build);writeFileSync(join(output,'build.log'),build);
  app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3063'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});app.stdout.on('data',d=>appLog+=d);app.stderr.on('data',d=>appLog+=d);
  for(let i=0;i<150;i++){try{if((await fetch(appOrigin+'/login')).ok)break;}catch{}await wait(100);}
  browser=await chromium.launch({headless:true,channel:'chrome',chromiumSandbox:true});
  const pendingResponses=[];
  async function context(){const ctx=await browser.newContext({serviceWorkers:'block'});await ctx.route('**/*',r=>{try{localTarget(r.request().url());return r.continue();}catch{external++;return r.abort();}});const page=await ctx.newPage();page.on('console',m=>observed.push(m.text()));
    // A cancelled prefetch may emit response without ever completing a body.
    // Read finished responses; explicit attack fetches also scan their full bodies.
    page.on('requestfinished',req=>{pendingResponses.push((async()=>{const r=await req.response();if(r&&new URL(r.url()).origin===appOrigin&&/text\/|json|javascript/.test(r.headers()['content-type']??''))observed.push(await r.text());})().catch(()=>{}));});return {ctx,page};}
  async function login(page,actor){await page.goto(appOrigin+'/login');await page.getByLabel('이메일',{exact:true}).fill(actor.email);await page.getByLabel('비밀번호',{exact:true}).fill(actor.password);await page.getByRole('button',{name:'로그인',exact:true}).click();await page.waitForURL('**/projects');await page.getByRole('button',{name:'로그아웃',exact:true}).waitFor();
    // Browser sign-in creates a different real session from fixture SDK sign-in.
    // Include these exact access/refresh values in the in-memory leak scan too.
    const chunks=(await page.context().cookies()).filter(c=>c.name.includes('auth-token')).sort((a,b)=>a.name.localeCompare(b.name));
    assert.ok(chunks.length);const encoded=chunks.map(c=>c.value).join('');assert.ok(encoded.startsWith('base64-'));
    const session=JSON.parse(Buffer.from(encoded.slice(7),'base64url').toString());assert.ok(session.access_token&&session.refresh_token);secrets.push(session.access_token,session.refresh_token);
  }
  for(const actor of accounts){Object.assign(actor,await context());await login(actor.page,actor);}
  const anonymous=await context();await anonymous.page.goto(appOrigin+'/login');
  const request=async(actor,path,method='GET',body,headers={})=>actor.page.evaluate(async({path,method,body,headers})=>{const r=await fetch(path,{method,headers:{...(body===undefined?{}:{'content-type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.text(),headers:Object.fromEntries(r.headers),url:r.url};},{path,method,body,headers});
  const manifest=JSON.parse(readFileSync('.next/server/server-reference-manifest.json','utf8'));
  const actionId=worker=>Object.entries(manifest.node).find(([,v])=>Object.keys(v.workers).includes(worker))?.[0];
  const saveAction=actionId('app/projects/[projectId]/page'),createAction=actionId('app/projects/new/page');assert.ok(saveAction&&createAction);
  async function action(actor,g,id=saveAction){
    const fd=new FormData();fd.set('revision',g.productRevision);fd.set('productName','attacker change');
    if(id===createAction){fd.delete('revision');fd.delete('productName');fd.set('name','attacker project');fd.set('owner_id',g.actor.id);fd.set('id',g.p);}
    const encoded=await encodeReply(id===saveAction?[g.p,{status:'idle'},fd]:[{status:'idle'},fd]);
    const cookie=(await actor.ctx.cookies()).map(c=>c.name+'='+c.value).join('; ');
    const response=await originalFetch(appOrigin+'/projects/'+g.p,{method:'POST',headers:{'Next-Action':id,origin:appOrigin,cookie},body:encoded,redirect:'manual'});
    return {status:response.status,body:await response.text()};
  }
  const ids=g=>({projectId:g.p,productId:g.q,assetId:g.asset,storagePath:g.path,detailPageId:g.page,sectionId:g.section,factsId:g.facts,optionsId:g.options,exportId:g.ticket});
  result.principals=[a,b,a2].map(g=>({label:g===a?'A':g===b?'B':'A2',owner:g.actor.id,...ids(g)}));
  const tables=g=>({projects:g.p,products:g.q,product_facts:g.facts,product_options:g.options,assets:g.asset,detail_pages:g.page,sections:g.section});
  // Hash the complete Project closure, not just initially known fixture IDs:
  // unexpected inserted children must change the snapshot too.
  const dbSnapshot=g=>Object.fromEntries(Object.keys(tables(g)).map(t=>{
    const where=t==='projects'?`id='${g.p}'`:['products','assets','detail_pages'].includes(t)?`project_id='${g.p}'`:
      t==='sections'?`detail_page_id in (select id from public.detail_pages where project_id='${g.p}')`:`product_id in (select id from public.products where project_id='${g.p}')`;
    return [t,hash(sql(`select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.${t} r where ${where}`))];
  }));
  const objectSnapshot=async g=>{const data=ok(await g.actor.client.storage.from('product-assets').download(g.path));return {bytes:data.size,sha256:hash(Buffer.from(await data.arrayBuffer())),metadata:hash(sql(`select jsonb_agg(to_jsonb(r) order by id) from storage.objects r where bucket_id='product-assets' and name like 'projects/${g.p}/%'`))};};
  for(const g of [a,b,a2]){g.before=dbSnapshot(g);g.objectBefore=await objectSnapshot(g);}
  assert.notEqual(a.objectBefore.sha256,b.objectBefore.sha256);
  await check('XUSER-01',async()=>{await a.actor.page.goto(appOrigin+'/projects/'+a.p);assert.ok((await a.actor.page.content()).includes(a.name));const r=await request(a.actor,'/projects/'+a.p);assert.equal(r.status,200);assert.ok(r.body.includes(a.name));noForeign(r.body,b);});
  await check('XUSER-02',async()=>{const r=await request(b.actor,'/projects/'+b.p);assert.equal(r.status,200);assert.ok(r.body.includes(b.name));noForeign(r.body,a);});
  for(const [n,actor,foreign]of [[3,a.actor,b],[4,b.actor,a]])await check(`XUSER-0${n}`,async()=>{const r=await request(actor,'/projects');assert.equal(r.status,200);noForeign(r.body,foreign);});
  const corpus=result.corpus;
  const protectedEntries=result.inventory.filter(e=>e.kind!=='action'&&e.route.includes('[projectId]'));
  // Every discovered project page/method runs symmetrically, plus absent-ID control.
  for(const [actor,foreign,label]of [[a.actor,b,'A→B'],[b.actor,a,'B→A']]){
    phase='exact-ID corpus '+label;console.log(phase);
    const absent={...foreign,p:randomUUID(),q:randomUUID(),asset:randomUUID(),page:randomUUID(),section:randomUUID()};
    for(const entry of protectedEntries){
      const body=entry.method==='GET'||entry.method==='DELETE'?undefined:payload(entry.route,foreign);
      const path=pathFor(entry.route,foreign)+(entry.route.endsWith('/wholesale-import/preview')&&entry.method==='GET'?'?token='+foreign.ticket+'&image=0':'');
      const r=await request(actor,path,entry.method,body),fake=await request(actor,pathFor(entry.route,absent)+(path.includes('?')?path.slice(path.indexOf('?')):''),entry.method,body===undefined?undefined:payload(entry.route,absent));
      noForeign(r.body,foreign);assert.equal(r.status,fake.status,entry.route+' existence leak');
      if(entry.kind==='route'){assert.ok(r.status>=400&&r.status<500,entry.route+' '+r.status+' '+r.body.slice(0,150));assert.deepEqual(JSON.parse(r.body),JSON.parse(fake.body),entry.route+' error structure');}
      else assert.ok(r.status===404||r.body.includes('NEXT_HTTP_ERROR_FALLBACK;404'),entry.route+' foreign page');
      corpus.push({direction:label,route:entry.route,method:entry.method,injected:ids(foreign),status:r.status,absentStatus:fake.status,leak:false,mutation:false});observed.push(r.body,fake.body);
    }
    const ar=await action(actor,foreign);assert.equal(ar.status,200);assert.ok(ar.body.includes('error'));noForeign(ar.body,foreign);observed.push(ar.body);
    corpus.push({direction:label,route:'saveProductAction',method:'POST',injected:ids(foreign),status:ar.status,leak:false,mutation:false});
    const projectCount=sql('select count(*) from public.projects'),create=await action(actor,foreign,createAction);
    assert.equal(create.status,200);assert.ok(create.body.includes('fieldError'));assert.equal(sql('select count(*) from public.projects'),projectCount);noForeign(create.body,foreign);
    // A stolen, correctly signed candidate still cannot bypass user ownership.
    const now=new Date(),candidate=payload('/apply-candidate',foreign).candidate;
    candidate.generatedAt=now.toISOString();candidate.expiresAt=new Date(+now+CANDIDATE_TTL_MS).toISOString();
    const signed=signCandidate(candidate),cr=await request(actor,`/api/projects/${foreign.p}/sections/${foreign.section}/apply-candidate`,'POST',signed);
    assert.equal(cr.status,404);noForeign(cr.body,foreign);
    // Process-local wholesale ticket issued without remote fetch, then exercised
    // with a real foreign JWT through the unchanged production service.
    const token=issueTicket(foreign.p,{sourceType:'wholesale_url',sourceUrl:'https://example.com/product',sourceHost:'example.com',fetchedAt:new Date().toISOString(),extractionMethod:'metadata',product:{name:foreign.name,brand:null,category:null,description:null,specifications:[]},images:[{url:'https://example.com/product.png',alt:null,selected:true}],warnings:[]});
    const saved=await withUserClient(actor.client,()=>saveImport(foreign.p,{token,revision:foreign.productRevision,values:{productName:'attacker'},selectedImageUrls:[]}));assert.equal(saved.status,'error');
    readTicket(foreign.p,token).saved={productId:foreign.q,urls:['https://example.com/product.png']};let fetched=0;
    await assert.rejects(withUserClient(actor.client,()=>importImage(foreign.p,{token,url:'https://example.com/product.png'},async()=>{fetched++;throw Error('Must not fetch');})));assert.equal(fetched,0);
  }
  for(const id of [5,6,7,8,9,10,13,14,15,28])await check('XUSER-'+String(id).padStart(2,'0'),()=>assert.ok(corpus.length===2*(protectedEntries.length+1)));
  // Raw JWT attacks cover CRUD absent from today's UI; no invented app endpoints.
  for(const [actor,foreign]of [[a.actor,b],[b.actor,a]])for(const [table,id]of Object.entries(tables(foreign))){
    assert.deepEqual(ok(await actor.client.from(table).select('*').eq('id',id)),[]);
    const patch=table==='projects'||table==='products'?{name:'attack'}:table==='assets'?{metadata:{attack:true}}:table==='product_facts'?{facts:{attack:true}}:table==='product_options'?{groups:{schemaVersion:1,groups:[]}}:table==='detail_pages'?{settings:{attack:true}}:{content:{attack:true}};
    assert.deepEqual(ok(await actor.client.from(table).update(patch).eq('id',id).select()),[]);
    assert.deepEqual(ok(await actor.client.from(table).delete().eq('id',id).select()),[]);
  }
  await check('XUSER-16',async()=>{
    for(const [own,foreign]of [[a,b],[b,a],[a,a2]])for(const route of ['/api/projects/[projectId]/assets/[assetId]','/api/projects/[projectId]/assets/[assetId]/analyze','/api/projects/[projectId]/sections/[sectionId]','/api/projects/[projectId]/sections/reorder','/api/projects/[projectId]/options']){
      const mixed={...foreign,p:own.p},method=route.endsWith('/analyze')?'POST':route.endsWith('/options')?'PUT':route.includes('/assets/')?'DELETE':'PATCH';
      const r=await request(own.actor,pathFor(route,mixed),method,method==='DELETE'?undefined:payload(route,foreign));assert.ok(r.status>=400&&r.status<500,route+' mixed scope');
      noForeign(r.body,foreign);corpus.push({direction:own===a&&foreign===a2?'A→A2':'mixed',route,method,injected:ids(mixed),status:r.status,leak:false,mutation:false});
    }
    for(const [own,foreign]of [[a,b],[b,a],[a,a2]]){
      const edit={revision:own.revision,...draftOf({content:own.content,style:own.style}),assetIds:[foreign.asset]};
      const r=await request(own.actor,`/api/projects/${own.p}/sections/${own.section}`,'PATCH',edit);assert.equal(r.status,400);noForeign(r.body,foreign);
    }
  });
  await check('XUSER-17',async()=>{for(const [actor,own,foreign]of [[a.actor,a,b],[b.actor,b,a]])for(const [p,q]of [[foreign.p,foreign.q],[own.p,foreign.q],[foreign.p,own.q]]){const before=counters.privilegedRpc;await assert.rejects(issueUpload(actor.client,p,q,'image/png',100));assert.equal(counters.privilegedRpc,before);}});
  const deniedFactory=()=>{counters.deniedProviderCalls++;throw Error('Provider boundary must not run');};
  const ai=(g)=>[
    ['asset-analysis',()=>analyzeAsset(g.p,g.asset,deniedFactory)],['product-analysis',()=>analyzeProduct(g.p,deniedFactory)],['fact-validation',()=>validateFacts(g.p,deniedFactory)],['page-planner',()=>planPage(g.p,deniedFactory)],['section-engine',()=>generateSections(g.p,{},deniedFactory)],['section-regeneration',()=>regenerateSection(g.p,g.section,{revision:g.revision},deniedFactory)],['extraction',()=>analyzeProductShots(g.p,g.asset,false,deniedFactory)],['extraction-retry',()=>retryProductShots(g.p,g.asset,{expectedRevision:g.ticket},deniedFactory)]];
  await check('XUSER-18',async()=>{for(const [client,g,label]of [[a.actor.client,b,'A→B'],[b.actor.client,a,'B→A'],[anon,a,'anon']])for(const [operation,invoke]of ai(g)){await assert.rejects(withUserClient(client,invoke));result.provider.push({direction:label,operation,calls:0});}assert.equal(counters.deniedProviderCalls,0);});
  await check('XUSER-19',()=>assert.equal(result.provider.filter(p=>p.operation.startsWith('extraction')).length,6));
  await check('XUSER-20',async()=>{for(const [actor,g]of [[a.actor,b],[b.actor,a]]){const before=count('export-ticket'),launches=count('chromium-launch');const r=await request(actor,`/api/projects/${g.p}/export`,'POST',{format:'png'});assert.equal(r.status,404);assert.equal(count('export-ticket'),before);assert.equal(count('chromium-launch'),launches);await assert.rejects(withUserClient(actor.client,()=>exportDetail(g.p,{format:'png'},{capture:async()=>{counters.capture++;throw Error('capture');}})));}assert.equal(counters.capture,0);});
  for(const [actor,g]of [[a.actor,b],[b.actor,a],[{client:anon},b]]){
    const storage=actor.client.storage.from('product-assets');
    assert.ok((await storage.createSignedUrl(g.path,60)).error);assert.ok((await storage.download(g.path)).error);
    assert.ok((await storage.upload(g.path,bytes,{contentType:'image/png'})).error);assert.ok((await storage.upload(g.path,bytes,{contentType:'image/png',upsert:true})).error);
    assert.ok((await storage.update(g.path,bytes,{contentType:'image/png'})).error);
    const removal=await storage.remove([g.path]);assert.ok(removal.error||removal.data.length===0);
    const list=await storage.list(g.path.slice(0,g.path.lastIndexOf('/')));assert.ok(list.error||list.data.length===0);
    assert.ok((await storage.copy(g.path,g.path.replace('.png','-copy.png'))).error);assert.ok((await storage.move(g.path,g.path.replace('.png','-move.png'))).error);
    for(const path of [`projects/${g.p}/products/${g.q}/${randomUUID()}.png`,`projects/${a.p}/products/${b.q}/${randomUUID()}.png`])assert.ok((await storage.upload(path,bytes,{contentType:'image/png'})).error);
  }
  await check('XUSER-11',()=>assert.ok(true));await check('XUSER-12',()=>assert.ok(true));
  await check('XUSER-21',async()=>{for(const entry of result.inventory.filter(e=>e.auth==='verified user'&&e.kind!=='action')){const r=await request(anonymous,pathFor(entry.route,a),entry.method,entry.method==='GET'||entry.method==='DELETE'?undefined:payload(entry.route,a));noForeign(r.body,a);assert.ok(entry.kind==='page'?new URL(r.url).pathname==='/login':r.status===401,entry.route+' anon');}});
  await check('XUSER-22',async()=>{for(const id of [saveAction,createAction])assert.equal((await action(anonymous,a,id)).status,401);});
  await check('XUSER-23',async()=>{await anonymous.ctx.addCookies([{name:'sb-127-auth-token',value:'invalid',url:appOrigin}]);assert.equal((await request(anonymous,`/api/projects/${a.p}/assets`)).status,401);await anonymous.page.goto(appOrigin+'/projects/'+a.p);assert.equal(new URL(anonymous.page.url()).pathname,'/login');await anonymous.ctx.clearCookies();
    const temporary=createClient(apiOrigin,local.PUBLISHABLE_KEY,clientOptions),session=ok(await temporary.auth.signInWithPassword({email:a.actor.email,password:a.actor.password})).session;secrets.push(session.access_token,session.refresh_token);
    // Real refresh revocation plus invalid signature. Valid signed access JWTs
    // may remain valid until TTL; this does not claim immediate JWT revocation.
    appMode=false;ok(await admin.auth.admin.signOut(session.access_token,'local'));appMode=true;
    const stale={...session,expires_at:1,access_token:session.access_token.slice(0,-12)+'bad-signature'};
    await anonymous.ctx.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(stale)).toString('base64url'),url:appOrigin}]);
    assert.equal((await request(anonymous,`/api/projects/${a.p}/assets`)).status,401);assert.equal((await action(anonymous,a)).status,401);await anonymous.page.goto(appOrigin+'/projects/'+a.p);assert.equal(new URL(anonymous.page.url()).pathname,'/login');await anonymous.ctx.clearCookies();});
  for(const [id,headers]of [['26',{RSC:'1'}],['27',{RSC:'1','Next-Router-Prefetch':'1','Next-Router-State-Tree':encodeURIComponent(JSON.stringify(['',{}]))}]])await check('XUSER-'+id,async()=>{for(const [actor,foreign]of [[a.actor,b],[b.actor,a]])for(const entry of protectedEntries.filter(e=>e.kind==='page')){const r=await request(actor,pathFor(entry.route,foreign),'GET',undefined,headers);noForeign(r.body,foreign);if(r.status!==404&&!r.body.includes('NEXT_HTTP_ERROR_FALLBACK;404')){
        assert.equal(id,'27');assert.equal(r.status,200);assert.match(r.headers['content-type'],/text\/x-component/);
        const missing={...foreign,p:randomUUID()},other=await request(actor,pathFor(entry.route,missing),'GET',undefined,headers);
        assert.equal(other.status,r.status);assert.equal(r.body.replaceAll(foreign.p,'PROJECT'),other.body.replaceAll(missing.p,'PROJECT'),'Prefetch must contain only the same structural tree as an absent project');
      }observed.push(r.body);}});
  await check('XUSER-29',async()=>{for(const g of [a,b,a2]){g.objectAfter=await objectSnapshot(g);assert.deepEqual(g.objectAfter,g.objectBefore);}});
  for(const [id,g]of [['30',b],['31',a]])await check('XUSER-'+id,()=>{const after=dbSnapshot(g);assert.deepEqual(after,g.before);result.integrity.push({project:g.p,before:g.before,after,storageBefore:g.objectBefore,storageAfter:g.objectAfter});});
  assert.deepEqual(dbSnapshot(a2),a2.before);
  // Prove the valid action wire format reaches persistence on an own fixture.
  const actionControl=await action(a.actor,a2);assert.equal(actionControl.status,200);assert.ok(actionControl.body.includes('success'));
  assert.equal(ok(await a.actor.client.from('products').select('name').eq('id',a2.q).single()).name,'attacker change');
  await check('XUSER-32',()=>{assert.equal(counters.adminDb,0);assert.equal(count('admin-db'),0);});
  await check('XUSER-33',()=>{assert.equal(counters.adminStorage,0);assert.equal(count('admin-storage'),0);});
  await check('XUSER-34',async()=>{sql('update app_private.admission_limits set ai_user_hour=1');let calls=0;await assert.rejects(withPaidOperation(a2.actor.client,a2.p,'asset-analysis',{quotaProbe:randomUUID()},async()=>{calls++;}));assert.equal(calls,0);assert.equal(counters.deniedProviderCalls,0);result.positiveProviderCalls=positiveCalls;sql('update app_private.admission_limits set ai_user_hour=1000');});
  await check('XUSER-35',()=>{assert.equal(counters.capture,0);assert.equal(count('chromium-launch'),0);assert.equal(count('export-ticket'),0);});
  // Export positive control AFTER foreign attacks proves app instrumentation fires.
  phase='own export instrumentation';const ownExport=await a.actor.page.evaluate(async p=>{const r=await fetch(`/api/projects/${p}/export`,{method:'POST',headers:{'content-type':'application/json'},body:'{"format":"png"}'});return {status:r.status,headers:Object.fromEntries(r.headers),bytes:Array.from(new Uint8Array(await r.arrayBuffer()))};},a.p);
  assert.equal(ownExport.status,200,Buffer.from(ownExport.bytes).toString());assert.equal((await sharp(Buffer.from(ownExport.bytes)).metadata()).width,860);assert.match(ownExport.headers['cache-control'],/private.*no-store/);assert.equal(count('export-ticket'),1);assert.equal(count('chromium-launch'),1);
  await check('XUSER-24',async()=>{await a.actor.page.getByRole('button',{name:'로그아웃',exact:true}).click();await a.actor.page.waitForURL('**/login');assert.equal((await request(a.actor,`/api/projects/${a.p}/assets`)).status,401);assert.equal((await action(a.actor,a)).status,401);await a.actor.page.goto(appOrigin+'/projects/'+a.p);assert.equal(new URL(a.actor.page.url()).pathname,'/login');});
  await check('XUSER-25',async()=>{await login(a.actor.page,b.actor);noForeign(await a.actor.page.content(),a);await a.actor.page.goto(appOrigin+'/projects/'+b.p);const html=await a.actor.page.content();assert.ok(html.includes(b.name));noForeign(html,a);});
  await check('XUSER-39',async()=>{for(const suffix of ['','/images','/render']){const r=await request(a.actor,'/projects/'+a.p+suffix,'GET',undefined,{RSC:'1'});noForeign(r.body,a);assert.ok(r.status===404||r.body.includes('NEXT_HTTP_ERROR_FALLBACK;404'));}const r=await request(a.actor,`/api/projects/${b.p}/assets`);assert.equal(r.status,200);noForeign(r.body,a);assert.match(r.headers['cache-control'],/no-store/);});
  await check('XUSER-36',async()=>{await Promise.all(pendingResponses);for(const text of [...observed,appLog])safe(text);const files=walk('.next/static').filter(f=>/\.(js|json|html)$/.test(f));for(const f of files){const text=readFileSync(f,'utf8');safe(text);assert.doesNotMatch(text,/SUPABASE_SERVICE_ROLE_KEY|DETAILFORGE_TICKET_SECRET|process\.env\.OPENAI_API_KEY/);}result.staticFiles=files.length;result.scannedResponses=observed.length;});
  await check('XUSER-37',()=>{assert.equal(external,0);assert.equal(count('external-blocked'),0);});
  await check('XUSER-38',()=>{assert.equal(count('chromium-external-attempt'),0);assert.equal(count('chromium-launch'),1);assert.equal(count('external-blocked'),0);});
  await check('XUSER-40',()=>{assert.equal(result.checks.length,39);assert.equal(new Set(result.checks.map(c=>c.id)).size,39);assert.equal(corpus.filter(r=>r.direction==='A→B').length,protectedEntries.length+1);assert.equal(corpus.filter(r=>r.direction==='B→A').length,protectedEntries.length+1);});
  result.counters={...counters,appEvents:Object.fromEntries([...new Set(events())].map(e=>[e,count(e)])),browserExternal:external};result.browser=browser.version();result.checkCount=result.checks.length;result.status='PASS';
}catch(error){result.status='FAIL';result.phase=phase;let message=String(error.stderr??error.stack??error.message);for(const s of secrets.filter(Boolean))message=message.replaceAll(s,'[REDACTED]');result.failure=message.slice(0,4000);process.exitCode=1;}
finally{
  appMode=false;await browser?.close().catch(()=>{});app?.kill();
  if(admin&&c){for(const g of graphs){await admin.storage.from('product-assets').remove([g.path].filter(Boolean));await g.actor.client.from('projects').delete().eq('id',g.p);}for(const actor of accounts){c.sql(`delete from app_private.export_tickets where actor='${actor.id}'; delete from app_private.admissions where actor='${actor.id}'`);await admin.auth.admin.deleteUser(actor.id);}}
  try{safe(appLog);writeFileSync(join(output,'app.log'),appLog);}catch{result.status='FAIL';result.failure='Sensitive app log suppressed';process.exitCode=1;}
  result.cleanup={localAccounts:accounts.length,localGraphs:graphs.length,volumesPreserved:true};
  const serialized=JSON.stringify(result,null,2);safe(serialized);writeFileSync(join(output,'runtime.json'),serialized+'\n');
  console.log(JSON.stringify({status:result.status,phase:result.phase,failure:result.failure,checks:result.checkCount,corpus:result.corpus.length},null,2));
}

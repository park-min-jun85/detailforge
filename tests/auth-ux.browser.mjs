// Real Next + GoTrue + PostgreSQL + Chromium, fixed isolated loopback only.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
import {connectLocal,localFetch,localTarget,appOrigin,apiOrigin,mailOrigin,output} from './helpers/auth-ux-local.mjs';
mkdirSync(output,{recursive:true});
const checks=[],secrets=[],run=randomUUID().replaceAll('-',''),accounts=[],responses=[],consoleText=[];
const result={status:'RUNNING',run,checks,remoteDbMutations:0,remoteAuthMutations:0,remoteStorageMutations:0,externalProviderCalls:0};
let phase='setup',app,browser,c,admin,appLog='',remoteRequests=0;
const check=async(name,fn)=>{phase=name;await fn();checks.push({name,status:'PASS'});};
const ok=r=>{assert.equal(r.error,null,r.error?.code??'Local fixture operation failed');return r.data;};
const secretFree=text=>{for(const value of secrets.filter(Boolean))assert.ok(!text.includes(value),'Secret value exposed');};
const password=()=>{const value='Local!'+randomUUID();secrets.push(value);return value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const report=()=>writeFileSync(join(output,'browser-runtime.json'),JSON.stringify(result,null,2)+'\n');
try {
  c=connectLocal();const {local,sql}=c;
  secrets.push(local.SERVICE_ROLE_KEY,local.SECRET_KEY,local.JWT_SECRET,local.S3_PROTOCOL_ACCESS_KEY_SECRET);
  assert.match(local.PUBLISHABLE_KEY,/^sb_publishable_/);
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:localFetch}};
  admin=createClient(apiOrigin,local.SERVICE_ROLE_KEY,options);
  if(sql("select to_regclass('public.projects') is null")==='t')
    for(const file of readdirSync('supabase/migrations').filter(n=>/^\d{4}_.*\.sql$/.test(n)).sort())sql(readFileSync('supabase/migrations/'+file,'utf8'));
  for(const label of ['a','b']){
    const email=`authux-${label}-${run}@example.test`,pass=password();
    const user=ok(await admin.auth.admin.createUser({email,password:pass,email_confirm:true})).user;
    accounts.push({id:user.id,email,pass});
  }
  const [a,b]=accounts;
  b.project=randomUUID();b.product=randomUUID();b.name='PRIVATE-B-'+run;
  ok(await admin.from('projects').insert({id:b.project,owner_id:b.id,name:b.name}));
  ok(await admin.from('products').insert({id:b.product,project_id:b.project,name:'PRIVATE-PRODUCT-'+run}));
  // Next receives explicit local env and an env-file/network guard in every worker.
  const env={...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',
    NODE_OPTIONS:'--require '+JSON.stringify(resolve('tests/helpers/auth-ux-app.cjs')),
    NEXT_PUBLIC_SUPABASE_URL:apiOrigin,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:local.PUBLISHABLE_KEY,
    SUPABASE_URL:apiOrigin,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY,
    DETAILFORGE_APP_ORIGIN:appOrigin,DETAILFORGE_TICKET_SECRET:password(),OPENAI_API_KEY:'',DOMEGGOOK_API_KEY:''};
  await new Promise((res,rej)=>{const s=createServer();s.once('error',rej);s.listen(3061,'127.0.0.1',()=>s.close(res));});
  const build=execFileSync(process.execPath,['node_modules/next/dist/bin/next','build'],{env,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
  secretFree(build);writeFileSync(join(output,'local-build.log'),build);
  app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3061'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  app.stdout.on('data',part=>appLog+=part);app.stderr.on('data',part=>appLog+=part);
  for(let i=0;i<100;i++){try{if((await localFetch(appOrigin+'/login')).status===200)break;}catch{}await wait(100);}
  assert.equal((await localFetch(appOrigin+'/login')).status,200);
  browser=await chromium.launch({headless:true,...(existsSync(chromium.executablePath())?{}:{channel:'chrome'})});
  const makeContext=async()=>{
    const ctx=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
    await ctx.route('**/*',route=>{try{localTarget(route.request().url());return route.continue();}catch{remoteRequests++;return route.abort();}});
    ctx.on('page',page=>{
      page.on('console',msg=>consoleText.push(msg.text()));page.on('pageerror',error=>consoleText.push(error.message));
      page.on('response',async res=>{try{if(/text\/html|text\/x-component|javascript|application\/json/.test(res.headers()['content-type']??''))responses.push(await res.text());}catch{}});
    });
    return ctx;
  };
  const ca=await makeContext(),cb=await makeContext(),anon=await makeContext();
  // Chromium treats loopback as secure; Playwright APIRequest does not send
  // Secure cookies over HTTP. Replay the real browser cookie jar in memory for
  // raw HTML/RSC assertions that need to inspect redirects without following.
  const rawGet=async(ctx,url,options={})=>ctx.request.get(url,{...options,headers:{...options.headers,
    cookie:(await ctx.cookies()).filter(c=>c.domain==='127.0.0.1').map(c=>`${c.name}=${c.value}`).join('; ')}});
  const rememberSession=async ctx=>{
    const chunks=(await ctx.cookies()).filter(c=>/auth-token(?:\.\d+)?$/.test(c.name)).sort((a,b)=>a.name.localeCompare(b.name));
    if(!chunks.length)return;
    const value=JSON.parse(Buffer.from(chunks.map(c=>c.value).join('').replace(/^base64-/,''),'base64url').toString());
    secrets.push(value.access_token,value.refresh_token);
  };
  const pa=await ca.newPage(),pb=await cb.newPage(),pn=await anon.newPage();
  const login=async(page,account,next='/projects')=>{
    await page.goto(appOrigin+'/login?'+new URLSearchParams({next}));
    await page.getByLabel('이메일',{exact:true}).fill(account.email);
    await page.getByLabel('비밀번호',{exact:true}).fill(account.pass);
    await page.getByRole('button',{name:'로그인',exact:true}).click();
    await page.waitForURL(url=>!url.pathname.startsWith('/login'),{timeout:15000});
    await page.getByRole('button',{name:'로그아웃',exact:true}).waitFor();
    await rememberSession(page.context());
  };
  await check('AUTHUX-01 anon login renders accessible form',async()=>{
    await pn.goto(appOrigin+'/login');await pn.getByRole('heading',{name:'로그인',exact:true}).waitFor();
    assert.equal(await pn.getByLabel('비밀번호',{exact:true}).getAttribute('autocomplete'),'current-password');
    await pn.screenshot({path:join(output,'login.png')});
  });
  await check('AUTHUX-02 anon direct/nested/RSC/prefetch redirects before protected render',async()=>{
    for(const path of ['/','/projects',`/projects/${b.project}`,`/projects/${b.project}/editor`]){
      for(const headers of [{},{RSC:'1','Next-Router-Prefetch':'1'}]){
        const r=await anon.request.get(appOrigin+path,{maxRedirects:0,headers});assert.equal(r.status(),307);
        assert.match(r.headers().location,/\/login\?next=/);assert.ok(!(await r.text()).includes(b.name));
      }
      await pn.goto(appOrigin+path);assert.equal(new URL(pn.url()).pathname,'/login');await pn.reload();
    }
  });
  await check('AUTHUX-03 real User A login establishes SSR cookie',async()=>{
    await login(pa,a);assert.ok((await ca.cookies()).some(c=>c.name.includes('auth-token')));
    const session=await rawGet(ca,appOrigin+'/auth/session');assert.equal(session.status(),200);
    assert.match(session.headers()['cache-control'],/no-store/);
  });
  await check('AUTHUX-04 invalid credentials fail generically without echo',async()=>{
    await pn.goto(appOrigin+'/login');await pn.getByLabel('이메일',{exact:true}).fill(a.email);
    await pn.getByLabel('비밀번호',{exact:true}).fill(password());await pn.getByRole('button',{name:'로그인',exact:true}).click();
    await pn.getByRole('alert').filter({hasText:'이메일과 비밀번호를 확인해 주세요.'}).waitFor();
    assert.equal(await pn.getByLabel('비밀번호',{exact:true}).inputValue(),'');
  });
  await check('AUTHUX-05 login restores safe internal next',async()=>{
    await login(pb,b,'/projects/'+b.project);assert.equal(new URL(pb.url()).pathname,'/projects/'+b.project);
  });
  await check('AUTHUX-06 external and encoded redirects never leave application',async()=>{
    for(const next of ['https://example.com','//example.com','%2F%2Fevil.example','javascript:alert(1)','\\evil.example','/\\evil.example','/%252f%252fevil.example','https://u:p@example.com']){
      const r=await rawGet(ca,appOrigin+'/login?'+new URLSearchParams({next}),{maxRedirects:0});
      assert.equal(new URL(r.headers().location,appOrigin).href,appOrigin+'/projects');
    }
  });
  await check('AUTHUX-07 signed-in login and signup redirect without loop',async()=>{
    for(const path of ['/login','/signup']){await pa.goto(appOrigin+path);assert.equal(new URL(pa.url()).pathname,'/projects');}
  });
  await check('AUTHUX-08 signup validation and same-origin enforcement',async()=>{
    await pn.goto(appOrigin+'/signup');await pn.getByLabel('이메일',{exact:true}).fill('bad');
    await pn.getByLabel('비밀번호',{exact:true}).fill('short');await pn.getByRole('button',{name:'가입 요청'}).click();
    assert.equal(new URL(pn.url()).pathname,'/signup');
    const r=await anon.request.post(appOrigin+'/auth/signup',{headers:{origin:appOrigin},data:{email:'valid@example.test',password:'short'}});assert.equal(r.status(),400);
    const csrf=await anon.request.post(appOrigin+'/auth/signin',{headers:{origin:'https://example.com'},data:{email:a.email,password:a.pass}});assert.equal(csrf.status(),403);
  });
  const signup={email:`authux-c-${run}@example.test`,pass:password()};let confirmationLink;
  await check('AUTHUX-09 actual signup requires configured email confirmation without session',async()=>{
    await pn.getByLabel('이메일',{exact:true}).fill(signup.email);await pn.getByLabel('비밀번호',{exact:true}).fill(signup.pass);
    await pn.getByRole('button',{name:'가입 요청'}).click();await pn.getByRole('status').filter({hasText:'확인 메일'}).waitFor();
    signup.id=sql(`select id from auth.users where email='${signup.email}'`);assert.ok(signup.id);accounts.push(signup);
    assert.equal(sql(`select email_confirmed_at is null from auth.users where id='${signup.id}'`),'t');
    assert.equal((await anon.request.get(appOrigin+'/auth/session')).status(),401);
    // Mailpit local API only; verification token is held in memory, never saved.
    const list=await (await localFetch(mailOrigin+'/api/v1/messages')).json();
    const message=list.messages.find(m=>m.To?.some(to=>to.Address===signup.email));assert.ok(message,'Local confirmation email missing');
    const mail=await (await localFetch(mailOrigin+'/api/v1/message/'+message.ID)).json();
    confirmationLink=mail.HTML.match(/href="([^"]*\/auth\/v1\/verify[^\"]*)"/)?.[1]?.replaceAll('&amp;','&');
    assert.ok(confirmationLink);localTarget(confirmationLink);
    result.confirmationRequired=true;
  });
  await check('AUTHUX-10 email confirmation PKCE callback reaches protected app; replay fails safely',async()=>{
    await pn.goto(confirmationLink);await pn.waitForURL(appOrigin+'/projects');await pn.getByRole('button',{name:'로그아웃',exact:true}).waitFor();
    await rememberSession(anon);
    assert.equal(sql(`select email_confirmed_at is not null from auth.users where id='${signup.id}'`),'t');
    const invalid=await anon.request.get(appOrigin+'/auth/callback?code=invalid&next=https://example.com',{maxRedirects:0});
    assert.equal(new URL(invalid.headers().location,appOrigin).href,appOrigin+'/login?notice=confirmation_failed');
    // A verification link cannot establish a new session in another browser.
    const replayContext=await makeContext();const replayPage=await replayContext.newPage();await replayPage.goto(confirmationLink);
    assert.equal((await replayContext.request.get(appOrigin+'/auth/session')).status(),401);await replayContext.close();
  });
  await check('AUTHUX-11 browser Project create derives owner from verified principal',async()=>{
    await pa.goto(appOrigin+'/projects/new');await pa.getByLabel('프로젝트명',{exact:false}).fill('OWN-A-'+run);
    await pa.getByRole('button',{name:'프로젝트 생성',exact:true}).click();await pa.waitForURL(/\/projects\?created=1$/);
    a.project=sql(`select id from public.projects where owner_id='${a.id}' and name='OWN-A-${run}'`);assert.ok(a.project);
  });
  await check('AUTHUX-12 A sees own Project',async()=>{await pa.getByText('OWN-A-'+run,{exact:true}).waitFor();assert.ok(!(await pa.content()).includes(b.name));
    await pa.screenshot({path:join(output,'own-project.png')});});
  await check('AUTHUX-13 B cannot see A Project in HTML or RSC',async()=>{
    await pb.goto(appOrigin+'/projects');assert.ok(!(await pb.content()).includes('OWN-A-'+run));
    const r=await pb.evaluate(async()=>{const r=await fetch('/projects',{headers:{RSC:'1'},cache:'no-store'});return {status:r.status,text:await r.text()};});
    assert.equal(r.status,200);assert.ok(!r.text.includes('OWN-A-'+run));assert.ok(r.text.includes(b.name));
  });
  await check('AUTHUX-14 A exact B Project/product/image routes disclose no foreign data',async()=>{
    for(const path of [`/projects/${b.project}`,`/projects/${b.project}/images`,`/api/projects/${b.project}/assets`]){
      if(!path.startsWith('/api/')){
        await pa.goto(appOrigin+path);await pa.getByRole('heading',{name:'프로젝트를 찾을 수 없습니다.'}).waitFor();
      }
      for(const headers of [{},{RSC:'1'}]){
        const r=await pa.evaluate(async({path,headers})=>{const r=await fetch(path,{headers,cache:'no-store'});return {status:r.status,text:await r.text(),url:r.url,type:r.headers.get('content-type')};},{path,headers});const text=r.text;
        result.foreignResponses??=[];result.foreignResponses.push({kind:path.endsWith('/images')?'images':path.startsWith('/api/')?'assets':'product',rsc:Boolean(headers.RSC),status:r.status,type:r.type,finalPath:new URL(r.url).pathname.replace(b.project,'[project]'),notFound:/프로젝트를 찾을 수 없습니다\.|NEXT_HTTP_ERROR_FALLBACK;404/.test(text)});
        if(path.startsWith('/api/'))assert.equal(r.status,404);
        else assert.ok(r.status===404||/NEXT_HTTP_ERROR_FALLBACK;404|프로젝트를 찾을 수 없습니다\./.test(text));
        assert.ok(!text.includes(b.name));assert.ok(!text.includes('PRIVATE-PRODUCT-'+run));assert.ok(!text.includes('/object/sign/'));
      }
    }
  });
  await check('AUTHUX-15 POST logout clears browser auth cookies and session',async()=>{
    await pa.getByRole('button',{name:'로그아웃',exact:true}).click();await pa.waitForURL(appOrigin+'/login');
    assert.equal((await ca.request.get(appOrigin+'/auth/session')).status(),401);
    assert.ok(!(await ca.cookies()).some(c=>c.name.includes('auth-token')&&c.value));
  });
  await check('AUTHUX-16 logout back/refresh/direct protected access returns to login',async()=>{
    await pa.goBack();await wait(300);await pa.goto(appOrigin+'/projects');await pa.reload();
    assert.equal(new URL(pa.url()).pathname,'/login');assert.ok(!(await pa.content()).includes('OWN-A-'+run));
  });
  await check('AUTHUX-17 invalid/stale cookie fails closed; real refresh persists new cookies',async()=>{
    const before=await cb.cookies(),auth=before.filter(c=>c.name.includes('auth-token'));assert.ok(auth.length);
    const full=auth.sort((a,b)=>a.name.localeCompare(b.name)).map(c=>c.value).join('');
    const session=JSON.parse(Buffer.from(full.replace(/^base64-/,''),'base64url').toString());
    secrets.push(session.access_token,session.refresh_token);session.expires_at=1;
    await cb.clearCookies();await cb.addCookies([{name:auth[0].name.replace(/\.\d+$/,''),value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:appOrigin}]);
    await pb.goto(appOrigin+'/projects');assert.equal(new URL(pb.url()).pathname,'/projects');
    const refreshed=await cb.cookies();assert.notDeepEqual(refreshed.map(c=>c.value),auth.map(c=>c.value));
    await rememberSession(cb);
    await ca.addCookies([{name:auth[0].name.replace(/\.\d+$/,''),value:'base64-invalid-cookie',url:appOrigin}]);
    await pa.goto(appOrigin+'/projects');assert.equal(new URL(pa.url()).pathname,'/login','malformed cookie must fail closed');
    // A still-valid access JWT can remain usable until expiry even after refresh
    // revocation. Use an invalid access signature as well, not a forged claim
    // that the server must reject a genuinely valid access token.
    ok(await admin.auth.admin.signOut(session.access_token,'local'));
    const stale={...session,access_token:session.access_token.slice(0,-12)+'invalid-signature'};
    await ca.addCookies([{name:auth[0].name.replace(/\.\d+$/,''),value:'base64-'+Buffer.from(JSON.stringify(stale)).toString('base64url'),url:appOrigin}]);
    await pa.goto(appOrigin+'/projects');assert.equal(new URL(pa.url()).pathname,'/login','expired metadata with revoked refresh must fail closed');
  });
  await check('AUTHUX-18 anon direct Server Action POST cannot mutate',async()=>{
    const count=sql('select count(*) from public.projects');
    const manifest=JSON.parse(readFileSync('.next/server/server-reference-manifest.json','utf8'));
    const action=Object.keys(manifest.node)[0];assert.ok(action);
    const r=await ca.request.post(appOrigin+'/projects/new',{headers:{'Next-Action':action,origin:appOrigin},data:[]});
    assert.equal(r.status(),401);assert.equal(sql('select count(*) from public.projects'),count);
  });
  await check('AUTHUX-19 HTML/RSC/static/console contain no secret/password/token',async()=>{
    await wait(100);for(const text of [...responses,...consoleText,appLog])secretFree(text);
    const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
    const files=walk('.next/static').filter(f=>/\.(js|map)$/.test(f));for(const file of files){const text=readFileSync(file,'utf8');secretFree(text);assert.doesNotMatch(text,/SUPABASE_SERVICE_ROLE_KEY|createSupabaseAdminClient/);}
    for(const page of [pa,pb,pn]){assert.doesNotMatch(page.url(),/access_token|refresh_token|password=/);
      assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>/supabase|auth-token/.test(k))),false);}
    result.secretScan={responses:responses.length,staticFiles:files.length,findings:0};
  });
  await check('AUTHUX-20 browser and app remain on fixed local endpoints',async()=>{
    assert.equal(remoteRequests,0);assert.ok(!appLog.includes('Nonlocal test network target rejected'));
    assert.throws(()=>localTarget('https://remote.supabase.co'));
  });
  result.status='PASS';result.browser='Playwright '+JSON.parse(readFileSync('node_modules/playwright/package.json','utf8')).version+' / Chromium '+browser.version();
} catch(error) {
  result.status='FAIL';result.phase=phase;let message=String(error?.message??error);
  for(const value of secrets.filter(Boolean))message=message.replaceAll(value,'[redacted]');
  result.error=message.replace(/(code|token|token_hash)=[^\s&]+/g,'$1=[redacted]').slice(0,1200);
} finally {
  if(browser)await browser.close();if(app)app.kill();
  if(c&&admin){
    const owned=JSON.parse(c.sql(`select coalesce(jsonb_agg(id),'[]') from auth.users where email like 'authux-%-${run}@example.test'`));
    for(const id of owned){try{c.sql(`delete from public.projects where owner_id='${id}'`);ok(await admin.auth.admin.deleteUser(id));}catch{result.cleanupFailed=true;result.status='FAIL';}}
  }
  try {
    const mail=await (await localFetch(mailOrigin+'/api/v1/messages')).json();
    const ids=mail.messages.filter(m=>m.To?.some(to=>to.Address.endsWith('-'+run+'@example.test'))).map(m=>m.ID);
    if(ids.length)assert.ok((await localFetch(mailOrigin+'/api/v1/messages',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({IDs:ids})})).ok);
    result.mailFixturesDeleted=ids.length;
  } catch {result.status='FAIL';result.mailCleanupFailed=true;}
  result.checkCount=checks.length;result.localFixturesCreated=accounts.length;
  if(c)result.remainingFixtures=Number(c.sql(`select count(*) from auth.users where email like 'authux-%-${run}@example.test'`));
  for(const value of secrets.filter(Boolean))appLog=appLog.replaceAll(value,'[redacted]');
  // Do not persist callback URLs, cookies, request bodies, traces or auth mail.
  writeFileSync(join(output,'app.log'),appLog.replace(/(code|token|token_hash)=[^\s&]+/g,'$1=[redacted]'));
  report();
}
console.log(JSON.stringify(result,null,2));if(result.status!=='PASS')process.exitCode=1;

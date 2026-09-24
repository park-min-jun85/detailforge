import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {inspect} from 'node:util';
import ts from 'typescript';
import {NextRequest} from 'next/server';
import {createBrowserAuthClient} from '../src/lib/auth/browser.ts';
import {readPublicAuthConfig,requirePublicAuthConfig,authCookieOptions} from '../src/lib/auth/config.ts';
import {createSessionClient} from '../src/lib/auth/session.ts';
import {getCurrentUser,requireCurrentUser} from '../src/lib/auth/principal.ts';
import {requireApiUser,requirePageUser} from '../src/lib/auth/guards.ts';
import {safeReturnPath,loginLocation} from '../src/lib/auth/return-path.ts';
import {updateAuthSession} from '../src/lib/auth/proxy.ts';
import {signInWithPassword,signUpWithPassword,signOut,MAX_AUTH_BODY_BYTES} from '../src/lib/auth/mutations.ts';
import {AuthFailure} from '../src/lib/auth/errors.ts';
import {createSupabaseAdminClient} from '../src/lib/supabase/admin.ts';
import {createSupabaseServerClient} from '../src/lib/supabase/server.ts';
import {AUTH_URL,PUBLIC_KEY,APP_ORIGIN,USER_A,USER_B,COOKIE_NAME,identity,session,cookieJar,authEnvironment,authFetch,json,authRequest} from './helpers/auth.mjs';

test('AUTH-01 browser client uses only validated public config; legacy alias remains privileged',t=>{
  authEnvironment(t);const client=createBrowserAuthClient();assert.equal(client.supabaseUrl,AUTH_URL);assert.equal(client.supabaseKey,PUBLIC_KEY);
  assert.equal(createSupabaseServerClient,createSupabaseAdminClient);assert.deepEqual(authCookieOptions(),{path:'/',sameSite:'lax',httpOnly:false,secure:process.env.NODE_ENV==='production'});
});

test('AUTH-02 server SDK sends the public apikey and request access token to Auth, never trusts cookie user',async t=>{
  authEnvironment(t);const value=session();value.user=identity(USER_B);const jar=cookieJar(value),calls=authFetch(t);
  const user=await getCurrentUser(createSessionClient(jar.adapter));assert.deepEqual(user,{userId:USER_A});assert.ok(Object.isFrozen(user));
  assert.equal(calls.length,1);assert.equal(calls[0].url.pathname,'/auth/v1/user');assert.equal(calls[0].init.headers.apikey,PUBLIC_KEY);
  assert.equal(calls[0].init.headers.Authorization,`Bearer ${value.access_token}`);assert.equal(calls[0].init.cache,'no-store');
});

test('AUTH-03 browser source graph excludes privileged and Node-only runtime modules',()=>{
  const seen=new Set();function walk(file){file=resolve(file);if(seen.has(file))return;seen.add(file);const text=readFileSync(file,'utf8'),sf=ts.createSourceFile(file,text,99,true);
    assert.doesNotMatch(text,/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|node:crypto|node:fs|server-only|sharp/);
    for(const stmt of sf.statements){if(!ts.isImportDeclaration(stmt)||stmt.importClause?.isTypeOnly)continue;const s=stmt.moduleSpecifier.text;
      assert.ok(!['fs','crypto','sharp','server-only'].includes(s));if(s.startsWith('.'))walk(resolve(dirname(file),s+'.ts'));else if(s.startsWith('@/'))walk(resolve('src',s.slice(2)+'.ts'));else assert.equal(s,'@supabase/ssr');}}
  walk('src/lib/auth/browser.ts');assert.ok(seen.size>=3);
  for(const file of readdirSync('src/lib/auth').filter(f=>f.endsWith('.ts'))){const text=readFileSync('src/lib/auth/'+file,'utf8');assert.doesNotMatch(text,/SUPABASE_SERVICE_ROLE_KEY|lib\/supabase\/(?:admin|server)["']/);}
});

test('AUTH-04 request-scoped A/B clients return separate minimal principals',async t=>{
  authEnvironment(t);const a=session(USER_A),b=session(USER_B);authFetch(t,({init})=>json(identity(init.headers.Authorization===`Bearer ${a.access_token}`?USER_A:USER_B)));
  const ca=createSessionClient(cookieJar(a).adapter),cb=createSessionClient(cookieJar(b).adapter);assert.notEqual(ca,cb);
  assert.deepEqual(await Promise.all([requireCurrentUser(ca),requireCurrentUser(cb)]),[{userId:USER_A},{userId:USER_B}]);
});

test('AUTH-05 missing session gives null, safe 401 and page redirect; never makes an Auth request',async t=>{
  authEnvironment(t);const calls=authFetch(t),client=createSessionClient(cookieJar().adapter);
  assert.equal(await getCurrentUser(client),null);await assert.rejects(requireCurrentUser(client),e=>e.code==='unauthenticated');
  const guard=await requireApiUser(client);assert.equal(guard.ok,false);assert.equal(guard.response.status,401);assert.match(guard.response.headers.get('cache-control'),/no-store/);
  assert.equal((await guard.response.json()).error.code,'unauthenticated');
  await assert.rejects(requirePageUser('/projects/known/editor',client),e=>e.digest?.includes('/login?next=%2Fprojects%2Fknown%2Feditor'));
  assert.equal(calls.length,0);
});

test('AUTH-06 identity and provider override fields are rejected before client creation',async t=>{
  authEnvironment(t);for(const extra of [{userId:USER_B},{ownerId:USER_A},{options:{data:{role:'admin'}}},{redirectTo:'https://evil.example'}]){
    let created=0;const response=await signInWithPassword(authRequest({email:'user-a@example.test',password:'fixture-password',...extra}),async()=>{created++;throw Error();});
    assert.equal(response.status,400);assert.equal(created,0);
  }
});

for(const [code,status,expected]of [['invalid_credentials',400,'invalid_credentials'],['email_not_confirmed',400,'invalid_credentials'],['over_request_rate_limit',429,'rate_limited'],['unexpected_failure',500,'temporary_failure']]){
  test(`AUTH-07 safe sign-in category ${code}`,async t=>{
    authEnvironment(t);authFetch(t,()=>json({code,msg:'raw-private-provider-password-token'},status));const client=createSessionClient(cookieJar().adapter);
    const response=await signInWithPassword(authRequest(),async()=>client);const text=await response.text();assert.equal(JSON.parse(text).error.code,expected);assert.doesNotMatch(text,/raw-private|password-token/);
  });
}

test('AUTH-07 successful sign-in persists SDK cookies and revalidates principal',async t=>{
  authEnvironment(t);const jar=cookieJar(),calls=authFetch(t,({url})=>url.pathname.endsWith('/user')?json(identity()):json(session()));
  const response=await signInWithPassword(authRequest(),async()=>createSessionClient(jar.adapter));assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{status:'signed_in',principal:{userId:USER_A}});assert.ok(jar.values.has(COOKIE_NAME));assert.equal(calls.length,2);
});

test('AUTH-08 signout removes SDK cookies, requests local scope and returns cache-clear contract',async t=>{
  authEnvironment(t);const jar=cookieJar(session()),calls=authFetch(t,()=>new Response(null,{status:204}));
  const response=await signOut(authRequest({}),async()=>createSessionClient(jar.adapter));assert.equal(response.status,200);assert.equal(jar.values.size,0);
  assert.deepEqual(await response.json(),{status:'signed_out',clearClientState:true,next:'/login'});assert.equal(calls[0].url.searchParams.get('scope'),'local');assert.ok(jar.writes.some(c=>c.options.maxAge===0));
});

test('AUTH-08 anonymous signout is idempotent; provider failure is not reported as successful revocation',async t=>{
  authEnvironment(t);let client=createSessionClient(cookieJar().adapter);const calls=authFetch(t,()=>json({code:'unexpected_failure',msg:'private token'},500));
  assert.equal((await signOut(authRequest({}),async()=>client)).status,200);assert.equal(calls.length,0);
  const jar=cookieJar(session());client=createSessionClient(jar.adapter);const response=await signOut(authRequest({}),async()=>client);assert.equal(response.status,503);assert.equal(jar.values.size,0);assert.doesNotMatch(await response.text(),/private token/);
});

test('AUTH-09 return paths reject open redirects, encoded traversal and auth loops',()=>{
  for(const value of ['https://evil.example','//evil.example','/\\evil.example','/%2f%2fevil.example','/%252f%252fevil.example','/%0aevil','/projects/../../login','/projects/%2e%2e/login','/login?next=/projects','/api/projects','/projectsX','',null,'/projects#\nsecret','/projects/'+ 'a'.repeat(2100)])assert.equal(safeReturnPath(value),'/projects',String(value));
  for(const value of ['/','/projects','/projects/a/editor?view=preview#section','/settings','/templates'])assert.equal(safeReturnPath(value),value);
  assert.equal(loginLocation('https://evil.example'),'/login?next=%2Fprojects');
});

test('AUTH-10 expired cookie refreshes through SDK before user lookup',async t=>{
  authEnvironment(t);const jar=cookieJar(session(USER_A,1)),calls=authFetch(t,({url})=>url.pathname.endsWith('/token')?json(session()):json(identity()));
  assert.deepEqual(await requireCurrentUser(createSessionClient(jar.adapter)),{userId:USER_A});assert.equal(calls.length,2);assert.equal(calls[0].url.searchParams.get('grant_type'),'refresh_token');assert.ok(jar.writes.length>0);
});

test('AUTH-10 invalid/expired refresh cannot produce a principal; forged JWT is sent for verification',async t=>{
  authEnvironment(t);const calls=authFetch(t,({url})=>json({code:url.pathname.endsWith('/token')?'refresh_token_not_found':'bad_jwt',msg:'private bad token'},401));
  for(const value of [session(USER_B),session(USER_A,1)]){const guard=await requireApiUser(createSessionClient(cookieJar(value).adapter));assert.equal(guard.ok,false);assert.equal(guard.response.status,401);}
  assert.equal(calls.length,2);
});

test('AUTH-11 SDK chunk writes/deletions carry cache headers; refresh proxy forwards request and response cookies',async t=>{
  authEnvironment(t);const large=session();large.user.user_metadata={fixture:'x'.repeat(10000)};const jar=cookieJar();
  authFetch(t,({url})=>url.pathname.endsWith('/token')?json(large):json(identity()));
  const client=createSessionClient(jar.adapter);assert.equal((await client.auth.signInWithPassword({email:'user-a@example.test',password:'fixture-password'})).error,null);
  assert.ok(jar.values.size>1);assert.match(jar.cacheHeaders.get('cache-control'),/private.*no-store/);
  const old=cookieJar(session(USER_A,1));const request=new NextRequest(APP_ORIGIN+'/projects',{headers:{cookie:[...old.values].map(([k,v])=>`${k}=${v}`).join('; ')}});
  const response=await updateAuthSession(request);assert.equal(response.status,200);assert.ok(response.cookies.getAll().length>1);
  assert.ok(request.cookies.getAll().some(c=>c.name===COOKIE_NAME+'.0'));assert.match(response.headers.get('x-middleware-request-cookie'),/sb-auth-fixture-auth-token\.0=/);
  assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('expires'),'0');assert.equal(response.headers.get('pragma'),'no-cache');
});

test('AUTH-12 missing public env is explicit for Auth and pass-through only for the legacy refresh proxy',async t=>{
  authEnvironment(t);delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.equal(readPublicAuthConfig(),null);assert.throws(requirePublicAuthConfig,e=>e.code==='configuration');assert.throws(createBrowserAuthClient,e=>e.code==='configuration');
  assert.equal((await updateAuthSession(new NextRequest(APP_ORIGIN+'/projects'))).status,200);
  await assert.rejects(getCurrentUser(),e=>e instanceof AuthFailure && e.code==='configuration');
});

test('AUTH-12 partial/secret/legacy key and mixed-project config fail closed without echoing values',t=>{
  authEnvironment(t);for(const key of ['', 'sb_secret_fixture_do_not_expose','eyJfixture.payload.signature','raw-private-key']){
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=key;assert.throws(readPublicAuthConfig,e=>e.code==='configuration'&&!e.message.includes(key||'fixture'));
  }
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=PUBLIC_KEY;
  for(const url of ['http://remote.example','https://u:p@auth.example','https://auth.example/path','https://auth.example?key=secret']){process.env.NEXT_PUBLIC_SUPABASE_URL=url;assert.throws(readPublicAuthConfig,e=>e.code==='configuration');}
  process.env.NEXT_PUBLIC_SUPABASE_URL=AUTH_URL;process.env.SUPABASE_URL='https://other.supabase.co';assert.throws(()=>createSessionClient(cookieJar().adapter),e=>e.code==='configuration');
});

test('AUTH-13 network errors remain bounded, not an unauthenticated redirect',async t=>{
  authEnvironment(t);const client={auth:{getUser:async()=>{throw Error('URL password access_token refresh_token Authorization private');}}};
  const result=await requireApiUser(client);assert.equal(result.response.status,503);assert.doesNotMatch(await result.response.text(),/URL|password|access_token|refresh_token|Authorization|private/);
  await assert.rejects(requirePageUser('/projects',client),e=>e.code==='temporary_failure'&&!e.digest);
});

test('AUTH-14 application auth code never logs or stores tokens outside the SDK',()=>{
  for(const file of readdirSync('src/lib/auth').filter(f=>f.endsWith('.ts'))){const text=readFileSync('src/lib/auth/'+file,'utf8');assert.doesNotMatch(text,/console\.|localStorage|sessionStorage|\.auth\.getSession\(|jwtDecode|decodeJwt|Buffer\.from/);}
});

test('AUTH-14 SDK refresh and malformed-cookie logs cannot include provider text, password or token values',async t=>{
  authEnvironment(t);const logs=[];t.mock.method(console,'error',(...items)=>logs.push(items.map(i=>inspect(i)).join(' ')));t.mock.method(console,'warn',(...items)=>logs.push(items.map(i=>inspect(i)).join(' ')));
  authFetch(t,()=>json({code:'refresh_token_not_found',msg:'private-provider-password-token-sentinel'},401));
  assert.equal(await getCurrentUser(createSessionClient(cookieJar(session(USER_A,1)).adapter)),null);
  for(const corrupted of ['base64-'+Buffer.from('private-cookie-value-sentinel').toString('base64url'),'base64-!private-cookie-value-sentinel']){
    const jar=cookieJar();jar.values.set(COOKIE_NAME,corrupted);assert.equal(await getCurrentUser(createSessionClient(jar.adapter)),null);
  }
  assert.doesNotMatch(logs.join('\n'),/private-provider-password-token-sentinel|private-cookie-value-sentinel|fixture-refresh-only|fixture-signature/);
});

test('authenticated API and page guards allow the verified minimal principal',async t=>{
  authEnvironment(t);authFetch(t);const client=createSessionClient(cookieJar(session()).adapter);
  const api=await requireApiUser(client);assert.equal(api.ok,true);assert.deepEqual(api.principal,{userId:USER_A});assert.match(api.headers.get('cache-control'),/no-store/);
  assert.deepEqual(await requirePageUser('/projects',client),{userId:USER_A});
});

test('signup hides duplicate identity, provider payload and avoids implicit login with confirmation disabled',async t=>{
  authEnvironment(t);const bodies=[];
  for(const duplicate of [false,true]){
    authFetch(t,()=>duplicate?json({code:'user_already_exists',msg:'private-user-exists'},422):json(identity()));
    const response=await signUpWithPassword(authRequest(),async()=>createSessionClient(cookieJar().adapter));assert.equal(response.status,200);bodies.push(await response.json());
  }
  assert.deepEqual(bodies[0],bodies[1]);
  const jar=cookieJar();authFetch(t,({url})=>url.pathname.endsWith('/logout')?new Response(null,{status:204}):json(session()));
  assert.equal((await signUpWithPassword(authRequest(),async()=>createSessionClient(jar.adapter))).status,200);assert.equal(jar.values.size,0);
});

test('auth mutation bounds reject malformed/oversized inputs before network; password whitespace is unchanged',async t=>{
  authEnvironment(t);let created=0;const factory=async()=>{created++;throw Error('must not create');};
  for(const body of [{email:'not-an-email',password:'x'},{email:'user-a@example.test',password:''},{email:'user-a@example.test',password:'x'.repeat(1025)},{email:'x'.repeat(255)+'@example.test',password:'x'},null,[]])assert.equal((await signInWithPassword(authRequest(body),factory)).status,400);
  assert.equal((await signInWithPassword(authRequest({}, {body:'x'.repeat(MAX_AUTH_BODY_BYTES+1)}),factory)).status,400);
  assert.equal((await signInWithPassword(authRequest({}, {body:'{broken'}),factory)).status,400);assert.equal(created,0);
  const calls=authFetch(t,()=>json({code:'invalid_credentials'},400));await signInWithPassword(authRequest({email:'user-a@example.test',password:'  preserve spaces  '}),async()=>createSessionClient(cookieJar().adapter));
  assert.equal(JSON.parse(calls[0].init.body).password,'  preserve spaces  ');
});

test('auth mutations reject missing/foreign Origin, Host spoof and wrong method; login CSRF is included',async t=>{
  authEnvironment(t);let created=0;const factory=async()=>{created++;throw Error();};
  for(const headers of [{origin:''},{origin:'null'},{origin:'https://evil.example'},{origin:'https://evil.example',host:'evil.example'}])assert.equal((await signInWithPassword(authRequest(undefined,{headers}),factory)).status,403);
  assert.equal((await signOut(new Request(APP_ORIGIN,{headers:{origin:APP_ORIGIN}}),factory)).status,403);assert.equal(created,0);
});

test('AUTH-15 foundation adds no auth UI/endpoints or blanket route redirects',()=>{
  const proxy=readFileSync('src/proxy.ts','utf8');assert.doesNotMatch(proxy,/redirect\(/);
  const appFiles=[];const walk=p=>{for(const e of readdirSync(p,{withFileTypes:true})){const f=p+'/'+e.name;if(e.isDirectory())walk(f);else appFiles.push(f);}};walk('src/app');
  assert.equal(appFiles.filter(f=>/\/(login|signup|auth)\//.test(f)).length,0);
});

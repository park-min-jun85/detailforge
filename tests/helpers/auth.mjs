export const AUTH_URL = 'https://auth-fixture.supabase.co';
export const PUBLIC_KEY = 'sb_publishable_fixture_not_a_real_key_056';
export const APP_ORIGIN = 'http://127.0.0.1:3056';
export const USER_A = '11111111-1111-4111-8111-111111111111';
export const USER_B = '22222222-2222-4222-8222-222222222222';
export const COOKIE_NAME = 'sb-auth-fixture-auth-token';
export const identity = (id = USER_A) => ({ id, email: id === USER_A ? 'user-a@example.test' : 'user-b@example.test',
  aud: 'authenticated', role: 'authenticated', email_confirmed_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });
export function session(id = USER_A, expiresAt = Math.floor(Date.now() / 1000) + 3600) {
  // Synthetic opaque token; tests mock Auth's verdict, not a production JWT verifier.
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return { access_token: `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,exp:expiresAt,aud:'authenticated'})}.fixture-signature`,
    refresh_token: 'fixture-refresh-only', expires_at: expiresAt, expires_in: 3600, token_type: 'bearer', user: identity(id) };
}
export function cookieJar(value) {
  const values = new Map(value ? [[COOKIE_NAME, 'base64-' + Buffer.from(JSON.stringify(value)).toString('base64url')]] : []);
  const writes = [], cacheHeaders = new Headers();
  return { values, writes, cacheHeaders, adapter: {
    getAll: () => [...values].map(([name,value])=>({name,value})),
    setAll: (changes, headers) => { writes.push(...changes); for(const {name,value,options} of changes){if(options.maxAge === 0)values.delete(name);else values.set(name,value);} for(const [name,value] of Object.entries(headers))cacheHeaders.set(name,value); },
  }};
}
export function authEnvironment(t) {
  const replacement = {NEXT_PUBLIC_SUPABASE_URL:AUTH_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:PUBLIC_KEY,SUPABASE_URL:AUTH_URL,DETAILFORGE_APP_ORIGIN:APP_ORIGIN};
  const previous = Object.fromEntries(Object.keys(replacement).map(k=>[k,process.env[k]]));
  Object.assign(process.env,replacement);
  t.after(()=>{for(const[k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
}
export const json = (data, status=200) => Response.json(data,{status,headers:{'x-supabase-api-version':'2024-01-01'}});
const fetchOwners = new WeakSet();
export function authFetch(t, respond = () => json(identity())) {
  const prior=globalThis.fetch,calls=[];
  if(!fetchOwners.has(t)){fetchOwners.add(t);t.after(()=>{globalThis.fetch=prior;});}
  globalThis.fetch=async(input,init)=>{const url=new URL(String(input));if(url.origin!==AUTH_URL)throw Error('Unexpected external Auth request');const call={url,init};calls.push(call);return respond(call);};
  return calls;
}
export function authRequest(body={email:'user-a@example.test',password:'fixture-password'}, options={}) {
  const {headers, ...rest}=options;
  return new Request(APP_ORIGIN+'/auth-future',{method:'POST',headers:{origin:APP_ORIGIN,'content-type':'application/json',...headers},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),...rest});
}

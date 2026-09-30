// Test subprocess only: do not load repository .env files or allow remote I/O.
// Node --require executes this guard before Next or any worker can load env.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module=require('node:module'),originalLoad=Module._load;
const origins=new Set(['http://127.0.0.1:3064','http://127.0.0.1:58821','http://127.0.0.1:58824']);
function allowed(input){const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if(!origins.has(url.origin)||url.username||url.password)throw Error('Nonlocal test network target rejected');}
const originalFetch=globalThis.fetch;
// Only fixed category names are persisted. Never URLs, headers, bodies or tokens.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {appendFileSync}=require('node:fs');
function event(category){if(process.env.OWN_EVENTS)appendFileSync(process.env.OWN_EVENTS,category+'\n');}
globalThis.fetch=(input,init)=>{
  const target=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if(target.href==='https://api.openai.com/v1/responses'){
    const headers=new Headers(init?.headers??input?.headers);
    if(headers.get('authorization')!=='Bearer own-local-fixture-key')throw Error('Unexpected provider credentials');
    // Replace the SDK transport before any DNS/socket to an external provider.
    // Do not forward authorization, cookies, or any production provider key.
    return originalFetch('http://127.0.0.1:58825/responses',{method:'POST',headers:{'content-type':'application/json'},body:init.body,redirect:'error',signal:init.signal});
  }
  try{allowed(input);}catch(error){event('external-blocked');throw error;}
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  const headers=new Headers(init?.headers??input?.headers);
  if(headers.get('authorization')==='Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY){
    if(url.pathname.startsWith('/rest/v1/rpc/')){
      const name=url.pathname.split('/').pop();
      if(!['reserve_admission','settle_admission','issue_export_ticket','use_export_ticket','close_export_ticket'].includes(name)){
        event('unexpected-privileged-rpc');throw Error('Unexpected privileged RPC');
      }
      event('rpc:'+name);
    }
    else if(url.pathname.startsWith('/rest/v1/'))event('admin-db');
    else if(url.pathname.startsWith('/storage/v1/'))event('admin-storage');
  }
  return originalFetch(input,{...init,redirect:'error'});
};
Module._load=function(name,parent,isMain){const loaded=originalLoad.call(this,name,parent,isMain);
  if(name==='@next/env'||name.endsWith('/@next/env/dist/index.js'))return {...loaded,
    loadEnvConfig:()=>({combinedEnv:process.env,parsedEnv:{},loadedEnvFiles:[]})};
  // Next's external ESM loader may enter through playwright-core rather than
  // the top-level package. Instrument the shared Chromium object in either path.
  if(loaded?.chromium?.launch&&!loaded.chromium.__own){
    const launch=loaded.chromium.launch.bind(loaded.chromium);
    loaded.chromium.launch=async(...args)=>{event('chromium-launch');const browser=await launch(...args),newContext=browser.newContext.bind(browser);
      browser.newContext=async(...args)=>{const context=await newContext(...args);context.on('request',r=>{try{allowed(r.url());}catch{event('chromium-external-attempt');}});return context;};return browser;};
    loaded.chromium.__own=true;
  }
  return loaded;
};

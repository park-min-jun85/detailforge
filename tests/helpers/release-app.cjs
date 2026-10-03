// Test subprocess only: do not load repository .env files or allow remote I/O.
// Node --require executes this guard before Next or any worker can load env.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module=require('node:module'),originalLoad=Module._load;
const origins=new Set(['http://127.0.0.1:3065','http://127.0.0.1:58921','http://127.0.0.1:58924']);
function allowed(input){const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if(!origins.has(url.origin)||url.username||url.password)throw Error('Nonlocal test network target rejected');}
const originalFetch=globalThis.fetch;
// Only fixed category names are persisted. Never URLs, headers, bodies or tokens.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {appendFileSync}=require('node:fs');
function event(category){if(process.env.RELEASE_EVENTS)appendFileSync(process.env.RELEASE_EVENTS,category+'\n');}
globalThis.fetch=(input,init)=>{
  try{allowed(input);}catch(error){event('external-blocked');throw error;}
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  const headers=new Headers(init?.headers??input?.headers);
  if(headers.get('authorization')==='Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY){
    if(url.pathname.startsWith('/rest/v1/rpc/'))event(url.pathname.endsWith('/issue_export_ticket')?'export-ticket':'privileged-rpc');
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
  if(loaded?.chromium?.launch&&!loaded.chromium.__release){
    const launch=loaded.chromium.launch.bind(loaded.chromium);
    loaded.chromium.launch=async(...args)=>{event('chromium-launch');const browser=await launch(...args),newContext=browser.newContext.bind(browser);
      browser.newContext=async(...args)=>{const context=await newContext(...args);context.on('request',r=>{try{allowed(r.url());}catch{event('chromium-external-attempt');}});return context;};return browser;};
    loaded.chromium.__release=true;
  }
  return loaded;
};

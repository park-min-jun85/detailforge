// Test subprocess only: do not load repository .env files or allow remote I/O.
// Node --require executes this guard before Next or any worker can load env.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module=require('node:module'),originalLoad=Module._load;
const origins=new Set(['http://127.0.0.1:3061','http://127.0.0.1:58521','http://127.0.0.1:58524']);
function allowed(input){const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if(!origins.has(url.origin)||url.username||url.password)throw Error('Nonlocal test network target rejected');}
const originalFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{allowed(input);return originalFetch(input,{...init,redirect:'error'});};
Module._load=function(name,parent,isMain){const loaded=originalLoad.call(this,name,parent,isMain);
  if(name==='@next/env'||name.endsWith('/@next/env/dist/index.js'))return {...loaded,
    loadEnvConfig:()=>({combinedEnv:process.env,parsedEnv:{},loadedEnvFiles:[]})};
  return loaded;
};

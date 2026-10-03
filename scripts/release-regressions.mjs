import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir='artifacts/TASK-065';
for(const [task,stack,file,expected,name]of [[58,'rls','rls-runtime.supabase.mjs',143,'rls'],[59,'storage','storage-runtime.supabase.mjs',74,'storage'],[60,'admission','admission-runtime.supabase.mjs',37,'admission'],[61,'auth','auth-ux.browser.mjs',20,'auth'],[62,'export','export-runtime.browser.mjs',27,'export'],[63,'cross-user','cross-user-runtime.browser.mjs',40,'cross-user'],[64,'own-user','own-user-runtime.browser.mjs',40,'own-user']]){
 if(process.argv[2]&&task<Number(process.argv[2]))continue;
 console.log('START TASK-'+task);
 const run=(args,label)=>{const r=spawnSync(process.execPath,args,{windowsHide:true,encoding:'utf8',timeout:600000,maxBuffer:32000000});writeFileSync(`${dir}/${label}.log`,(r.stdout??'')+(r.stderr??''));if(r.status!==0)throw Error(`${label} failed; see bounded log (exit ${r.status})`);};
 run([`scripts/${stack}-local-stack.mjs`,'start'],`${name}-start`);
 try{run(['--conditions=react-server','--import','./tests/register.mjs',`tests/${file}`],`${name}-runtime`);
 const path=`artifacts/TASK-0${task}/${task===61?'browser-runtime':'runtime'}.json`,r=JSON.parse(readFileSync(path,'utf8'));assert.equal(r.status,'PASS');assert.equal(r.checkCount,expected);copyFileSync(path,`${dir}/${name}-runtime.json`);console.log(`PASS TASK-${task}: ${expected}`);
 }finally{run([`scripts/${stack}-local-stack.mjs`,'stop'],`${name}-stop`);}
}

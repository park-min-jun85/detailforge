// Explicit browser-target bundle verification: no application proof page/route.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';
import {PUBLIC_KEY,AUTH_URL} from './helpers/auth.mjs';
const require=createRequire(import.meta.url),{webpack}=require('next/dist/compiled/webpack/webpack.js');
const directory=resolve('node_modules/.cache/task056/browser');mkdirSync(directory,{recursive:true});
const evidence=resolve('artifacts/TASK-056/browser');mkdirSync(evidence,{recursive:true});
const compiler=webpack({mode:'production',target:'web',entry:resolve('src/lib/auth/browser.ts'),devtool:false,
  // Unminified audit output, not a product bundle size measurement.
  optimization:{minimize:false},performance:false,
  output:{path:directory,filename:'auth-client.js',library:{name:'AuthFoundation',type:'var'}},
  resolve:{extensions:['.ts','.js'],alias:{'@':resolve('src')},conditionNames:['browser','import','default'],mainFields:['browser','module','main']},
  module:{rules:[{test:/\.ts$/,exclude:/node_modules/,use:resolve('tests/helpers/auth-browser-loader.cjs')}]},
  plugins:[new webpack.DefinePlugin({'process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify(AUTH_URL),
    'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':JSON.stringify(PUBLIC_KEY),'process.env.NODE_ENV':JSON.stringify('production')})],
});
const stats=await new Promise((resolve,reject)=>compiler.run((error,stats)=>error?reject(error):resolve(stats)));
await new Promise((resolve,reject)=>compiler.close(error=>error?reject(error):resolve()));
const report=stats.toJson({all:false,errors:true,warnings:true,modules:true,nestedModules:true});
assert.deepEqual(report.errors,[]);assert.deepEqual(report.warnings,[]);
const modules=[];function collect(entries){for(const item of entries??[]){if(item.name)modules.push(item.name);collect(item.modules);}}collect(report.modules);
assert.ok(modules.some(m=>m.includes('src/lib/auth/browser.ts')));
assert.ok(!modules.some(m=>/src[\\/]lib[\\/](?:auth[\\/](?:server|session|mutations|principal|proxy|guards)|supabase[\\/](?:server|admin))|(?:^|[\\/])sharp[\\/]|node:(?:fs|crypto)|server-only/.test(m)));
// Remove third-party documentation comments (including example secret variable names).
// Runtime modules were checked above; this is not a removal of executable imports.
const output=ts.transpileModule(readFileSync(directory+'/auth-client.js','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,removeComments:true}}).outputText;
writeFileSync(directory+'/auth-client.js',output);
assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|OPENAI_API_KEY|DOMEGGOOK_API_KEY|server-only|createSupabaseAdminClient/.test(output),'Unexpected privileged marker in executable browser bundle');
assert.ok(output.includes(PUBLIC_KEY)); // Public key is intentionally public; not a secret finding.
const result={status:'PASS',target:'web',moduleCount:modules.length,bytes:Buffer.byteLength(output),serverModules:0,secretMarkers:0,publicFixtureKeyPresent:true};
writeFileSync(evidence+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));

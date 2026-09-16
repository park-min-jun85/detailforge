import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
registerHooks({
 resolve(specifier,context,next){
  if(specifier === 'next/image' || specifier === 'next/link')return next(specifier+'.js',context);
  if(/^react(?:-dom)?(?:\/|$)/.test(specifier))return next(specifier,{...context,conditions:context.conditions.filter(c=>c!=='react-server')});
  if(specifier.startsWith('@/')){
   const target=path.join(root,'src',specifier.slice(2));
   for(const ext of ['.ts','.tsx'])if(existsSync(target+ext))return next(pathToFileURL(target+ext).href,context);
  }
  if(specifier.startsWith('.')&&context.parentURL&&!path.extname(specifier)){
   for(const ext of ['.ts','.tsx']){const target=new URL(specifier+ext,context.parentURL);if(existsSync(target))return next(target.href,context);}
  }
  return next(specifier,context);
 },
 load(url,context,next){
  if(url.endsWith('/node_modules/next/image.js'))return {format:'module',shortCircuit:true,source:'import image from "./dist/shared/lib/image-external.js"; export default image.default;'};
  if(url.endsWith('.module.css'))return {format:'module',shortCircuit:true,source:'export default new Proxy({}, {get:(_,key)=>String(key)});'};
  if(url.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};
  return next(url,context);
 }
});

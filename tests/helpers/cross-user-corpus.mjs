// Enumerate the source tree, not a hand-maintained subset of routes.
import {readdirSync,readFileSync} from 'node:fs';
import ts from 'typescript';
export function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);}
export function inventory(){
  const entries=[];
  for(const file of walk('src/app').filter(f=>/\/(page|route)\.tsx?$/.test(f))){
    const source=readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
    const route=file.replace(/^src\/app/,'').replace(/\/(page|route)\.tsx?$/,'')||'/';
    const methods=file.endsWith('/page.tsx')?['GET']:ast.statements.filter(s=>ts.isFunctionDeclaration(s)&&s.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)).map(s=>s.name?.text).filter(n=>/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(n));
    const auth=route.startsWith('/export-capture')?'one-time capability':/^\/(login|signup|auth)(\/|$)/.test(route)?'public/auth flow':'verified user';
    for(const method of methods)entries.push({file,route,method,kind:file.endsWith('/page.tsx')?'page':'route',auth,parameters:[...route.matchAll(/\[(\w+)\]/g)].map(m=>m[1]),boundary:route.includes('[projectId]')?'owned project, scoped child query + RLS':auth,foreign:route.includes('[projectId]')?'no foreign projection/mutation; same error as absent resource':'principal-specific or public'});
  }
  for(const file of walk('src/features').filter(f=>f.endsWith('.ts'))){const source=readFileSync(file,'utf8');if(!/^['"]use server['"];/.test(source))continue;
    const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
    for(const s of ast.statements.filter(s=>ts.isFunctionDeclaration(s)&&s.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)))entries.push({file,route:s.name.text,method:'POST',kind:'action',auth:'verified user',parameters:s.parameters.map(p=>p.name.getText(ast)),boundary:'verified principal + owned project/RLS',foreign:'no mutation; safe error'});
  }
  return entries.sort((a,b)=>(a.route+a.method).localeCompare(b.route+b.method));
}
export function pathFor(route,g){return route.replaceAll('[projectId]',g.p).replaceAll('[assetId]',g.asset).replaceAll('[sectionId]',g.section);}
export function payload(route,g){
  const revision=g.revision??new Date().toISOString();
  if(route.endsWith('/export'))return {format:'png'};
  if(route.endsWith('/options/import/apply'))return {productId:g.q,expectedVersion:1,token:g.ticket,selectedIds:[]};
  if(route.endsWith('/options/import'))return {productId:g.q,expectedVersion:1};
  if(route.endsWith('/sections/[sectionId]/options'))return {revision,productId:g.q,rowId:g.options,expectedVersion:1,expectedFingerprint:'a'.repeat(64),confirmEmpty:false};
  if(route.endsWith('/options'))return {productId:g.q,expectedVersion:1,options:{schemaVersion:1,groups:[]}};
  if(route.endsWith('/reorder'))return {detailPageId:g.page,orderedSectionIds:[g.section],expectedSections:[{id:g.section,updatedAt:revision}]};
  if(route.endsWith('/regenerate'))return {revision};
  if(route.endsWith('/apply-candidate'))return {candidate:{schemaVersion:1,projectId:g.p,productId:g.q,detailPageId:g.page,sectionId:g.section,baseUpdatedAt:revision,baseFingerprint:'a'.repeat(64),inputFingerprint:'b'.repeat(64),content:g.content,style:g.style,generatedAt:revision,expiresAt:new Date(Date.now()+60000).toISOString(),generationId:g.ticket,provider:'openai',model:'fixture'},signature:'0'.repeat(64)};
  if(route.endsWith('/sections/[sectionId]'))return {revision,fields:{headline:'attacker edit',subheadline:'attacker edit'},assetIds:[g.asset],style:g.style};
  if(route.endsWith('/retry'))return {expectedRevision:g.ticket};
  if(route.endsWith('/extract-product-shots/save'))return {schemaVersion:2,expectedRevision:g.ticket,items:[{candidateId:'a'.repeat(64)}]};
  if(route.endsWith('/wholesale-import/preview'))return {url:'https://example.com/product'};
  if(route.endsWith('/wholesale-import/images'))return {token:g.ticket,url:'https://example.com/product.png'};
  if(route.endsWith('/wholesale-import/save'))return {token:g.ticket,revision,values:{productName:'attacker edit'},selectedImageUrls:[]};
  if(route.endsWith('/sections/generate'))return {replaceExisting:true,expectedRevision:revision};
  return {};
}

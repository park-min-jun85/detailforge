import './register-renderer.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
const {createElement}=await import('react');
const {renderToStaticMarkup}=await import('react-dom/server');
const {SectionRenderer}=await import('../src/features/detail-renderer/section-renderer.tsx');
const {RenderSurface}=await import('../src/features/detail-renderer/surface.tsx');
const {RenderReview}=await import('../src/features/detail-renderer/review.tsx');
const {SectionPreview}=await import('../src/features/detail-editor/preview/section-preview.tsx');
const {getRenderView}=await import('../src/features/detail-renderer/service.ts');
const {mapCanonicalSections}=await import('../src/features/detail-renderer/model.ts');
const {defaultSectionStyle}=await import('../src/features/section-engine/schemas.ts');
const {generateSections}=await import('../src/features/section-engine/service.ts');
const {fixture,provider,sectionOutput}=await import('./helpers/section-fixtures.mjs');
const {projectId,assetRow}=await import('./helpers/section-db.mjs');
const html=(C,props)=>renderToStaticMarkup(createElement(C,props));
const copy=type=>sectionOutput({plan:{sections:[{key:'test',type,evidenceIds:[],assetIds:[]}]},evidenceSnapshot:[]}).sections[0];
const render=(content,style=defaultSectionStyle(content.type),assets=[])=>html(SectionRenderer,{content,style,assets});
const snapshot=s=>structuredClone({project:s.project,product:s.product,facts:s.facts,assets:s.assets,page:s.page,sections:s.sections});
async function seeded(fn){return fixture(async s=>{await generateSections(projectId,{},provider);const original=globalThis.fetch;
 globalThis.fetch=(url,init)=>{if(new URL(typeof url==='string'?url:url.url??url.toString()).hostname.endsWith('openai.com'))throw new Error('Paid AI forbidden');return original(url,init);};
 try{await fn(s);}finally{globalThis.fetch=original;}
});}

for(const type of ['hero','keyBenefits','feature','imageText','gallery','useCase','detail','specification','option','notice']){
 test('shared renderer supports '+type,()=>{const c=copy(type);const final=render(c);assert.match(final,new RegExp('data-section-type="'+type+'"'));assert.doesNotMatch(final,/선택|Property Inspector|수정|AI 후보/);assert.equal(html(SectionPreview,{section:{content:c,style:defaultSectionStyle(type)},assets:[]}),final);});
}
test('canonical order and width come from saved DB, never Planner ordering',()=>seeded(async s=>{
 s.sections.reverse().forEach((r,i)=>r.sort_order=i);s.page.width=860;const before=snapshot(s);s.requests=[];
 const view=await getRenderView(projectId);assert.deepEqual(view.sections.map(r=>r.id),s.sections.map(r=>r.id));assert.equal(view.width,860);
 assert.match(html(RenderSurface,view),/width:860px/);assert.deepEqual(snapshot(s),before);assert.ok(s.requests.every(r=>r.method==='GET'));
 s.page.width=960;assert.equal((await getRenderView(projectId)).width,960);
}));
test('bounded style tokens are mapped without raw CSS or HTML execution',()=>seeded(async s=>{
 const row=s.sections[0];for(const bad of [{...row.style,background:'#123456'},{...row.style,css:'color:red'},{...row.style,layout:'fixed'}])assert.throws(()=>mapCanonicalSections([{...row,style:bad}],s.page.id));
 const c=copy('hero');c.headline='<script>alert("x")</script>';assert.match(render(c),/&lt;script&gt;/);
 const css=readFileSync(new URL('../src/features/detail-renderer/renderer.module.css',import.meta.url),'utf8');
 for(const token of ['layout','align','density','background','emphasis','fit'])assert.match(css,new RegExp('data-'+token));
 assert.doesNotMatch(css,/position:\s*(fixed|sticky)|zoom:|transform:|100vh|overflow:\s*hidden/);
}));
test('null and empty optional contents have no empty title/list/cards/table boxes',()=>{
 const g=copy('gallery');g.title=null;assert.equal(render(g),'');
 assert.doesNotMatch(render(copy('hero')),/<p|<ul/);
 assert.doesNotMatch(render(copy('keyBenefits')),/<article/);
 assert.doesNotMatch(render(copy('option')),/<table|등록된 옵션/);
});
test('long Korean and model strings are preserved and wrapping/table contracts are bounded',()=>{
 const c=copy('specification');c.rows=[{label:'아주긴항목'.repeat(10),value:'MODEL-'.repeat(60),evidenceIds:[]}];const output=render(c);
 assert.ok(output.includes(c.rows[0].label)&&output.includes(c.rows[0].value));
 const css=readFileSync(new URL('../src/features/detail-renderer/renderer.module.css',import.meta.url),'utf8');
 assert.match(css,/overflow-wrap:anywhere/);assert.match(css,/word-break:keep-all/);assert.match(css,/table-layout:fixed/);
});
test('missing image fallback, Hero canonical assets and contain/cover',()=>{
 const id=randomUUID(),c=copy('hero');c.assetIds=[id];
 assert.match(render(c),/상품 이미지를 불러올 수 없습니다/);
 const output=render(c,{...defaultSectionStyle('hero'),imageFit:'cover'},[{id,name:'현재 Hero',previewUrl:'https://example.test/selected.png'}]);
 assert.match(output,/selected.png/);assert.match(output,/data-fit="cover"/);
 assert.doesNotMatch(output,/heroAssetId/);
});
test('useCase item images render at their own item, never duplicated',()=>{
 const id=randomUUID(),c=copy('useCase');c.assetIds=[id];c.items=[{title:'사용 상황',description:'고려할 수 있습니다.',evidenceIds:[],confidence:.7,assetIds:[id]}];
 const out=render(c,defaultSectionStyle('useCase'),[{id,name:'현재 상품',previewUrl:'https://example.test/a.png'}]);assert.equal((out.match(/<img /g)||[]).length,1);
});
test('missing or foreign assets are excluded, safe fallback without DB writes',()=>seeded(async s=>{
 const foreign=randomUUID();s.sections[0].content.assetIds=[foreign];s.assets=[assetRow({id:foreign,product_id:randomUUID()})];
 const before=snapshot(s);s.requests=[];const view=await getRenderView(projectId);
 assert.equal(view.readiness.missingImageCount,1);assert.equal(view.assets.length,0);assert.equal(view.state,'ready');assert.deepEqual(snapshot(s),before);assert.ok(s.requests.every(r=>r.method==='GET'));
}));
test('only referenced owned assets get transient signed URLs',()=>seeded(async s=>{
 const selected=assetRow(),unused=assetRow({id:randomUUID()});s.assets=[selected,unused];s.sections[0].content.assetIds=[selected.id];
 const previous=globalThis.fetch;let signedPaths=[];
 globalThis.fetch=(url,init)=>{if(String(url).includes('/storage/v1/object/sign/')){signedPaths=JSON.parse(init.body).paths;return Promise.resolve(Response.json(signedPaths.map(path=>({path,signedURL:'/object/sign/product-assets/'+path+'?token=transient'}))));}return previous(url,init);};
 const before=snapshot(s);s.requests=[];
 try{const view=await getRenderView(projectId);assert.deepEqual(signedPaths,[selected.storage_path]);assert.equal(view.assets.length,1);assert.match(view.assets[0].previewUrl,/token=transient/);assert.deepEqual(snapshot(s),before);assert.ok(s.requests.every(r=>r.method==='GET'));}
 finally{globalThis.fetch=previous;}
}));
test('stale Plan/Validation and manual grounding are warnings outside final surface',()=>seeded(async s=>{
 s.page.plan.latestResult.plannedAt=new Date().toISOString();s.facts.facts.brand='변경된 브랜드';s.sections[0].content.meta.groundingStatus='needs_review';
 const view=await getRenderView(projectId);assert.equal(view.state,'ready');assert.equal(view.readiness.stalePlan,true);assert.notEqual(view.readiness.validation,'ready');assert.equal(view.readiness.needsReviewCount,1);
 const surface=html(RenderSurface,view);assert.doesNotMatch(surface,/준비 상태|사실 확인|설계 변경|편집기로/);assert.match(html(RenderReview,{view}),/사실 확인이 필요한 수동 문구/);
}));
test('local Editor draft and AI candidate cannot enter canonical read model',()=>seeded(async s=>{
 const draft=structuredClone(s.sections[0]);draft.content.headline='미저장 문구';const candidate={content:{headline:'미적용 후보'}};
 const view=await getRenderView(projectId);assert.doesNotMatch(JSON.stringify(view),/미저장 문구|미적용 후보/);assert.ok(draft&&candidate);
 assert.ok(view.sections.every(r=>!('sort_order'in r)&&!('detail_page_id'in r)&&!('meta'in r.content)));
}));
test('unknown type, malformed content and scope mismatch fail visibly',()=>seeded(async s=>{
 const row=structuredClone(s.sections[0]);s.sections[0].type='unknown';await assert.rejects(()=>getRenderView(projectId));
 s.sections[0]=structuredClone(row);s.sections[0].content.type='notice';await assert.rejects(()=>getRenderView(projectId),e=>e.code==='invalid');
 s.sections[0]=structuredClone(row);s.sections[0].detail_page_id=randomUUID();s.ignoreFilter='sections';await assert.rejects(()=>getRenderView(projectId));
}));
test('empty Project/Product/Page/Sections states do not cause creation',()=>seeded(async s=>{
 s.sections=[];assert.equal((await getRenderView(projectId)).state,'empty');
 s.page=null;assert.equal((await getRenderView(projectId)).state,'page_missing');
 s.product=null;assert.equal((await getRenderView(projectId)).state,'product_missing');
 s.project=null;await assert.rejects(()=>getRenderView(projectId),e=>e.code==='not_found');
}));
test('generation/recovery and edit lease block partial render without performing recovery',()=>seeded(async s=>{
 s.page.settings.sectionEdit={id:randomUUID(),startedAt:new Date().toISOString()};const before=snapshot(s);s.requests=[];
 assert.equal((await getRenderView(projectId)).state,'busy');assert.deepEqual(snapshot(s),before);assert.ok(s.requests.every(r=>r.method==='GET'));
 delete s.page.settings.sectionEdit;s.page.settings.sectionGeneration={...s.page.settings.sectionGeneration,status:'generating',finishedAt:null,backup:structuredClone(s.sections)};
 assert.equal((await getRenderView(projectId)).state,'busy');
}));
test('read race and private DB errors never leak internal details',()=>seeded(async s=>{
 let count=0;s.beforeRead=table=>{if(table==='sections'&&++count===2)s.sections[0].content.headline='동시 저장';};
 await assert.rejects(()=>getRenderView(projectId),e=>e.code==='conflict');s.beforeRead=null;s.failure='read-sections';
 await assert.rejects(()=>getRenderView(projectId),e=>!e.message.includes('private')&&!e.message.includes('secret'));
}));
test('reorder recovery journal never exposes partial order or triggers recovery writes',()=>seeded(async s=>{
 const order=s.sections.map(r=>({id:r.id,updatedAt:r.updated_at,sortOrder:r.sort_order}));
 s.page.settings.sectionReorder={schemaVersion:1,runId:randomUUID(),detailPageId:s.page.id,status:'recovery_required',
  backup:order.map(r=>({...r,fingerprint:'a'.repeat(64)})),current:order,pending:null,orderedSectionIds:order.map(r=>r.id),startedAt:new Date().toISOString()};
 const before=snapshot(s);s.requests=[];assert.equal((await getRenderView(projectId)).state,'busy');
 assert.deepEqual(snapshot(s),before);assert.ok(s.requests.every(r=>r.method==='GET'));
}));
test('deterministic surface has no draft/candidate/controls/time/random or mutations',()=>{
 const c=copy('hero'),props={width:860,assets:[],sections:[{id:'stable',type:'hero',sortOrder:0,content:c,style:defaultSectionStyle('hero')}]};
 assert.equal(html(RenderSurface,props),html(RenderSurface,props));
 const source=readFileSync(new URL('../src/features/detail-renderer/service.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\.update\(|\.insert\(|\.delete\(|generateSections\(|planPage\(|analyze\(/);
 const out=html(RenderSurface,props);assert.doesNotMatch(out,/<button|선택|Inspector|AI 후보|data-selected|style=".*zoom/);
});

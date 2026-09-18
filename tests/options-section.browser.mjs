// Explicit opt-in integration check. Loads .env.local via the documented node command.
// Creates and cleans ONLY its own UUID-scoped project and private Storage image.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {createSupabaseServerClient} from '../src/lib/supabase/server.ts';
import {saveProductOptions} from '../src/features/product-options/persistence.ts';
import {uploadAsset} from '../src/features/assets/service.ts';
import {planPage} from '../src/features/page-planner/service.ts';
import {generateSections} from '../src/features/section-engine/service.ts';
import {getEditorView,saveSection} from '../src/features/detail-editor/service.ts';
import {draftOf} from '../src/features/detail-editor/schemas.ts';
import {reorderSections} from '../src/features/section-reorder/service.ts';
import {exportDetail} from '../src/features/detail-export/service.ts';
import {imageDimensions} from '../src/features/detail-export/image-header.ts';
import {seedStrategy,seedValidation,planResult} from './helpers/planner-fixtures.mjs';
import {completedAnalysis} from './helpers/analysis.mjs';
import {sectionOutput} from './helpers/section-fixtures.mjs';

if(process.env.DETAILFORGE_OPTIONS_BROWSER!=='1')throw Error('Explicit DETAILFORGE_OPTIONS_BROWSER=1 required');
const origin=process.env.TASK022_ORIGIN??'http://localhost:3000';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const client=createSupabaseServerClient(),projectId=randomUUID(),productId=randomUUID();
const artifacts=join(process.env.TASK022_ARTIFACT_DIR??tmpdir(),'detailforge-task022-'+projectId);
await mkdir(artifacts,{recursive:true});
let browser,storagePath,step='setup',created=false;
const results={projectId,artifacts,paidApiCalls:0,wholesaleApiCalls:0,captures:[],cleanup:false};
const originalFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url??input.toString());
 if(/openai|domeggook|domeme/i.test(url.hostname))throw Error('AI/wholesale calls forbidden');return originalFetch(input,init);};
async function inserted(table,value){const result=await client.from(table).insert(value).select('*').single();if(result.error)throw Error('Fixture insert failed: '+table);return result.data;}
async function read(table,field,id){const result=await client.from(table).select('*').eq(field,id);if(result.error)throw Error('Fixture read failed: '+table);return result.data;}
async function rows(pageId){return (await read('sections','detail_page_id',pageId)).sort((a,b)=>a.sort_order-b.sort_order);}
try {
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1600,height:1100},locale:'ko-KR'});
 const forbidden=[];
 await context.route(/openai\.com|domeggook\.com/,route=>{forbidden.push('forbidden provider request');return route.abort();});
 const page=await context.newPage();
 await page.setContent('<html><body style="margin:0;background:#ecefe9;font:32px Arial;padding:50px;color:#253328">TASK-022<br>Private test image</body></html>');
 const bytes=await page.screenshot({type:'png'});
 await inserted('projects',{id:projectId,name:'TASK-022 integration fixture · temporary'});created=true;
 const product=await inserted('products',{id:productId,project_id:projectId,name:'옵션 연결 검증 상품',brand:'검증 브랜드',category:'테스트',description:'검증 전용 상품',source_type:'manual'});
 const factsValue={productName:product.name,brand:product.brand,category:product.category,specifications:[{name:'재질',value:'ABS'},{name:'폭',value:'20cm'}]};
 const facts=await inserted('product_facts',{product_id:productId,facts:factsValue,source_snapshot:{inputMethod:'manual',...factsValue}});
 const asset=await uploadAsset(projectId,{name:'task022-fixture.png',mime:'image/png',bytes});storagePath=asset.storagePath;
 const update=await client.from('assets').update({metadata:{aiAnalysis:completedAnalysis()}}).eq('id',asset.id).eq('project_id',projectId);if(update.error)throw Error('Fixture analysis update failed');
 const fixture={project:{id:projectId},product,facts,assets:await read('assets','project_id',projectId)};
 seedStrategy(fixture);seedValidation(fixture);
 for(const [table,key,id,value] of [['products','id',productId,{ai_analysis:fixture.product.ai_analysis}],['product_facts','product_id',productId,{validation:fixture.facts.validation}]]){const result=await client.from(table).update(value).eq(key,id);if(result.error)throw Error('Fixture evidence setup failed');}
 const labels=['화이트 / 블랙','ABS, PC','ON241125403','긴 한국어 모델명 옵션은 줄바꿈을 유지하고 전체 내용이 잘리지 않아야 합니다 '.repeat(3).trim(),'단품','세트'];
 await saveProductOptions(projectId,{productId,expectedVersion:0,options:{schemaVersion:1,groups:[{id:randomUUID(),name:'제품 선택',values:labels.map(label=>({id:randomUUID(),label}))}]}});
 step='mock plan and generation';
 await planPage(projectId,()=>({model:'TASK022-mock-planner',plan:async input=>{const result=planResult(input);result.sections[2]={key:'confirmed-options',type:'option',purpose:'확정 선택값 안내',contentBrief:'서버의 확정 옵션 snapshot을 표시한다.',evidenceIds:[],assetIds:[],priority:'supporting'};return result;}}));
 await generateSections(projectId,{},()=>({model:'TASK022-mock-section',generate:async input=>sectionOutput(input)}));
 let view=await getEditorView(projectId),option=view.sections.find(row=>row.type==='option');assert.ok(option);assert.deepEqual(option.content.optionSnapshot.confirmed.groups[0].values.map(v=>v.label),labels);
 await saveSection(projectId,option.id,{revision:option.updated_at,...draftOf(option),fields:{title:'내가 정한 옵션 안내'},style:{...option.style,background:'soft'},assetIds:[asset.id]});
 view=await getEditorView(projectId);const order=[view.sections[0].id,option.id,...view.sections.filter(row=>row.id!==option.id&&row.id!==view.sections[0].id).map(row=>row.id)];
 await reorderSections(projectId,{detailPageId:view.detailPageId,orderedSectionIds:order,expectedSections:view.sections.map(row=>({id:row.id,updatedAt:row.updated_at}))});
 const beforeRows=await rows(view.detailPageId),beforePage=(await read('detail_pages','id',view.detailPageId))[0];option=beforeRows.find(row=>row.type==='option');
 const protectedData={products:await read('products','id',productId),facts:await read('product_facts','product_id',productId),assets:await read('assets','project_id',projectId)};
 async function capture(stage,expected){
   await page.goto(`${origin}/projects/${projectId}/render`);const surface=page.locator('article[data-detail-render-surface="1"]');await surface.waitFor();
   assert.deepEqual(await surface.locator('[data-section-type="option"] li').allTextContents(),expected);
   const bounds=await surface.evaluate(el=>({width:el.getBoundingClientRect().width,overflow:el.scrollWidth>el.clientWidth,clipped:[...el.querySelectorAll('[data-section-type="option"] li')].some(item=>item.scrollWidth>item.clientWidth)}));assert.equal(bounds.width,860);assert.equal(bounds.overflow,false);assert.equal(bounds.clipped,false);
   for(const format of ['png','jpg']){const result=await exportDetail(projectId,{format,...(format==='jpg'?{quality:90}:{})},{origin});const path=join(artifacts,`${stage}.${format}`);await writeFile(path,result.bytes);const size=imageDimensions(result.bytes,format);assert.equal(size.width,860);results.captures.push({stage,format,...size,bytes:result.bytes.length,path});}
 }
 step='before captures';await capture('before',labels);
 step='editor values';await page.goto(`${origin}/projects/${projectId}/editor`);await page.getByRole('button',{name:'2. 옵션 선택',exact:true}).click();
 const panel=page.locator('section[aria-label="확정 옵션 연결"]');await panel.getByText('저장된 옵션과 현재 상품 옵션이 일치합니다.',{exact:true}).waitFor();for(const label of labels)await panel.getByText(label,{exact:true}).waitFor();
 await page.screenshot({path:join(artifacts,'editor-before.png'),fullPage:true});
 step='options UI save';const optionsPage=await context.newPage();await optionsPage.goto(`${origin}/projects/${projectId}#product-options-title`);await optionsPage.getByLabel('그룹 1 값 1',{exact:true}).fill('수정한 선택값 / 분리하지 않음');await optionsPage.getByRole('button',{name:'옵션 저장',exact:true}).click();await optionsPage.getByText('옵션을 저장했습니다.',{exact:true}).waitFor();
 await page.bringToFront();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await panel.getByText('상품 옵션이 변경되었습니다. 최신 옵션 반영을 확인해 주세요.',{exact:true}).waitFor();assert.deepEqual(await rows(view.detailPageId),beforeRows);
 step='comparison cancel';await panel.getByRole('button',{name:'최신 옵션 반영',exact:true}).click();await panel.getByRole('group',{name:'옵션 변경 비교'}).waitFor();await panel.getByRole('button',{name:'취소',exact:true}).click();assert.deepEqual(await rows(view.detailPageId),beforeRows);
 step='dirty guard';const title=page.getByRole('complementary',{name:'Property Inspector'}).getByRole('textbox').first();await title.fill('저장 전 draft');await panel.getByRole('button',{name:'최신 옵션 반영',exact:true}).click();const guard=page.getByRole('group',{name:'저장되지 않은 변경사항 확인'});await guard.waitFor();await guard.getByRole('button',{name:'취소',exact:true}).click();assert.equal(await title.inputValue(),'저장 전 draft');assert.deepEqual(await rows(view.detailPageId),beforeRows);await title.fill('내가 정한 옵션 안내');
 step='explicit apply';await panel.getByRole('button',{name:'최신 옵션 반영',exact:true}).click();await panel.getByRole('button',{name:'반영 확인',exact:true}).click();await page.getByText('선택한 섹션에 확정 옵션을 반영했습니다.',{exact:true}).waitFor();
 const afterRows=await rows(view.detailPageId),afterOption=afterRows.find(row=>row.id===option.id);assert.deepEqual(afterRows.filter(row=>row.id!==option.id),beforeRows.filter(row=>row.id!==option.id));
 for(const key of ['id','type','sort_order','style'])assert.deepEqual(afterOption[key],option[key]);for(const key of ['title','assetIds','meta'])assert.deepEqual(afterOption.content[key],option.content[key]);
 const afterPage=(await read('detail_pages','id',view.detailPageId))[0];assert.deepEqual(afterPage.settings,beforePage.settings);assert.deepEqual(afterPage.plan,beforePage.plan);
 assert.deepEqual({products:await read('products','id',productId),facts:await read('product_facts','product_id',productId),assets:await read('assets','project_id',projectId)},protectedData);
 step='refresh and captures';await page.reload();await page.getByRole('button',{name:'2. 옵션 선택',exact:true}).click();await page.locator('section[aria-label="확정 옵션 연결"]').getByText('수정한 선택값 / 분리하지 않음',{exact:true}).waitFor();
 await page.screenshot({path:join(artifacts,'editor-after.png'),fullPage:true});const changed=[...labels];changed[0]='수정한 선택값 / 분리하지 않음';await capture('after',changed);assert.equal(forbidden.length,0);
 results.steps=['mock Plan/Section 1:1','six exact ordered choices','860px PNG/JPG before/after','options UI save','stale without replacement','comparison cancel read-only','dirty guard cancel preserves draft','explicit selected-row apply','F5 persistence','other sections/style/assets/manual order/provenance unchanged'];
} catch(error){results.failure={step,code:typeof error?.code==='string'?error.code:'validation_failed'};process.exitCode=1;}
finally {
 if(browser)await browser.close();
 if(storagePath){const result=await client.storage.from('product-assets').remove([storagePath]);if(result.error)results.cleanupError='storage';}
 if(created){const result=await client.from('projects').delete().eq('id',projectId);if(result.error)results.cleanupError='project';
   const remaining=await read('projects','id',projectId);results.cleanup=remaining.length===0&&!results.cleanupError;}
 globalThis.fetch=originalFetch;await writeFile(join(artifacts,'report.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fixture, provider, protectedSnapshot, sectionOutput } from './helpers/section-fixtures.mjs';
import { projectId, assetRow } from './helpers/section-db.mjs';
import { generateSections } from '../src/features/section-engine/service.ts';
import { editorSectionSchema, draftOf, prepareEdit, editRequestSchema, editableFieldsSchema, previewContent, isDirty } from '../src/features/detail-editor/schemas.ts';
import { textFields } from '../src/features/detail-editor/fields.ts';
import { saveSection, getEditorView } from '../src/features/detail-editor/service.ts';
import { editorResponse, readEditRequest } from '../src/features/detail-editor/http.ts';
import { requestSave } from '../src/features/detail-editor/client.ts';
import { defaultSectionStyle } from '../src/features/section-engine/schemas.ts';
const now='2026-09-15T00:00:00.000Z';
async function seeded(fn, images=false){return fixture(async state=>{await generateSections(projectId,{},provider);await fn(state,editorSectionSchema.parse(state.sections[0]));},images);}
const input=(row,patch={})=>({revision:row.updated_at,...draftOf(row),...patch});

for(const type of ['hero','keyBenefits','feature','imageText','gallery','useCase','detail','specification','option','notice']){
  test(`editor ${type} editable schema and form mapping`,()=>{
    const copy=sectionOutput({plan:{sections:[{key:'test',type,evidenceIds:[],assetIds:[]}]},evidenceSnapshot:[]}).sections[0];
    if(['keyBenefits','useCase'].includes(type))copy.items=[{title:'항목',description:'설명',evidenceIds:[],...(type==='useCase'?{confidence:.7,assetIds:[]}: {})}];
    const row=editorSectionSchema.parse({id:randomUUID(),detail_page_id:randomUUID(),type,sort_order:0,content:{...copy,meta:{schemaVersion:1,plannerKey:'test',sourcePlanFingerprint:'a'.repeat(64),sourceInputFingerprint:'b'.repeat(64),generationId:randomUUID(),generatedAt:now,provider:'openai',model:'fixture',origin:'generated',warnings:[]}},style:defaultSectionStyle(type),created_at:now,updated_at:now});
    const draft=draftOf(row),fields=textFields(row.content);
    assert.ok(fields.length);assert.ok(editableFieldsSchema(row).safeParse(draft.fields).success);
    const key=fields[0].path;draft.fields[key]='수동 편집';
    const edit=prepareEdit(row,input(row,draft),now);
    assert.equal(edit.content.meta.groundingStatus,'needs_review');assert.equal(edit.content.meta.manualEdit.textEdited,true);
    assert.equal(textFields(edit.content)[0].value,'수동 편집');
    if(type==='keyBenefits')assert.deepEqual(fields.map(f=>f.path),['title','items.0.title','items.0.description']);
  });
}
test('strict payload rejects immutable DB/provenance fields',async()=>seeded((_state,row)=>{
  for(const key of ['id','detail_page_id','type','sort_order','plannerKey','sourcePlanFingerprint','meta','evidenceIds']){
    assert.equal(editRequestSchema.safeParse({...input(row),[key]:'bad'}).success,false);
    assert.throws(()=>prepareEdit(row,input(row,{fields:{...draftOf(row).fields,[key]:'bad'}}),now));
  }
}));
test('bounded styles reject CSS, extra fields and unbounded tokens',async()=>seeded((_state,row)=>{
  for(const style of [{...row.style,background:'#ffffff'},{...row.style,css:'color:red'},{...row.style,layout:'flex'},{...row.style,margin:20}])assert.equal(editRequestSchema.safeParse(input(row,{style})).success,false);
}));
test('signed URL, HTML and non-UUID asset persistence rejected',async()=>seeded((_state,row)=>{
  for(const value of ['<script>alert(1)</script>','https://host/storage/v1/object/sign/x?token=secret'])assert.throws(()=>prepareEdit(row,input(row,{fields:{...draftOf(row).fields,headline:value}}),now));
  assert.equal(editRequestSchema.safeParse(input(row,{assetIds:['https://signed.example']})).success,false);
}));
test('text edit retains all provenance/evidence and records manual review',async()=>seeded((_state,row)=>{
  const original=structuredClone(row);const edit=prepareEdit(row,input(row,{fields:{...draftOf(row).fields,headline:'사람이 수정한 문구'}}),now);
  assert.deepEqual(row,original);assert.deepEqual(edit.content.evidenceIds,row.content.evidenceIds);
  for(const key of ['plannerKey','sourcePlanFingerprint','sourceInputFingerprint','provider','model','generationId','generatedAt','origin'])assert.deepEqual(edit.content.meta[key],row.content.meta[key]);
  assert.equal(edit.content.meta.manualEdit.editedAt,now);assert.equal(edit.content.meta.groundingStatus,'needs_review');
}));
test('style-only preserves both generated and previously reviewed grounding',async()=>seeded((_state,row)=>{
  const style={...row.style,background:'contrast'};
  assert.deepEqual(prepareEdit(row,input(row,{style}),now).content,row.content);
  row.content.meta.groundingStatus='needs_review';row.content.meta.manualEdit={edited:true,editedAt:now,textEdited:true,assetsEdited:false};
  assert.deepEqual(prepareEdit(row,input(row,{style}),now).content,row.content);
}));
test('manual asset change preserves grounding and records asset provenance',async()=>seeded((_state,row)=>{
  const edit=prepareEdit(row,input(row,{assetIds:[randomUUID()]}),now);
  assert.equal(edit.content.meta.manualEdit.assetsEdited,true);assert.equal(edit.content.meta.manualEdit.textEdited,false);assert.equal(edit.content.meta.groundingStatus,undefined);
}));
test('save success uses canonical revision, preserves all upstream data and immutable rows',async()=>seeded(async(state,row)=>{
  const before=protectedSnapshot(state),newDraft=draftOf(row);newDraft.fields.headline='수동으로 저장한 상품 소개';
  const saved=await saveSection(projectId,row.id,input(row,newDraft));
  assert.notEqual(saved.updated_at,row.updated_at);assert.equal(saved.content.headline,newDraft.fields.headline);assert.equal(isDirty(saved,draftOf(saved)),false);
  for(const key of ['id','detail_page_id','type','sort_order','created_at'])assert.equal(saved[key],row[key]);
  assert.deepEqual(protectedSnapshot(state),before);assert.equal(state.page.settings.sectionEdit,undefined);
  const writes=state.requests.filter(r=>r.table==='sections'&&r.method==='PATCH');assert.deepEqual(Object.keys(writes.at(-1).payload).sort(),['content','style']);
}));
test('stale revision conflict never overwrites another tab',async()=>seeded(async(state,row)=>{
  await saveSection(projectId,row.id,input(row,{fields:{...draftOf(row).fields,headline:'다른 탭 저장'}}));
  await assert.rejects(()=>saveSection(projectId,row.id,input(row)),e=>e.code==='conflict'&&e.status===409);
  assert.equal(state.sections[0].content.headline,'다른 탭 저장');
}));
test('atomic row compare-and-swap catches a race after reading',async()=>seeded(async(state,row)=>{
  state.beforeSections=(method)=>{if(method==='PATCH'){state.sections[0].updated_at=now;state.sections[0].content.headline='동시 변경';}};
  await assert.rejects(()=>saveSection(projectId,row.id,input(row)),e=>e.code==='conflict');assert.equal(state.sections[0].content.headline,'동시 변경');
}));
test('foreign Project, Product, DetailPage and Section scope rejected',async()=>seeded(async(state,row)=>{
  await assert.rejects(()=>saveSection(randomUUID(),row.id,input(row)),e=>e.code==='not_found');
  await assert.rejects(()=>saveSection(projectId,randomUUID(),input(row)),e=>e.code==='not_found');
  state.ignoreFilter='sections';state.sections[0].detail_page_id=randomUUID();await assert.rejects(()=>saveSection(projectId,row.id,input(row)),e=>e.code==='ownership');
}));
test('unknown or cross-product asset rejected, manual current-product asset allowed beyond Plan',async()=>seeded(async(state,row)=>{
  const foreign=assetRow({id:randomUUID(),product_id:randomUUID()});state.assets=[foreign];
  await assert.rejects(()=>saveSection(projectId,row.id,input(row,{assetIds:[foreign.id]})),e=>e.code==='ownership');
  const own=assetRow();state.assets=[own];const saved=await saveSection(projectId,row.id,input(row,{assetIds:[own.id]}));assert.deepEqual(saved.content.assetIds,[own.id]);
}));
test('database failure hides provider details, preserves draft and existing row',async()=>seeded(async(state,row)=>{
  state.failure='sections-patch';const draft=draftOf(row);draft.fields.headline='실패해도 유지';const snapshot=structuredClone(draft);
  const response=await editorResponse(()=>saveSection(projectId,row.id,input(row,draft)));const body=await response.json();
  assert.equal(response.status,503);assert.doesNotMatch(JSON.stringify(body),/private-db|secret-test/);assert.deepEqual(draft,snapshot);assert.deepEqual(state.sections[0],row);assert.equal(state.page.settings.sectionEdit,undefined);
}));
test('stale/missing Plan does not block editor read or manual save',async()=>seeded(async(state,row)=>{
  state.page.plan={};const view=await getEditorView(projectId);assert.equal(view.stale,true);assert.equal(view.sections.length,5);
  const saved=await saveSection(projectId,row.id,input(row));assert.equal(saved.id,row.id);
}));
test('empty editor and incomplete product remain readable',async()=>fixture(async state=>{
  assert.equal((await getEditorView(projectId)).sections.length,0);state.product=null;assert.equal((await getEditorView(projectId)).sections.length,0);
}));
test('generation backup readable, manual save blocked until recovery',async()=>seeded(async(state,row)=>{
  state.page.settings.sectionGeneration={...state.page.settings.sectionGeneration,status:'generating',finishedAt:null,backup:structuredClone(state.sections)};
  const view=await getEditorView(projectId);assert.equal(view.blocked,true);assert.deepEqual(view.sections,state.sections);
  await assert.rejects(()=>saveSection(projectId,row.id,input(row)),e=>e.code==='busy');
}));
test('manual lease prevents generation before any provider is constructed',async()=>seeded(async(state)=>{
  state.page.settings.sectionEdit={id:randomUUID(),startedAt:new Date().toISOString()};let calls=0;
  await assert.rejects(()=>generateSections(projectId,{},()=>{calls++;return provider();}),e=>e.code==='busy');assert.equal(calls,0);
}));
test('draft previews do not mutate canonical state',async()=>seeded((_state,row)=>{
  const before=structuredClone(row),draft=draftOf(row);draft.fields.headline='live';draft.style.background='soft';
  assert.equal(previewContent(row,draft).headline,'live');assert.ok(isDirty(row,draft));assert.deepEqual(row,before);
}));
test('client failure contract leaves input unchanged and sanitizes message',async()=>seeded(async(_state,row)=>{
  const originalFetch=globalThis.fetch,draft=draftOf(row),before=structuredClone(draft);
  globalThis.fetch=async()=>Response.json({ok:false,message:'secret-provider-message',code:'unknown'},{status:500});
  try{const result=await requestSave(projectId,row.id,row.updated_at,draft);assert.equal(result.ok,false);assert.doesNotMatch(result.message,/secret/);assert.deepEqual(draft,before);}finally{globalThis.fetch=originalFetch;}
}));
test('same-origin and bounded streaming request',async()=>{
  const request=body=>new Request('http://localhost/api/editor',{method:'PATCH',headers:{Origin:'http://localhost',Host:'localhost'},body});
  assert.deepEqual(await readEditRequest(request('{}')),{});
  await assert.rejects(()=>readEditRequest(request('x'.repeat(32001))),e=>e.code==='invalid_input');
  await assert.rejects(()=>readEditRequest(new Request('http://localhost/api/editor',{method:'PATCH',headers:{Origin:'http://evil',Host:'localhost'},body:'{}'})),e=>e.code==='forbidden');
});
test('editor has no provider calls and migration uses existing updated_at/JSONB',()=>{
  const service=readFileSync(new URL('../src/features/detail-editor/service.ts',import.meta.url),'utf8');assert.doesNotMatch(service,/getSectionProvider|generateSections|from ["']openai/);
  const sql=readFileSync(new URL('../supabase/migrations/0001_initial_schema.sql',import.meta.url),'utf8');assert.match(sql,/create trigger sections_set_updated_at/);assert.match(sql,/content jsonb/);
});
test('specification fact values and nested evidence/confidence are not editable paths',async()=>seeded((state)=>{
  const row=editorSectionSchema.parse(state.sections.find(s=>s.type==='specification'));
  for(const path of ['rows.0.label','rows.0.value','rows.0.evidenceIds','items.0.confidence','items.0.assetIds','items.0.evidenceIds'])assert.throws(()=>prepareEdit(row,input(row,{fields:{...draftOf(row).fields,[path]:'위조'}}),now));
}));
test('page lease CAS rejects generation winning between read and save claim',async()=>seeded(async(state,row)=>{
  state.beforePatch=payload=>{if(payload.settings?.sectionEdit){state.page.updated_at=now;state.page.settings.sectionGeneration={...state.page.settings.sectionGeneration,status:'generating',finishedAt:null,backup:structuredClone(state.sections)};}};
  await assert.rejects(()=>saveSection(projectId,row.id,input(row)),e=>e.code==='conflict');assert.deepEqual(state.sections[0],row);
}));
test('expired manual lease can be replaced without restoring section content',async()=>seeded(async(state,row)=>{
  state.page.settings.sectionEdit={id:randomUUID(),startedAt:'2020-01-01T00:00:00.000Z'};
  const saved=await saveSection(projectId,row.id,input(row));assert.equal(saved.id,row.id);assert.deepEqual(saved.content,row.content);assert.equal(state.page.settings.sectionEdit,undefined);
}));
test('read-time asset scope and product relationship are checked even if filters are bypassed',async()=>seeded(async(state,row)=>{
  state.ignoreFilter='assets';state.assets=[assetRow({product_id:randomUUID()})];await assert.rejects(()=>saveSection(projectId,row.id,input(row)),e=>e.code==='ownership');
  state.assets=[];state.ignoreFilter='products';state.product.project_id=randomUUID();await assert.rejects(()=>saveSection(projectId,row.id,input(row)));
}));
test('useCase image deselection removes nested display associations without changing evidence',async()=>seeded((_state,row)=>{
  const id=randomUUID();row.type='useCase';row.content={type:'useCase',plannerKey:row.content.plannerKey,evidenceIds:['F1'],assetIds:[id],title:'사용 상황',intro:null,items:[{title:'검토',description:'사용 환경을 검토해 주세요.',evidenceIds:['F1'],confidence:.7,assetIds:[id]}],meta:row.content.meta};
  const edit=prepareEdit(row,input(row,{assetIds:[]}),now);assert.deepEqual(edit.content.items[0].assetIds,[]);assert.deepEqual(edit.content.items[0].evidenceIds,['F1']);assert.equal(edit.content.items[0].confidence,.7);assert.equal(edit.content.meta.manualEdit.assetsEdited,true);
}));

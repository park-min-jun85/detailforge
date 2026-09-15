import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fixture,provider,protectedSnapshot} from './helpers/section-fixtures.mjs';
import {projectId} from './helpers/section-db.mjs';
import {generateSections,getSectionView} from '../src/features/section-engine/service.ts';
import {getEditorView,saveSection} from '../src/features/detail-editor/service.ts';
import {draftOf,editorSectionSchema} from '../src/features/detail-editor/schemas.ts';
import {reorderSections} from '../src/features/section-reorder/service.ts';
import {reorderResponse} from '../src/features/section-reorder/http.ts';
import {reorderRequestSchema,assertWholeSet,readReorder,hasManualOrder} from '../src/features/section-reorder/schemas.ts';
import {immutableFingerprint} from '../src/features/section-reorder/persistence.ts';
import {moveSection,orderIsDirty,needsDraftGuard} from '../src/features/section-reorder/draft.ts';
import {planPage} from '../src/features/page-planner/service.ts';
import {readEditRequest} from '../src/features/detail-editor/http.ts';

const req=state=>({detailPageId:state.page.id,orderedSectionIds:state.sections.map(row=>row.id).reverse(),expectedSections:state.sections.map(row=>({id:row.id,updatedAt:row.updated_at}))});
async function seeded(fn){return fixture(async state=>{await generateSections(projectId,{},provider);await fn(state);});}
const immutable=rows=>Object.fromEntries(rows.map(({sort_order,updated_at,...row})=>{void sort_order;void updated_at;return [row.id,row];}));
test('request whole set rejects duplicate, missing, foreign, nonexistent and extra IDs',async()=>seeded(state=>{
 const input=req(state);assert.ok(reorderRequestSchema.safeParse(input).success);assert.ok(assertWholeSet(input,state.sections));
 for(const ids of [[...input.orderedSectionIds,input.orderedSectionIds[0]],input.orderedSectionIds.slice(1),[...input.orderedSectionIds,randomUUID()],[randomUUID(),...input.orderedSectionIds.slice(1)]]){
   assert.equal(assertWholeSet({...input,orderedSectionIds:ids},state.sections),false);
 }
 assert.equal(reorderRequestSchema.safeParse({...input,expectedSections:[...input.expectedSections,input.expectedSections[0]]}).success,false);
 assert.equal(reorderRequestSchema.safeParse({...input,sort_order:1}).success,false);
}));
test('success assigns canonical 0..N-1 and preserves content/style/type/provenance/grounding and all upstream',async()=>seeded(async state=>{
 state.sections[0].content.meta.manualEdit={edited:true,editedAt:new Date().toISOString(),textEdited:true,assetsEdited:false};state.sections[0].content.meta.groundingStatus='needs_review';
 state.page.settings.editor={themePreference:'preserve'};state.page.settings.other={value:42};
 const before=protectedSnapshot(state),original=immutable(state.sections),journal=structuredClone(state.page.settings.sectionGeneration),input=req(state);
 const result=await reorderSections(projectId,input);
 assert.deepEqual(result.sections.map(row=>row.id),input.orderedSectionIds);assert.deepEqual(result.sections.map(row=>row.sort_order),[0,1,2,3,4]);
 assert.deepEqual(immutable(result.sections),original);assert.deepEqual(protectedSnapshot(state),before);
 assert.deepEqual(state.page.settings.sectionGeneration,journal);assert.equal(state.page.settings.editor.themePreference,'preserve');assert.deepEqual(state.page.settings.other,{value:42});
 assert.equal(state.page.settings.editor.manualOrder.edited,true);assert.deepEqual(state.page.settings.editor.manualOrder.orderedSectionIds,input.orderedSectionIds);
 assert.equal(state.page.settings.sectionReorder,undefined);assert.equal(state.page.settings.sectionEdit,undefined);
 for(const write of state.requests.filter(r=>r.table==='sections'&&r.method==='PATCH'))assert.deepEqual(Object.keys(write.payload),['sort_order']);
 assert.equal((await getEditorView(projectId)).manualOrder,true);assert.equal((await getSectionView(projectId)).manualOrder,true);
}));
test('same order is a no-op without row writes or manual provenance',async()=>seeded(async state=>{
 const before=structuredClone(state.sections),input=req(state);input.orderedSectionIds=state.sections.map(r=>r.id);
 const result=await reorderSections(projectId,input);assert.deepEqual(result.sections,before);assert.equal(state.page.settings.editor,undefined);
 assert.equal(state.requests.filter(r=>r.table==='sections'&&r.method==='PATCH').length,0);
}));
test('whole-set stale revision returns 409 before any row mutation',async()=>seeded(async state=>{
 const input=req(state);state.sections[2].updated_at='2020-01-01T00:00:00.000Z';const before=structuredClone(state.sections);
 const response=await reorderResponse(()=>reorderSections(projectId,input));assert.equal(response.status,409);assert.match((await response.json()).message,/최신 섹션/);assert.deepEqual(state.sections,before);
}));
test('stale revision on unchanged-position section also blocks entire reorder',async()=>seeded(async state=>{
 const input=req(state);input.expectedSections[2].updatedAt='2020-01-01T00:00:00.000Z';await assert.rejects(()=>reorderSections(projectId,input),e=>e.code==='conflict');
 assert.equal(state.requests.filter(r=>r.table==='sections'&&r.method==='PATCH').length,0);
}));
test('scope validation rejects foreign Project/Product/Page/Sections',async()=>seeded(async state=>{
 const input=req(state);
 await assert.rejects(()=>reorderSections(randomUUID(),input),e=>e.code==='not_found');
 await assert.rejects(()=>reorderSections(projectId,{...input,detailPageId:randomUUID()}),e=>e.code==='not_found');
 state.ignoreFilter='sections';state.sections[0].detail_page_id=randomUUID();await assert.rejects(()=>reorderSections(projectId,input),e=>e.code==='not_found');
}));
test('whole-set checked again after lease acquisition',async()=>seeded(async state=>{
 const input=req(state);state.beforePatch=payload=>{if(payload.settings?.sectionEdit&&!payload.settings.sectionReorder)state.sections[0].updated_at='2020-01-01T00:00:00.000Z';};
 await assert.rejects(()=>reorderSections(projectId,input),e=>e.code==='conflict');assert.equal(state.requests.filter(r=>r.table==='sections'&&r.method==='PATCH').length,0);
}));
test('partial persistence failure rolls back order only and returns refreshed revisions for retry',async()=>seeded(async state=>{
 const input=req(state),before=structuredClone(state.sections);let writes=0;
 state.beforeSections=method=>{if(method==='PATCH'){writes++;state.failure=writes===2?'sections-patch':null;}};
 let failure;try{await reorderSections(projectId,input);}catch(e){failure=e;}
 assert.equal(failure.code,'persistence');assert.deepEqual(state.sections.map(r=>r.id),before.map(r=>r.id));assert.deepEqual(immutable(state.sections),immutable(before));
 assert.deepEqual(state.sections.map(r=>r.sort_order),before.map(r=>r.sort_order));assert.ok(failure.sections);assert.equal(state.page.settings.sectionReorder,undefined);
 state.beforeSections=null;const retry={...input,expectedSections:failure.sections.map(row=>({id:row.id,updatedAt:row.updated_at}))};assert.deepEqual((await reorderSections(projectId,retry)).sections.map(r=>r.id),input.orderedSectionIds);
}));
test('rollback failure retains durable journal, blocks writes/generation, and explicit recovery succeeds',async()=>seeded(async state=>{
 const input=req(state),before=structuredClone(state.sections);let writes=0;
 state.beforeSections=method=>{if(method==='PATCH'){writes++;if(writes>=2)state.failure='sections-patch';}};
 await assert.rejects(()=>reorderSections(projectId,input),e=>e.code==='recovery_required');assert.ok(readReorder(state.page.settings));
 const view=await getEditorView(projectId);assert.equal(view.blocked,true);assert.equal(view.reorderRecovery,true);assert.deepEqual(view.sections.map(r=>r.id),before.map(r=>r.id));
 const row=editorSectionSchema.parse(state.sections[0]);await assert.rejects(()=>saveSection(projectId,row.id,{revision:row.updated_at,...draftOf(row)}),e=>e.code==='busy');
 await assert.rejects(()=>generateSections(projectId,{},()=>assert.fail('AI must not be constructed')),e=>e.code==='busy');
 state.failure=null;state.beforeSections=null;
 const recovered=await reorderSections(projectId,{detailPageId:state.page.id,recover:true});assert.equal(recovered.recovered,true);assert.deepEqual(immutable(recovered.sections),immutable(before));assert.deepEqual(recovered.sections.map(r=>r.sort_order),[0,1,2,3,4]);assert.equal(state.page.settings.sectionReorder,undefined);
}));
test('lost row acknowledgement is reconciled without duplicate effects',async()=>seeded(async state=>{
 state.ackLost='sections-patch';const input=req(state);const result=await reorderSections(projectId,input);assert.deepEqual(result.sections.map(r=>r.id),input.orderedSectionIds);assert.equal(state.page.settings.sectionReorder,undefined);
}));
test('settings commit failure restores original order and preserves previous manual order',async()=>seeded(async state=>{
 state.page.settings.editor={manualOrder:{prior:true}};let injected=false;const before=structuredClone(state.sections);
 state.beforePatch=payload=>{if(!injected&&payload.settings?.editor?.manualOrder?.edited&&!payload.settings.sectionReorder){injected=true;state.failure='patch-completed';}else state.failure=null;};
 await assert.rejects(()=>reorderSections(projectId,req(state)),e=>e.code==='persistence');assert.ok(injected);assert.deepEqual(state.sections.map(r=>r.id),before.map(r=>r.id));assert.deepEqual(state.page.settings.editor.manualOrder,{prior:true});
}));
test('lost settings commit acknowledgement is recognized as success',async()=>seeded(async state=>{
 let injected=false;state.beforePatch=payload=>{if(!injected&&payload.settings?.editor?.manualOrder?.edited&&!payload.settings.sectionReorder){injected=true;state.ackLost='completed';}};
 const result=await reorderSections(projectId,req(state));assert.ok(injected);assert.equal(result.sections[0].sort_order,0);assert.equal(state.page.settings.sectionReorder,undefined);
}));
test('lease prevents other content/reorder/Planner writes',async()=>seeded(async state=>{
 state.page.settings.sectionEdit={id:randomUUID(),startedAt:new Date().toISOString()};await assert.rejects(()=>reorderSections(projectId,req(state)),e=>e.code==='busy');
 let providers=0;await assert.rejects(()=>planPage(projectId,()=>{providers++;assert.fail('AI not allowed');}),e=>e.code==='busy');assert.equal(providers,0);
}));
test('active Planner prevents reorder before row writes',async()=>seeded(async state=>{
 state.page.plan.attempt={...state.page.plan.attempt,status:'planning',startedAt:new Date().toISOString(),finishedAt:null,errorCode:null};
 await assert.rejects(()=>reorderSections(projectId,req(state)),e=>e.code==='busy');
 assert.equal(state.requests.filter(r=>r.table==='sections'&&r.method==='PATCH').length,0);
}));
test('read detects completed write or rollback even after journal is cleared',async()=>seeded(async state=>{
 let tick=0;state.beforeRead=table=>{if(table==='sections')state.page.updated_at=new Date(Date.parse(state.page.updated_at)+ ++tick).toISOString();};
 await assert.rejects(()=>getEditorView(projectId),e=>e.code==='conflict');
 await assert.rejects(()=>getSectionView(projectId),e=>e.code==='conflict');
}));
test('reorder HTTP preserves origin and invalid-body status without exposing internals',async()=>{
 const foreign=await reorderResponse(()=>readEditRequest(new Request('http://localhost/api/reorder',{method:'PATCH',headers:{origin:'https://foreign.invalid'},body:'{}'})));assert.equal(foreign.status,403);
 const invalid=await reorderResponse(()=>readEditRequest(new Request('http://localhost/api/reorder',{method:'PATCH',headers:{origin:'http://localhost'},body:'invalid'})));assert.equal(invalid.status,400);
});
test('stale or absent Plan permits manual reorder and preserves original Plan exactly',async()=>seeded(async state=>{
 state.page.plan={};const input=req(state);await reorderSections(projectId,input);const view=await getEditorView(projectId);assert.equal(view.stale,true);assert.deepEqual(state.page.plan,{});assert.deepEqual(view.sections.map(r=>r.id),input.orderedSectionIds);
}));
test('recovery without journal remains idempotent but cannot bypass active lease',async()=>seeded(async state=>{
 const input={detailPageId:state.page.id,recover:true};
 const result=await reorderSections(projectId,input);assert.equal(result.recovered,true);assert.equal(result.sections.length,5);
 state.page.settings.sectionEdit={id:randomUUID(),startedAt:new Date().toISOString()};
 await assert.rejects(()=>reorderSections(projectId,input),e=>e.code==='busy');
}));
test('reorder error response hides database internals',async()=>seeded(async state=>{
 state.failure='sections-patch';const response=await reorderResponse(()=>reorderSections(projectId,req(state)));assert.equal(response.status,503);assert.doesNotMatch(JSON.stringify(await response.json()),/private-db|secret-test/);
}));
test('order draft move/revert is immutable and same-position move stays clean',()=>{
 const canonical=['a','b','c'],draft=moveSection(canonical,'a','b');assert.deepEqual(draft,['b','a','c']);assert.deepEqual(canonical,['a','b','c']);assert.ok(orderIsDirty(canonical,draft));
 const reverted=[...canonical];assert.equal(orderIsDirty(canonical,reverted),false);assert.equal(orderIsDirty(canonical,moveSection(canonical,'b','b')),false);assert.deepEqual(moveSection(canonical,'missing','b'),canonical);
});
test('content dirty blocks reorder; order dirty guards exit but does not block section selection',()=>{
 assert.equal(needsDraftGuard(true,false,'move'),true);assert.equal(needsDraftGuard(false,true,'leave'),true);assert.equal(needsDraftGuard(true,true,'leave'),true);assert.equal(needsDraftGuard(false,true,'select'),false);assert.equal(needsDraftGuard(false,false,'leave'),false);
});
test('manual order marker is tied to current Section ID set after regeneration',async()=>seeded(async state=>{
 await reorderSections(projectId,req(state));assert.equal(hasManualOrder(state.page.settings,state.sections),true);assert.equal(hasManualOrder(state.page.settings,state.sections.map(r=>({...r,id:randomUUID()}))),false);
}));
test('interrupted write intent recovers persisted update using immutable fingerprint',async()=>seeded(async state=>{
 const original=structuredClone(state.sections),input=req(state),row=state.sections[0];
 state.page.settings.sectionReorder={schemaVersion:1,runId:randomUUID(),detailPageId:state.page.id,status:'applying',startedAt:'2020-01-01T00:00:00.000Z',orderedSectionIds:input.orderedSectionIds,
 backup:original.map(r=>({id:r.id,sortOrder:r.sort_order,updatedAt:r.updated_at,fingerprint:immutableFingerprint(r)})),current:original.map(r=>({id:r.id,sortOrder:r.sort_order,updatedAt:r.updated_at})),pending:{id:row.id,fromUpdatedAt:row.updated_at,fromOrder:0,toOrder:4}};
 row.sort_order=4;row.updated_at='2020-02-01T00:00:00.000Z';
 const result=await reorderSections(projectId,{detailPageId:state.page.id,recover:true});assert.deepEqual(result.sections.map(r=>r.id),original.map(r=>r.id));assert.deepEqual(immutable(result.sections),immutable(original));
}));
test('unexpected content change during partial write is never overwritten by rollback',async()=>seeded(async state=>{
 let count=0;state.beforeSections=method=>{if(method==='PATCH'&&++count===2){state.sections[0].content.headline='보호할 외부 변경';state.sections[0].updated_at='2020-01-01T00:00:00.000Z';state.failure='sections-patch';}};
 await assert.rejects(()=>reorderSections(projectId,req(state)),e=>e.code==='recovery_required');assert.ok(state.sections.some(row=>row.content.headline==='보호할 외부 변경'));assert.ok(state.page.settings.sectionReorder);
}));
test('no AI/key dependency, no migration, and exact sort-only persistence boundary',()=>{
 const text=readFileSync(new URL('../src/features/section-reorder/service.ts',import.meta.url),'utf8');assert.doesNotMatch(text,/OPENAI_API_KEY|from ["']openai|generateSections|planPage/);
 const sql=readFileSync(new URL('../supabase/migrations/0001_initial_schema.sql',import.meta.url),'utf8');assert.match(sql,/create index sections_detail_page_id_sort_order_idx/);assert.doesNotMatch(sql,/unique\s*\(detail_page_id,\s*sort_order\)/i);
});

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { validateFacts, getValidationView } from "../src/features/fact-validation/service.ts";
import { FactValidationError } from "../src/features/fact-validation/errors.ts";
import { isValidationStale } from "../src/features/fact-validation/schemas.ts";
import { startValidationDb, projectId, productId, assetRow, validationOutput } from "./helpers/fact-validation.mjs";
import { completedAnalysis } from "./helpers/analysis.mjs";
const factory=(analyze=async input=>validationOutput(input))=>()=>({model:'mock-validation',analyze});
const rejects=(op,code)=>assert.rejects(op,e=>{assert.equal(e.code,code);assert.doesNotMatch(e.message,/secret-test|private-error/);return true;});
test("validation saves only separate column; Facts/source_snapshot/Product Analysis and Project are immutable",async()=>{
  const db=await startValidationDb();try{
    const before=structuredClone(db.state);let calls=0;
    const result=await validateFacts(projectId,factory(async input=>{calls++;return validationOutput(input);}));
    assert.equal(calls,1);assert.equal(result.state.attempt.status,'completed');
    assert.deepEqual((await getValidationView(projectId)).state,result.state);
    for(const key of ['facts','source_snapshot','version','validated_at','id','product_id','created_at'])assert.deepEqual(db.state.facts[key],before.facts[key]);
    assert.deepEqual(db.state.product,before.product);assert.deepEqual(db.state.project,before.project);
    const writes=db.state.requests.filter(r=>r.method!=='GET');assert.equal(writes.length,2);
    assert.ok(writes.every(r=>r.table==='product_facts'&&Object.keys(r.payload).join()==='validation'));
    assert.ok(db.state.requests.every(r=>!r.path.includes('/storage/')));
  }finally{await db.close();}
});
test("revalidation failure preserves exact previous success; changed Facts get stale and next success clears stale",async()=>{
  const db=await startValidationDb();try{
    const first=await validateFacts(projectId,factory());const previous=structuredClone(first.state.latestResult);
    await rejects(validateFacts(projectId,factory(async()=>{throw new Error('secret-test-key private-error');})),'provider');
    assert.equal(db.state.facts.validation.attempt.status,'failed');assert.deepEqual(db.state.facts.validation.latestResult,previous);
    db.state.facts.facts.productName='새 값';const view=await getValidationView(projectId);assert.ok(isValidationStale(view.state,view.inputFingerprint));
    const next=await validateFacts(projectId,factory());assert.equal(isValidationStale(next.state,next.inputFingerprint),false);
    assert.notEqual(next.state.latestResult.inputFingerprint,previous.inputFingerprint);
  }finally{await db.close();}
});
test("invalid evidence, altered facts and malformed output persist safe failure without a success",async()=>{
  for(const change of [o=>o.facts[0].evidenceIds=['S99'],o=>o.facts[0].value='invented',o=>o.facts.pop(),o=>o.extra=true]){
    const db=await startValidationDb();try{
      await rejects(validateFacts(projectId,factory(async input=>{const output=validationOutput(input);change(output);return output;})),'invalid_response');
      assert.equal(db.state.facts.validation.latestResult,null);assert.equal(db.state.facts.validation.attempt.status,'failed');
    }finally{await db.close();}
  }
});
test("missing records and ownership mismatches reject before provider or writes",async()=>{
  for(const [change,code] of [[s=>s.project=null,'not_found'],[s=>s.product=null,'product_required'],[s=>s.facts=null,'facts_required'],
    [s=>{s.facts.product_id=projectId;s.ignoreFilter='product_facts';},'ownership'],[s=>s.assets.push(assetRow({product_id:projectId})),'ownership'],
    [s=>s.assets.push(assetRow({project_id:productId})),'ownership'],[s=>s.assets.push(assetRow({storage_path:'other/path.png'})),'ownership']]){
    const db=await startValidationDb();try{change(db.state);let calls=0;await rejects(validateFacts(projectId,factory(async()=>{calls++;})) ,code);assert.equal(calls,0);assert.ok(db.state.requests.every(r=>r.method==='GET'));}finally{await db.close();}
  }
});
test("zero source permits insufficient, partial visual input uses only completed observations",async()=>{
  const db=await startValidationDb();try{
    db.state.facts.source_snapshot={};db.state.assets=[assetRow({metadata:{aiAnalysis:completedAnalysis()}}),assetRow({id:randomUUID()})];
    const result=await validateFacts(projectId,factory(async input=>{assert.deepEqual(input.coverage,{total:2,completed:1,invalid:0});assert.equal(input.evidence.some(e=>e.id==='S1'),false);return validationOutput(input,'insufficient');}));
    assert.equal(result.state.latestResult.status,'insufficient');
  }finally{await db.close();}
});
test("missing config and initial CAS save failure do not call provider or erase success",async()=>{
  const db=await startValidationDb();try{
    await validateFacts(projectId,factory());const before=structuredClone(db.state.facts.validation);
    await rejects(validateFacts(projectId,()=>{throw new FactValidationError('not_configured');}),'not_configured');assert.deepEqual(db.state.facts.validation,before);
    db.state.failure='patch-analyzing';let called=false;await rejects(validateFacts(projectId,factory(async()=>{called=true;})),'database');assert.equal(called,false);assert.deepEqual(db.state.facts.validation,before);
  }finally{await db.close();}
});
test("source changed during validation preserves original result and reports stale immediately",async()=>{
  const db=await startValidationDb();try{
    const before=structuredClone(db.state.facts.source_snapshot);
    const result=await validateFacts(projectId,factory(async input=>{db.state.facts.source_snapshot={changed:true};return validationOutput(input);}));
    assert.deepEqual(JSON.parse(result.state.latestResult.evidenceSnapshot[0].value),before);
    assert.equal(isValidationStale(result.state,result.inputFingerprint),true);assert.deepEqual(db.state.facts.source_snapshot,{changed:true});
  }finally{await db.close();}
});
test("provider cannot mutate canonical target/snapshot through its in-memory input",async()=>{
  const db=await startValidationDb();try{
    await rejects(validateFacts(projectId,factory(async input=>{input.targets[0].value='hijacked';input.evidence[0].value='hijacked';return validationOutput(input);})), 'invalid_response');
    assert.notEqual(db.state.facts.facts.productName,'hijacked');assert.equal(db.state.facts.validation.latestResult,null);
  }finally{await db.close();}
});
test("lost DB acknowledgment recovers without another provider call",async()=>{
  for(const stage of ['analyzing','completed']){const db=await startValidationDb();try{
    db.state.ackLost=stage;let calls=0;const result=await validateFacts(projectId,factory(async input=>{calls++;return validationOutput(input);}));
    assert.equal(result.state.attempt.status,'completed');assert.equal(calls,1);
  }finally{await db.close();}}
});
test("late response cannot overwrite newer attempt or deleted Facts",async()=>{
  for(const deleted of [false,true]){const db=await startValidationDb();try{
    const run=randomUUID();await rejects(validateFacts(projectId,factory(async input=>{if(deleted)db.state.facts=null;else db.state.facts.validation.attempt.runId=run;return validationOutput(input);})),deleted?'facts_required':'conflict');
    if(!deleted)assert.equal(db.state.facts.validation.attempt.runId,run);else assert.equal(db.state.facts,null);
  }finally{await db.close();}}
});
test("CAS claim detects concurrent Facts edits; final DB failure does not erase old success",async()=>{
  const db=await startValidationDb();try{
    let calls=0;db.state.beforePatch=async()=>{db.state.facts.updated_at='2026-09-14T01:00:00.000Z';};
    await rejects(validateFacts(projectId,factory(async()=>{calls++;})),'conflict');assert.equal(calls,0);
    db.state.beforePatch=null;await validateFacts(projectId,factory());const previous=structuredClone(db.state.facts.validation.latestResult);
    db.state.failure='patch-completed';await rejects(validateFacts(projectId,factory()),'database');
    assert.equal(db.state.facts.validation.attempt.status,'analyzing');assert.deepEqual(db.state.facts.validation.latestResult,previous);
  }finally{await db.close();}
});
test("in-process duplicate validation is blocked while first call is pending",async()=>{
  const db=await startValidationDb();let release,entered;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  try{const pending=validateFacts(projectId,factory(async input=>{entered();await gate;return validationOutput(input);}));await started;await rejects(validateFacts(projectId,factory()),'busy');release();await pending;}finally{release();await db.close();}
});
test("large previous validation stays out of CAS URLs; expired leases allow explicit retry",async()=>{
  const db=await startValidationDb();try{
    db.state.facts.source_snapshot.description='긴 설명'.repeat(1500);await validateFacts(projectId,factory());
    const previous=structuredClone(db.state.facts.validation.latestResult);assert.ok(JSON.stringify(previous).length>3000);
    await rejects(validateFacts(projectId,factory(async()=>{throw new Error('failed');})),'provider');assert.deepEqual(db.state.facts.validation.latestResult,previous);
    for(const request of db.state.requests.filter(r=>r.method==='PATCH'))assert.ok(request.query.length<650);
    db.state.facts.validation.attempt={status:'analyzing',runId:randomUUID(),startedAt:new Date(Date.now()-190000).toISOString(),finishedAt:null,errorCode:null};
    assert.equal((await validateFacts(projectId,factory())).state.attempt.status,'completed');
  }finally{await db.close();}
});

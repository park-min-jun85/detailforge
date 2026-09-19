import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { startAssetDb, assetRow, projectId, productId, assetId, otherId } from "./helpers/asset-db.mjs";
import { analysisResult, completedAnalysis } from "./helpers/analysis.mjs";
import { analyzeProductShots, saveProductShots } from "../src/features/detail-extraction/service.ts";
import { analyzeAsset } from "../src/features/asset-analysis/service.ts";
import { deleteAsset } from "../src/features/assets/service.ts";
import { readExtraction, derivationSchema } from "../src/features/detail-extraction/schemas.ts";
import { sourceFingerprint } from "../src/features/detail-extraction/images.ts";
const region={regionType:"product_photo",confidence:.9,productVisibility:.9,standaloneUsability:.9,textDensity:"none",box:{xMin:100,yMin:100,xMax:900,yMax:800},rationale:"제품이 보이는 사진"};
const code=expected=>e=>e.code===expected;
async function fixture(t) {
  const db=await startAssetDb();t.after(()=>db.close());
  const bytes=await sharp({create:{width:400,height:4000,channels:3,background:"#ddd"}}).png().toBuffer();
  const row=assetRow({size_bytes:bytes.length,asset_type:"detail",metadata:{source:{url:"https://supplier.example/image.png"},aiAnalysis:completedAnalysis()}});
  db.state.assets.push(row);db.state.objects.add(row.storage_path);db.state.objectBytes.set(row.storage_path,bytes);
  let calls=0;
  const provider={model:"mock-vision",analyze:async()=>{calls++;return {schemaVersion:1,regions:[structuredClone(region)]};}};
  const analyze=force=>analyzeProductShots(projectId,assetId,force,()=>provider);
  return {...db,row,bytes,provider,analyze,get calls(){return calls;}};
}
test("analyze source with null dimensions, retain original fields/Facts and no Storage writes",async t=>{
  const f=await fixture(t),before=structuredClone(f.row);const reply=await f.analyze(false),state=readExtraction(reply.asset.metadata);
  assert.equal(state.attempt.status,"completed");assert.equal(state.latestResult.sourceFingerprint,sourceFingerprint(f.bytes));assert.ok(f.calls>=2);
  const {detailExtraction,...remaining}=f.row.metadata;assert.ok(detailExtraction);assert.deepEqual(remaining,before.metadata);
  for(const key of Object.keys(before).filter(k=>k!=="metadata"))assert.deepEqual(f.row[key],before[key]);
  assert.equal(f.state.objects.size,1);assert.equal(f.state.assets.length,1);
  assert.equal(JSON.stringify(f.row.metadata).includes("temporary-test-token"),false);
  assert.equal(JSON.stringify(f.row.metadata).includes("data:image"),false);
  assert.ok(f.state.requests.filter(r=>r.method!=="GET"&&r.path.startsWith("/rest/v1/")).every(r=>r.path.endsWith("/assets")));
});
test("same fingerprint reuses successful result; force explicitly reanalyzes",async t=>{
  const f=await fixture(t);await f.analyze(false);const calls=f.calls;
  assert.equal((await f.analyze(false)).reused,true);assert.equal(f.calls,calls);
  assert.equal((await f.analyze(true)).reused,false);assert.equal(f.calls,2*calls);
});
test("changed source invalidates reuse and rejects stale crop saving",async t=>{
  const f=await fixture(t),reply=await f.analyze(false),ids=reply.asset.metadata.detailExtraction.latestResult.candidates.map(c=>c.id);
  f.state.objectBytes.set(f.row.storage_path,await sharp(f.bytes).negate().png().toBuffer());
  await assert.rejects(saveProductShots(projectId,assetId,{candidateIds:[ids[0]]}),code("source_changed"));
  assert.equal(f.state.assets.length,1);assert.equal((await f.analyze(false)).reused,false);
});
test("all tile failure preserves previous success and records safe failed attempt",async t=>{
  const f=await fixture(t);await f.analyze(false);const previous=structuredClone(f.row.metadata.detailExtraction.latestResult);
  f.provider.analyze=async()=>{throw new Error("raw-secret-provider");};
  await assert.rejects(f.analyze(true),code("unexpected"));
  assert.deepEqual(f.row.metadata.detailExtraction.latestResult,previous);assert.equal(f.row.metadata.detailExtraction.attempt.status,"failed");
  assert.equal(JSON.stringify(f.row.metadata).includes("raw-secret"),false);
});
test("partial tile failure keeps valid candidates and explicit warning/counts",async t=>{
  const f=await fixture(t);let count=0;f.provider.analyze=async()=>{if(count++===0)throw new Error("fail");return {schemaVersion:1,regions:[region]};};
  await f.analyze(false);const result=f.row.metadata.detailExtraction.latestResult;assert.equal(result.partialAnalysis,true);assert.deepEqual(result.failedTiles,[0]);assert.equal(result.completedTiles,result.tileCount-1);
});
test("invalid provider rectangles never enter metadata candidates",async t=>{
  const f=await fixture(t);f.provider.analyze=async()=>({schemaVersion:1,regions:[{...region,box:{xMin:900,yMin:0,xMax:100,yMax:1000}}]});
  await assert.rejects(f.analyze(false),code("invalid_rect"));assert.equal(f.row.metadata.detailExtraction.latestResult,null);
});
test("provider/config failure sanitized without metadata claim",async t=>{
  const f=await fixture(t);await assert.rejects(analyzeProductShots(projectId,assetId,false,()=>{throw new Error("secret-config");}),e=>!e.message.includes("secret-config"));
  assert.equal(f.row.metadata.detailExtraction,undefined);
});
test("ownership and recursive source rejected before any provider invocation",async t=>{
  const f=await fixture(t);f.row.product_id=otherId;await assert.rejects(f.analyze(false),code("not_found"));assert.equal(f.calls,0);
  f.row.product_id=productId;f.row.metadata.derivation={kind:"detail_image_crop"};await assert.rejects(f.analyze(false),code("recursive"));
  delete f.row.metadata.derivation;f.row.storage_path=`projects/${otherId}/products/${productId}/${assetId}.png`;await assert.rejects(f.analyze(false),code("ownership"));
});
test("active analysis rejects concurrency and expired lease may be retried",async t=>{
  const f=await fixture(t);await f.analyze(false);const s=f.row.metadata.detailExtraction;
  s.attempt={...s.attempt,status:"analyzing",startedAt:new Date().toISOString()};await assert.rejects(f.analyze(true),code("busy"));
  s.attempt.startedAt="2020-01-01T00:00:00.000Z";assert.equal((await f.analyze(true)).reused,false);
});
test("shared product mutation lock rejects delete while analyzing",async t=>{
  const f=await fixture(t);let release,started;const ready=new Promise(r=>started=r),gate=new Promise(r=>release=r);
  f.provider.analyze=async()=>{started();await gate;return {schemaVersion:1,regions:[region]};};
  const pending=f.analyze(false);await ready;await assert.rejects(deleteAsset(projectId,assetId),e=>e.status===409);release();await pending;
});
test("metadata CAS preserves concurrent namespace edit and uses small revision filter",async t=>{
  const f=await fixture(t);await f.analyze(false);let changed=false;
  f.state.beforePatch=payload=>{if(!changed&&payload.metadata?.detailExtraction?.attempt.status==="completed"){
    changed=true;f.row.metadata.custom={retain:true};f.row.metadata.detailExtraction.revision=randomUUID();}};
  await f.analyze(true);assert.deepEqual(f.row.metadata.custom,{retain:true});
  const patches=f.state.requests.filter(r=>r.method==="PATCH");assert.ok(patches.slice(1).every(r=>r.query.includes("revision")&&r.query.length<1000));
});
test("existing Asset AI participates in extraction revision CAS and preserves results",async t=>{
  const f=await fixture(t);await f.analyze(false);const result=structuredClone(f.row.metadata.detailExtraction.latestResult),revision=f.row.metadata.detailExtraction.revision;
  await analyzeAsset(projectId,assetId,()=>({model:"mock-asset",analyze:async()=>analysisResult()}));
  assert.deepEqual(f.row.metadata.detailExtraction.latestResult,result);assert.notEqual(f.row.metadata.detailExtraction.revision,revision);assert.equal(f.row.metadata.aiAnalysis.status,"completed");
});
test("lost metadata UPDATE acknowledgement reconciles committed state",async t=>{
  const f=await fixture(t);f.state.patchAckLost="completed";await f.analyze(false);assert.equal(f.row.metadata.detailExtraction.attempt.status,"completed");
});
test("selected-only actual crop save appends in source order, unclassified and provenance",async t=>{
  const f=await fixture(t);await f.analyze(false);const candidates=f.row.metadata.detailExtraction.latestResult.candidates;
  const before=structuredClone(f.row),ids=candidates.map(c=>c.id).reverse();const reply=await saveProductShots(projectId,assetId,{candidateIds:ids});
  assert.equal(reply.failed.length,0);assert.equal(reply.saved.length,ids.length);
  for(const [i,item]of reply.saved.entries()){
    assert.equal(item.asset.assetType,"unclassified");assert.equal(item.asset.sortOrder,i+1);
    const d=derivationSchema.parse(item.asset.metadata.derivation);assert.equal(d.parentAssetId,assetId);assert.equal(d.candidateId,candidates[i].id);
    assert.equal(d.suggestedRole,"product");assert.equal(item.asset.metadata.aiAnalysis,undefined);
    const meta=await sharp(f.state.objectBytes.get(item.asset.storagePath)).metadata();assert.equal(meta.width,item.asset.width);assert.equal(meta.height,item.asset.height);
  }
  assert.deepEqual(f.row.metadata.source,before.metadata.source);assert.deepEqual(f.row.metadata.aiAnalysis,before.metadata.aiAnalysis);
  assert.equal(f.row.asset_type,"detail");assert.equal(sourceFingerprint(f.state.objectBytes.get(f.row.storage_path)),sourceFingerprint(f.bytes));
});
test("unselected candidate never creates a row; duplicate save returns existing asset",async t=>{
  const f=await fixture(t);await f.analyze(false);const ids=[f.row.metadata.detailExtraction.latestResult.candidates[0].id];
  const first=await saveProductShots(projectId,assetId,{candidateIds:ids}),second=await saveProductShots(projectId,assetId,{candidateIds:ids});
  assert.equal(f.state.assets.length,2);assert.equal(second.saved[0].existing,true);assert.equal(second.saved[0].asset.id,first.saved[0].asset.id);
});
test("asset limit rejects entire selection before storage write and reports remaining slots",async t=>{
  const f=await fixture(t);await f.analyze(false);const candidates=f.row.metadata.detailExtraction.latestResult.candidates;
  for(let i=0;i<28;i++)f.state.assets.push(assetRow({id:randomUUID(),sort_order:i+1}));
  await assert.rejects(saveProductShots(projectId,assetId,{candidateIds:candidates.slice(0,2).map(c=>c.id)}),e=>e.code==="asset_limit"&&e.available===1);
  assert.equal(f.state.objects.size,1);assert.equal(f.state.assets.length,29);
});
test("stale/unknown/forged candidate IDs and arbitrary crop body rejected",async t=>{
  const f=await fixture(t);await f.analyze(false);const id=f.row.metadata.detailExtraction.latestResult.candidates[0].id;
  await assert.rejects(saveProductShots(projectId,assetId,{candidateIds:["f".repeat(64)]}),code("stale"));
  await assert.rejects(saveProductShots(projectId,assetId,{candidateIds:[id],rect:{x:0,y:0,width:10,height:10}}),code("invalid_input"));
  f.row.metadata.detailExtraction.latestResult.candidates[0].rect.x++;await assert.rejects(saveProductShots(projectId,assetId,{candidateIds:[id]}),code("stale"));
});
test("partial failure keeps prior saved crop and cleans up DB-failed crop",async t=>{
  const f=await fixture(t);await f.analyze(false);const ids=f.row.metadata.detailExtraction.latestResult.candidates.slice(0,2).map(c=>c.id);
  let signs=0;f.state.beforePatch=()=>{};
  // Make first upload succeed, second INSERT fail, without changing production code.
  const originalAdd=f.state.objects.add.bind(f.state.objects);f.state.objects.add=path=>{if(++signs===2)f.state.failure="insert";return originalAdd(path);};
  const reply=await saveProductShots(projectId,assetId,{candidateIds:ids});assert.equal(reply.saved.length,1);assert.equal(reply.failed.length,1);
  assert.equal(f.state.assets.length,2);assert.equal(f.state.objects.size,2);
});
test("upload failure and cleanup failure return bounded per-candidate error",async t=>{
  const f=await fixture(t);await f.analyze(false);f.state.failure="upload";
  const body={candidateIds:[f.row.metadata.detailExtraction.latestResult.candidates[0].id]};
  assert.equal((await saveProductShots(projectId,assetId,body)).failed[0].code,"upload");assert.equal(f.state.objects.size,1);
  f.state.failCleanup=true;assert.equal((await saveProductShots(projectId,assetId,body)).failed[0].code,"recovery");
});
test("INSERT acknowledgement lost preserves successfully committed crop",async t=>{
  const f=await fixture(t);await f.analyze(false);f.state.ackLost=true;
  const reply=await saveProductShots(projectId,assetId,{candidateIds:[f.row.metadata.detailExtraction.latestResult.candidates[0].id]});
  assert.equal(reply.saved.length,1);assert.equal(reply.failed.length,0);assert.equal(f.state.objects.size,2);
});
test("uncertain INSERT reconciliation does not delete possibly committed crop",async t=>{
  const f=await fixture(t);await f.analyze(false);f.state.ackLost=true;
  const originalAdd=f.state.objects.add.bind(f.state.objects);f.state.objects.add=path=>{f.state.failRecoveryRead=true;return originalAdd(path);};
  await assert.rejects(saveProductShots(projectId,assetId,{candidateIds:[f.row.metadata.detailExtraction.latestResult.candidates[0].id]}));
  assert.equal(f.state.assets.length,2);assert.equal(f.state.objects.size,2);assert.equal(f.state.requests.filter(r=>r.method==="DELETE").length,0);
});
test("source deletion does not cascade crops; crop deletion does not delete source",async t=>{
  const f=await fixture(t);await f.analyze(false);const ids=f.row.metadata.detailExtraction.latestResult.candidates.slice(0,2).map(c=>c.id);
  const reply=await saveProductShots(projectId,assetId,{candidateIds:ids});await deleteAsset(projectId,reply.saved[0].asset.id);
  assert.ok(f.state.assets.some(a=>a.id===assetId));await deleteAsset(projectId,assetId);
  assert.ok(f.state.assets.some(a=>a.id===reply.saved[1].asset.id));assert.ok(f.state.objects.has(reply.saved[1].asset.storagePath));
});
test("source Storage redirect is not followed and never reaches provider",async t=>{
  const f=await fixture(t);f.state.downloadRedirect="http://127.0.0.1:1/private";
  await assert.rejects(f.analyze(false),code("source_load"));assert.equal(f.calls,0);assert.equal(f.state.assets.length,1);
});
test("active save lease blocks another save or analysis, and expires for recovery",async t=>{
  const f=await fixture(t);await f.analyze(false);const s=f.row.metadata.detailExtraction,body={candidateIds:[s.latestResult.candidates[0].id]};
  s.saveLease={id:randomUUID(),startedAt:new Date().toISOString()};await assert.rejects(f.analyze(true),code("busy"));await assert.rejects(saveProductShots(projectId,assetId,body),code("busy"));
  s.saveLease.startedAt="2020-01-01T00:00:00.000Z";assert.equal((await saveProductShots(projectId,assetId,body)).saved.length,1);
});
test("new derived image remains eligible for existing explicit Asset AI analysis",async t=>{
  const f=await fixture(t);await f.analyze(false);const reply=await saveProductShots(projectId,assetId,{candidateIds:[f.row.metadata.detailExtraction.latestResult.candidates[0].id]});
  const asset=reply.saved[0].asset,provenance=structuredClone(asset.metadata.derivation);let calls=0;
  const analyzed=await analyzeAsset(projectId,asset.id,()=>({model:"mock-asset",analyze:async()=>{calls++;return analysisResult();}}));
  assert.equal(calls,1);assert.equal(analyzed.assetType,"product");assert.deepEqual(analyzed.metadata.derivation,provenance);
});

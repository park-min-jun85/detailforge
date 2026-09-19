import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { imageCategory, MAX_TILE_COUNT, TILE_OVERLAP } from "../src/features/detail-extraction/policy.ts";
import { regionSchema, tileOutputSchema, saveRequestSchema, isDerived, isExtractionActive } from "../src/features/detail-extraction/schemas.ts";
import { mapBox, clampRect, withMargin, normalizeCandidates, candidateId } from "../src/features/detail-extraction/geometry.ts";
import { decodeSource, cropImage, planTiles, imageTiles, sourceFingerprint } from "../src/features/detail-extraction/images.ts";
import { bounded, readLimitedResponse } from "../src/features/detail-extraction/source.ts";
import { createExtractionProvider, EXTRACTION_PROMPT, getExtractionConfig } from "../src/features/detail-extraction/provider.ts";
import { extractionResponse } from "../src/features/detail-extraction/http.ts";
import { responseBody } from "./helpers/analysis.mjs";
const source = { width: 860, height: 12900 }, fingerprint = "a".repeat(64);
const tile = { x: 0, y: 2000, width: 860, height: 2000, index: 1 };
const region = (overrides = {}) => ({ regionType: "product_photo", confidence: .9, productVisibility: .9, standaloneUsability: .9,
  textDensity: "none", box: { xMin: 100, yMin: 100, xMax: 900, yMax: 800 }, rationale: "제품 전체가 보이는 사진", ...overrides });
const normalize = (r = region(), t = tile) => normalizeCandidates([{ region: r, tile: t }], source, fingerprint).candidates[0];
const code = expected => error => error.code === expected;

test("eligibility: extreme detail independent of classification; normal square/1200px excluded", () => {
  assert.equal(imageCategory(860, 12900), "extreme_long"); assert.equal(imageCategory(800, 4000), "long");
  for (const [w,h] of [[330,330],[860,860],[860,1200],[0,0]]) assert.equal(imageCategory(w,h), "normal");
});
test("strict schema rejects extra claims, arbitrary types, NaN, out-of-range scores/boxes and long rationale", () => {
  assert.ok(regionSchema.safeParse(region()).success);
  for (const extra of [{ facts: "invented" }, { regionType:"hero" }, { confidence:1.1 }, { productVisibility:-1 }, { standaloneUsability:NaN },
    { textDensity:"unknown" }, { rationale:"a".repeat(181) }, { box:{xMin:0,yMin:0,xMax:1001,yMax:1} }]) assert.equal(regionSchema.safeParse(region(extra)).success,false);
  assert.equal(tileOutputSchema.safeParse({ schemaVersion:1, regions:Array(9).fill(region()) }).success,false);
});
test("normalized box maps using tile offset and source pixels", () => assert.deepEqual(mapBox(region().box,tile,source), {x:86,y:2200,width:688,height:1400}));
test("invalid reverse/zero/fractional/nonfinite/out-of-bounds normalized boxes rejected", () => {
  for (const box of [{xMin:900,yMin:0,xMax:1,yMax:1000},{xMin:0,yMin:10,xMax:1000,yMax:10},{xMin:0.2,yMin:0,xMax:1000,yMax:1000},{xMin:NaN,yMin:0,xMax:1000,yMax:1000},{xMin:-1,yMin:0,xMax:1000,yMax:1000}]) assert.throws(()=>mapBox(box,tile,source),code("invalid_rect"));
});
test("clamping and bounded margin remain inside source", () => {
  assert.deepEqual(clampRect({x:-10,y:-10,width:30,height:30},source),{x:0,y:0,width:20,height:20});
  assert.deepEqual(withMargin({x:0,y:0,width:860,height:12900},source),{x:0,y:0,width:860,height:12900});
  assert.throws(()=>clampRect({x:9999,y:0,width:2,height:2},source),code("invalid_rect"));
});
test("candidate IDs deterministic and sensitive to bytes/rect/role", () => {
  const rect={x:1,y:2,width:200,height:400}; const id=candidateId(fingerprint,rect,"product_photo");
  assert.equal(id,candidateId(fingerprint,{...rect},"product_photo"));
  for(const other of [candidateId("b".repeat(64),rect,"product_photo"),candidateId(fingerprint,{...rect,x:2},"product_photo"),candidateId(fingerprint,rect,"usage_photo")])assert.notEqual(id,other);
});
test("small regions filtered but tall complete full-body crops remain eligible",()=>{
  assert.equal(normalize(region({box:{xMin:0,yMin:100,xMax:100,yMax:120}})).saveAllowed,false);
  assert.equal(normalize(region({regionType:"usage_photo",box:{xMin:200,yMin:10,xMax:500,yMax:990}})).defaultSelected,true);
});
test("nonproduct/mixed/high text/low confidence never default selected",()=>{
  for(const regionType of ["product_photo","usage_photo","detail_closeup","variant_photo"])assert.equal(normalize(region({regionType})).defaultSelected,true);
  for(const regionType of ["text_or_spec","shipping_or_notice","promotional_banner","other","mixed"]) assert.equal(normalize(region({regionType})).defaultSelected,false);
  assert.equal(normalize(region({regionType:"mixed"})).saveAllowed,true);
  for(const extra of [{textDensity:"high"},{confidence:.5},{productVisibility:.4},{standaloneUsability:.4}])assert.equal(normalize(region(extra)).defaultSelected,false);
});
test("tile-edge fragments flagged and not selected; adjacent photos never blind-unioned",()=>{
  assert.equal(normalize(region({box:{xMin:0,yMin:0,xMax:1000,yMax:1000}})).defaultSelected,false);
  const entries=[{region:region(),tile},{region:region(),tile:{...tile,y:4000,index:2}}];
  assert.equal(normalizeCandidates(entries,source,fingerprint).candidates.length,2);
});
test("overlapping and contained duplicate boxes retain best candidate without union",()=>{
  const entries=[{region:region(),tile},{region:region({confidence:.5,box:{xMin:110,yMin:110,xMax:890,yMax:790}}),tile:{...tile,index:2}}];
  const result=normalizeCandidates(entries,source,fingerprint).candidates;
  assert.equal(result.length,1);assert.equal(result[0].confidence,.9);assert.deepEqual(result[0].tileIndices,[1,2]);
});
test("candidate cap ranks quality then returns deterministic source order",()=>{
  const entries=Array.from({length:30},(_,i)=>({region:region({confidence:i===0?.4:.9}),tile:{...tile,index:i%16,y:i*3000,height:2000}}));
  const result=normalizeCandidates(entries,{width:860,height:100000},fingerprint);
  assert.equal(result.candidates.length,24);assert.equal(result.truncatedCandidates,true);
  assert.ok(result.candidates.every(c=>c.confidence===.9));
  assert.deepEqual(result.candidates.map(c=>c.rect.y),result.candidates.map(c=>c.rect.y).toSorted((a,b)=>a-b));
});
test("tiling has bounded overlap, full coverage, final tile and count limit",()=>{
  const tiles=planTiles(source);assert.ok(tiles.length>1&&tiles.length<=MAX_TILE_COUNT);assert.equal(tiles[0].y,0);
  assert.equal(tiles.at(-1).y+tiles.at(-1).height,source.height);
  for(let i=1;i<tiles.length;i++)assert.equal(tiles[i-1].y+tiles[i-1].height-tiles[i].y,TILE_OVERLAP);
  assert.throws(()=>planTiles({width:860,height:60000}),code("tile_limit"));
});
test("bounded gutter snapping selects wide near-target separator",()=>{
  const rows=Array(5000).fill(false);for(let y=2080;y<2120;y++)rows[y]=true;
  const tiles=planTiles({width:860,height:5000},rows);assert.ok(tiles[0].height>=2088&&tiles[0].height<=2112);
});
test("bytes fingerprint does not depend on URLs or metadata",()=>{
  assert.equal(sourceFingerprint(Buffer.from("same")),sourceFingerprint(new Uint8Array(Buffer.from("same"))));
  assert.notEqual(sourceFingerprint(Buffer.from("same")),sourceFingerprint(Buffer.from("changed")));
});
test("recursive extraction marker and expired attempt lease",()=>{
  assert.equal(isDerived({derivation:{kind:"detail_image_crop"}}),true);assert.equal(isDerived({source:{url:"example"}}),false);
  assert.equal(isExtractionActive({attempt:{status:"analyzing",startedAt:new Date().toISOString()}}),true);
  assert.equal(isExtractionActive({attempt:{status:"analyzing",startedAt:"2020-01-01T00:00:00.000Z"}}),false);
});
test("save schema accepts only known-shaped IDs, no client rectangles/URLs, duplicates or empty selection",()=>{
  assert.ok(saveRequestSchema.safeParse({candidateIds:[fingerprint]}).success);
  for(const body of [{candidateIds:[]},{candidateIds:[fingerprint,fingerprint]},{candidateIds:[fingerprint],rect:{}},{candidateIds:[fingerprint],url:"http://localhost"},{candidateIds:[randomUUID()]}]) assert.equal(saveRequestSchema.safeParse(body).success,false);
});
for (const [format,mime] of [["jpeg","image/jpeg"],["png","image/png"],["webp","image/webp"]]) test(`actual ${format} decode/crop preserves MIME, dimensions and source bytes`,async()=>{
  const bytes=await sharp({create:{width:400,height:2400,channels:3,background:"#d77c50"}})[format]().toBuffer(),before=sourceFingerprint(bytes);
  const image=await decodeSource(bytes,mime),crop=await cropImage(image,{x:10,y:20,width:300,height:500});
  const metadata=await sharp(crop.bytes).metadata();assert.equal(metadata.format,format);assert.equal(metadata.width,300);assert.equal(metadata.height,500);
  assert.equal(sourceFingerprint(bytes),before);assert.ok(crop.bytes.length>0);
  await assert.rejects(cropImage(image,{x:300,y:0,width:500,height:500}),code("invalid_rect"));
});
test("EXIF orientation normalization uses identical pixel space for tiles and crops",async()=>{
  const bytes=await sharp({create:{width:2400,height:400,channels:3,background:"red"}}).jpeg().withMetadata({orientation:6}).toBuffer();
  const image=await decodeSource(bytes,"image/jpeg");assert.deepEqual(image.dimensions,{width:400,height:2400});assert.equal(image.orientation,6);
  const crop=await cropImage(image,{x:0,y:0,width:400,height:600});assert.equal((await sharp(crop.bytes).metadata()).orientation,undefined);
  const tiles=await imageTiles(image);assert.ok(tiles.length>1);assert.equal(tiles[0].width,400);
});
test("bad MIME/signature/truncated decoder input, ordinary photo and pixel limit rejected",async()=>{
  await assert.rejects(decodeSource(Buffer.from("MZ binary"),"image/png"),code("unsupported_mime"));
  await assert.rejects(decodeSource(Buffer.from([255,216,255]),"image/jpeg"),code("decode"));
  const small=await sharp({create:{width:330,height:330,channels:3,background:"white"}}).png().toBuffer();
  await assert.rejects(decodeSource(small,"image/gif"),code("unsupported_mime"));await assert.rejects(decodeSource(small,"image/png"),code("ineligible"));
  const wide=await sharp({create:{width:6100,height:10,channels:3,background:"white"}}).png().toBuffer();await assert.rejects(decodeSource(wide,"image/png"),code("pixel_limit"));
});
test("bounded source stream rejects declared and actual >10MiB",async()=>{
  await assert.rejects(readLimitedResponse(new Response("x",{headers:{"content-length":String(11*1024*1024)}})),code("source_load"));
  await assert.rejects(readLimitedResponse(new Response(new Uint8Array(10*1024*1024+1))),code("source_load"));
  assert.equal((await readLimitedResponse(new Response("ok"))).toString(),"ok");
});
test("decoder rejects decompression pixel bomb from image header before allocating pixels",async()=>{
  const bytes=await sharp({create:{width:1,height:1,channels:3,background:"white"}}).png().toBuffer();
  bytes.writeUInt32BE(6000,16);bytes.writeUInt32BE(10000,20);
  // Correct IHDR CRC; retain tiny compressed payload, since the decoder must reject the header first.
  let crc=0xffffffff;for(const byte of bytes.subarray(12,29)){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  bytes.writeUInt32BE((crc^0xffffffff)>>>0,29);
  await assert.rejects(decodeSource(bytes,"image/png"),code("pixel_limit"));
});
test("wall-clock bound aborts even a provider ignoring abort",async()=>{
  let signal;await assert.rejects(bounded(s=>{signal=s;return new Promise(()=>{});},5),code("timeout"));assert.equal(signal.aborted,true);
});
test("provider sends image as data under fixed instructions and strict output, with no retries/logging",async()=>{
  let calls=0,payload;
  const provider=createExtractionProvider({apiKey:"secret-test",model:"gpt-5.6-luna"},async(_,init)=>{calls++;payload=JSON.parse(init.body);return Response.json(responseBody({schemaVersion:1,regions:[region()]}));});
  await provider.analyze("data:image/jpeg;base64,abc",new AbortController().signal);
  assert.equal(calls,1);assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);
  assert.equal(payload.input[0].content,EXTRACTION_PROMPT);assert.match(EXTRACTION_PROMPT,/untrusted DATA/);
  assert.equal(payload.input[1].content[1].type,"input_image");assert.equal(JSON.stringify(payload).includes("secret-test"),false);
});
test("provider raw errors and invalid responses are sanitized",async()=>{
  const provider=createExtractionProvider({apiKey:"secret-test",model:"test"},async()=>{throw new Error("secret-test https://private?key=secret-test");});
  await assert.rejects(provider.analyze("data:test",new AbortController().signal),e=>e.code==="provider"&&!e.message.includes("secret-test"));
  const invalid=createExtractionProvider({apiKey:"test",model:"test"},async()=>Response.json(responseBody({schemaVersion:1,regions:[region({box:{}})]})));
  await assert.rejects(invalid.analyze("data:test",new AbortController().signal),code("invalid_response"));
});
test("missing key rejects configuration before request",()=>{
  const before=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
  try{assert.throws(getExtractionConfig,code("not_configured"));}finally{if(before!==undefined)process.env.OPENAI_API_KEY=before;}
});
test("HTTP enforces same origin, JSON bound and private/no-store errors",async()=>{
  const make=(body,origin="http://localhost:3000")=>new Request("http://localhost:3000/api/test",{method:"POST",headers:{origin,"content-type":"application/json"},body});
  let calls=0;const operation=async()=>{calls++;throw new Error("secret-test");};
  assert.equal((await extractionResponse(make("{}","https://evil.example"),operation)).status,403);
  assert.equal((await extractionResponse(make("x".repeat(9000)),operation)).status,400);
  const response=await extractionResponse(make("{}"),operation);assert.equal(calls,1);assert.match(response.headers.get("cache-control"),/no-store/);assert.equal((await response.text()).includes("secret-test"),false);
});

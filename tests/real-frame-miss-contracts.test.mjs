import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {analyzeCropEdges} from '../src/features/detail-extraction/frame-analysis.ts';
import {trimCrop} from '../src/features/detail-extraction/edge-trim.ts';
import {edgeProfile,regionStats,rgbDistance,luminance,validateMissCorpus} from './helpers/frame-miss-diagnostics.mjs';
import {frameMissAnalogues,renderFrameMiss} from './fixtures/v0.2.1/frame-miss-analogues.mjs';
const manifest=JSON.parse(readFileSync(new URL('./fixtures/v0.2.1/real-frame-misses.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const insets=decisions=>Object.fromEntries(Object.entries(decisions).map(([edge,d])=>[edge,d.trimPixels]));

test('real miss patches are bounded, anonymized by neutral names, and cover three distinct mechanisms',()=>{
 assert.equal(manifest.samples.length,3);
 assert.deepEqual(manifest.samples.map(s=>s.classification),['ambiguous','panel_background','content_touching_edge']);
 for(const s of manifest.samples){assert.ok(s.patch.rect.width<=256&&s.patch.rect.height<=128);assert.ok(s.patch.bytes<64000);assert.match(s.patch.file,/^real-frame-patches\/[a-z-]+\.png$/);assert.match(s.sourceHash,/^[a-f0-9]{64}$/);assert.deepEqual(s.beforeRect,s.afterRect);assert.ok(Object.values(s.fullCandidateDecisions).every(d=>d.trimPixels===0));}
});
for(const s of manifest.samples)test(`real patch ${s.name}: frozen decoded pixels and current preserve characterization`,async()=>{
 const bytes=readFileSync(new URL('./fixtures/v0.2.1/'+s.patch.file,import.meta.url));assert.equal(bytes.length,s.patch.bytes);assert.equal(hash(bytes),s.patch.sha256);
 const {data:raw,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,s.patch.rect.width);assert.equal(info.height,s.patch.rect.height);assert.equal(hash(raw),s.patch.rawHash);
 const before=Buffer.from(raw),decisions=analyzeCropEdges(raw,info.width,info.height);
 assert.deepEqual(decisions,s.patch.decisions);assert.deepEqual(analyzeCropEdges(Buffer.from(raw),info.width,info.height),decisions);assert.deepEqual(raw,before);
 assert.ok(Object.values(decisions).every(d=>d.trimPixels===0));
 // These small local patches have artificial new edges and a different 3% cap.
 if(s.name==='layered-muted-border'){assert.equal(decisions.top.reason,'wide_band');assert.equal(s.fullCandidateDecisions.top.reason,'no_separator');}
 const profile=edgeProfile(raw,info.width,info.height,s.statistics.representativeEdge,30);
 assert.ok(profile.lines.every(l=>l.continuity>=0&&l.continuity<=1&&l.detailRatio>=0&&l.detailRatio<=1));
});
test('desired contract is distinct from production output and validates all five classifications',()=>{
 validateMissCorpus(frameMissAnalogues,renderFrameMiss);
 assert.equal(frameMissAnalogues.filter(f=>f.safety==='safe_to_trim').length,3);
 assert.equal(new Set(frameMissAnalogues.map(f=>f.expectedClass)).size,5);
});
for(const f of frameMissAnalogues){
 test(`${f.id}: desired ${f.expectedClass}/${f.safety} preserves the declared content bounds`,()=>{
  const i=f.desiredInsets,b=f.knownContentBounds;
  assert.ok(i.left<=b.x&&i.top<=b.y&&f.width-i.right>=b.x+b.width&&f.height-i.bottom>=b.y+b.height);
  if(f.pairedWith){const pair=frameMissAnalogues.find(p=>p.id===f.pairedWith);assert.notEqual(pair.safety,'safe_to_trim');assert.notDeepEqual(renderFrameMiss(f),renderFrameMiss(pair));}
 });
 test(`${f.id}: current production characterization and crop safeguard`,async()=>{
  const raw=renderFrameMiss(f),before=Buffer.from(raw),decisions=analyzeCropEdges(raw,f.width,f.height);
  assert.deepEqual(insets(decisions),f.currentInsets);assert.equal(decisions[f.edge].reason,f.currentReason);assert.deepEqual(raw,before);
  const bytes=await sharp(raw,{raw:{width:f.width,height:f.height,channels:4}}).png().toBuffer(),trim=await trimCrop(bytes,f.width,f.height);
  assert.deepEqual(trim.insets,f.currentInsets);assert.equal(trim.width,f.width-f.currentInsets.left-f.currentInsets.right);assert.equal(trim.height,f.height-f.currentInsets.top-f.currentInsets.bottom);
 });
}
test('semantic reinterpretation cannot change a pixel-only desired or production decision',()=>{
 const a=frameMissAnalogues.find(f=>f.id==='RF-A-R'),h=frameMissAnalogues.find(f=>f.id==='RF-A-H');assert.notEqual(a.semanticInterpretation,h.semanticInterpretation);
 assert.deepEqual(renderFrameMiss(a),renderFrameMiss(h));assert.equal(a.expectedClass,h.expectedClass);
 assert.deepEqual(analyzeCropEdges(renderFrameMiss(a),a.width,a.height),analyzeCropEdges(renderFrameMiss(h),h.width,h.height));
 const changed=structuredClone(frameMissAnalogues);changed.find(f=>f.id===h.id).expectedClass='panel_background';
 assert.throws(()=>validateMissCorpus(changed,renderFrameMiss),/Same pixels/);
});
for(const [label,mutate,pattern]of [
 ['missing negative pair',f=>{f[0].pairedWith='missing';},/Missing preserve pair/],
 ['positive sharing exact negative pixels',f=>{f[1].recipe='separated';},/pixel signal/],
 ['content loss',f=>{f[0].knownContentBounds.y=7;f[0].knownContentBounds.height=313;},/Content loss/],
 ['cap violation',f=>{f[0].desiredInsets.top=10;},/Inset cap/],
 ['unsafe classification with trim',f=>{f[0].safety='unsafe_to_trim';},/Safety\/inset/],
 ['non-decorative positive',f=>{f[0].expectedClass='photo_background';},/Only separated/],
 ['invalid class',f=>{f[0].expectedClass='looks good';},/Invalid class/],
 ['duplicate id',f=>{f[1].id=f[0].id;},/Duplicate/],
])test(`desired validator rejects ${label}`,()=>{const f=structuredClone(frameMissAnalogues);mutate(f);assert.throws(()=>validateMissCorpus(f,renderFrameMiss),pattern);});
test('diagnostic means, population variance, continuity, transition and detail counts have independent numeric oracles',()=>{
 const raw=Buffer.from([0,0,0,255,10,20,30,255,100,100,100,255,110,120,130,255]);
 const p=edgeProfile(raw,2,2,'top',2);
 assert.deepEqual(p.lines[0].mean,[5,10,15]);assert.deepEqual(p.lines[0].variance,[25,100,225]);assert.equal(p.lines[0].continuity,0);assert.equal(p.lines[0].detailRatio,1);
 assert.equal(p.transitionCount,1);assert.ok(Math.abs(p.transitions[0].rgbDistance-Math.sqrt(30000))<1e-10);assert.ok(Math.abs(p.transitions[0].luminanceDistance-100)<1e-10);
 const r=regionStats(raw,2,2,{x:0,y:0,width:2,height:2});assert.deepEqual(r.mean,[55,60,65]);assert.deepEqual(r.variance,[2525,2600,2725]);assert.equal(r.detailRatio,1);
 assert.equal(rgbDistance([0,0,0],[3,4,0]),5);assert.equal(luminance([0,0,0]),0);
});
test('uniform split line has high variance despite a low adjacent detail ratio',()=>{
 const raw=Buffer.alloc(100*2*4);for(let y=0;y<2;y++)for(let x=0;x<100;x++)raw.set([x<50?80:255,x<50?80:255,x<50?80:255,255],(y*100+x)*4);
 const p=edgeProfile(raw,100,2,'bottom',1).lines[0];assert.equal(p.detailRatio,1/99);assert.equal(p.variance[0],7656.25);assert.equal(p.continuity,0);
});
test('diagnostic corner inset and axis orientation are explicit rather than silently sampled',async()=>{
 const f=frameMissAnalogues[0],raw=renderFrameMiss(f),bytes=await sharp(raw,{raw:{width:f.width,height:f.height,channels:4}}).png().toBuffer();
 const rotated=await sharp(bytes).rotate(90).ensureAlpha().raw().toBuffer();
 assert.deepEqual(edgeProfile(raw,320,320,'top',20,4).lines,edgeProfile(rotated,320,320,'right',20,4).lines);
 assert.equal(edgeProfile(raw,320,320,'top',1).inset,0);
});
test('diagnostics reject malformed buffers, edge, regions and config',()=>{
 const raw=Buffer.alloc(4*4*4);
 for(const invoke of [()=>edgeProfile(raw,3,4,'top',2),()=>edgeProfile(raw,4,4,'middle',2),()=>edgeProfile(raw,4,4,'top',5),()=>edgeProfile(raw,4,4,'top',2,2),()=>edgeProfile(raw,4,4,'top',2,0,{}),()=>regionStats(raw,4,4,{x:3,y:0,width:2,height:1})])assert.throws(invoke,/Invalid/);
});

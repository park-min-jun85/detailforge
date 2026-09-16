import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exportRequestSchema} from '../src/features/detail-export/schemas.ts';
import {exportFilename,disposition} from '../src/features/detail-export/filename.ts';
import {trustedOrigin,checkDimensions,SURFACE_SELECTOR} from '../src/features/detail-export/config.ts';
import {assertBrowserInstalled,allowedCaptureRequest,imagesReady,fontsReady} from '../src/features/detail-export/browser.ts';
import {exportDetail} from '../src/features/detail-export/service.ts';
import {handleExport} from '../src/features/detail-export/http.ts';
import {ExportError} from '../src/features/detail-export/errors.ts';
import {imageDimensions} from '../src/features/detail-export/image-header.ts';
import {renderFingerprint} from '../src/features/detail-renderer/fingerprint.ts';
import {generateSections} from '../src/features/section-engine/service.ts';
import {fixture,provider} from './helpers/section-fixtures.mjs';
import {projectId} from './helpers/section-db.mjs';
const origin='http://127.0.0.1:3000';
const png=(w=860,h=1500)=>{const b=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.write('IHDR',12);b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);return b;};
const jpg=(w=860,h=1500)=>Buffer.from([255,216,255,192,0,8,8,h>>8,h&255,w>>8,w&255,1]);
const capture=async i=>({bytes:i.options.format==='png'?png(i.width):jpg(i.width),width:i.width,height:1500});
const view=()=>({projectId,productName:'검증 상품',detailPageId:'page',width:860,state:'ready',sections:[],assets:[],readiness:{missingImageCount:0}});
const run=(input={format:'png'},extra={})=>exportDetail(projectId,input,{origin,read:async()=>view(),capture,...extra});
test('strict PNG/JPG schema, quality default and bounds, arbitrary URL forbidden',()=>{
 assert.deepEqual(exportRequestSchema.parse({format:'png'}),{format:'png'});
 assert.deepEqual(exportRequestSchema.parse({format:'jpg'}),{format:'jpg',quality:90});
 for(const input of [{format:'jpeg'},{format:'png',quality:90},{format:'jpg',quality:59},{format:'jpg',quality:101},{format:'jpg',quality:90.5},{format:'png',url:'http://evil.test'}])assert.equal(exportRequestSchema.safeParse(input).success,false);
 for(const quality of [60,100])assert.equal(exportRequestSchema.parse({format:'jpg',quality}).quality,quality);
});
test('filename handles Korean, path/control chars, reserved names, length and header injection',()=>{
 const date=new Date('2026-09-16T12:00Z');assert.equal(exportFilename('상품/명\r\n:*?','png',date),'상품명_detail_20260916.png');
 assert.match(exportFilename('CON','jpg',date),/^detail-page/);assert.match(exportFilename('...','png',date),/^detail-page/);
 assert.ok(exportFilename('가'.repeat(100),'png',date).length<110);assert.doesNotMatch(disposition(exportFilename('x\r\ny','png'),'png'),/[\r\n]/);
 assert.match(disposition('한글.jpg','jpg'),/filename\*=UTF-8''/);
});
test('trusted origin is fixed config, loopback allowed, production requires config',()=>{
 assert.equal(trustedOrigin(undefined,'development'),origin);assert.equal(trustedOrigin('http://localhost:3001'), 'http://localhost:3001');
 for(const url of ['', 'http://evil.test','https://x.test/path','https://u:p@x.test','https://x.test/?url=x','file:///tmp/a'])assert.throws(()=>trustedOrigin(url,'production'),{code:'configuration'});
 assert.equal(trustedOrigin('https://app.example.test/'),'https://app.example.test');
});
test('capture network allowlist only admits canonical route/static/owned signed image',()=>{
 const url=origin+'/projects/'+projectId+'/render',images=['https://storage.test/storage/v1/object/sign/a.png?token=a'];
 assert.equal(allowedCaptureRequest(url,url,images),true);assert.equal(allowedCaptureRequest(origin+'/_next/static/a.js',url,images),true);
 assert.equal(allowedCaptureRequest(images[0].replace('token=a','token=b'),url,images),true);
 for(const bad of ['http://169.254.169.254/','https://evil.test',origin+'/api/projects','https://storage.test/storage/v1/object/sign/other.png'])assert.equal(allowedCaptureRequest(bad,url,images),false);
});
test('surface selector, physical width, height and pixel budget',()=>{
 assert.equal(SURFACE_SELECTOR,'article[data-detail-render-surface="1"]');checkDimensions(860,16000,860);
 for(const size of [[860,16001],[2000,9000],[0,900],[860,0]])assert.throws(()=>checkDimensions(...size,size[0]),{code:'page_too_large'});
 assert.throws(()=>checkDimensions(1720,1000,860),{code:'screenshot'});
});
test('PNG and JPEG header dimensions validated without image dependency',()=>{
 assert.deepEqual(imageDimensions(png(),'png'),{width:860,height:1500});assert.deepEqual(imageDimensions(jpg(),'jpg'),{width:860,height:1500});
 assert.throws(()=>imageDimensions(Buffer.from('bad'),'png'),{code:'screenshot'});
});
test('image readiness waits for decode and rejects missing/broken images',async()=>{
 let decoded=0;await imagesReady({querySelector:()=>null,querySelectorAll:()=>[{complete:true,naturalWidth:600,decode:async()=>{decoded++;}}]});assert.equal(decoded,1);
 await assert.rejects(()=>imagesReady({querySelector:()=>true}));
 await assert.rejects(()=>imagesReady({querySelector:()=>null,querySelectorAll:()=>[{complete:true,naturalWidth:0}]}));
 await assert.rejects(()=>imagesReady({querySelector:()=>null,querySelectorAll:()=>[{complete:true,naturalWidth:600,decode:async()=>{throw Error();}}]}));
});
test('font readiness awaits document fonts ready',async()=>{let done=false;globalThis.document={fonts:{ready:Promise.resolve().then(()=>{done=true;})}};try{await fontsReady();assert.equal(done,true);}finally{delete globalThis.document;}});
test('missing browser returns safe actionable error',()=>{assert.throws(()=>assertBrowserInstalled('Z:/definitely-no-detailforge-chromium'),{code:'browser_missing'});});
test('export uses canonical width and JPG default, warnings do not block',async()=>{
 let input;const output=await run({format:'jpg'},{read:async()=>({...view(),width:960,readiness:{missingImageCount:0,needsReviewCount:9,stalePlan:true,validation:'stale'}}),capture:async i=>{input=i;return capture(i);}});
 assert.equal(output.width,960);assert.equal(input.options.quality,90);assert.equal(input.url,origin+'/projects/'+projectId+'/render');assert.match(output.filename,/\.jpg$/);
});
test('canonical change during capture fails instead of returning mixed content',async()=>{let reads=0;await assert.rejects(()=>run(undefined,{read:async()=>({...view(),width:++reads===1?860:960})}),{code:'changed'});});
test('fingerprint ignores signed token rotation but detects section/style/asset change',()=>{
 const v={...view(),assets:[{id:'asset',previewUrl:'https://storage.test/a?token=1'}]};const next=structuredClone(v);next.assets[0].previewUrl='https://storage.test/a?token=2';assert.equal(renderFingerprint(v),renderFingerprint(next));next.width=960;assert.notEqual(renderFingerprint(v),renderFingerprint(next));
});
test('missing data, busy, empty and broken assets return distinct errors',async()=>{
 for(const [state,code] of [['busy','busy'],['empty','empty'],['page_missing','data_missing'],['product_missing','data_missing']])await assert.rejects(()=>run(undefined,{read:async()=>({...view(),state})}),{code});
 await assert.rejects(()=>run(undefined,{read:async()=>({...view(),readiness:{missingImageCount:1}})}),{code:'asset_load'});
});
test('provider stack/private URL never exposed in API errors',async()=>{
 const request=new Request(origin+'/api/projects/'+projectId+'/export',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{"format":"png"}'});
 const response=await handleExport(request,projectId,()=>run(undefined,{capture:async()=>{throw new Error('secret-provider-stack signed-token');}}));
 assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/secret-provider|signed-token/);
});
test('overall timeout aborts capture and process concurrency rejects duplicates',async()=>{
 let began;const start=new Promise(r=>began=r);
 const pending=run(undefined,{timeoutMs:30,capture:async(i,signal)=>{began();await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));throw new ExportError('timeout');}});
 await start;await assert.rejects(()=>run(),{code:'busy'});await assert.rejects(()=>pending,{code:'timeout'});
});
test('binary response attachment content types and private no-store',async()=>{
 for(const format of ['png','jpg']){const req=new Request(origin+'/api/projects/'+projectId+'/export',{method:'POST',headers:{origin},body:JSON.stringify({format})});
 const response=await handleExport(req,projectId,(id,input)=>run(input));assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),format==='png'?'image/png':'image/jpeg');assert.match(response.headers.get('cache-control'),/no-store/);assert.match(response.headers.get('content-disposition'),/attachment/);assert.equal(imageDimensions(new Uint8Array(await response.arrayBuffer()),format).width,860);}
});
test('timed-out preflight cannot retain browser slot or launch late capture',async()=>{
 let resolveRead,captures=0;const read=new Promise(resolve=>{resolveRead=resolve;});
 await assert.rejects(()=>run(undefined,{timeoutMs:10,read:()=>read,capture:async i=>{captures++;return capture(i);}}),{code:'timeout'});
 assert.equal((await run()).width,860);resolveRead(view());await new Promise(resolve=>setImmediate(resolve));assert.equal(captures,0);
});
test('foreign origin and oversized request rejected before capture',async()=>{
 for(const [body,requestOrigin,status] of [['{}','https://evil.test',403],['x'.repeat(3000),origin,400]]){const response=await handleExport(new Request(origin+'/api/projects/'+projectId+'/export',{method:'POST',headers:{origin:requestOrigin},body}),projectId,()=>{throw Error('must not execute');});assert.equal(response.status,status);}
});
test('real read model export preserves all DB state, stores no URLs and makes no AI calls',()=>fixture(async s=>{
 await generateSections(projectId,{},provider);const before=structuredClone({project:s.project,product:s.product,facts:s.facts,assets:s.assets,page:s.page,sections:s.sections});s.requests=[];
 const old=globalThis.fetch;let ai=0;globalThis.fetch=(url,...args)=>{if(String(url).includes('openai.com')){ai++;throw Error('AI forbidden');}return old(url,...args);};
 try{await exportDetail(projectId,{format:'png'},{origin,capture});assert.equal(ai,0);assert.ok(s.requests.every(r=>r.method==='GET'));assert.deepEqual({project:s.project,product:s.product,facts:s.facts,assets:s.assets,page:s.page,sections:s.sections},before);}finally{globalThis.fetch=old;}
}));
test('browser provider and review contract keep controls outside the shared surface',()=>{
 const browser=readFileSync(new URL('../src/features/detail-export/browser.ts',import.meta.url),'utf8');assert.match(browser,/import "server-only"/);assert.match(browser,/deviceScaleFactor: 1/);assert.match(browser,/surface\.screenshot/);assert.match(browser,/browser\.close/);assert.match(browser,/scale: "css"/);
 const review=readFileSync(new URL('../src/features/detail-renderer/review.tsx',import.meta.url),'utf8');assert.ok(review.indexOf('<ExportPanel')<review.indexOf('<RenderSurface'));assert.doesNotMatch(readFileSync(new URL('../src/features/detail-renderer/surface.tsx',import.meta.url),'utf8'),/ExportPanel|warning|button/);
});

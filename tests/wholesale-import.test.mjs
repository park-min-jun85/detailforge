import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Readable} from 'node:stream';
import {gzipSync} from 'node:zlib';
import {remoteUrlSchema,candidateSchema} from '../src/features/wholesale-import/schemas.ts';
import {publicUrl,isPublicAddress,resolvePublic} from '../src/features/wholesale-import/security.ts';
import {fetchResource,acceptsMime,decodeHtml} from '../src/features/wholesale-import/fetcher.ts';
import {extractCandidate} from '../src/features/wholesale-import/extractor.ts';
import {previewImport,saveImport,importImage,loadRemoteImage} from '../src/features/wholesale-import/service.ts';
import {issueTicket,readTicket} from '../src/features/wholesale-import/tickets.ts';
import {importResponse} from '../src/features/wholesale-import/http.ts';
import {ImportError} from '../src/features/wholesale-import/errors.ts';
import {saveConfirmedImport} from '../src/features/wholesale-import/client.ts';
import {saveProductInformation} from '../src/features/products/persistence.ts';
import {getProductDetail} from '../src/features/products/queries.ts';
import {startProductDb,projectId} from './helpers/product-db.mjs';
import {startAssetDb,productId,png,assetRow} from './helpers/asset-db.mjs';
const source='https://shop.example.com/product/1',imageUrl='https://cdn.example.com/item.png';
const html=name=>readFileSync(new URL('./fixtures/wholesale-'+name+'.html',import.meta.url),'utf8');
const resolver=async()=>[{address:'93.184.216.34',family:4}];
function response(body='',status=200,headers={}){return Object.assign(Readable.from([Buffer.from(body)]),{statusCode:status,headers:{'content-type':'text/html',...headers}});}
const candidate=()=>extractCandidate(html('jsonld'),source);
const input={productName:'사용자 확정 상품',brand:'확인 브랜드',category:'수납',description:'설명은 Fact가 아님',sourceUrl:source,specifications:[{name:'재질',value:'확정 ABS'}]};
async function productFixture(t){const db=await startProductDb();t.after(()=>db.close());return db.state;}
async function assetFixture(t){const db=await startAssetDb();t.after(()=>db.close());const c=candidate();c.images=[{url:imageUrl,alt:null,selected:true}];const token=issueTicket(projectId,c);readTicket(projectId,token).saved={productId,urls:[imageUrl]};return {state:db.state,token};}
const imageFetch=async()=>({url:imageUrl,mime:'image/png',bytes:Buffer.from(png)});
const jpeg=Buffer.from([0xff,0xd8,0xff,0xe0,0,16]);
const webp=Buffer.from([82,73,70,70,4,0,0,0,87,69,66,80]);
for(const [declared,bytes,expected] of [
 ['image/jpeg',jpeg,'image/jpeg'],
 ['application/octet-stream',jpeg,'image/jpeg'],
 ['application/octet-stream',png,'image/png'],
 ['application/octet-stream',webp,'image/webp'],
])test(`remote image ${declared} with ${expected} signature normalizes to ${expected}`,async()=>{
 const c=await loadRemoteImage(imageUrl,undefined,(url,kind)=>fetchResource(url,kind,{resolver,transport:async()=>response(bytes,200,{'content-type':declared})}));
 assert.equal(c.mime,expected);assert.deepEqual(c.bytes,Buffer.from(bytes));
});
test('octet-stream rejects executable, HTML, SVG, unknown, empty and truncated signatures',async()=>{
 for(const bytes of [Buffer.from('MZ executable'),Buffer.from('<html>not an image</html>'),Buffer.from('<svg></svg>'),Buffer.from('unknown'),Buffer.alloc(0),jpeg.subarray(0,2),Buffer.from(png).subarray(0,7),webp.subarray(0,11)]){
  await assert.rejects(()=>loadRemoteImage('https://cdn.example.com/looks-like.jpg',undefined,(url,kind)=>fetchResource(url,kind,{resolver,transport:async()=>response(bytes,200,{'content-type':'application/octet-stream'})})));
 }
});
test('jpg extension never authorizes non-image bytes or a declared MIME mismatch',async()=>{
 for(const bytes of [Buffer.from('MZ executable'),Buffer.from(png)])await assert.rejects(()=>loadRemoteImage('https://cdn.example.com/fake.jpg',undefined,async()=>({url:imageUrl,mime:'image/jpeg',bytes})),{code:'unsupported'});
});
test('sniffing exception is limited to explicit octet-stream image responses',async()=>{
 for(const mime of ['text/html','image/svg+xml','application/x-msdownload','binary/octet-stream',''])await assert.rejects(()=>loadRemoteImage(imageUrl,undefined,async()=>({url:imageUrl,mime,bytes:jpeg})),{code:'unsupported'});
 for(const kind of ['html','script','style','json'])assert.equal(acceptsMime(kind,'application/octet-stream'),false);
});
test('octet-stream obeys 10MiB declared, streamed and compressed size limits',async()=>{
 for(const [body,headers] of [
  [jpeg,{'content-length':String(10*1024*1024+1)}],
  [Buffer.concat([jpeg,Buffer.alloc(10*1024*1024)]),{}],
  [gzipSync(Buffer.concat([jpeg,Buffer.alloc(10*1024*1024)])),{'content-encoding':'gzip'}]
 ])await assert.rejects(()=>fetchResource(imageUrl,'image',{resolver,transport:async()=>response(body,200,{'content-type':'application/octet-stream',...headers})}),{code:'too_large'});
});
test('octet-stream still rejects private redirects and aborted requests',async()=>{
 await assert.rejects(()=>fetchResource(imageUrl,'image',{resolver,transport:async()=>response('',302,{location:'http://127.0.0.1/image.jpg','content-type':'application/octet-stream'})}),{code:'blocked'});
 await assert.rejects(()=>fetchResource(imageUrl,'image',{resolver,signal:AbortSignal.abort()}),{code:'timeout'});
});
test('octet-stream import uses actual MIME for Storage despite misleading original extension',async t=>{
 const {state,token}=await assetFixture(t),url='https://cdn.example.com/incorrect.jpg';readTicket(projectId,token).saved.urls=[url];
 await importImage(projectId,{token,url},async()=>({url,mime:'application/octet-stream',bytes:Buffer.from(png)}));
 assert.equal(state.assets[0].mime_type,'image/png');assert.equal(state.assets[0].original_filename,'incorrect.jpg');assert.match(state.assets[0].storage_path,/\.png$/);assert.equal(state.assets[0].asset_type,'unclassified');
 assert.equal(state.assets[0].metadata.source.url,url);
});
test('generic specification normalization removes only empty edge delimiters',()=>{
 for(const value of ['수입산 / /',' / 수입산 / / ','| 수입산 | |']){
  const c=extractCandidate(`<main class="product"><h1>상품</h1><table><tr><th>원산지</th><td>${value}</td></tr></table></main>`,source);
  assert.equal(c.product.specifications[0].value,'수입산');assert.equal(c.product.description,'원산지: 수입산');
 }
});
test('generic specification normalization preserves meaningful internal delimiters and units',()=>{
 for(const value of ['ABS / PC','가로 / 세로','1/2','-5','MODEL-A/','cm/s','ABS | PC']){
  const c=extractCandidate(`<main class="product"><h1>상품</h1><table><tr><th>규격</th><td>${value}</td></tr></table></main>`,source);
  assert.equal(c.product.specifications[0].value,value);
 }
});
test('URL schema only http/https, rejects credentials and nonstandard ports',()=>{for(const url of [source,'http://shop.example.com/x'])assert.ok(remoteUrlSchema.safeParse(url).success);for(const url of ['file:///x','data:text/html,x','javascript:alert(1)','ftp://shop.example.com','blob:https://shop.example.com/x','https://a:b@shop.example.com','https://shop.example.com:8080/x'])assert.equal(remoteUrlSchema.safeParse(url).success,false);});
test('HTML charset decoding preserves Korean UTF-8 and legacy EUC-KR',()=>{assert.equal(decodeHtml({bytes:Buffer.from('한글')}),'한글');assert.equal(decodeHtml({bytes:Buffer.from([0xc7,0xd1,0xb1,0xdb]),charset:'euc-kr'}),'한글');assert.throws(()=>decodeHtml({bytes:Buffer.from('x'),charset:'not-a-charset'}),{code:'unsupported'});});
test('SSRF rejects loopback/private/link-local/metadata/internal names and encoded IPv4',()=>{for(const url of ['http://localhost','http://localhost.','http://127.0.0.2','http://2130706433','http://0x7f000001','http://10.1.2.3','http://172.16.0.1','http://192.168.1.1','http://169.254.169.254','http://metadata.google.internal','http://server','http://foo.local','http://[::1]','http://[fc00::1]','http://[fe80::1]','http://[::ffff:127.0.0.1]','http://[64:ff9b::7f00:1]'])assert.throws(()=>publicUrl(url),{code:'blocked'});});
test('public IP classification conservatively rejects reserved IPv4/IPv6 ranges',()=>{for(const ip of ['100.64.0.1','192.0.2.1','198.18.0.1','224.0.0.1','255.255.255.255','2001:db8::1','2002:7f00:1::'])assert.equal(isPublicAddress(ip),false);for(const ip of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])assert.equal(isPublicAddress(ip),true);});
test('DNS rejects any private answer, including mixed public/private records',async()=>{await assert.rejects(()=>resolvePublic(source,async()=>[{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}]),{code:'blocked'});await assert.rejects(()=>resolvePublic(source,async()=>[]),{code:'blocked'});});
test('checked DNS address is pinned into transport with no second resolution',async()=>{let calls=0,target;const resource=await fetchResource(source,'html',{resolver:async()=>{calls++;return calls===1?[{address:'8.8.8.8',family:4}]:[{address:'127.0.0.1',family:4}];},transport:async t=>{target=t;return response('<h1>x</h1>');}});assert.equal(calls,1);assert.equal(target.address.address,'8.8.8.8');assert.equal(resource.url,source);});
test('redirect destination revalidated, private redirect never reaches transport',async()=>{let calls=0;await assert.rejects(()=>fetchResource(source,'html',{resolver,transport:async()=>{calls++;return response('',302,{location:'http://169.254.169.254/latest/meta-data'});}}),{code:'blocked'});assert.equal(calls,1);});
test('redirect count bounded to five and each host resolved again',async()=>{let calls=0,dns=0;await assert.rejects(()=>fetchResource(source,'html',{resolver:async()=>{dns++;return resolver();},transport:async()=>{calls++;return response('',302,{location:'/again'});}}),{code:'blocked'});assert.equal(calls,6);assert.equal(dns,6);});
test('HTML MIME, response size and compressed expansion are bounded',async()=>{await assert.rejects(()=>fetchResource(source,'html',{resolver,transport:async()=>response('PDF',200,{'content-type':'application/pdf'})}),{code:'unsupported'});for(const headers of [{'content-length':String(3*1024*1024)},{'content-encoding':'gzip'}])await assert.rejects(()=>fetchResource(source,'html',{resolver,transport:async()=>response(headers['content-encoding']?gzipSync('x'.repeat(3*1024*1024)):'x',200,headers)}),{code:'too_large'});});
test('abort and blocked status are safe and never trigger automatic retries',async()=>{await assert.rejects(()=>fetchResource(source,'html',{signal:AbortSignal.abort(),resolver}),{code:'timeout'});for(const status of [401,403,429])await assert.rejects(()=>fetchResource(source,'html',{resolver,transport:async()=>response('',status)}),{code:'restricted'});});
test('JSON-LD Product priority, normalized specs and duplicate images',()=>{const c=candidate();assert.equal(c.product.name,'정리함');assert.equal(c.product.brand,'브랜드');assert.equal(c.extractionMethod,'json_ld');assert.deepEqual(c.product.specifications,[{name:'재질',value:'ABS'},{name:'크기',value:'20cm'},{name:'색상',value:'흰색'}]);assert.equal(c.images.length,3);assert.ok(c.images[0].selected);assert.equal(c.images[2].selected,false);assert.ok(candidateSchema.safeParse(c).success);});
test('OpenGraph/meta extraction does not invent facts',()=>{const c=extractCandidate(html('metadata'),source);assert.equal(c.product.name,'메타 상품');assert.equal(c.extractionMethod,'metadata');assert.deepEqual(c.product.specifications,[]);assert.equal(c.images.length,1);assert.equal(c.product.category,null);});
test('DOM product scope/table/dl/entity decoding and relative image paths',()=>{const c=extractCandidate(html('dom'),source);assert.equal(c.product.name,'DOM 상품 & 정보');assert.equal(c.product.description,'확인 가능한 원문 설명');assert.equal(c.extractionMethod,'dom');assert.equal(c.images.length,1);assert.equal(c.images[0].url,'https://shop.example.com/images/dom.webp');assert.equal(c.product.specifications.length,2);});
test('30 image cap, duplicate/icon/tiny/tracking/unrelated filtering',()=>{const c=extractCandidate('<main class="product"><h1>상품</h1>'+Array.from({length:40},(_,i)=>`<img src="/images/${i}.png">`).join('')+'<img src="/images/icon.png"></main>',source);assert.equal(c.images.length,30);assert.ok(c.images.every(i=>!i.url.includes('icon')));});
test('login/CAPTCHA wall detected without bypass',()=>{for(const body of ['<title>Just a moment...</title>','<title>CAPTCHA</title>','<form><input type="password"></form>'])assert.throws(()=>extractCandidate(body,source),{code:'restricted'});});
test('public product with shared login form and member-only price remains importable',()=>{
 const c=extractCandidate(html('partial-restriction'),source);
 assert.equal(c.product.name,'공개 상품');assert.equal(c.product.category,'반려동물 > 배변용품');
 assert.deepEqual(c.product.specifications,[{name:'원산지',value:'수입산'},{name:'품명 및 모델명',value:'MODEL-42'},{name:'제조국 또는 원산지',value:'중국'},{name:'상품번호',value:'12345678'}]);
 assert.match(c.product.description,/MODEL-42/);assert.match(c.warnings.join(' '),/가격은 로그인한 사업자회원/);
 assert.equal(c.product.price,undefined);assert.doesNotMatch(JSON.stringify(c),/20,200|상점 광고|관련 없는 선택지|사용자 입력/);
});
test('public JSON-LD and product OpenGraph signals tolerate incidental login and CAPTCHA words',()=>{
 for(const sourceHtml of [html('jsonld'),html('metadata').replace('<head>','<head><meta property="og:type" content="product">')]){
  const c=extractCandidate(sourceHtml+'<form><input type="password"></form><footer>로그인 사업자회원만 구매가능 CAPTCHA 안내</footer>',source);
  assert.ok(c.product.name);assert.ok(c.images.length);
 }
});
test('public body heading and labeled specifications do not require site-specific selectors or metadata',()=>{
 const c=extractCandidate('<header><h1>상점 로고</h1><form><input type="password"></form></header><main><h1>메타 없는 상품</h1><p>사업자회원만 가격확인이 가능합니다</p><table><tr><th>원산지</th><td>수입산</td></tr></table></main>',source);
 assert.equal(c.product.name,'메타 없는 상품');assert.equal(c.product.specifications[0].value,'수입산');
});
test('real login wall with generic metadata and no product body is blocked',()=>{
 const wall='<title>로그인</title><meta property="og:title" content="쇼핑몰"><meta property="og:image" content="/store.jpg"><form><input type="password"></form>';
 assert.throws(()=>extractCandidate(wall,source),{code:'restricted'});
 assert.throws(()=>extractCandidate('<h1>로그인해 주세요</h1><p>로그인이 필요합니다.</p>',source),{code:'restricted'});
});
test('CAPTCHA and bot challenge main content without product signals is blocked',()=>{
 for(const wall of ['<h1>Verify you are human</h1><div class="g-recaptcha"></div>','<title>Just a moment...</title><form id="challenge-form"></form>','<title>접근 제한</title><p>보안 문자를 입력해 주세요</p>'])assert.throws(()=>extractCandidate(wall,source),{code:'restricted'});
});
test('challenge/login wall cannot be excused by retained product metadata',()=>{
 const metadata='<meta property="og:type" content="product"><meta property="og:title" content="숨겨진 상품"><meta property="og:image" content="/goods.jpg">';
 assert.throws(()=>extractCandidate(metadata+'<title>Just a moment...</title><form id="challenge-form"></form>',source),{code:'restricted'});
 assert.throws(()=>extractCandidate(metadata+'<title>로그인</title><input type="password">',source),{code:'restricted'});
});
test('redirected authentication destination without product body is blocked',async()=>{
 const r=await fetchResource(source,'html',{resolver,transport:async t=>t.url.pathname==='/product/1'?response('',302,{location:'/auth/login'}):response('<h1>계정 인증</h1>')});
 assert.match(r.url,/auth\/login/);assert.throws(()=>extractCandidate(decodeHtml(r),r.url),{code:'restricted'});
});
test('external detail image in inert textarea is extracted without scripts, private URLs or UI images',()=>{
 const c=extractCandidate(html('partial-restriction'),source);
 assert.deepEqual(c.images.map(i=>i.url),['https://cdn.example.com/goods/main.jpg','https://supplier.example.com/goods/detail.jpg']);
 assert.equal(c.images[1].selected,false);assert.doesNotMatch(JSON.stringify(c),/never execute|127\.0\.0\.1|unrelated|<script/);
});
test('detail markup expansion stays bounded',()=>{
 assert.throws(()=>extractCandidate('<div class="goods-detail"><textarea>'+('x'.repeat(256*1024+1))+'</textarea></div>',source),{code:'too_large'});
 assert.throws(()=>extractCandidate('<div class="goods-detail"><textarea>'+('<b></b>'.repeat(10001))+'</textarea></div>',source),{code:'too_large'});
});
test('price-restricted preview succeeds without browser, price inference or Product/Facts writes',async t=>{
 const s=await productFixture(t);await saveProductInformation(projectId,'',input);
 const before=structuredClone({product:s.product,facts:s.facts});s.requests=[];let renders=0;
 const result=await previewImport(projectId,{url:source},{fetch:async()=>({url:source,mime:'text/html',bytes:Buffer.from(html('partial-restriction'))}),render:async()=>{renders++;throw Error('must not bypass');}});
 assert.ok(result.token);assert.equal(renders,0);assert.match(result.candidate.warnings.join(' '),/가격은 로그인한 사업자회원/);
 assert.equal(result.candidate.product.price,undefined);assert.doesNotMatch(JSON.stringify(result),/20,200/);
 assert.deepEqual({product:s.product,facts:s.facts},before);assert.ok(s.requests.every(r=>r.method==='GET'));
});
test('preview does not mutate existing Product/Facts and skips Chromium when HTTP is sufficient',async t=>{const s=await productFixture(t);await saveProductInformation(projectId,'',input);const before=structuredClone({product:s.product,facts:s.facts});s.requests=[];let renders=0;const result=await previewImport(projectId,{url:source},{fetch:async()=>({url:source,mime:'text/html',bytes:Buffer.from(html('jsonld'))}),render:async()=>{renders++;return '';}});assert.ok(result.token);assert.equal(renders,0);assert.deepEqual({product:s.product,facts:s.facts},before);assert.ok(s.requests.every(r=>r.method==='GET'));assert.doesNotMatch(JSON.stringify(result),/<html|<script|rawHtml/);});
test('JS fallback only when HTTP insufficient and still uses normalized candidate',async t=>{await productFixture(t);let renders=0;const result=await previewImport(projectId,{url:source},{fetch:async()=>({url:source,mime:'text/html',bytes:Buffer.from('<div id="root"></div><script src="/app.js"></script>')}),render:async()=>{renders++;return html('dom');}});assert.equal(renders,1);assert.equal(result.candidate.extractionMethod,'browser');});
test('restricted HTTP never falls through to browser',async t=>{await productFixture(t);let renders=0;await assert.rejects(()=>previewImport(projectId,{url:source},{fetch:async()=>{throw new ImportError('restricted');},render:async()=>{renders++;return html('dom');}}),{code:'restricted'});assert.equal(renders,0);});
test('explicit confirmation saves only user fields as Facts with normalized source provenance',async t=>{const s=await productFixture(t),c=candidate(),token=issueTicket(projectId,c);const result=await saveImport(projectId,{token,revision:'',values:input,selectedImageUrls:[c.images[0].url,c.images[0].url]});assert.equal(result.status,'success');assert.equal(s.product.source_type,'wholesale_url');assert.equal(s.facts.facts.productName,input.productName);assert.equal(s.facts.facts.description,undefined);assert.deepEqual(s.facts.facts.specifications,input.specifications);assert.deepEqual(s.facts.source_snapshot,s.product.raw_data);assert.equal(s.product.raw_data.provenance.extracted.name,'정리함');assert.equal(s.product.raw_data.provenance.importedImageUrls.length,1);assert.doesNotMatch(JSON.stringify(s.product.raw_data),/<script|<html/);assert.equal((await getProductDetail(projectId)).status,'ready');});
test('existing optimistic concurrency and failed Product save never authorize image import',async t=>{const s=await productFixture(t);await saveProductInformation(projectId,'',input);const before=structuredClone(s.product),c=candidate(),token=issueTicket(projectId,c);const result=await saveImport(projectId,{token,revision:'',values:input,selectedImageUrls:[c.images[0].url]});assert.equal(result.status,'recovery-required');assert.equal(readTicket(projectId,token).saved,undefined);assert.deepEqual(s.product,before);});
test('manual editing imported product retains provenance and manual regression stays intact',async t=>{const s=await productFixture(t),c=candidate(),token=issueTicket(projectId,c);await saveImport(projectId,{token,revision:'',values:input,selectedImageUrls:[]});const provenance=structuredClone(s.product.raw_data.provenance);const result=await saveProductInformation(projectId,s.product.updated_at,{...input,productName:'수동 수정'});assert.equal(result.status,'success');assert.deepEqual(s.product.raw_data.provenance,provenance);assert.equal((await getProductDetail(projectId)).values.productName,'수동 수정');});
test('ticket is project-bound, expires, and unknown selected image rejected',async t=>{await productFixture(t);const token=issueTicket(projectId,candidate());assert.throws(()=>readTicket('other',token),{code:'expired'});await assert.rejects(()=>saveImport(projectId,{token,revision:'',values:input,selectedImageUrls:[imageUrl]}),{code:'invalid_input'});readTicket(projectId,token).expiresAt=0;assert.throws(()=>readTicket(projectId,token),{code:'expired'});});
test('remote image MIME, size/signature and independent SSRF checks',async()=>{assert.equal(acceptsMime('image','image/svg+xml'),false);await assert.rejects(()=>loadRemoteImage('http://127.0.0.1/a.png'),{code:'blocked'});await assert.rejects(()=>loadRemoteImage(imageUrl,undefined,async()=>({url:imageUrl,mime:'image/jpeg',bytes:Buffer.from(png)})));await assert.rejects(()=>loadRemoteImage(imageUrl,undefined,async()=>({url:imageUrl,mime:'image/png',bytes:Buffer.alloc(10*1024*1024+1)})));});
test('remote import Storage→Asset, unclassified source metadata and URL dedup',async t=>{const {state,token}=await assetFixture(t);const result=await importImage(projectId,{token,url:imageUrl},imageFetch);assert.equal(result.status,'imported');assert.equal(state.assets.length,1);assert.equal(state.assets[0].asset_type,'unclassified');assert.equal(state.assets[0].metadata.source.url,imageUrl);assert.match(state.assets[0].storage_path,new RegExp(`projects/${projectId}/products/${productId}/[a-f0-9-]+.png`));const upload=state.requests.findIndex(r=>r.path.includes('/storage/')&&r.method==='POST'),insert=state.requests.findIndex(r=>r.path.endsWith('/assets')&&r.method==='POST');assert.ok(upload>=0&&insert>upload);assert.equal((await importImage(projectId,{token,url:imageUrl},imageFetch)).status,'skipped');assert.equal(state.assets.length,1);});
test('Asset insert failure cleans object and does not affect other imported files',async t=>{const {state,token}=await assetFixture(t);state.failure='insert';await assert.rejects(()=>importImage(projectId,{token,url:imageUrl},imageFetch));assert.equal(state.objects.size,0);assert.equal(state.assets.length,0);state.failure=null;await importImage(projectId,{token,url:imageUrl},imageFetch);const second='https://cdn.example.com/second.png';readTicket(projectId,token).saved.urls.push(second);await assert.rejects(()=>importImage(projectId,{token,url:second},async()=>{throw new ImportError('unsupported');}));assert.equal(state.assets.length,1);assert.equal(state.objects.size,1);});
test('reimport preserves existing metadata keys including AI analysis',async t=>{const {state,token}=await assetFixture(t);state.assets=[assetRow({metadata:{source:{type:'wholesale_url',url:imageUrl},custom:'keep',aiAnalysis:{status:'completed'}}})];const before=structuredClone(state.assets);assert.equal((await importImage(projectId,{token,url:imageUrl},imageFetch)).status,'skipped');assert.deepEqual(state.assets,before);});
test('unconfirmed and mismatched Product image requests never fetch or upload',async t=>{const {state,token}=await assetFixture(t);readTicket(projectId,token).saved.productId='foreign';await assert.rejects(()=>importImage(projectId,{token,url:imageUrl},imageFetch),{code:'conflict'});assert.equal(state.objects.size,0);});
test('network/database exceptions are not exposed and response no-store',async()=>{const response=await importResponse(async()=>{throw Error('private-network secret-service-key');});assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private-network|secret-service/);assert.match(response.headers.get('cache-control'),/no-store/);});
test('client flow saves Product first, reports partial images, never starts images on save failure',async()=>{
 const old=globalThis.fetch,requests=[];let saveFailure=false;const progress=[];
 globalThis.fetch=async(url,init)=>{requests.push(url);if(url.endsWith('/save'))return Response.json({ok:true,data:{status:saveFailure?'error':'success'}});if(JSON.parse(init.body).url.endsWith('bad.png'))return Response.json({ok:false,code:'unsupported'},{status:400});return Response.json({ok:true,data:{status:'imported'}});};
 try{const input={token:'token',revision:'',values:{},selectedImageUrls:['https://cdn.example.com/ok.png','https://cdn.example.com/bad.png']};const result=await saveConfirmedImport(projectId,input,r=>progress.push(r));assert.match(result.message,/2장 중 1장/);assert.ok(requests[0].endsWith('/save'));assert.equal(progress.at(-1).length,2);requests.length=0;saveFailure=true;assert.equal((await saveConfirmedImport(projectId,input,()=>{})).status,'error');assert.equal(requests.length,1);}finally{globalThis.fetch=old;}
});
test('browser fallback has pinned fulfillment, service worker/WebSocket blocking and no export coupling',()=>{const code=readFileSync(new URL('../src/features/wholesale-import/browser.ts',import.meta.url),'utf8');assert.match(code,/server-only/);assert.match(code,/route\.fulfill/);assert.match(code,/routeWebSocket/);assert.match(code,/serviceWorkers:"block"/);assert.doesNotMatch(code,/route\.continue|route\.fetch|detail-export|stealth|ignoreHTTPSErrors/);});

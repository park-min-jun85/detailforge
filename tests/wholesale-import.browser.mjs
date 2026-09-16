import assert from 'node:assert/strict';
import {renderedHtml} from '../src/features/wholesale-import/browser.ts';
import {extractCandidate} from '../src/features/wholesale-import/extractor.ts';
import {publicUrl} from '../src/features/wholesale-import/security.ts';
const url='https://shop.example.com/product',seen=[],blocked=[];
const html=await renderedHtml(url,AbortSignal.timeout(30000),{
 resolve:async value=>({url:publicUrl(value),address:{address:'8.8.8.8',family:4}}),
 fetch:async(value,kind)=>{try{publicUrl(value);}catch(error){blocked.push(value);throw error;}seen.push(value);
  const body=kind==='html'?'<html><body><div id="root"></div><script src="/product.js"></script></body></html>':`document.querySelector('#root').innerHTML='<main class="product"><h1>브라우저 상품</h1><p itemprop="description">JS 렌더링 설명</p><table><tr><th>재질</th><td>ABS</td></tr></table></main>'; fetch('http://127.0.0.1/private').catch(()=>{});`;
  return{url:value,mime:kind==='html'?'text/html':'application/javascript',bytes:Buffer.from(body)};
 }
});
const candidate=extractCandidate(html,url,true);assert.equal(candidate.product.name,'브라우저 상품');assert.equal(candidate.extractionMethod,'browser');assert.equal(candidate.product.specifications[0].value,'ABS');assert.ok(blocked.some(url=>url.startsWith('http://127.0.0.1/')));console.log(JSON.stringify({realChromium:true,renderedName:candidate.product.name,requestsFulfilled:seen.length,privateRequestBlocked:blocked.length,externalNetworkCalls:0}));


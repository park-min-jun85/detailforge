import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedCaptureRequest} from '../src/features/detail-export/browser.ts';
import {verifyExportRequest} from '../src/features/detail-export/authorization.ts';
import {exportDetail} from '../src/features/detail-export/service.ts';
import {localTarget} from './helpers/export-local.mjs';
const target='http://127.0.0.1:3062/export-capture';
test('capture network refuses URL credentials, non-http schemes, other ports and query capabilities',()=>{
  for(const bad of ['https://example.com','http://169.254.169.254','http://127.0.0.1:3061/export-capture','file:///etc/passwd','ftp://127.0.0.1/file','javascript:alert(1)','data:text/html,test','blob:http://127.0.0.1:3062/id','http://user:pass@127.0.0.1:3062/export-capture',target+'?token=anything',target+'#fragment','not a URL'])assert.equal(allowedCaptureRequest(bad,target),false);
  assert.equal(allowedCaptureRequest(target,target),true);assert.equal(allowedCaptureRequest(new URL('/export-capture/data',target).href,target),true);
});
test('render authorization rejects absent, oversized, query, RSC and session headers before database',async()=>{
  for(const extra of [{},{headers:{'x-export-token':'x'.repeat(10000)}},{headers:{cookie:'session=value'}},{headers:{authorization:'Bearer value'}},{headers:{rsc:'1'}}])assert.equal(await verifyExportRequest(new Request(target,extra),true),null);
  assert.equal(await verifyExportRequest(new Request(target+'?projectId=foreign'),true),null);
});
test('export local harness rejects remote, credentials and wrong ports',()=>{
  localTarget(target);
  for(const value of ['https://example.com','http://localhost:3062','http://127.0.0.1:3000','http://a:b@127.0.0.1:3062'])assert.throws(()=>localTarget(value));
});
test('capture exception closes authorization and never exposes raw failure',async()=>{
  let closed=0,captures=0;
  const id='1645f432-b847-4e28-9ee7-f41beccccf46';
  await assert.rejects(exportDetail(id,{format:'png'},{origin:'http://127.0.0.1:3062',read:async()=>({projectId:id,state:'ready',width:860,detailPageId:id,sections:[],assets:[],readiness:{missingImageCount:0}}),
    authorize:async()=>({id,token:'unit',worker:'unit',close:async()=>{closed++;}}),capture:async()=>{captures++;throw Error('internal credential');}}),{code:'unavailable'});
  assert.equal(closed,1);assert.equal(captures,1);
});

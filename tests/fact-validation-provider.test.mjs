import test from "node:test";
import assert from "node:assert/strict";
import { createValidationProvider } from "../src/features/fact-validation/provider.ts";
import { validationOutput } from "./helpers/fact-validation.mjs";
import { responseBody } from "./helpers/analysis.mjs";
const input={targets:[{factId:'F1',label:'상품명',value:'검증 상품'}],evidence:[{id:'S1',kind:'source_snapshot',label:'입력 원본',value:'{"productName":"검증 상품"}'}],coverage:{total:0,completed:0,invalid:0},warnings:[]};
const config={apiKey:'secret-test-key',model:'test-validation'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
test("validation SDK sends strict text-only structured output with no tools, images or API keys",async()=>{
  let body,calls=0;const provider=createValidationProvider(config,async(_url,options)=>{calls++;body=JSON.parse(options.body);return reply(responseBody(validationOutput(input)));});
  assert.deepEqual(await provider.analyze(input,new AbortController().signal),validationOutput(input));assert.equal(calls,1);
  assert.equal(body.text.format.strict,true);assert.equal(body.text.format.schema.additionalProperties,false);assert.equal(body.store,false);assert.equal(body.tools,undefined);
  assert.equal(body.model,'test-validation');assert.doesNotMatch(JSON.stringify(body),/secret-test-key|input_image|image_url|signedUrl/);
});
test("validation provider refuses malformed, incomplete, refusal, invented IDs and altered Fact values",async()=>{
  const bad=validationOutput(input);bad.facts[0].evidenceIds=['S999'];const changed=validationOutput(input);changed.facts[0].value='invented';
  for(const body of [responseBody('bad JSON'),responseBody(bad),responseBody(changed),responseBody(validationOutput(input),{status:'incomplete'}),responseBody(null,{output:[{type:'message',id:'msg',role:'assistant',status:'completed',content:[{type:'refusal',refusal:'no'}]}]})]){
    const provider=createValidationProvider(config,async()=>reply(body));await assert.rejects(provider.analyze(input,new AbortController().signal),e=>e.code==='invalid_response');
  }
});
test("validation provider errors are private and requests never automatically retry",async()=>{
  let calls=0;const provider=createValidationProvider(config,async()=>{calls++;return reply({error:{message:'secret-test-key private-error'}},500);});
  await assert.rejects(provider.analyze(input,new AbortController().signal),e=>{assert.equal(e.code,'provider');assert.doesNotMatch(e.message,/secret-test|private-error/);return true;});assert.equal(calls,1);
});
test("validation aborted provider yields only safe timeout",async()=>{
  const controller=new AbortController();controller.abort();const provider=createValidationProvider(config,async()=>{throw new Error('private-error');});
  await assert.rejects(provider.analyze(input,controller.signal),e=>e.code==='timeout');
});

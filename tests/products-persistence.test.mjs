import assert from "node:assert/strict";
import test from "node:test";
import { saveProductInformation } from "../src/features/products/persistence.ts";
import { getProductDetail } from "../src/features/products/queries.ts";
import { startProductDb,projectId } from "./helpers/product-db.mjs";

const input={productName:"  센서등 ",brand:" 브랜드 ",specifications:[{name:" 재질 ",value:" ABS "}]};
async function withDb(run){const db=await startProductDb();try{await run(db.state);}finally{await db.close();}}
async function seed(state){
  const result=await saveProductInformation(projectId,"",input);
  assert.equal(result.status,"success");
  return state.product.updated_at;
}

test("신규 저장은 products와 facts 1개씩, raw snapshot 일치, 상태 불변",()=>withDb(async(state)=>{
  const result=await saveProductInformation(projectId,"",input);
  assert.equal(result.status,"success");
  assert.equal(state.product.name,"센서등");
  assert.equal(state.product.source_type,"manual");
  assert.equal(state.facts.product_id,state.product.id);
  assert.equal(state.facts.version,1);
  assert.equal(state.facts.validated_at,null);
  assert.deepEqual(state.facts.source_snapshot,state.product.raw_data);
  assert.deepEqual(state.facts.facts,{productName:"센서등",brand:"브랜드",specifications:[{name:"재질",value:"ABS"}]});
  assert.equal(state.project.status,"draft");
  assert.equal(state.requests.some((request)=>request.table==="projects"&&request.method!=="GET"),false);
  const detail=await getProductDetail(projectId);
  assert.equal(detail.status,"ready");assert.equal(detail.values.productName,"센서등");
}));

test("수정은 id/version 유지, validated_at 해제, 빈 선택값 제거",()=>withDb(async(state)=>{
  const revision=await seed(state),productId=state.product.id,factsId=state.facts.id;
  state.facts.version=7;state.facts.validated_at="2026-09-10T01:00:00.000Z";
  const result=await saveProductInformation(projectId,revision,{productName:"수정 상품",brand:"",specifications:[]});
  assert.equal(result.status,"success");
  assert.equal(state.product.id,productId);assert.equal(state.facts.id,factsId);assert.equal(state.facts.version,7);
  assert.equal(state.facts.validated_at,null);assert.equal(state.product.brand,null);
  assert.deepEqual(state.facts.facts,{productName:"수정 상품",specifications:[]});
  assert.equal(state.requests.filter((r)=>r.method==="POST"&&r.table==="products").length,1);
}));

test("기존 Product에 Facts가 없으면 Facts만 새로 생성",()=>withDb(async(state)=>{
  const revision=await seed(state);state.facts=null;
  assert.equal((await saveProductInformation(projectId,revision,input)).status,"success");
  assert.ok(state.facts);assert.equal(state.requests.filter((r)=>r.method==="POST"&&r.table==="products").length,1);
}));

test("신규 Facts 실패 시 이번 Product만 삭제",()=>withDb(async(state)=>{
  state.failure="facts-insert";
  const result=await saveProductInformation(projectId,"",input);
  assert.equal(result.status,"error");assert.equal(state.product,null);assert.equal(state.facts,null);
  assert.equal(state.project.status,"draft");assert.equal(result.revision,"");
}));

test("기존 Facts 실패 시 Product 내용 복원, 기존 Facts와 version 유지",()=>withDb(async(state)=>{
  const revision=await seed(state),before=structuredClone(state.product),facts=structuredClone(state.facts);
  state.failure="facts-update";
  const result=await saveProductInformation(projectId,revision,{productName:"저장 실패 이름"});
  assert.equal(result.status,"error");
  assert.deepEqual({...state.product,updated_at:before.updated_at},before);
  assert.deepEqual(state.facts,facts);assert.equal(result.revision,state.product.updated_at);
  state.failure=null;
  assert.equal((await saveProductInformation(projectId,result.revision,{productName:"재시도 성공"})).status,"success");
}));

test("보상 삭제 실패는 성공으로 숨기지 않고 재확인 상태 반환",()=>withDb(async(state)=>{
  state.failure="facts-insert";state.failRollback=true;
  const result=await saveProductInformation(projectId,"",input);
  assert.equal(result.status,"recovery-required");assert.ok(state.product);assert.equal(state.facts,null);
}));

test("보상 복원 실패는 재확인 필요, 다른 쓰기는 덮어쓰지 않음",()=>withDb(async(state)=>{
  const revision=await seed(state);
  state.failure="facts-update";state.concurrentWrite=true;
  const result=await saveProductInformation(projectId,revision,{productName:"내 변경"});
  assert.equal(result.status,"recovery-required");assert.equal(state.product.name,"다른 창 변경");
}));

for(const table of ["products","product_facts"]){
  test(`${table} 쓰기 응답 유실 시 실제 저장 내용을 재조회해서 확인`,()=>withDb(async(state)=>{
    state.ackLost=table;
    assert.equal((await saveProductInformation(projectId,"",input)).status,"success");
    assert.ok(state.product);assert.ok(state.facts);
    assert.deepEqual(state.product.raw_data,state.facts.source_snapshot);
  }));
}

test("검증 오류는 쓰기 없이 반환, 잘못된/없는 프로젝트와 오래된 폼 처리",()=>withDb(async(state)=>{
  const invalid=await saveProductInformation(projectId,"",{productName:" ",specifications:[{name:"재질",value:""}]});
  assert.equal(invalid.status,"error");assert.ok(invalid.fieldErrors.productName);
  assert.equal(state.requests.length,0);
  assert.equal((await getProductDetail("bad-id")).status,"not-found");
  assert.equal((await getProductDetail("d3926b64-9340-4279-99b6-8e13ac3d8c17")).status,"not-found");
  const revision=await seed(state);
  const requestCount=state.requests.length;
  assert.equal((await saveProductInformation(projectId,"",{productName:"오래된 폼"})).status,"recovery-required");
  assert.equal(state.requests.slice(requestCount).some((r)=>r.method!=="GET"),false);
  assert.equal(state.product.updated_at,revision);
}));

test("Product INSERT 실패와 DB 조회 오류는 내부 정보 비공개",()=>withDb(async(state)=>{
  state.failure="product-insert";
  const result=await saveProductInformation(projectId,"",input);
  assert.equal(result.status,"error");assert.equal(state.facts,null);
  state.readFailure=true;
  const detail=await getProductDetail(projectId);
  assert.equal(detail.status,"error");
  for(const item of [result,detail]){
    assert.equal(JSON.stringify(item).includes("private-db-detail"),false);
    assert.equal(JSON.stringify(item).includes("secret-test-key"),false);
  }
}));

test("동일 프로세스의 같은 프로젝트 중복 저장 차단",()=>withDb(async(state)=>{
  const results=await Promise.all([saveProductInformation(projectId,"",input),saveProductInformation(projectId,"",input)]);
  assert.equal(results.filter((r)=>r.status==="success").length,1);
  assert.equal(results.filter((r)=>r.status==="error").length,1);
  assert.equal(state.requests.filter((r)=>r.method==="POST"&&r.table==="products").length,1);
}));
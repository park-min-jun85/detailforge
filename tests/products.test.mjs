import assert from "node:assert/strict";
import test from "node:test";
import { productFormSchema, manualSourceSchema } from "../src/features/products/schemas.ts";
import { toManualSource, toManualFacts, toProductInput, readProductFormData } from "../src/features/products/mappers.ts";

const input = { productName: "  센서등  ", brand: " 브랜드 ", category: " 생활용품 ",
  description: " 사용자 제공 설명 ", sourceUrl: " https://example.com/product ",
  specifications: [{ name: " 재질 ", value: " ABS " }, { name: " ", value: " " }] };

test("상품명과 선택 필드 trim 및 길이 경계", () => {
  const result = productFormSchema.parse(input);
  assert.equal(result.productName, "센서등");
  assert.equal(result.brand, "브랜드");
  assert.equal(result.description, "사용자 제공 설명");
  assert.equal(productFormSchema.safeParse({ productName: "가".repeat(200) }).success, true);
  for (const productName of ["", "   ", "가".repeat(201), null, new Blob(["name"])]) {
    assert.equal(productFormSchema.safeParse({ productName }).success, false);
  }
  for (const [field, max] of [["brand",100],["category",100],["description",5000]]) {
    assert.equal(productFormSchema.safeParse({ productName: "상품", [field]: "가".repeat(max) }).success, true);
    assert.equal(productFormSchema.safeParse({ productName: "상품", [field]: "가".repeat(max+1) }).success, false);
  }
});

test("URL은 선택 입력이고 http/https 절대 주소만 허용", () => {
  for (const sourceUrl of ["", " ", "https://example.com/p?q=1", "http://example.com"]) {
    assert.equal(productFormSchema.safeParse({ productName: "상품", sourceUrl }).success, true);
  }
  for (const sourceUrl of ["javascript:alert(1)", "file:///tmp/a", "ftp://example.com", "/relative", "example.com", "https://", "https://example.com/"+"x".repeat(2048)]) {
    assert.equal(productFormSchema.safeParse({ productName: "상품", sourceUrl }).success, false);
  }
});

test("스펙 trim/빈 행 제거/불완전 행별 오류와 최대 50개", () => {
  assert.deepEqual(productFormSchema.parse(input).specifications, [{ name: "재질", value: "ABS" }]);
  for (const [row, field] of [[{name:"재질",value:" "},"value"],[{name:" ",value:"ABS"},"name"]]) {
    const result = productFormSchema.safeParse({ productName:"상품", specifications:[row] });
    assert.equal(result.success,false);
    assert.deepEqual(result.error.issues[0].path,["specifications",0,field]);
  }
  const rows=Array.from({length:50},()=>({name:"항목",value:"값"}));
  assert.equal(productFormSchema.safeParse({productName:"상품",specifications:rows}).success,true);
  assert.equal(productFormSchema.safeParse({productName:"상품",specifications:[...rows,rows[0]]}).success,false);
  assert.equal(productFormSchema.safeParse({productName:"상품",specifications:[{name:"가".repeat(101),value:"값"}]}).success,false);
  assert.equal(productFormSchema.safeParse({productName:"상품",specifications:[{name:"항목",value:"가".repeat(501)}]}).success,false);
});

test("raw_data는 일관된 manual snapshot, Facts는 빈 선택값/설명/URL을 제외", () => {
  const normalized = productFormSchema.parse(input);
  const source = toManualSource(normalized);
  assert.deepEqual(manualSourceSchema.parse(source), source);
  assert.equal(source.inputMethod,"manual");
  assert.equal(source.sourceUrl,"https://example.com/product");
  const facts = toManualFacts(normalized);
  assert.deepEqual(facts,{productName:"센서등",brand:"브랜드",category:"생활용품",specifications:[{name:"재질",value:"ABS"}]});
  assert.deepEqual(toManualFacts(productFormSchema.parse({productName:" 상품 "})),{productName:"상품",specifications:[]});
});

test("폼 필드 수 불일치도 스펙 오류로 처리하고 extra 필드를 저장하지 않음", () => {
  const form = new FormData();
  form.set("productName","상품");
  form.set("status","completed");
  form.append("specificationValue","ABS");
  assert.equal(productFormSchema.safeParse(readProductFormData(form)).success,false);
  form.append("specificationName","재질");
  assert.equal("status" in productFormSchema.parse(readProductFormData(form)),false);
});

test("기존 상품 값/스펙 재입력과 초기 raw_data 기본값 지원, 알 수 없는 원본은 거부", () => {
  const source=toManualSource(productFormSchema.parse(input));
  const product={name:"센서등",brand:null,category:null,description:null,sourceUrl:null,rawData:source};
  assert.deepEqual(toProductInput(product).specifications,[{name:"재질",value:"ABS"}]);
  assert.deepEqual(toProductInput({...product,rawData:{}}).specifications,[]);
  assert.throws(()=>toProductInput({...product,rawData:{unrecognized:"do not discard"}}));
});
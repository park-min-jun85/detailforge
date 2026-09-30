import assert from 'node:assert/strict';
import {analysisResult,responseBody} from './analysis.mjs';
import {strategyResult,validationOutput} from './fact-validation.mjs';

// SDK transport fixture only. Production prompt building, schemas, grounding,
// user authorization, admission and persistence all execute unchanged.
export async function providerOutput(request,counts,fetchImage){
  const name=request.text.format.name;
  counts[name]=(counts[name]??0)+1;
  const user=request.input.find(m=>m.role==='user');
  const content=Array.isArray(user.content)?user.content:[];
  const text=content.find(c=>c.type==='input_text')?.text;
  const input=text?JSON.parse(text):{};
  let output;
  if(name==='asset_visual_analysis'){
    const image=content.find(c=>c.type==='input_image');assert.ok(image);await fetchImage(image.image_url);
    output=analysisResult();
  }else if(name==='product_strategy_analysis'){
    const facts=input.untrustedEvidenceRegistry.filter(e=>e.kind==='product_fact');assert.ok(facts.length);
    output=strategyResult({summary:{text:'입력 상품정보와 등록 이미지를 확인하는 구성입니다.',evidenceIds:[facts[0].id]},valuePropositions:[],cautions:[]});
  }else if(name==='fact_validation')output=validationOutput(input.untrustedValidationData);
  else if(name==='detail_image_regions'){
    const image=content.find(c=>c.type==='input_image');assert.match(image.image_url,/^data:image\//);
    // Invalid structured output on tile 2: production provider validation
    // preserves an uncertain charge. The runtime advances only its expiry clock.
    output={schemaVersion:2,regions:[{regionType:counts[name]===1?'product_photo':'detail_closeup',confidence:.95,productVisibility:.95,standaloneUsability:.95,textDensity:'none',
      box:{xMin:100,yMin:100,xMax:900,yMax:500},rationale:'등록된 제품 이미지 영역',visualKind:'photo',targetProductRelevance:.95,containsTargetProduct:true,relevanceReason:'입력 상품과 관련된 제품 영역'}]};
  }else if(name==='detail_page_plan'){
    const d=input.untrustedPlannerData,hero=d.assets.find(a=>a.heroEligible&&a.kind==='normal'),derived=d.assets.filter(a=>a.kind==='derived');
    assert.ok(hero&&derived.length>=2);const facts=d.evidence.filter(e=>e.kind==='supported_fact');
    const ev=ids=>d.evidence.filter(e=>e.kind==='visual_observation'&&ids.includes(e.assetId)).map(e=>e.id);
    const gallery=derived.slice(0,2).map(a=>a.assetId);
    output={schemaVersion:1,narrative:{strategy:'상품 소개에서 이미지와 확정 정보로 이어지는 구성',rationale:'입력된 사실과 저장된 제품컷만 사용합니다.'},heroAssetId:hero.assetId,heroRationale:'등록한 제품 대표 이미지',sections:[
      {key:'hero',type:'hero',purpose:'상품 식별',contentBrief:'입력된 상품명과 대표 이미지를 소개한다.',evidenceIds:[facts[0].id,...ev([hero.assetId])],assetIds:[hero.assetId],priority:'primary'},
      {key:'gallery',type:'gallery',purpose:'제품컷 모아보기',contentBrief:'서로 다른 저장 제품컷을 배치한다.',evidenceIds:ev(gallery),assetIds:gallery,priority:'supporting'},
      {key:'specification',type:'specification',purpose:'확정 스펙 확인',contentBrief:'입력된 사실정보를 원문 그대로 정리한다.',evidenceIds:facts.map(e=>e.id),assetIds:[],priority:'supporting'},
      {key:'option',type:'option',purpose:'확정 옵션 확인',contentBrief:'저장된 옵션을 그대로 표시한다.',evidenceIds:[],assetIds:[],priority:'supporting'}],warnings:[]};
  }else if(name==='detail_page_sections'){
    const d=input.untrustedSectionData;
    output={schemaVersion:1,sections:d.plan.sections.map(p=>{const base={plannerKey:p.key,type:p.type,evidenceIds:p.evidenceIds,assetIds:p.assetIds},facts=d.evidenceSnapshot.filter(e=>e.kind==='supported_fact'&&p.evidenceIds.includes(e.id));
      if(p.type==='hero')return {...base,headline:facts[0].value,subheadline:null,highlights:[]};
      if(p.type==='gallery')return {...base,title:'제품컷 모아보기',intro:null};
      if(p.type==='specification')return {...base,title:'상품 스펙',rows:facts.map(e=>({label:e.label,value:e.value,evidenceIds:[e.id]}))};
      return {...base,title:'옵션 안내',items:[]};})};
  }else if(name==='section_regeneration'){
    const {meta,optionSnapshot,...copy}=input.untrustedRegenerationData.current.content;void meta;void optionSnapshot;
    output={schemaVersion:1,content:{...copy,subheadline:'등록한 상품 정보를 확인하세요.'}};
  }else throw Error('Unknown fixture operation');
  if(name==='detail_image_regions'&&counts[name]===2)output={schemaVersion:999};
  return responseBody(output,{model:request.model});
}

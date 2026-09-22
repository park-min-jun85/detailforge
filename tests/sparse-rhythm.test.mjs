import './register-renderer.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {createElement:h}=await import('react');
const {renderToStaticMarkup}=await import('react-dom/server');
const {sectionRhythm}=await import('../src/features/detail-renderer/visual-system.ts');
const {SectionRenderer}=await import('../src/features/detail-renderer/section-renderer.tsx');
const {SectionPreview}=await import('../src/features/detail-editor/preview/section-preview.tsx');
const {defaultSectionStyle}=await import('../src/features/section-engine/schemas.ts');
const {heroImageSizing}=await import('../src/features/page-quality/images.ts');
const base={plannerKey:'sparse',evidenceIds:[],assetIds:[]};
const asset={id:'44000000-0000-4000-8000-000000000001',name:'상품',width:330,height:330,previewUrl:'https://example.test/image.jpg'};
const row={label:'원산지',value:'수입산 / 아시아 / 중국',evidenceIds:['F1']};
const option=n=>({...base,type:'option',title:'옵션',optionSnapshot:{confirmed:{groups:[{id:'group',name:'옵션',values:Array.from({length:n},(_,i)=>({id:String(i),label:'색상 '+i}))}]}}});
const cases=[
  ['R1',{...base,type:'specification',title:'사양',rows:[row,row]},'compact'],
  ['R2',{...base,type:'specification',title:'사양',rows:Array(6).fill(row)},'normal'],
  ['R3',option(1),'compact'],['R4',option(6),'normal'],
  ['R5',{...base,type:'notice',title:'안내',items:[{text:'옵션을 확인해 주세요.',evidenceIds:[]}]},'compact'],
  ['R6',{...base,type:'feature',title:'상품 정보',body:'표기된 정보를 확인해 주세요.',bullets:[]},'compact'],
  ['R7',{...base,type:'imageText',title:'제품 형태',body:null,assetIds:[asset.id]},'normal'],
  ['R8',{...base,type:'detail',title:'디테일',body:'제품 형태',points:[],assetIds:[asset.id]},'normal'],
  ['R9',{...base,type:'gallery',title:null,intro:null,assetIds:[asset.id]},'normal'],
  ['R10',{...base,type:'hero',headline:'상품',subheadline:null,highlights:[],assetIds:[asset.id]},'normal'],
];
for(const [id,content,expected] of cases)test(`${id} sparse rhythm, canonical preservation and Editor/Final parity`,()=>{
  const before=structuredClone(content);assert.equal(sectionRhythm(content),expected);
  for(const density of ['compact','normal','spacious']){
    const style={...defaultSectionStyle(content.type),density},saved=structuredClone(style),props={content,style,assets:[asset]};
    const final=renderToStaticMarkup(h(SectionRenderer,props));
    assert.equal(renderToStaticMarkup(h(SectionPreview,{section:{content,style},assets:[asset]})),final);
    assert.ok(final.includes(`data-density="${density}"`));assert.ok(final.includes(`data-rhythm="${expected}"`));
    assert.deepEqual(style,saved);assert.doesNotMatch(final,/role="alert"|<button/);
    if(content.rows)assert.equal((final.match(/수입산 \/ 아시아 \/ 중국/g)??[]).length,content.rows.length);
    if(content.type==='option')for(const v of content.optionSnapshot.confirmed.groups[0].values)assert.ok(final.includes(v.label));
    if(content.assetIds.length)assert.match(final,/<img /);
  }
  assert.deepEqual(content,before);
});
test('short copy boundaries, line breaks, item counts and missing visual refs',()=>{
  const feature=cases[5][1];
  assert.equal(sectionRhythm({...feature,title:'가'.repeat(40),body:'나'.repeat(120)}),'compact');
  for(const change of [{title:'가'.repeat(41)},{body:'나'.repeat(121)},{body:'첫 줄\n둘째 줄'},{bullets:[{text:'a'},{text:'b'}]},{assetIds:[asset.id]}])assert.equal(sectionRhythm({...feature,...change}),'normal');
  assert.equal(sectionRhythm({...feature,title:'가'.repeat(40),body:'나'.repeat(120),bullets:[{text:'다'.repeat(41)}]}),'normal');
  const useCase={...base,type:'useCase',title:'활용 예시',intro:null,items:[{title:'예시',description:'짧은 설명',assetIds:[]}]};
  assert.equal(sectionRhythm(useCase),'compact');
  assert.equal(sectionRhythm({...useCase,items:[{...useCase.items[0],assetIds:[asset.id]}]}),'normal');
  assert.equal(sectionRhythm({...useCase,items:[...useCase.items,...useCase.items]}),'normal');
});
test('one benefit is sparse; multiple benefits and legacy options retain existing rhythm',()=>{
  const benefit={...base,type:'keyBenefits',title:'특징',items:[{title:'형태',description:'짧은 설명'}]};
  assert.equal(sectionRhythm(benefit),'compact');assert.equal(sectionRhythm({...benefit,items:[...benefit.items,...benefit.items]}),'normal');
  assert.equal(sectionRhythm({...base,type:'option',title:'옵션',items:[row]}),'normal');
  for(const n of [1,2,3,4])assert.equal(sectionRhythm({...cases[0][1],rows:Array(n).fill(row)}),n<=3?'compact':'normal');
});
test('null bodies and empty collections produce no spacing wrappers; legacy title-only remains renderable',()=>{
  const render=c=>renderToStaticMarkup(h(SectionRenderer,{content:c,style:defaultSectionStyle(c.type),assets:[asset]}));
  assert.doesNotMatch(render(cases[6][1]),/<p|<ul/);
  assert.equal(render({...cases[4][1],items:[]}), '');
  assert.equal(render({...cases[8][1],assetIds:[]}), '');
  assert.doesNotMatch(render({...cases[7][1],body:null,assetIds:[]}),/<p|<ul|<figure/);
  assert.match(render({...cases[7][1],body:null,assetIds:[]}),/data-rhythm="compact"/);
});
test('small Hero retains intrinsic 1.5x upscale cap',()=>{
  const sizing=heroImageSizing(330,330);assert.ok(sizing.maxWidth<=495);assert.ok(sizing.maxHeight<=495);
});

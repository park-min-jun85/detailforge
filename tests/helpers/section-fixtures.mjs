import { startSectionDb, projectId, assetRow } from './section-db.mjs';
import { completedAnalysis } from './analysis.mjs';
import { seedStrategy, seedValidation, mockProvider } from './planner-fixtures.mjs';
import { planPage } from '../../src/features/page-planner/service.ts';
export async function fixture(fn, images=false) {
  const db=await startSectionDb();
  try{if(images)db.state.assets=[assetRow({metadata:{aiAnalysis:completedAnalysis()}})];seedStrategy(db.state);seedValidation(db.state);await planPage(projectId,mockProvider);await fn(db.state);}
  finally{await db.close();}
}
export function sectionOutput(input) {
  return {schemaVersion:1,sections:input.plan.sections.map(p=>{
    const common={plannerKey:p.key,type:p.type,evidenceIds:p.evidenceIds,assetIds:p.assetIds};
    const facts=input.evidenceSnapshot.filter(f=>f.kind==='supported_fact'&&p.evidenceIds.includes(f.id));
    const title='상품 안내',body='제공된 상품 정보를 확인해 주세요.';
    switch(p.type){
      case 'hero':return {...common,headline:title,subheadline:null,highlights:[]};
      case 'keyBenefits':return {...common,title,items:[]};
      case 'feature':return {...common,title,body,bullets:[]};
      case 'imageText':return {...common,title,body};
      case 'gallery':return {...common,title,intro:null};
      case 'useCase':return {...common,title,intro:null,items:[]};
      case 'detail':return {...common,title,body,points:[]};
      case 'specification':return {...common,title,rows:facts.map(f=>({label:f.label,value:f.value,evidenceIds:[f.id]}))};
      case 'option':return {...common,title,items:[]};
      case 'notice':return {...common,title,items:[{text:'상품 정보를 확인해 주세요.',evidenceIds:[]}]};
    }
  })};
}
export const provider = () => ({model:'mock-section',async generate(input){return sectionOutput(input);}});
export const protectedSnapshot = state => structuredClone({project:state.project,product:state.product,facts:state.facts,assets:state.assets,plan:state.page.plan});

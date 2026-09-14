import { randomUUID } from "node:crypto";
import { assetRowSchema } from "../../src/features/assets/schemas.ts";
import { buildValidationEvidence } from "../../src/features/fact-validation/evidence.ts";
import { summarizeValidation, validationStateSchema } from "../../src/features/fact-validation/schemas.ts";
import { buildEvidenceRegistry } from "../../src/features/product-analysis/evidence.ts";
import { validationOutput, strategyResult } from "./fact-validation.mjs";
export const context = state => ({ projectId: state.project.id, productId: state.product.id, facts: state.facts.facts,
  sourceSnapshot: state.facts.source_snapshot, validation: state.facts.validation, productAnalysis: state.product.ai_analysis,
  description: state.product.description, assets: state.assets.map(a => assetRowSchema.parse(a)) });
export function seedStrategy(state) {
  const input=buildEvidenceRegistry(context(state)); const now=new Date().toISOString();
  state.product.ai_analysis={schemaVersion:1,attempt:{status:'completed',runId:randomUUID(),startedAt:now,finishedAt:now,errorCode:null},
    latestResult:{provider:'openai',model:'fixture',analyzedAt:now,inputFingerprint:input.inputFingerprint,evidenceSnapshot:input.evidence,analysis:strategyResult()}};
}
export function seedValidation(state, statuses={}) {
  const input=buildValidationEvidence(context(state)), now=new Date().toISOString();
  const output=validationOutput(input);output.facts=output.facts.map(f=>({...f,status:statuses[f.factId]??'supported'}));
  state.facts.validation=validationStateSchema.parse({schemaVersion:1,attempt:{status:'completed',runId:randomUUID(),startedAt:now,finishedAt:now,errorCode:null},
    latestResult:{...output,...summarizeValidation(output.facts),provider:'openai',model:'fixture',validatedAt:now,inputFingerprint:input.inputFingerprint,evidenceSnapshot:input.evidence}});
}
export function planResult(input) {
  const fact=input.evidence.find(e=>e.kind==='supported_fact'); const visual=input.evidence.find(e=>e.kind==='visual_observation');
  return {schemaVersion:1,narrative:{strategy:'상품 식별에서 스펙 확인으로 이어지는 구조',rationale:'입력된 근거 범위에서 정보의 확인 순서를 설계한다.'},
    heroAssetId:visual?.assetId??null,heroRationale:visual?'제품을 보여 주는 후보를 선택한다.':'적합한 이미지가 제공되지 않았다.',
    sections:['hero','detail','imageText','specification','notice'].map((type,index)=>({key:`section-${index}`,type:!fact&&type==='specification'?'detail':type,
      purpose:['상품 식별','특징 확인','형태 안내','스펙 확인','근거 한계 안내'][index],contentBrief:'제공된 근거만 사용해 정보를 정리한다.',
      evidenceIds:[...(fact?[fact.id]:[]),...(index===0&&visual?[visual.id]:[])],assetIds:index===0&&visual?[visual.assetId]:[],priority:index===0?'primary':'supporting'})),warnings:[]};
}
export const mockProvider = () => ({model:'fixture-planner',async plan(input){return planResult(input);}});

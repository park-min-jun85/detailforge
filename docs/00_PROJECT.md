# DetailForge Project

## TASK-029 Commerce Visual System

판매용 상세페이지 디자인은 canonical Section과 bounded style token을 application-owned deterministic layout으로 표시한다. AI가 CSS/색/px/HTML을 만들지 않는다. 제품 이미지와 정보 역할에 맞는 hierarchy, adaptive option/gallery, intrinsic1.5배 cap을 Editor/Final/Export가 공유한다. 기존 사실·옵션·저장 style은 자동 변경하지 않는다. [TASK-029](tasks/TASK-029.md).

## Mission

도매상품의 원본 사실정보와 실제 제품 정체성을 유지하면서
판매자가 새로운 상세페이지를 빠르게 구성할 수 있도록 한다.

## Core Flow

Product Source
→ Normalize
→ Product Facts
→ Asset Analysis
→ Product Analysis
→ Page Planning
→ Section Generation
→ Human Editing
→ Rendering

## MVP Goal

사용자가 상품정보와 이미지 5~15장을 입력하면
AI가 상품을 분석하고 근거량에 따라 4~12개 Section으로 상세페이지 초안을 생성한다.

사용자는 문구, 이미지, Section 순서를 수정할 수 있고
최종적으로 JPG/PNG를 출력할 수 있어야 한다.

## MVP에서 제외

- 도매사이트 자동 크롤링
- 스마트스토어/쿠팡 자동등록
- 대량 상품처리
- 결제/구독
- 팀 협업
- AI 동영상
- 리뷰 생성

## Success Metric

기존 도매상품을 기준으로
약 10~20분 안에 판매 가능한 새 상세페이지를 제작할 수 있는가.

## TASK-025 재구성 원칙

원본 상세페이지의 긴 이미지를 그대로 재사용하는 것이 아니라, 원본에서 사용할 수 있는 제품 이미지를 추출하고 그 이미지와 확인된 상품정보로 새로운 상세페이지를 재구성한다.
긴 Source는 원재료·출처·최후 fallback이며, 사용자가 선택 저장한 Derived는 실제 재구성 시각 자료다. 정상 대표 원본도 동등하게 사용한다. Derived와 시각 AI 관찰은 Product Fact가 아니다. 추출·분석·재생성은 자동 실행하지 않는다.

## TASK-026 판매용 품질

판매용 상세페이지는 분석 보고서가 아니다. 각 Section에 다른 정보 역할을 부여하고 확인된 Fact의 반복 강조를 줄인다. 원본 intrinsic 해상도에 맞춰 사진 크기를 제한하고 deterministic spacing/layout과 보수적인 새 crop edge trim을 사용한다. 품질 개선을 위해 Fact·옵션·근거의 정확성을 희생하지 않는다. 실제 새 AI 검증은 TASK-027에서 수행했고 남은 보고체·중복 문제는 TASK-028에서 보완했다. [TASK-026](tasks/TASK-026.md).

## TASK-028 커머스 카피

최종 산출물은 관찰 보고서가 아닌 판매용 상세페이지다. 새 AI는 근거가 있는 짧은 외형 설명과 section copy intent를 사용하며 이미지 확인을 권하는 보고체를 출력하지 않는다. 같은 사진·근거·목적을 되풀이하기보다4~12개의 유효한 Section으로 줄인다. Fact grounding과 확정 옵션 원문은 유지한다. [TASK-028](tasks/TASK-028.md).


## TASK-030 Final Commerce Polish

새 AI 생성과 개별 재생성은 제목도 내용·근거와 일치해야 한다. 원본의 부족한 해상도를 CSS로 복구할 수 없으며, 대표성에 맞는 후보를 고르고 표시 크기를 제한한다. 실제 새 상품의 전체 흐름과 BLOCKER/HIGH 0건을 Release Candidate 기준으로 삼는다. [TASK-030](tasks/TASK-030.md).

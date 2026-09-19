# DetailForge Project

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
AI가 상품을 분석하고 8~12개 Section으로 상세페이지 초안을 생성한다.

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

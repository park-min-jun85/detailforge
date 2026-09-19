# TASK-025 — Derived Asset First Reconstruction

완료: 2026-09-19. 브랜치 `feat/derived-asset-reconstruction`, 시작 HEAD `6129e8e`.
commit/main merge, migration, dependency 추가 없음.

DetailForge는 도매 상세페이지를 그대로 복제하는 도구가 아니라, 원본 사실정보와 실제 제품 정체성을 보존하면서 판매용 상세페이지를 재구성하는 도구다.
긴 Source는 원재료, 저장된 Derived crop은 재구성용 visual이다. Derived는 Product Fact가 아니다.

## 구현 보고

1. 생성: `src/features/visual-assets/policy.ts`, `inspection.ts`, `tests/visual-assets.test.mjs`, 본 문서.
2. 수정: assets 카드, detail-extraction 저장 안내, product-analysis evidence/화면, fact-validation 화면, page-planner schemas/evidence/service/types/prompts/manager, section-engine grounding/service/types/prompts, detail-editor types/service/inspector. 테스트 helpers/page-planner·section-db, page-planner·detail-renderer 회귀 검사와 docs/00·01·02·04·05·tasks/README 갱신.
3. migration/dependency 없음. 기존 Sharp 재사용, DB generated types와 RLS 변경 없음.
4. Visual Asset Inventory: 현재 project/product의 정상 원본, 저장 Derived, long Source, 사용할 수 없는 Asset을 정렬한다. 소유권, 경로, private 파일 가용성, 크기, 분석, provenance를 반영한다. 최대30개.
5. Derived는 TASK-024 derivation schema가 유효한 실제 Asset row다. self-parent, 범위 밖 rect, crop 크기 불일치는 제외한다. 후보 metadata만으로 Asset을 만들지 않는다.
6. parentAssetId/sourceFingerprint/sourceRect/candidateId로 관계와 중복을 확인한다. parent가 삭제되어도 독립 파일인 Derived는 유지한다.
7. approved는 사용자가 추출 후보를 선택해 별도 Asset으로 저장했다는 의미다. 추가 승인 필드나 가짜 품질 승인은 없다.
8. role은 completed TASK-008 분석 > suggestedRole 배치 힌트 > unknown 순서다. 실패/진행 중/invalid 분석을 완료 관찰로 쓰지 않는다.
9. 유효한 Derived가 있는 long parent는 Planner 후보와 V evidence에서 억제한다. normal original은 억제하지 않는다.
10. 유효 자식이 없는 분석 완료 long Source만 fallback 후보가 된다. 페이지 전체 최대1회이며 Hero/specification/option/notice에는 금지한다. 자식이 있으면 역할 부족을 이유로 parent를 자동 부활시키지 않는 보수적 정책이다.
11. Hero는 normal 또는 normal 비율 Derived의 제품/사용 사진 중심이다. 최소 축160px·면적64,000px²로 330×330 정상 원본도 허용한다. extreme-long과 텍스트/블러/잘림 경고는 금지한다. detail은 분석 heroSuitability≥.8일 때만 후보가 된다.
12. Hero score는 `80*(.45*heroSuitability+.30*visibility+.25*clarity)+.20*basePriority`. 정상 분석 제품/사용100, Derived 제품90/사용80/디테일70/옵션60/기타40의 base priority다. 미분석 Derived 품질은 .5 고정값이며 추출 confidence를 품질 증명으로 쓰지 않는다. 점수는 선택 가이드이고 반드시 최고점을 고르도록 강제하지 않는다.
13. Section visual 선호: Hero 제품/사용, benefits 제품/디테일/사용, feature 디테일/제품, imageText 제품/디테일/사용, gallery 제품/디테일/사용/옵션, useCase 사용/제품, detail 디테일/제품, option 옵션. specification/notice는 canonical text 중심. role 선호는 가이드, 소유권/금지 Source/근거 제한은 서버 강제다. 기존 이미지 최대8개 유지.
14. long Source 반복과 raw-parent+Derived 혼용을 거부한다. 같은 parent/hash의 IoU≥.85 crop은 결정적으로 하나만 후보에 남기고 출력에서도 중복 거부한다. 정상 사진의 Hero+Feature 재사용은 허용한다.
15. fingerprint에 ID/정규화된 분석/역할/크기/가용성/부모·hash·rect를 포함한다. signed URL, timestamp, 후보 rationale/미저장 후보는 제외한다. 입력 순서와 warnings 순서를 정규화한다.
16. Derived 추가·삭제·분석/파일 가용성 변경은 새 Plan 필요 여부를 계산한다. 미분석 Derived는 upstream coverage에서 제외해 실제 근거가 바뀌지 않았는데 Facts/Validation이 바뀐 것처럼 처리하지 않는다. 완료 분석으로 V가 바뀌면 기존 upstream stale 정책을 따른다.
17. Planner prompt는 compact visual projection만 전달한다. extraction 후보, URL, filename, 전체 provenance는 AI에 보내지 않는다. unknown/억제/부적합 Hero/long 반복 응답은 거부하고 이전 성공 결과를 보존한다.
18. Section Engine은 새 Plan의 Asset 집합을 정확히 보존한다. 미분석 Derived는 placement-only이며 V/F를 만들어 내지 않는다. 실제 QA에서 Hero highlight의 V-only 응답이 기존 F 검증에 거부되어, prompt에 highlight/benefit/bullet의 F 필수 조건을 명시했다. 서버 grounding은 완화하지 않았다.
19. specification label/value/evidence는 supported F 원문과 정확히 일치해야 한다. 긴 스펙 이미지나 추출 이미지로 Fact를 대체하지 않는다.
20. Options는 기존 confirmed snapshot/version을 유지한다. option-role 이미지는 그룹 보조 visual로만 허용하며 선택값별 이미지 대응을 추정하지 않는다. 1그룹6값 snapshot 회귀 검사 포함.
21. Editor에 추출 이미지·원본명(또는 원본 삭제됨)·추출 역할 힌트를 읽기 전용으로 표시한다. Asset 화면에도 동일한 provenance 표시.
22. Renderer/Export 앱 코드는 변경하지 않았다. 저장된 canonical Section/Asset ID만 표시하고 새 이미지 선택·Fact 추론을 하지 않는다.
23. visual policy가 없는 legacy Plan/Section의 기존 계약을 유지한다. 읽기/새 인벤토리 계산만으로 기존 페이지를 수정하지 않으며 재생성은 명시적 버튼이다.
24. Derived는 기존 TASK-008 단건/배치 분석 대상이다. 자동 extraction/analysis 호출은 없다. 미분석 힌트는 Fact/Validation 근거로 승격하지 않는다.
25. Derived 삭제/파일 누락은 stale·누락으로 감지한다. Source 삭제 시 Derived 파일을 연쇄 삭제하지 않는다. mock 삭제/가용성·legacy 불변 회귀 검사를 포함한다.
26. 신규43개 회귀 검사: 저장/미저장 구분, scope, role 우선순위, Hero 크기·품질, Source 억제/fallback/전체페이지1회, crop 중복, injection 분리, deterministic fingerprint/stale, 이전 Plan 보존, source/derived 삭제, F/V 보호, option snapshot, 실제 Sharp decode와 손상 파일, URL·시간 제외, 실제 V-only highlight 실패 형태.
27. 전체682 tests 통과(기존639+신규43), 실패/skip 없음. 자동 tests는 실제 OpenAI/도매 API를 호출하지 않는다.
28. next typegen, tsc --noEmit, lint, build, git diff --check 통과. client bundle/보고서 secret 검사 별도 수행.
29. 실제 상품67399861의 새 QA Project에서 Import→7 Derived 저장→Asset AI→Product Analysis→Validation→Plan→Section→Editor→Renderer→PNG/JPG 완료. Import/Export 일부는 실제 앱 server service로 실행하고 옵션 확인·저장/추출 선택·저장/분석/Planner·Editor·Renderer는 브라우저로 확인했다. 브라우저만으로 전 단계를 진행했다고 주장하지 않는다.
30. 실제 Derived 저장7개. 원본2개 포함 총9 Assets. TASK-024에서 얻은 실제 extraction 결과는 다운로드 source SHA-256이 동일함을 확인한 뒤 QA Source에만 재사용했다. extraction Vision 재호출0, mock 후보가 아니다. 도식/텍스트 경계/불명확 후보는 사용자 검토 단계에서 제외했다.
31. Derived 중1개 분석 완료, normal original1개 분석 완료. 나머지 Derived6개와 raw Source는 미분석. 실제 paid 호출은 Asset2+Product1+Validation1+Planner1+Section3=8회, 공식 옵션 API1회. 자동 retry/대량 호출 없음.
32. Plan/저장 Section7개: hero → keyBenefits → feature → imageText → detail → specification → option.
33. Hero는 정상330×330 원본. 정상 score94.32, 분석 Derived 제품사진93.04. 작은 정상 대표사진을 일률 배제하지 않았다.
34. 최종 사용 Derived2개: 펼친 패드 제품컷(imageText), 물방울이 보이는 확대컷(detail). 후자는 미분석 placement-only, 성능/흡수성 claim은 추가하지 않았다. Gallery0, Detail1, imageText1.
35. raw long Source 사용0회, 이미지 배치3개, 동일 Asset/긴 원본 반복0. 최종 Renderer 이미지 누락0.
36. PNG 860×3875px/575,711bytes, JPG 860×3875px/268,677bytes. 두 파일 첫~마지막 Section, 옵션, 스펙, 이미지3개 확인. 레이아웃 차이·잘림·Editor UI·review warning 없음.
37. Renderer 원본860px 기준 첫 사진 top offset465.53125px(약466px). surface 높이3874.578125px, Export 정수 높이3875px. 사진3개 모두 contain, 실제 로드 성공, 수평 overflow 없음.
38. TASK-023의 long Source2회/첫 사진757px 대비 이번 raw0회/약466px. 단 서로 다른 상품(67695797 vs67399861)이므로 동일 상품 A/B 개선 수치로 해석하지 않는다.
39. 실제 옵션은 `옵션 / 단일상품` 1그룹1값이며 저장 UUID/version과 Section snapshot이 일치한다. 6개 옵션 실제 상품을 이번에 다시 호출하지 않았다. 스펙5행: 상품명, 품명 및 모델명 ON241125403, 상품번호67399861, 원산지 수입산, 제조국 또는 원산지 중국. Fact 값 일치, placeholder 없음.
40. 기존 사용자7개 테이블의 모든 baseline row hash 일치. QA Product 입력/Facts/source_snapshot/Options도 AI 전후 hash 일치. QA source bytes hash 불변. AI Analysis/Validation/Plan/Sections 및 명시적으로 요청한 신규 QA Assets만 해당 단계에서 생성됐다.
41. 실제 환경 secret3개의 값으로 src/docs/tests/artifact 텍스트와 production client JS/map를 검사해 일치0. key/토큰/원본 provider 네트워크 오류를 출력하지 않았다. client에 provider/Sharp 서버 코드가 들어가지 않는지 확인. signed URL은 DB/provenance/AI prompt에 저장하지 않는다.
42. QA Project/Product/Facts/Options/Assets/Derived/Sections와 해당 private Storage 파일을 모두 제거하고 baseline7테이블 완전 일치 확인. PNG/JPG·정제된 결과·검사 로그는 저장소 외부 로컬 artifact로만 보존.
43. 남은 품질: Hero 330px 확대 선명도, Hero와 benefits의 크기/수량 반복, category-only feature의 낮은 정보 가치, 관찰체 문구와 `추가 이미지` 제목의 단조로움. detail crop 왼쪽에 원본 여백 띠가 남고, 물방울 사진은 설명 없이 성능을 암시할 수 있어 판매 전 검토가 필요하다. 배치/근거 보호 기능 완료가 곧 판매용 디자인 완성을 뜻하지 않는다.
44. TASK-026 제안: 동일 상품 고정 QA로 카피 중복·빈약한 category Section·중립 detail caption·crop 경계 및 Hero 크기별 표시 품질을 개선한다. 사실/옵션/근거 경계는 유지하며 새 AI 호출보다 deterministic 편집/렌더 품질을 우선 검토한다.

## 실제 QA 실패와 제한

- Section 생성 첫 호출은 invalid_response로 저장되지 않았다. 두 번째 진단 호출에서 Hero highlight가 V2만 참조한 것이 확인됐다. 나머지6개 Section은 유효했다. prompt 수정 후 세 번째 명시적 호출에서7개 모두 통과했다. 실패 시 부분 Section이나 가짜 Fact를 저장하지 않았다.
- 실제 Product Analysis는 상품명/크기/수량/분류 범위로 전략을 제안했고, Validation은 입력 자료 범위에서 supported6, conflict/insufficient/needs_review0이었다. 같은 source_snapshot 근거의 supported는 외부 진위·성능 입증이 아니다.
- 기하학적 중복 검사는 서로 다른 위치의 동일 사진이나 정상 원본과 Derived의 시각적 유사성까지 감지하지 않는다. OCR/추가 Vision/이미지 생성은 하지 않았다.
- 가용성 검사는 private Storage signing 결과와 저장된 크기를 사용한다. 크기가 없는 기존 파일은 signature+Sharp 제한 decode(10MiB/40MP/단일 프레임/6000×60000 이하/네트워크20초/Sharp10초)로 보완한다. 3개씩 처리, 크기 cache 최대120개/60초. 저장 크기가 있는 파일은 매 조회마다 전체 bytes를 재검증하지 않으며 전체 batch용 aggregate timeout은 별도로 추가하지 않았다.
- 새 분석 오류를 숨겨 이전 분석을 completed로 간주하거나, 힌트 confidence를 정식 분석 confidence로 변환하지 않는다.
- 기존 Supabase SSRF/DNS/redirect/private path/용량·timeout/최대 Asset 수, Options CAS, Section CAS 및 보안 회귀 검사를 유지했다.

## 로컬 증거

저장소 밖 `C:\Users\alswn\Documents\Codex\2026-09-09\c-projects-detailforge\artifacts\TASK-025`:
`evidence.json`, `export-metrics.json`, `render-metrics.json`, `detail-67399861.png`, `detail-67399861.jpg`,
`tests-final.txt`, `build-final.txt`, `secret-check.json`, `cleanup.json`.
원본 전체 API 응답·비밀키·signed URL은 보고서/fixture에 포함하지 않는다. QA Project는 정리되어 해당 프로젝트 링크는 더 이상 열리지 않는다.

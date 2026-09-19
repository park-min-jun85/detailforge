# TASK-027 — Real AI Copy Quality Validation

2026-09-19 KST. `feat/ai-copy-quality-validation`, 시작 HEAD `4716161`, 시작 working tree clean.

**실제 Planner 1회 + Section Engine 1회 모두 성공. 새 canonical Sections의 Renderer 및 PNG/JPG 검증 완료. 사실·옵션 보호와 Fact 반복 억제는 확인했지만, 판매용 카피·사진 다양성은 NEEDS_WORK다.**

앱 코드, dependency, migration 수정 없음. 본 QA 문서만 추가한다. Git commit/main merge 없음. 품질을 개선하기 위한 추가 생성이나 자동 retry는 하지 않았다.

## 1. 검증 범위와 실제 호출

- 상품: [도매매 67399861](https://domeme.domeggook.com/s/67399861), 냄새잡는 대나무숯 애견 배변패드 40매(60x60cm).
- AGENTS.md, CLAUDE.md, Coding Rules, TASK-023~026 및 page-quality / page-planner / section-engine / visual-assets / detail-renderer / detail-export의 관련 구현을 확인했다.
- 새 QA Project `ace457e8-2e50-4148-9eed-b1d46ab49532`를 생성했다. 기존 사용자 Project는 수정하지 않았다.
- TASK-025에서 실제로 확인한 Facts, Validation, Product Analysis, confirmed Options 및 완료된 이미지 관찰을 재사용했다. TASK-024 원본 bytes와 TASK-026의 원본 대표 사진을 로컬에서 재사용했다. 새 QA Storage에 원본2개와 Derived7개를 준비했다.
- 기존 분석 Asset ID는 현재 DB에 없음을 먼저 확인한 뒤 QA 복제에서 유지했다. upstream evidence의 정렬/ID가 바뀌어 stale을 무시하는 일을 피하기 위해서다. Product Analysis와 Fact Validation의 저장 fingerprint가 재구성한 실제 입력 fingerprint와 정확히 일치함을 assert했다. fingerprint나 과거 결과 시각을 다시 쓰지 않았다.
- Product Options의 group/value UUID, 순서, 값, version1을 복제했다. QA row/product UUID는 새 값이다. 예전 실제 도매 응답을 다시 조회했다고 보고하지 않는다.
- 실제 Planner **1회**, Section Engine **1회**, 둘 다 `gpt-5.6-terra`. 새 Section 생성 시각 `2026-09-19T10:11:15.479Z`.
- Asset AI / Product AI / Fact Validation / Detail Extraction / 도매 API 신규 호출 각각 **0회**. 별도 semantic AI 호출 없음. 네트워크 원본 재다운로드 없이 로컬 bytes를 사용했다.
- 실제 앱의 서버 service/provider를 호출해 생성·저장·Export하고, 브라우저에서 Final Renderer와 새로고침 후 저장 결과를 확인했다. 모든 동작을 브라우저 버튼으로 수행했다고 주장하지 않는다.
- TASK-026의 quota 실패와 달리 이번 두 요청은 성공했다. 추가 billing/model 진단 요청은 불필요하여 실행하지 않았다.

## 2. 새 Planner 결과

`presentationVersion: 1`. **5개**, hero → imageText → detail → specification → option. Planner에는 최종 title 필드가 없으며 아래 title은 뒤에서 새로 생성한 Section 결과다.

Asset 별칭:

- A: `274da11e-7960-4cbe-856a-800d400ca367`, 분석 완료 Derived, 펼친 패드, 434×445px.
- B: `dcdc0748-73ba-457e-8e18-1606739fceb9`, 분석 완료 normal original, 패드 묶음/반려견, 330×330px.
- 긴 Source: `cf5884f2-fd32-4951-9b78-c5b90c29281c`, 860×12900px, Derived가 있어 억제됨.

1. `hero-product-identity` / hero: 상품 정체성과 첫 외관. F1+V1, A. 상품명의 규격·수량을 별도 장점으로 반복하지 않도록 계획했다.
2. `bundle-visual-reference` / imageText: 묶음과 반려견이 포함된 외관 사진. V2, B. 반려견의 적합성/사용 효과를 주장하지 않도록 계획했다.
3. `unfolded-pad-detail` / detail: 사각 외곽과 접힘선. V1, A 재사용. 흡수력/소재/두께를 설명하지 않도록 계획했다.
4. `canonical-specifications` / specification: 정확한 상품·분류·원산지·식별 정보 표. F1/F3/F4/F5/F6/F7, 이미지 없음.
5. `server-owned-option` / option: 확정 선택값. F/V 없음, 이미지 없음, 서버 snapshot 사용.

Hero는 A. heroScore91.41, resolutionSuitability0.775. B는90.92 / 0.5893이었다. 최신 해상도 가중치가 적용됐으며, 330px 원본을 금지한 결과가 아니다.

Planner warnings:

- `partial_asset_analysis`
- `visual_observations_not_facts`
- `insufficient_content_evidence`
- `repeated_asset`
- `hero_low_resolution`

generic title / repetitive_copy / low_visual_density / low_value_section 경고는 없었다. 그러나 경고 부재가 사람의 의미상 중복 검토를 대신하지는 않는다.

## 3. 새 Section 카피와 근거

1. **hero — 냄새잡는 대나무숯 애견 배변패드 40매(60x60cm)**
   - headline은 F1 원문과 동일.
   - subheadline: “흰색 패드가 펼쳐진 형태로 보이는 제품 이미지입니다.”
   - highlights 빈 배열. 수량·크기를 별도로 재강조하지 않았다.
   - evidenceIds F1/V1, assetIds A.
2. **imageText — 묶음 구성 외관**
   - body: “흰색 패드 묶음과 소형견이 함께 배치된 이미지입니다. 정면에 가까운 구도로 제품 모습이 보입니다.”
   - evidenceIds V2, assetIds B. 별도 bullet 없음.
3. **detail — 펼친 패드 모습**
   - body: “회색 단색 배경 위에 펼쳐진 흰색 패드가 중앙에 배치되어 있습니다.”
   - point: “사각 외곽과 내부 접힘선이 보입니다.” (V1)
   - evidenceIds V1, assetIds A.
4. **specification — 상품 표기 정보**
   - 아래 canonical 6행. evidenceIds F1/F3/F4/F5/F6/F7, assetIds 빈 배열.
5. **option — 옵션 안내**
   - 서버가 confirmed `옵션 / 단일상품`을 삽입했다. AI 작성 choices 없음.
   - evidenceIds/assetIds 빈 배열. 저장 group/value UUID와 배열 순서/version 보존.

완료된 canonical 결과만 정규화하여 기록했다. provider 전체 raw response나 system/developer prompt는 QA artifact에 보존하지 않았다.

## 4. Fact·의미 반복과 V-only 검토

`factCoverage` 결과: F1은 marketingBudget1 / uses1, Hero에만 사용. F3/F4/F5/F6/F7은 budget0 / uses0, specification에만 사용했다. 모든 예산 이내다. 기존 TASK-025는 F1이 Hero+Benefits의2곳, F3가 category Feature1곳에 사용되어 예산을 초과했다.

40매/60x60cm는 새 Hero의 상품명과 canonical 표에만 나온다. 모델명 ON241125403, 원산지 수입산, 제조국 중국, 상품번호67399861은 표에만 있다. 단위 변경/수치 추가/placeholder 부활 없음. specification에서 상품명을 반복하는 것은 정상이다.

`copyQuality`: duplicateTitleCount0, duplicateCopyCount0, warnings 빈 배열. `titleSimilarity`의 10쌍 중 최대값은 Hero ↔ “펼친 패드 모습”의 **0.0741**, 나머지9쌍0, 경고 임계값0.72 미만이다. “상품 표기 정보”는 표의 역할을 설명하고, “옵션 안내”는 기존 서버 계약이므로 이 두 제목을 generic 단어가 있다는 이유로 실패시키지 않았다.

사람의 검토에서는 Hero의 “흰색 패드가 펼쳐진 형태”와 Detail의 “펼쳐진 흰색 패드가 중앙에 배치”가 같은 사진과 관찰을 되풀이한다. Detail의 접힘선은 작은 추가 정보지만, 별도1029px Section을 정당화하기에는 약하다. 문자열 기반 helper는 이 의미 중복을 감지하지 못했다.

V-only 카피에서 흡수력/탈취력/안전/편안함/보온/최고/보장 등의 새 성능 claim은 발견하지 못했다. Hero 상품명에 원래 있는 “냄새잡는 대나무숯”은 F1 원문 유지이며 독립적인 탈취 성능 입증이 아니다. 제목 “묶음 구성 외관”의 ‘구성’은 사진 배치와 실제 배송 구성을 혼동할 여지가 있으나 body가 사진 관찰로 한정한다. 확정 구성/수량 추가는 없다.

UseCase/Benefits/Feature/Notice는 생성되지 않았다. 부족한 Fact로 장점/사용 효과를 채우지 않은 점은 확인했다. 이 사례만으로 해당 type들의 실제 품질까지 검증했다고 주장하지 않는다.

## 5. Specification / Options 정확성

supported F6개와 생성 rows6개를 label/value/evidenceId 단위로 완전 일치 검사했다.

- F1 상품명: 냄새잡는 대나무숯 애견 배변패드 40매(60x60cm)
- F3 카테고리: 취미/도서 > 반려동물 > 강아지배변용품 > 배변패드
- F4 원산지: 수입산
- F5 품명 및 모델명: ON241125403
- F6 제조국 또는 원산지: 중국
- F7 상품번호: 67399861

옵션 group `7712877f-441b-4d3f-bef4-bfa71e7f006c` / 이름 `옵션`, value `6eb44366-6930-463e-8884-5d36988cd7df` / label `단일상품`, version1을 유지했다. 새 QA Product/Options row를 참조하는 snapshot fingerprint도 기존 서버 검증을 통과했다. 색상/사이즈 분할 없음. 이 상품은1값이며 다른 상품67695797의6값 실검증을 대신하지 않는다.

## 6. Renderer / visual density / Hero

Final Renderer는 저장된5개 Sections만 표시하며 새로고침 후에도 동일했다. image load3/3, 누락0, 텍스트 가로 overflow0, article 내부 controls0. 품질 경고2건은 article 밖의 review 영역에만 표시됐다.

- visual 포함 Section **3/5=60%**.
- max consecutive text-only **2개**, 마지막 specification+option. 앞4개 중 text-only1개.
- 이미지 배치 **3회**, 고유 Asset **2개**.
- 고유 Derived **1개**, Derived 배치 **2회**. raw long Source **0회**.
- duplicate Asset count **1개**, max reuse **2회**. 서버 상한은 지켰지만 다양성이 좋아졌다는 뜻은 아니다.
- 첫 meaningful image top offset **325.84375px**, article 폭860px, DOM 높이3362.734375px.
- Hero A 실제 표시560×574.1875px, 원본434×445, 약1.2903배. cap1.5배, maxWidth560/maxHeight667. contain이며 잘림 없음.
- imageText B 표시350×350px, 약1.0606배, split 배치.
- Detail A 표시640×656.21875px, 약1.4747배, imageFirst. Hero와 동일 사진을 더 크게 반복한다.
- Hero 높이988.03125px / imageText495px / Detail1029.09375px / Specification546.375px / Option304.234375px.
- 실제 세로 padding: Hero64px, imageText·Detail72px, Specification36px, Option60px. 중간 split으로 변화는 있지만 Hero+Detail이 전체 높이 약60%를 차지한다.
- empty Section은 없으며 category-only Feature와 근거 없는 Notice도 없다. 다만 5개 최저 개수 정책 아래 Detail이 약한 추가 관찰을 독립 Section으로 만든 점은 후속 개선 대상이다. 모델이 개수를 채우려고 했다는 내부 의도까지 단정하지 않는다.

## 7. 실제 Export

- PNG **860×3363px / 632,048bytes**.
- JPG **860×3363px / 246,612bytes**, 기존 품질90 설정.
- 앱의 동일 Export service/Chromium capture 경로로 각각1회 생성했다. 두 파일을 실제 열어 첫 Hero부터 마지막 옵션까지 확인했다.
- Section5개, spec6행, 옵션1값, 이미지3배치 모두 존재. 글자 잘림/이미지 누락/Editor UI/Review warning 없음.
- PNG/JPG의 dimensions와 배치가 동일하다. RGB 평균 절대 차이0.63084/255는 압축 차이이며 픽셀 동일성을 뜻하지 않는다. 육안으로 배치 차이는 관찰되지 않았다.
- 긴 Source 자체를 출력하지 않으므로 긴 이미지 압축 문제는 재발하지 않았다. 반복된 작은 사진의 선명도와 원본에 남은 흰 경계는 별도 품질 문제다.

## 8. 동일 상품 BEFORE / AFTER

BEFORE의 실제 AI 결과는 TASK-025다. TASK-026은 그 결과를 그대로 재현한 Renderer 비교였고 새 AI 생성이 아니었다. 이번에는 동일 upstream 근거에 최신 정책으로 새 AI를 각1회 실행했다. 한 상품·한 출력의 관측이며 통계적 개선 증명은 아니다.

| 항목 | TASK-025 실제 AI | TASK-026 기존 카피 재현 | TASK-027 새 실제 AI |
| --- | --- | --- | --- |
| Section 수 | 7 | 7 | 5 |
| 제목 | 상품명 / 상품명 표기 기준 구성 / 강아지 배변용품 · 배변패드 / 펼친 패드 외관 / 추가 이미지 / 상품 정보 / 옵션 안내 | 동일 | 상품명 / 묶음 구성 외관 / 펼친 패드 모습 / 상품 표기 정보 / 옵션 안내 |
| F1 marketing 사용 | Hero+Benefits 2곳 | 동일 | Hero 1곳 |
| F3 marketing 사용 | Feature 1곳 | 동일 | 0곳, canonical 표만 |
| Hero 원본/표시 | normal330 / 정사각 내용561 | normal330 /495 | Derived434×445 /560×574.19 |
| 첫 사진 offset | 465.53px | 441.53px | 325.84px |
| 고유 이미지/Derived | 3 /2 | 3 /2 | 2 /1 |
| 중복 이미지 수 | 0 | 0 | 1 |
| visual 비율 | 3/7,42.86% | 동일 | 3/5,60% |
| Export 높이 | 3875px | 3919px | 3363px |

Fact 반복, category-only Section, 상단 사진 지연은 줄었다. **사진 다양성은 오히려 줄었고, 관찰 보고체와 Hero/Detail 의미 중복은 남았다.** 페이지는 TASK-026 대비556px 짧아졌지만 새 정보량에 비해 중복 Detail이 여전히 크다.

## 9. 품질 판정

| 항목 | 판정 | 근거 |
| --- | --- | --- |
| Hero | PASS | 적격 Derived, 상품 상단326px, contain,1.29배로 cap 준수 |
| 제품 이미지 활용 | NEEDS_WORK | 가용 Derived7개 중1개만 사용, 동일 사진2회 |
| 제목 다양성 | PASS | 목적별 제목, similarity 최대0.0741, generic 반복 없음 |
| 카피 중복 | NEEDS_WORK | Fact 반복은 해소, Hero/Detail의 펼친 흰 패드 관찰은 중복 |
| Section 역할 분리 | NEEDS_WORK | Detail이 Hero 사진의 외관 설명과 겹침 |
| 정보 밀도 | NEEDS_WORK | 새 정보가 적은 Detail1029px, 옵션1값 영역304px |
| visual rhythm | NEEDS_WORK | centered/split/imageFirst 변화는 있으나 큰 같은 사진 재등장 |
| Specification 정확성 | PASS | supported6행 label/value/evidence 완전 일치 |
| Options 정확성 | PASS | 그룹/값/순서/UUID/version 유지 |
| V-only claim 보호 | PASS | 관찰을 성능 claim으로 승격하지 않음, 새 효능 표현 없음 |
| 이미지 선명도 | NEEDS_WORK | Hero 해상도 경고, Detail1.47배 확대와 흰 경계 띠 |
| 전체 페이지 길이 | NEEDS_WORK |3363px 중 반복 Detail1029px, 단축됐어도 정보 대비 과함 |
| 사실 안정성 | PASS | 신규 Fact/옵션 생성·변경 없음, 기존 upstream/원본 보호 |

## 10. 문제와 우선순위

BLOCKER: 발견0. 잘못된 Fact/옵션 출력이나 E2E 중단 없음.

**HIGH H-01 — 판매 문구가 여전히 사진 관찰 보고체다.**

- 위치: Hero subheadline, imageText body, Detail body.
- 실제: “보이는 제품 이미지입니다”, “함께 배치된 이미지입니다”, “중앙에 배치되어 있습니다”.
- 근거: 구매자가 사진에서 바로 보는 배경·배치 설명이 세 마케팅 영역의 대부분이며, TASK-026의 보고체 회피 지시가 실제 출력에서 충분히 작동하지 않았다.
- 원인 추정: 성능 추론을 막는 정책 아래 안전한 관찰문을 길게 재진술. Planner brief도 외관 참고 중심이다.
- 수정 대상: page-planner/prompts, section-engine/prompts, page-quality의 사람 검토 가능한 관찰체·중복 안내. 보호 validator를 완화하지 않고 짧고 중립적인 사진 caption을 검토해야 한다.
- 데이터 손상 없음. 후속 테스트는 V-only 성능 금지와 짧은 허용 caption을 함께 유지해야 한다.

**MEDIUM M-01 — Hero/Detail 사진·의미 반복과 Derived 미활용.**

- 위치:1번 Hero와3번 Detail, A동일, 전체고유사진2개.
- 근거: 가용 Derived7개 중 분석 완료1개만 선택. “펼쳐진 흰 패드”를 다시 설명하고 접힘선1개만 추가한다. repeated_asset 경고는 작동했지만 semantic copy helper는0건이다.
- 원인 추정: 분석 완료 evidence를 선호하고 placement-only 사진을 회피. max2회는 안전 상한일 뿐 좋은 조합을 보장하지 않는다.
- 수정 대상: page-planner 목적/사진 배분, page-quality coverage와 중복 검토. 새 근거가 없어도 placement-only 사진을 사용할 수 있는 기존 경계를 유지한다.
- 데이터 손상 없음. 후속 composition 테스트는 Fact/V 발명 금지와 raw Source 억제를 계속 확인해야 한다.

**MEDIUM M-02 — Detail의 낮은 정보 밀도와 전체 길이.**

- 위치:3번 Detail1029.09px, Hero와합2017.13px(약60%).
- 근거: 같은 사진을640px 폭으로 더 크게 보여 준 뒤 짧은 외관 설명과 point1개만 표시.
- 원인 추정: 낮은 추가 정보량을 평가하지 않는 low-value heuristic과 spacious/imageFirst 매핑.
- 수정 대상: page-quality low-value 판정, Planner, shared renderer의 bounded density. 이번에는5~12 정책이나 CSS를 변경하지 않았다.
- 데이터 손상 없음. 후속 레이아웃 검증은860px capture/한글 줄바꿈/전체 Section 보존을 포함해야 한다.

**MEDIUM M-03 — ‘묶음 구성 외관’의 구성 의미가 모호하다.**

- 위치:2번 imageText 제목, 근거V2만 사용.
- 근거: 실제 사진에는 여러 패드 묶음이 있지만 확정 배송 구성에 대한 별도 F는 없다. body는 이미지 관찰로 한정하여 확정 오정보로 분류하지 않았다.
- 원인 추정: visual heading에 구매 단위로 해석될 수 있는 단어 사용.
- 수정 대상: section-engine prompt 및 사람 검토 품질 경고. 품목 수·구성 추가 없이 사진임을 분명히 하는 제목을 후속 검토한다.
- 데이터 손상 없음. V-only 제목의 구매 구성 암시 회귀 사례가 필요하다.

**MEDIUM M-04 — 작은 사진 확대와 원본 흰 경계.**

- 위치: Hero A560px / Detail A640px.
- 근거: 원본434px, Hero1.29배/Detail1.47배. cap은 정상이나 detail 질감은 선명하지 않고 위·아래 흰 띠가 보인다.
- 원인 추정: 원본 해상도 한계와 보수적 edge trim. 침범 위험이 있는 경계를 유지한 결과다.
- 수정 대상: visual-assets 후보 비교, 사용자 선택/배치, detail-extraction의 별도 검토 UX. cap 상향/생성형 보정/과도한 trim으로 해결하지 않는다.
- 데이터 손상 없음. 원본 bytes/제품 가장자리 보호 테스트 유지가 필요하다.

**LOW L-01 — 단일 옵션의 중복 라벨과 여백.**

- 위치: 마지막 Option304.23px, “옵션 안내”→“옵션”→“단일상품”.
- 원인 추정: 모든 그룹 수에 공통 제목과 padding 적용.
- 수정 대상: shared SectionCopy/renderer bounded density. UUID/label 원문을 삭제하거나 AI가 변경하는 방향은 제외한다.
- 데이터 손상 없음. 단일값/6개 결합값의 기존 snapshot 회귀 테스트 유지가 필요하다.

우선순위: H-01 → M-01/M-02 → M-03 → M-04 → L-01. 품질 재생성 없이 이번 결과를 먼저 보고한다.

## 11. 정책 적용 판단과 한계

- 적용 확인: presentationVersion1, F reuse 예산, category-only Feature/근거 없는 Benefits·Notice 제외,5개 구성, 첫3개 모두 visual, max Asset2회, Hero cap, 정확한 spec, 서버 confirmed Options, V-only 성능 금지.
- 충분하지 않음: 관찰 보고체 제거, 의미상 반복 탐지, 다양한 Derived 선택, 중복 Detail의 정보 가치. `low_value_section`과 `repetitive_copy` 경고가 없더라도 판매 품질을 보장하지 않는다.
- 모델 confidence/상품명/사진을 외부 진실성이나 성능 입증으로 취급하지 않았다. supported는 기존 제공 근거 내 일관성이다.
- 한 상품/한 샘플이다. 다상품 성공률,6옵션 실검증, useCase 품질, 공급처 최신 상품 상태는 이번 결과로 주장하지 않는다.

## 12. 검사·데이터 보호·정리

- 관련 자동 tests **240/240 pass**, fail0/skipped0. page-quality38개를 포함해 page-planner/section-engine/visual-assets/detail-renderer/detail-export/product-options를 실행했다. 자동 tests에서 실제 OpenAI 호출0회.
- 앱 코드 변경이 없으므로 요청26항에 따라 전체 build/typegen/tsc/lint/전체720tests는 재실행하지 않았다. 이전 TASK-026 통과 기록을 이번 실행 결과로 표기하지 않는다.
- Product/Facts/source_snapshot/Validation/Product Analysis/Options의 전체 QA row hash를 생성 전후 비교했다. upstream 불변.
- QA Asset9개의 Storage bytes를 준비한 로컬 원본/crop과 모두 SHA-256 비교했다. 원본 Source/normal 사진 불변, 원본 재분석/재작성 없음.
- 기존 사용자 데이터는7테이블(projects/products/product_facts/product_options/assets/detail_pages/sections)의 시작 전체 row id/hash와 단계별 비교했다. QA에서만 새 Plan/Sections와 필요한 복제 자료를 생성했다.
- QA Project/DetailPage/Sections/Products/Facts/Options/Assets 및 QA private Storage prefix 정리 완료. prefix 잔여 파일0개, 기존 사용자7테이블 전체 row hash가 시작 baseline과 완전히 일치했다. 임시 브라우저 탭도 닫았다.
- 실제 환경의 비밀키3종 값으로 src/docs/tests, QA 텍스트 artifact, production client JS/map26개를 검사했다. 일치0, client provider/server marker0. 검사 결과에는 키 이름과 match 수만 기록했다.
- `git diff --check` 통과. 마지막 상태는 `feat/ai-copy-quality-validation`의 신규 `docs/tasks/TASK-027.md` 한 파일뿐이다. commit/main merge 없음.

## 13. 로컬 산출물과 다음 TASK

저장소 밖 `C:/Users/alswn/Documents/Codex/2026-09-09/c-projects-detailforge/artifacts/TASK-027/`:

`after.png`, `after.jpg`, `plan.json`(정규화된 저장 Plan), `evidence.json`(저장 Section), `quality-analysis.json`, `render-metrics.json`, `export-metrics.json`, `tests-related.txt`, `secret-check.json`, `cleanup.json`.

원본 API response/전체 prompt/키/signed URL/판매자 연락처는 저장하지 않는다. PNG/JPG와 정제 QA 기록은 로컬에만 보존하며 Git에 추가하지 않는다. QA Project는 정리하므로 해당 localhost 링크는 산출물 링크로 제공하지 않는다.

다음 제안: **TASK-028 — 관찰체 카피와 반복 Visual Section 개선**. 이번 실제 문구를 최소 정규화 fixture로 삼아, 사실을 추가하지 않는 자연스러운 caption, Hero/Detail 역할 분리, placement-only Derived 다양성, 낮은 정보 가치 경고를 보완한다. 동일 upstream 고정 비교와 최소 실제 호출로 검증하며, Options/Facts/grounding/security 경계는 유지한다.

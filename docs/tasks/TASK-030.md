# TASK-030 — Final Commerce Polish & Release QA

- 브랜치: `feat/final-commerce-polish`, 기준 `33cd152`.
- 상태: 구현·실제 새 상품 E2E QA 완료. Release Candidate **NEEDS_WORK** (HIGH 1건).
- migration / dependency 추가 없음. Git commit / main merge 없음.

## 구현과 정책

1. 원인: 기존 Hero 점수는 원본 base priority의 영향을 크게 받았고 해상도를 고정 정사각 목표로 비교했다. 제목은 제한된 review warning만 있었다. TASK-029의 실제 “패드 묶음 구성”은 Option이 아닌 ImageText 제목이었다.
2. `heroImageSizing`: mode별 520/560/680px, 높이 720px 안에서 실제 종횡비와 1.5배 cap을 적용한다. 예상 display W/H와 intrinsic/display suitability를 Renderer·ranking·review에서 공유한다. CSS로 원본의 정보 부족을 복구하지 않는다.
3. Hero 점수: product/usage 대표성 40점, 관찰 품질 35점, 실제 해상도 20점, 정상 원본 2점, 분석 및 경고 0~3점. 같은 품질의 800px Derived가 330px 원본보다 높을 수 있으나 detail close-up의 최대 점수는 대표 컷보다 낮다. 기존 읽기용 eligibility는 유지하고 새 prompt와 새 Planner 결과에서는 detail Hero를 제외한다. 자동 교체 없음.
4. Review/Editor만 해상도 경고·이미지 후보 확인 링크를 제공한다. Export는 상품 surface만 사용한다. 인위적 sharpen/SR/upscale 없음.
5. `validateSectionTitleRelevance`는 순수 deterministic 함수다. sectionType/title/content/cited supported Facts/confirmedOptions/selected visualRoles를 받아 valid/warnings/hardErrors를 돌려준다. 추가 AI 호출 없음. bounded rule이므로 일반적인 자연어 사실 검증을 대신하지 않는다.
6. 묶음/세트/패키지는 인용된 판매 구성 Fact 또는 명시적 bundle 선택값이 필요하다. 수량 Fact, 여러 독립 선택값, 사진 속 묶음은 근거가 아니다. 단일상품 옵션 제목은 다른 구성 Fact가 있어도 묶음 금지.
7. detail/finish 제목은 detail visual, 착용/사용/활용 장면 제목은 usage visual이 필요하다. useCase의 명시적 가정·예시는 장면 증거와 구분한다. Spec 제목은 실제 rows, Notice는 관련 Fact를 확인한다. Hero/Benefits/Feature의 사실 claim은 기존 grounding을 함께 통과해야 한다.
8. Planner에는 title 필드가 없다. 새 provider 결과의 긍정적 purpose를 검사하고 금지 지시를 담는 contentBrief는 제목으로 오인하지 않는다. Section Engine와 개별 재생성은 실제 최종 title/headline을 검사한다. 실패 시 이전 성공 자료 보존, 자동 retry 없음.
9. 수동 편집은 차단하지 않고 review warning만 표시한다. 기존 DB를 조회해 제목·이미지를 바꾸지 않는다. 새 정책 version은 새 Plan/재생성 fingerprint에 반영한다.
10. optional gallery title은 null 유지. 기존 서버 option 기본 제목은 “옵션 안내”다. safeSectionTitle helper는 option/spec/notice의 허용된 빈 제목에만 중복되지 않는 기본값을 반환하며, 유효하지 않은 AI 제목을 몰래 고쳐 성공시키지 않는다. required AI 필드는 기존 schema를 따른다.

## 실제 QA 진행 기록

- 새 QA Project만 생성, 기존 7개 테이블의 14개 행 해시 보관(Projects1/Products1/Facts1/Options1/Assets4/Pages1/Sections5).
- 상품: `67695797`, 공개 URL `https://domeme.domeggook.com/s/67695797`.
- 상품명: 여성 양털 후리스 뽀글이 조끼 퍼 베스트 수면조끼.
- 카테고리: 의류/언더웨어 > 여성의류 > 조끼.
- 원산지: 수입산 / 아시아 / 중국. 제조국: 중국. 제조사: 디에이치트레이딩. 품명 및 모델명: 컬리 집업 베스트. 상품번호: 67695797.
- source snapshot은 원문을 보존하고 Facts에서는 모델명 “별도표기”, 포장 “X / X” 제외. 소재/보온 성능을 상품명에서 새 Fact로 추론하지 않음.
- 공식 옵션: 1그룹 옵션 / 아이보리 90, 아이보리 95, 코코아 90, 코코아 95, 브라운 90, 브라운 95. 입력란 반영 후 명시적 저장(version1). 분해·재조합 없음.
- 이미지 후보3 중 배송 홍보 이미지 제외, 대표330×330 + 상세800×23982(2.3MiB) 저장. 기존10MiB 상한 유지.
- 추출1회/14타일, 13성공·1실패, 후보24개. 실패 타일 재시도 없음. 실제 사진을 검토해 후보3/4/5/12/13/18/19만 저장: Derived7개, 총Asset9개.
- 문제: 후보24(전자기기 안내 그림)가 product_photo/98%/default selected로 반환됨. 사람이 제외했으며 Asset/최종 페이지에 포함시키지 않음. 후보 선택 안전성 개선 필요.
- 원본 + Derived3개의 실제 이미지 분석(4회). 나머지 Derived는 배치 힌트이며 V/F로 승격하지 않는다. 긴 Source 통합분석 추가 호출 없음.
- 원본/큰 착용컷/뒷모습 모두 cropped 경고: 의류 전체가 보여도 얼굴 잘림을 동일 취급하는 기존 정책의 보수적 제외를 기록한다.

## 최종 검증 결과

정제한 QA 증거와 최종 산출물은 작업공간 `C:/Users/alswn/Documents/Codex/2026-09-09/c-projects-detailforge/artifacts/TASK-030/`에 보존했다. 이전 TASK 산출물을 이번 실제 결과로 재사용하지 않았다.


## 변경 파일

생성 4개:

- `docs/tasks/TASK-030.md`
- `src/features/page-quality/generation-titles.ts`
- `src/features/page-quality/title-policy.ts`
- `tests/final-commerce.test.mjs`

수정 28개:

- `docs/00_PROJECT.md`
- `docs/01_PRD.md`
- `docs/02_ARCHITECTURE.md`
- `docs/04_AI_PIPELINE.md`
- `docs/05_UI_UX.md`
- `docs/tasks/README.md`
- `src/features/detail-editor/components/editor.tsx`
- `src/features/detail-editor/service.ts`
- `src/features/detail-editor/types.ts`
- `src/features/detail-renderer/model.ts`
- `src/features/detail-renderer/render-image.tsx`
- `src/features/detail-renderer/review.tsx`
- `src/features/detail-renderer/service.ts`
- `src/features/detail-renderer/visual-system.ts`
- `src/features/page-planner/evidence.ts`
- `src/features/page-planner/prompts.ts`
- `src/features/page-planner/service.ts`
- `src/features/page-quality/commerce.ts`
- `src/features/page-quality/images.ts`
- `src/features/page-quality/policy.ts`
- `src/features/page-quality/summary.tsx`
- `src/features/page-quality/title-relevance.ts`
- `src/features/section-engine/grounding.ts`
- `src/features/section-engine/prompts.ts`
- `src/features/section-regeneration/context.ts`
- `src/features/section-regeneration/grounding.ts`
- `src/features/section-regeneration/prompts.ts`
- `src/features/visual-assets/policy.ts`

## 발견 문제와 우선순위

- **HIGH H1 — 추출 후보24 자동 선택**: 조끼 Source 하단의 전자기기 안내 그림(736×357)이 product_photo, confidence98%, defaultSelected=true. 저장 직전 사람이 해제해 실제 Asset 혼입은 없었다. 원인 추정은 타일 단위 region 분류가 상품 정체성을 대조하지 않는 것. 대상: detail-extraction/provider, candidates/defaultSelected 정책 및 사용자 검토 UI. Product/Facts 손상은 없으나 무검토 저장 시 다른 상품 이미지가 최종 출력에 들어갈 위험. 후속 TASK에서 실제 양성/음성 region fixture와 상품 일치성·보수적 선택 회귀가 필요. RC 보류의 단일 HIGH.
- **MEDIUM M1 — 인물 잘림과 제품 잘림 혼동**: 330 원본, 646×737 전면 Derived, 634×738 뒷모습 모두 cropped로 Hero 제외. 실제 의류는 식별 가능. 미분석 사용자 승인 crop이 선택됐으나, 분석 자체가 좋은 후보를 탈락시키는 경험은 개선 필요. 대상 asset-analysis schema/prompt 및 visual-assets hasHeroQuality. 원본값 손상 없음. 향후 사람 얼굴/제품 경계 구분과 기존 잘림 제외 테스트를 함께 검토.
- **MEDIUM M2 — 긴 이미지 일부 구간 미확보**: 14타일 중 index1(화면2구간) 실패, 나머지13 성공. 원인 세부는 공개 계약에 없으므로 추정하지 않는다. 재시도 없이 첫 partial 결과 평가. 대상 detail-extraction의 부분 성공 안내·호출 한도. 데이터 손상 없음. 기존 partial result/이전 성공 보존 테스트 유지.
- **MEDIUM M3 — 짧지만 제목·본문의 정보 반복**: ImageText 제목 '전면 여밈과 양쪽 포켓'을 본문에서 거의 그대로 반복하고, Detail 본문 '근접 구성'은 판매 문구로 다소 건조하다. deterministic duplicate0/meta0이어도 사람이 느끼는 반복은 남음. 대상 page-quality/commerce, Section prompt의 title/body 역할. Fact 변경 없음. 후속 copy 회귀 예시 추가; 이번 첫 결과는 재생성하거나 손보지 않음.
- **MEDIUM M4 — 첫 Import 직후 옵션 영역 갱신**: 상품·이미지 저장 성공 뒤에도 옵션 영역의 '상품정보를 먼저 저장' 상태가 남아 새로고침 후 진행. 원인 추정은 product 저장과 options 초기 props 갱신 경계. 대상 products form/product-options panel. 저장 손상 없음. 신규 Product 저장→옵션 활성화 UI 회귀 필요.
- **LOW L1 — 시각 섹션 여백**: ImageText547px, Detail518px에서 이미지 높이 외160px 여백으로 긴 흰 간격이 느껴짐. 잘림·누락은 없고 수정 가능한 스타일. 대상 renderer spacing/style-policy. 새 디자인 조정 시 동일 canonical export 회귀 비교.

발견 후 바로 보완한 범위 내 문제: Editor QualitySummary가 canonical rows만 검사해 미저장 제목·이미지 변경 경고가 늦었다. displayed preview에 연결하고 실제 브라우저에서 330px 선택 시 warning+CTA, '묶음 구성' 입력 시 warning+저장 허용을 확인했다. 두 draft 모두 원복했고 DB에는 저장하지 않았다. 새 AI 호출 없음.

## 사용자 흐름 판정

| 흐름 | 결과 | 근거 |
| --- | --- | --- |
| Import UX | NEEDS_WORK | 저장 성공, placeholder 제외; 최초 저장 후 옵션 UI 새로고침 필요(M4) |
| Image extraction | NEEDS_WORK | 승인 Derived7개 저장; 무관한 그림 자동 선택(H1), 일부 구간 미확보(M2) |
| Option import | PASS | 공식API1회, 1그룹6개 원문·UUID·명시 저장 유지 |
| AI analysis | NEEDS_WORK | 분석/Fact 검증 성공, 인물 cropped와 제품 대표성 구분 개선(M1) |
| Page composition | PASS | 5개 역할 분리, 긴 Source0, 다른상품 Asset0 |
| Copy | NEEDS_WORK | 잘못된 제목/성능 claim0, 제목·본문 의미 반복(M3) |
| Visuals | PASS | Hero 축소0.882배, 제품 식별·선명도 허용, 누락/잘림 없음 |
| Editor | PASS | 현재 옵션6개, 최신 상태, 미저장 경고·수동 저장 허용, canonical 미변경 |
| Final export | PASS | PNG/JPG UI 다운로드 성공, 모두860×2744, 옵션6/이미지3/전체5 Sections |

## 요청된 45개 완료 보고

1. **Root issues**: 고정 크기·원본 가중치의 Hero 점수, 제한된 제목 경고. 상단 구현 정책 참고.
2. **생성 파일**: 위 목록 4개.
3. **수정 파일**: 위 목록 28개.
4. **Migration/dependency**: 0. 기존 DB/RLS/Storage/SSRF/DNS/redirect/size/timeout 정책 유지.
5. **Hero resolution**: 표시 목표와 종횡비를 공통 계산, MAX_RASTER_UPSCALE1.5 유지. CSS 선명도 위장 없음.
6. **Ranking**: semantic band 우선, visibility/clarity/heroSuitability + 해상도 + warning + original2점; detail은 고해상도만으로 승격 불가.
7. **Low-res warning**: 실제 Editor의 미저장330px Hero로 warning+Images CTA 확인 후 원복. Export surface에는 없음.
8. **Title architecture**: pure title-policy + generation-titles context adapter + review title-relevance. 추가AI0.
9. **Bundle semantics**: 인용된 판매 구성/confirmed bundle choices 필요. 수량/시각 묶음은 불충분, 단일상품 option은 금지.
10. **Option title**: 실제 '옵션 안내'; 6개를 독립 색상/사이즈로 분리하지 않음.
11. **Visual title**: 선택된 detail/usage 역할과 비교, Spec rows/Notice Fact도 대조. 제한된 deterministic 규칙이며 모든 의미 오류를 증명하지는 않음.
12. **AI/human**: 새 AI/regen은 strict failure, 이전 성공 보존; 사람은 저장 가능+warning. 실제 미저장 경고 확인, 저장 동작은 mock 회귀 통과.
13. **Fallback**: optional gallery null 유지, option '옵션 안내', safe helper의 spec/notice 대안과 중복 회피 검증. invalid AI 결과를 자동 치환하지 않음.
14. **Legacy**: 읽기 schema 유지, 새 정책은 생성 경계에서 검사. 조회/Editor QA/Export로 기존 제목·이미지·DB 자동 변경 없음.
15. **Tests**: 신규30개. low-res/ratio, 해상도 동률 비교, detail rank, bundle single/multi/실제근거/수량/부정, visual role, spec/notice, fallback, legacy, AI 실패 보존, human 저장/regen거부, Planner prior 보존.
16. **Total tests**: 820/820, 실패0/skip0. 자동 tests는 mock, 실제API 호출 없음.
17. **필수 검사**: next typegen, tsc --noEmit, lint(warning0), build 통과. git diff --check 통과. Client bundle 검사 아래.
18. **Actual E2E**: 새 Project로67695797 URLImport→Facts→Images→공식옵션→저장→추출→Derived7→이미지분석→상품분석→Fact검증→Plan→Sections→Editor→Renderer→PNG/JPG. 과거 fixture 복제 없음.
19. **API counts**: Dome1. OpenAI22 = 추출14타일(1run,13성공/1실패)+이미지4+상품1+검증1+Planner1+Section1. 자동 retry/품질 재생성/cherry-picking0. 추출·이미지 gpt-5.6-luna, 이후 gpt-5.6-terra. Export는 파일 보존용 service2회와 실제 UI2회(외부AI 없음).
20. **Facts**: 상품명·category + 위5개 실제스펙, 총7개 Fact. 별도표기/X / X는 source에만 보존. 검증 supported7,insufficient/conflict/needs_review0: 원본 일치만 뜻하며 외부 진실 증명 아님.
21. **Options**: 옵션1그룹6개(아이보리90/95,코코아90/95,브라운90/95; 실제 공백 원문 유지), version1, Export snapshot과 DB groups deep equal.
22. **Derived**: 저장7, 사용3. 총Asset9. 추출 후보24 중 사람이7개 승인.
23. **Hero**: Derived product hint,635×792. 별도 분석 없이 승인된 배치 자료이며 Fact/V 생성 안 함.
24. **Display**: 실제560×698.453125px, intrinsic 대비0.88188976배(축소), suitability1, lowResolution=false.
25. **Sections**: hero,imageText,detail,specification,option; 순서 그대로5개.
26. **Titles**: '여성 양털 후리스 뽀글이 조끼 퍼 베스트 수면조끼' / '전면 여밈과 양쪽 포켓' / '목둘레와 앞여밈 주변' / '상품 표기 정보' / '옵션 안내'.
27. **Meta observation**: deterministic count0. 근거 없는 성능·효과·최고·보장0, 사용 가설을 사실로 확대하지 않음.
28. **Copy duplicate**: deterministic0, title duplicate0. 사람 평가의 title/body 의미 반복은 M3에 별도 기록.
29. **Title semantic issues**: 실제첫최종결과0. 사람이 입력한 가짜 묶음 제목은 경고 확인 후 저장 없이 원복.
30. **Used images**: 3, 모두 실제 해당 상품 Derived. 최종원본 대표0.
31. **Duplicate images**: 0, 각1회.
32. **Raw long Source**: 0. 다른 상품 Asset 혼입0. 원본 Source는 삭제 전까지 provenance용 보존.
33. **First visual offset**: article 상단 기준217.4375px. 다른 상품인TASK029와 개선율 A/B로 주장하지 않음.
34. **Export**: PNG860×2744 /1,009,269bytes; JPG860×2744 /278,573bytes(quality90). 두 파일 직접 시각검토, RGB 평균차0.9412/255(압축 차이), layout동일. Hero~Option 모두존재, textOverflow0, image missing0, controls0, review text0.
35. **BLOCKER**: 0.
36. **HIGH**: 1(H1, 전체 흐름). 사람이 걸러낸 최종파일만 보면HIGH0이나 RC전체기준에서는 제외하지 않음.
37. **MEDIUM**: 4(M1~M4).
38. **LOW**: 1(L1).
39. **PASS/NEEDS_WORK**: 위9개 흐름 표 참고.
40. **Safety**: 기존7테이블14행 모두 해시 일치. QA Product/Facts/source_snapshot/Options protected hash 일치, 첫 성공Sections 그대로, 원본긴이미지bytes hash 동일. 허용된 AI 결과·QA행만 변경.
41. **Secrets**: 실제 키3종의 client JS/map26개·src/docs/tests·artifact텍스트 검출0, client provider marker0. 키·signed URL·원본 provider 오류 보고 없음.
42. **Cleanup**: QA Project/자식DB행/Storage9객체 정리 완료, 해당private prefix0, 기존baseline exact equal. QA탭/3002서버 정리; 사용자3000서버 미조작. 로컬 증거·최종이미지만 보존. .env.local 변경 없음.
43. **RC verdict**: **NEEDS_WORK**. TASK030 구현과 E2E는 완료, HIGH1 때문에 Release Candidate 통과 선언은 하지 않는다.
44. **Remaining non-blocking**: M1~M4/L1. 최종파일은 판매자가 문구·여백을 조금 다듬어 활용 가능하지만 추출 선택 단계의 신뢰성은 선행 개선 필요.
45. **Next task**: TASK031 Product-identity-aware Extraction Selection QA. 광고/전자기기/로고를 무조건 제품컷으로 기본 선택하지 않도록 보수적 후보 정책·명시 검토를 설계하고, 사람/제품 잘림 구분을 별도 검증. 기존 안전 제한과 원본 보존, AI retry 제한 유지. 추가AI/재생성은 이번TASK에서 실행하지 않음.

## 보존 산출물

- final.png, final.jpg: 실제 첫 유효 생성 결과. UI draft 테스트는 저장하지 않음.
- candidates.png:24개 후보 contact sheet. H1의 전자기기 그림 확인용.
- evidence.json, quality.json, browser-metrics.json, export-metrics.json, format-comparison.json: 정제된 QA 자료.
- tests.txt, build.txt, secret-check.json, data-safety.json, cleanup.json: 검사·보호·정리 증거.
- 이 artifact들은 Git 저장소 외부 작업공간에 있고 원격 DB/Storage에는 남기지 않았다. Git commit/main merge 없음.

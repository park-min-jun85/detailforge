# TASK-028 — Commerce Copy & Visual Section Refinement

2026-09-19 KST. `feat/commerce-copy-quality`, 시작 HEAD `772b891`, 시작 working tree clean.

**구현 및 동일 상품 실제 AI QA 완료. Planner1회/Section1회 모두 첫 호출 성공. 관찰 보고체4→0건, 반복 목적1→0쌍, 반복 이미지1→0개,5→4 Sections, PNG/JPG860×2334.** 기존 사실·옵션 보호를 유지했다. 새 dependency/migration/commit/main merge 없음.

## 요청한 47개 보고 항목

1. **Root cause**: 기존 prompt는 보고체를 피하도록 했지만 서버의 hard 검사는 길이/F grounding 중심이었다. 분석 관찰을 판매 카피로 직역해도 통과했고, 정확한 문자열 비교는 Hero/Detail의 의미 반복을 놓쳤다. 이미지 최대2회는 같은 목적2회도 허용했다. Planner와 Section output이 모두 최소5여서 TASK-027의 반복 Detail을 제외한4개 구성은 계약상 불가능했다. 이것이 모델의 유일한 생성 원인이라고 단정하지 않는다.
2. **생성 파일**: `src/features/page-quality/commerce.ts`, `tests/commerce-copy.test.mjs`, 본 문서.
3. **수정 파일**: page-quality/policy; page-planner evidence/prompts/schemas/service; section-engine errors/grounding/prompts/schemas/service/types; section-regeneration context/errors/grounding/prompts/types; detail-editor/fields; detail-renderer/section-copy; tests/page-planner; docs/tasks/README 및 docs00/01/02/04/05/06. 기존 Product Analysis/Fact Validation/Facts/Options/Assets 저장 모듈은 변경하지 않았다.
4. **Migration/dependency**: 없음. package/lock/DB generated types/RLS/기존 migration 변경 없음. 기존 Node/Zod/SDK와 helpers만 사용한다.
5. **Commerce-copy policy**: 최종 카피는 사진을 보거나 확인하는 행위를 설명하지 않는다. supplied V의 직접 관찰 범위에서 짧은 명사구/설명구를 생성한다. 전략은 구성 방향이며 Fact가 아니다. 문자열 자동 삭제·치환, 별도 카피 AI 호출, 자동 retry 없음.
6. **Meta-observation detector**: NFKC/공백 정규화 뒤 media(이미지/사진/시각)+확인/참고/보는 표현, media 보고 서술, visual intent+외형/배치+보입니다/배치되어 있습니다 등의 조합을 검사한다. `{hasMetaObservation, patterns}`를 반환한다. 제목·본문·강조·목록을 검사하되 canonical spec/option 행은 제외한다. “구매 전 옵션을 확인해 주세요”는 notice/selection 문맥에서 일괄 금지하지 않는다. 단순 ‘확인’ blacklist가 아니다.
7. **Copy intent**: identity, benefit_from_fact, feature_from_fact, visual_description, detail_description, usage_hypothesis, selection_information, specification, notice. type으로 runtime 계산하여 prompt/context에 넣는다. Product Fact나 새 DB field가 아니다.
8. **V-only visual description**: 실제 관찰에 있는 앞면 지퍼 여밈/실루엣/외형/배치만 간결하게 표현한다. 예시를 모든 상품에 복사하지 않도록 고정 정책에 명시했다. 미분석 Derived hint는 배치용이며 새 V/Fact/보이지 않는 외형 설명의 근거가 아니다.
9. **V-only prohibited claims**: 기존 guard를 유지하고 가볍/가벼, 부드럽/부드러, 고급, 간편, 편리, 활동하기 편, 피부에 좋, 안전을 보완했다. 기존 편안/따뜻/흡수/튼튼/실용/착용감/보온/내구성 등도 유지한다. 해당 표현은 관련 cited supported F에 있어야 한다. 유한한 어휘 검사가 자연어 주장 전체의 진실성을 증명하지는 않는다.
10. **Type별 copy policy**: Hero=정체성, Benefits=서로 다른 Fact 기반 이유, Feature=새 supported 특징, ImageText=한 가지 관찰 외형, Gallery=짧은 제목/선택 intro, Detail=별도 visual/새 근거, UseCase=명시적 가설, Specification=원문 표, Option=confirmed snapshot, Notice=실제 안내 근거. Hero subheadline과 Gallery intro는 기존 null 허용, ImageText/Detail body에는 null을 추가했다. Feature body는 계속 필수다.
11. **Message signature**: type/intent, 정렬·중복 제거한 evidenceIds/assetIds, NFKC+공백/구두점 분리 및 제한된 조사 제거 purpose tokens. 순서가 다른 집합도 같은 서명을 만든다. full semantic embedding/AI 판단이 아니며 원본 purpose는 변경하지 않는다.
12. **Semantic duplication policy**: 같은 이미지가 겹치는 visual Section에서 다른 Section의 이미지·근거 부분집합만 쓰면 새로운 visual/evidence가 없다고 판정한다. 같은 intent+동일 근거/이미지 집합+purpose token Dice≥0.6도 중복 위험이다. canonical spec/option/notice 재표시는 제외한다. 다른 Asset ID의 실제로 같은 사진이나 표현만 다른 모든 의미 중복을 검출하는 기능은 아니다.
13. **Hero/Detail repetition**: Hero A/F1/V1과 Detail A/V1은 문장을 바꿔도 별도 상세 근거가 없어 거부한다. TASK-027의 실제 구조가 회귀 사례다. 새 F2를 설명하는 Feature는 동일 A 재사용이 가능하며 기존 max2회는 별도로 유지한다.
14. **Distinct visual assignment**: available/suppressed/heroEligible/effective role/heroScore/basePriority를 이용한 결정적 우선 후보 hint다. 이미 쓴 후보보다 미사용 후보, Detail에는 detail role을 우선한다. 후보가 없으면 감소 hint를 준다. Plan/Asset을 자동 재작성하거나 raw Source를 부활시키지 않는다. 모델은 실제 Plan 계약 안에서 최종 배치를 선택한다.
15. **Low-value visual Section**: 새 이미지/근거가 없는 반복 visual 목적은 Planner 저장 전과 Section 최종 출력에서 거부한다. 근거·이미지 없는 imageText/detail, 이미지 없이 null body인 visual도 거부한다. prompt는 빈약한 Section을 줄이거나 distinct 컷을 Gallery로 묶도록 한다. 생성 뒤 자동 삭제/문장 rewrite는 없다. 이 보수적 검사로 모든 낮은 정보 가치 문장을 완전히 평가하는 것은 아니다.
16. **최소 Section 수 결정**:5→**4**, 상한12 유지. TASK-027은 Hero/ImageText/Spec/Option에 반복 Detail을 더한5개였고4개는 양쪽 Zod가 거부하던 구조다. 최소 개수 때문에 불필요한 추가 항목이 필요해지는 계약을 완화했다. Planner Zod/Section output Zod/prompt/tests/docs를 함께 변경했다. 5~12개도 유효하고 type/순서1:1은 유지한다. 기존 저장 Plan/Section을 자동 축소하지 않는다.
17. **Planner 변경**: copy intents와 distinct visual hints를 untrusted 데이터 context에 추가했다. 새 목적 중복 검사 후만 저장하며 실패하면 이전 Plan 보존. `commerceCopyVersion:1`을 latestResult와 input fingerprint에 추가했다. 기존 Plan JSON은 optional version으로 읽을 수 있으나 정책 변경에 따른 stale 후 명시적 재설계가 필요하다.
18. **Section Engine 변경**: sectionIntents/factPresentation/visual assignment/전체 Plan을 기존 한 호출에 전달한다. Structured Output→Zod→대응·evidence·asset·Fact/spec/options 검증→기존 presentation 상한→commerce 보고체/목적 중복 검사 후 staging한다. 실패는 안전한 `copy_quality`422이며 기존 backup/recovery 경계를 유지한다.
19. **Section regeneration 변경**: 같은 commerce prompt와 hard 검사를 후보 생성·명시적 적용 양쪽에서 사용한다. 현재 페이지의 다른 최대49개 Section의 type/title/purpose/evidenceIds/assetIds만 전달하며 본문/URL은 제외한다. peer summary가 candidate input fingerprint에 들어가므로 다른 Section의 요약이 바뀌면 기존 후보 적용을 거부한다. 대상과 관계없는 peer의 수동 보고체를 차단하지 않는다. 실제 재생성 유료 호출은 하지 않았고 mock으로 검증했다.
20. **Title policy**: 기존40자 상한/유사도 검토 유지, 제목의 보고체도 생성 실패 대상이다. 현재 Renderer에는 상품명 전용 표기와 headline의 이중 출력이 없으므로 Hero schema/레이아웃을 억지로 바꾸지 않았다. 실제 headline은 정확한 상품명, subheadline은 다른 외형 정보다.
21. **Fact reuse regression**: canonical 표는 예산에서 제외, marketing coverage는 그대로 계산한다. 크기 Fact를 Hero+ImageText에 사용하면 uses2/budget1인 회귀 검사 포함. 실제 AFTER F1은 Hero1곳, F3/F4/F5/F6/F7은 marketing0곳이다.40매/60x60cm를 highlights/body로 반복하지 않았다.
22. **Option/spec protection**: AI가 optionSnapshot을 작성하지 않고 기존 deterministic 삽입/원문 spec 검증 유지. detector는 원문 행을 치환하거나 ‘보고체 같다’는 이유로 제거하지 않는다. 기존6개 결합 옵션의 UUID·값·순서 회귀 검사도 전체 suite에서 통과했다.
23. **테스트 결과**: 신규35개. 실제 TASK-027 문구 최소 fixture, 공백/조사/제목 보고체, 안전한 visual 표현, notice 예외, F 없는 성능 거부, signature/새 Fact 차별화, A/B/C distinct 후보,4개 계획, nullable body Editor/shared renderer, 이전 성공 보존, 재생성 실패/peer 변경 conflict, 수동 저장 허용, injection 데이터 분리를 검증했다. 자동 테스트 실제 API 호출0회.
24. **전체 test 수**: **755/755 pass**, fail0/skipped0, 약57.7초. 기존720+신규35. 기존 SSRF/DNS/redirect/private Storage/Options CAS/Section CAS/regeneration 서명·만료·복구도 유지한다.
25. **Typecheck/lint/build**: next typegen, tsc --noEmit, lint(warning0), production build 통과. diff/secret 최종 확인은 아래 기록. 최초 테스트 중 Node strip-only의 TS parameter property 오류를 수정했고, 공유 prompt 상수를 조합하는 방식으로 기존 injection 검사를 그대로 통과시켰다. 검사를 삭제하거나 실제 provider 출력에 맞춰 완화하지 않았다.
26. **실제 OpenAI Planner**:1회, `gpt-5.6-terra`, 성공. 자동 retry0회.
27. **실제 Section Engine**:1회, 같은 모델, 성공. 추가 카피 AI/embedding/Asset AI/Product Analysis/Validation/Extraction/도매 API 재호출0회. 품질 때문에 재생성하지 않았다.
28. **QA 상품**:67399861, 냄새잡는 대나무숯 애견 배변패드 40매(60x60cm). 새 QA Project `a5e8e0b9-e0c0-4e60-aec1-565d8e637236`. TASK-027과 동일 실제 upstream 자료를 복제, fingerprint를 고치지 않고 Product Analysis/Validation 입력 일치를 assert했다. 원본2/Derived7개를 준비했다. 기존 사용자 Project는 사용하지 않았다.
29. **BEFORE 구조**: Hero → ImageText → Detail → Specification → Option,5개. 펼친 패드 사진/의미가1번과3번에 반복됐다.
30. **AFTER 구조**: **Hero → ImageText → Specification → Option**,4개. 반복 Detail을 계획하지 않았다. Planner의 purpose와 spec/option 영역은 그대로 역할을 구분한다.
31. **AFTER titles / 핵심 문구**:
    - Hero headline: `냄새잡는 대나무숯 애견 배변패드 40매(60x60cm)`; subheadline: `펼친 사각 패드 형태`; highlights=[]; F1/V1.
    - ImageText: `패드 묶음 구성`; body: `흰색 패드 묶음과 소형견이 함께 배치된 전체 구도.`; V2.
    - Specification: `상품 사양`; F1/F3/F4/F5/F6/F7 canonical6행.
    - Option: `옵션 안내`; `옵션 / 단일상품`; F/V없음, confirmed snapshot.
32. **Meta-observation count**: 같은 detector로 BEFORE4 prose fields(보조 문구/본문2/point1) → **AFTER0**. 사람이 읽어도 이미지 확인을 지시하거나 ‘보입니다/이미지입니다’로 설명하지 않는다. ImageText는 직접 관찰 배치를 짧게 설명한 구절이다.
33. **Semantic copy duplicate count**: 구조 signature 위험쌍1→**0**, exact duplicate title/copy0. 사람 검토에서도 펼친 한 장의 패드와 묶음 배치가 서로 다른 역할이다. canonical 상품명 표 반복은 정상이다.
34. **Used Asset count**: 고유2개, 배치2회. Hero `274da11e-7960-4cbe-856a-800d400ca367`, ImageText `dcdc0748-73ba-457e-8e18-1606739fceb9`. Spec/Option이미지 없음.
35. **Duplicate Asset count**:1→**0**, max reuse2→1. 가용 사진을 더 많이 쓴 것은 아니며 불필요한 재등장을 없앴다.
36. **Derived count**: 고유1개/배치1회.434×445px 분석 완료 제품컷. normal330×330px1개도 사용했다. 준비한 Derived7개 중1개만 사용한 한계는 남는다.
37. **Raw long Source count**:0.860×12900 parent는 계속 억제됐다.
38. **First visual offset**: **325.84375px**, BEFORE와 동일. visual ratio3/5=60%→2/4=50%로 수치는 낮아졌지만 사진 없는 구간이 늘어난 것이 아니라 중복 visual Section을 제거한 결과다. max text-only2개(Spec+Option). Hero560×574.1875, ImageText350×350, contain, 로드2/2. Hero1.29배로 기존1.5배 cap 유지.
39. **PNG/JPG**: 둘 다 **860×2334px**, PNG359,986bytes / JPG159,570bytes. BEFORE860×3363 대비1029px 감소. 실제 파일 둘을 열어4개 Section/스펙/옵션/사진을 확인했다. 누락·글자 잘림·Editor UI·Review warning 없음. DOM height2333.640625px, controls0, text overflow0. RGB 평균절대차이0.58223/255는 압축 차이이며 육안 배치 차이는 없다.
40. **V-only claim 결과**: PASS. 실제 short copy는 사각 형태와 흰색 패드·반려견 배치 범위이며 성능/안전/효능/편안함을 새로 주장하지 않았다. 상품명에 원래 있는 ‘냄새잡는 대나무숯’은 F1 원문 유지이며 독립적인 효능 입증이 아니다.
41. **Options/spec 결과**: PASS.6행 모두 원문 label/value/evidence 일치(상품명, 카테고리, 원산지 수입산, 모델ON241125403, 제조국 중국, 상품번호67399861). 옵션 `옵션 / 단일상품`, group UUID `7712877f-441b-4d3f-bef4-bfa71e7f006c`, value UUID `6eb44366-6930-463e-8884-5d36988cd7df`, version1/순서 유지. 다른 상품67695797의6옵션 실제 호출 검증을 했다고 주장하지 않는다.
42. **품질 PASS/NEEDS_WORK**: 아래 표. 이번 필수5항목은 PASS, 반복/밀도/visual 배분은 이전보다 개선. 모든 판매 디자인이 완성됐다는 의미는 아니다.
43. **기존 데이터 불변**: QA Product/Facts/source_snapshot/Validation/Product Analysis/Options 전체 row hash를 생성 전후 비교했다. QA9 Asset의 실제 Storage bytes도 로컬 준비 입력과 모두 SHA-256 일치했다. 기존7테이블 baseline id/row hash 비교로 사용자 데이터 보존을 확인한다. 새로운 QA Plan/Sections만 AI가 저장한다.
44. **Secret 검사**: 실제 환경 비밀키3종으로 production client JS/maps25개와 src/docs/tests/QA 텍스트 검사 완료. 일치0건, client provider/server marker0건. 키 값이나 SDK raw 오류는 로그/보고서에 출력하지 않았다. 새 commerce prompt도 client bundle에 포함되지 않음을 검색했다.
45. **QA cleanup**: QA Project/Product/Facts/Options/DetailPage/Sections/Assets/Storage 정리 완료. QA Storage prefix 잔여0개, 기존7테이블 전체 row hash가 시작 baseline과 완전히 일치했다. 임시 브라우저 탭도 닫았다. 로컬 출력 artifact만 보존한다.
46. **남은 품질 문제**: ImageText의 ‘묶음 구성’이 배송 구성으로 오해될 여지는 있어 판매 전 제목 검토가 필요하다. body는 전체 구도로 한정하고 실제 구성 수량을 발명하지 않았다. 소형견 배치 설명도 더 자연스러운 상품 카피로 다듬을 수 있지만 임의 이점은 추가하지 않았다. Hero 작은 원본의 선명도/흰 경계, 단일 옵션304px의 여백·중복 label도 남는다. 자체 재생성하지 않았다.
47. **다음 TASK 제안**: TASK-029 — 다상품 Commerce Copy 회귀 QA 및 단일 옵션/사진 caption 밀도 개선. 동일 자료의 다른 상품1개(67695797 등)에서 복합 옵션·착용 V를 추가 검증하고, 필요 시 ‘구성’과 시각 배치를 구분하는 제목/짧은 caption을 보완한다. 사실 근거가 없는 감성·편의 claim, 과도한 확대/자동 trim은 해결책으로 사용하지 않는다.

## 품질 판정

| 항목 | 판정 | 실제 관찰 |
| --- | --- | --- |
| 관찰 보고체 카피 | PASS |4→0 fields, 짧은 형태/배치 표현 |
| V-only claim 보호 | PASS | 새 성능·효능·편안함 주장 없음 |
| Specification | PASS | supported6행 원문 완전 일치 |
| Options | PASS | UUID/label/order/version 보존 |
| Section 역할 분리 | PASS | 정체성→다른 제품컷→정확한 표→선택값 |
| Hero/Detail 반복 | PASS | 동일 사진·관찰 반복 Section 제거 |
| 정보 밀도 | PASS | 낮은 정보량 Detail1029px 제거,4개 구성 |
| Visual diversity | PASS | 고유사진 수2개 유지, 이미지 배분은3배치/중복1에서2배치/중복0으로 개선 |
| 이미지 선명도·crop 경계 | NEEDS_WORK | Hero 원본434px와 원본 흰 띠의 한계 유지 |
| 옵션 영역 밀도 | NEEDS_WORK | 단일값에304px, 옵션 안내/옵션 라벨 반복 |
| 카피의 자연스러움 추가 개선 | NEEDS_WORK | ‘묶음 구성’의 의미 모호성, 구도 설명의 표현 여지 |

## 호환성·보안·검출 한계

수동 Editor 저장은 commerce hard validation을 호출하지 않는다. AI 품질 warning은 Editor/Final review에만 표시하고 capture에는 넣지 않는다. nullable body의 표시는 공유 renderer에서 통일했다. 기존 문자열 body/Plan은 계속 파싱된다. 새 정책 fingerprint 때문에 기존 Plan은 명시적 재설계가 필요할 수 있으나 DB나 기존 콘텐츠를 자동 변경하지 않는다.

purpose/evidence/asset 검사는 실제 자연어 의미 추론이 아니다. 같은 사진을 다른 Asset ID로 저장했거나, 다른 참조를 붙여 실질적으로 같은 말을 하는 경우까지 완전히 판별하지 않는다. 반대로 같은 V 사진을 다시 세부 설명하는 것도 별도 근거가 없으면 보수적으로 거부한다. F/V 참조의 존재와 제한 어휘 검사는 완전한 진위 증명이 아니므로 판매 전 사람 검토를 유지한다.

원본 SSRF/DNS/redirect/response 크기/10MiB/timeout/최대 Asset 수, private Storage, Zod strict 출력, 옵션 CAS, generation recovery와 개별 후보 서명/만료는 변경하지 않았다. 새 유료 API 종류나 자동 비용 루프가 없다.

## 로컬 QA 증거

저장소 밖 `C:/Users/alswn/Documents/Codex/2026-09-09/c-projects-detailforge/artifacts/TASK-028/`:

- `after.png`, `after.jpg`, `export-metrics.json`, `render-metrics.json`
- `plan.json`, `evidence.json`, `quality-analysis.json`: 앱이 검증·저장한 정규화 결과 및 필요한 수치. 전체 API envelope/prompt/signed URL 없음.
- `tests-final.txt`, `build-final.txt`, `secret-check.json`, `cleanup.json`

QA용 scripts/crops/출력 파일은 저장소 밖에 남기고 Git에 추가하지 않는다. 실제 호출은 기존 서버 service/provider를 통해 수행했고 Final Renderer는 실제 브라우저에서 확인했다. 브라우저 버튼으로 전 단계를 수행했다고 주장하지 않는다. 한 상품·한 번의 새 출력이며 다상품 일반 성능/성공률을 증명하지 않는다.

## 최종 상태

전체755 tests, next typegen, tsc --noEmit, lint(warning0), build, git diff --check 통과. 신규 파일도 별도 whitespace 검사를 수행했다. Windows LF→CRLF 안내는 있었으나 whitespace 오류는 없다. 브랜치 `feat/commerce-copy-quality` 유지, 생성3/수정26파일은 본 TASK 범위이며 commit/main merge는 하지 않았다. QA 종료 후 기존 데이터 불변·Storage 정리·secret 검사 완료.

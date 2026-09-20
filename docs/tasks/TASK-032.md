# TASK-032 — Release Candidate Polish & Multi-Product QA

- 저장소 `C:/Projects/detailforge`, 브랜치 `feat/release-candidate-polish`, 시작 HEAD `bce40ae` (TASK-031).
- 실제 QA: 2026-09-19~20 KST. 중간 세션 중단 시간을 단계 소요 시간에 합산하지 않았다.
- 이 문서의 실제/재현/mock 구분을 함께 읽어야 한다. 세 상품 모두 새 유료 full E2E를 실행했다는 보고가 아니다.
- 최종 판정: **v0.1.0 local/internal MVP Release Candidate — PASS**. 관찰 BLOCKER0/HIGH0/MEDIUM4/LOW2. A 핵심 여정, 전체849 tests, 필수 검사, secret0, 기존14행 불변, QA 정리 성공을 기준으로 한다. B/C의 제한된 범위를 전체 새 E2E 성공으로 확대하지 않는다.
- Git commit/main merge/tag 없음. 새 dependency/migration/생성 DB 타입 변경 없음.

## 요청한 60개 완료 보고 항목

1. **TASK 목표**: 새 기능 확장 없이 내부 MVP 여정·오류 복구·정확성·출력 품질을 검증하고 작은 UX/중복 저장 문제를 보완한다. AGENTS/CLAUDE/00~07/TASK023~031 및 설치된 Next `use-router` 지침을 확인했다.
2. **생성 파일**: `src/features/detail-extraction/crop-identity.ts`, `docs/tasks/TASK-032.md`, `docs/RELEASE_BACKLOG.md`. 실제 QA helper·JSON·PNG/JPG는 아래 별도 작업공간에만 보존하고 저장소 dependency/test suite에 유료 호출을 넣지 않았다.
3. **수정 파일**: `src/features/products/components/product-form.tsx`; `src/features/assets/components/asset-manager.tsx`; `src/features/detail-extraction/service.ts`; `src/features/detail-extraction/components/extraction-panel.tsx`; `tests/detail-extraction-service.test.mjs`; root `README.md`; `docs/00_PROJECT.md`, `01_PRD.md`, `02_ARCHITECTURE.md`, `03_DATABASE.md`, `04_AI_PIPELINE.md`, `05_UI_UX.md`, `06_CODING_RULES.md`, `07_DECISIONS.md`; `docs/tasks/README.md`. 03은 중복 조회 기준의 오래된 설명도 맞추기 위해 갱신했다.
4. **Migration/dependency**: 0. 기존0001~0005·RLS·private bucket·package·`.env.local`·generated types 유지. QA 포트3003 origin override는 저장소 밖 임시 env 파일에만 둔다.
5. **CASE A**: 실제67399861, ‘냄새잡는 대나무숯 애견 배변패드 40매(60x60cm)’. 새 `QA-TASK032-A-67399861`에서 브라우저 Import→상품/이미지 저장→공식 옵션 조회·반영·저장→추출·Derived 저장→AI→Validation→Planner→Section→Editor→Renderer→PNG/JPG 성공. 대표330×330/18,216B, 상세860×12900/1,976,196B. category ‘취미/도서 > 반려동물 > 강아지배변용품 > 배변패드’, 원산지 ‘수입산’, 품명 및 모델명 ‘ON241125403’, 제조국 또는 원산지 ‘중국’, 상품번호 ‘67399861’. 등록된5개 파일을 private Storage에서 재조회해 bytes·decoder 크기를 확인했다.
6. **CASE B**: 실제67695797 ‘여성 양털 후리스 뽀글이 조끼 퍼 베스트 수면조끼’. 새 QA Project에서 실제 HTTP Import→상품/Facts 저장→공식 옵션 후보→명시 apply/save를 서비스 경계로 실행했다. 옵션1그룹6값 그대로 저장. 새 이미지/AI 호출은 생략하고 TASK030의 실제 canonical Facts/Options/Plan/5 Sections와 원본 bytes/provenance로 local read-only replay를 만들었다. 동일 현재 Renderer/Export로 PNG/JPG 검증. replay 외부 호출0/DB 쓰기 차단이며 새 원격 B 프로젝트에 과거 Plan을 복사하지 않았다. B의 새 브라우저 full E2E 성공으로 세지 않는다.
7. **CASE C**: 실제62191078 ‘페인팅 수면조끼 수면 조끼 아기 유아 여아 아동’. 실제 Import/Facts 저장, 공식 응답 `combination_restricted`, 옵션1그룹12값(블랙/네이비/아이보리 × 5/7/9/11호). 부분 조합 누락·숨김·판매/수량 제한 안내, apply token 없음, additions 없음, Options row0. ‘옵션 없음’으로 확정하지 않았다. 후보를 임의 확정하거나 평탄화하지 않았고 C의 이미지/AI/Planner/Section/PNG/JPG는 이번에 실행하지 않았다. 해당 후속 경계는 기존 restricted/canonical 옵션 mock 회귀로 확인한다. 원문 ‘원산지 수입산’과 ‘제조국 대한민국’의 관계도 이번 AI 검증으로 해소됐다고 주장하지 않는다.
8. **실제 full E2E**: A. 주요3개 수정 후 만든 새 Project의 첫 유효 AI 결과를 평가했다. 마지막 UI 슬롯 수 정합성 보완 후 production build에서 기존 후보/저장 상태를 다시 확인했다. 이 UI 계산 변경 때문에 동일 유료 AI 파이프라인을 반복하지 않았다. 재개 전후 같은 Project로 계속했으며 사전 저장된 AI 결과를 새 결과라고 표시하지 않았다.
9. **External API calls**: 공식 Dome getItemView A/B/C 각1회, 합3회. URL Import 논리 요청 각1회, 합3회. A 이미지 후보2개 preview 및 실제2개 import. URL redirect·이미지 로딩·signed 재발급·Supabase 읽기의 전체 HTTP hop 수는 계측하지 않았으므로 논리 요청 수와 혼동하지 않는다. 대량 탐색/자동 retry0.
10. **OpenAI calls**: 총16회 = extraction8 + Asset4 + Product1 + Validation1 + Planner1 + Section1. 새 결과를 고르기 위한 반복0, 자동 retry0, 개별 regeneration0. B/C 후속 OpenAI0.
11. **Extraction tile calls**: A860×12900 source를8타일,8성공/0실패로 처리. run1회, 후보24개(cap), 기본8개. tile2차 pass/후보별 호출 없음. 같은 source/policy/context의 cache 확인은 추가 AI0회였다.
12. **Import UX**: Preview-first, 가격만 제한된 공개 상품 import 성공·`price_restricted` 안내 유지. raw placeholder 후보와 확정 Facts를 구분하고 이미지 선택 후에만 저장한다. A2이미지 저장2/2 성공. 잘못된 URL/access wall/timeout/부분 이미지 실패는 기존 mock·error mapping 회귀이며 이 상품에서 모든 오류를 실제 발생시킨 것은 아니다.
13. **Fact UX**: supported/insufficient/conflict/needs_review의 사용자 안내 및 출처 분리 유지. A raw7개 spec 중 ‘별도표기’, ‘X / X’3개는 최종 Facts에서 제외하고 원문에는 보존. 최종 spec4개+상품명+카테고리=검증 대상6개. 상품 설명은 raw 참고이며 자동 Fact로 승격하지 않는다.
14. **Option UX**: A‘단일상품’1값, B‘아이보리 90’, ‘아이보리 95’, ‘코코아 90’, ‘코코아 95’, ‘브라운 90’, ‘브라운 95’6값. 색상/사이즈 분리0. 후보 조회→입력란 반영→명시 저장의 경계를 유지한다. C 제한은 token 발급/자동 apply 차단. stale/기존 변경 보존/서로 다른 version은 기존 Options/CAS tests로 확인.
15. **Option source refresh**: 원인은 Import Route Handler 성공 후 sibling Server Component props가 갱신되지 않는 경로였다. 성공 시 `router.refresh()`를 호출한다. A 최초 상품 저장 직후 F5 없이 버튼 활성화, 후보를 draft에 반영한 뒤 상품을 다시 저장해도 미저장 옵션이 유지됨을 실제 확인했다. 기존 Product ID key 유지, hard reload 없음. 회귀 증거는 이번 브라우저 시나리오이며 문자열 매칭용 가짜 unit test는 추가하지 않았다.
16. **Extraction UX**: 긴 원본에 ‘제품컷 추출’/저장 후 ‘후보 보기’, 분석 중 disabled와 실제 진행 문구. 결과24개/8구간·관련도%·기본 제외 사유·AI 재호출 버튼. 기존 결과 열기만으로 AI0. 저장 Derived에서는 재귀 추출 버튼이 없었다.
17. **Candidate selection**: 기본8개(2/7/8/9/11/15/16/24). 모두 해제하면 저장(0)disabled. 기본 제외 mixed5번을 수동 체크/해제 가능. 최종2/8/15번3개만 명시 저장. 저장 후 체크 disabled/저장됨, duplicate save3개 모두 existing·신규0. 최종 빌드에서 신규 선택5/남은 슬롯25를 확인했다.
18. **Duplicate Derived guard**: 이전 candidateId에는 role이 포함돼 같은 영역의 역할만 바뀌면 중복 파일이 가능했다. parent+source hash+rect로 기존 Asset을 재사용한다. 요청 내부에서도 저장 직후 registry에 추가한다. 신규 고유 rect 수로 서버·UI capacity를 동일 계산. 기존 파일·candidateId·분류·분석·provenance를 덮어쓰지 않고, 다른 parent/hash/rect는 재사용하지 않는다. 실제 동일 후보3개 재저장과 새 role/한 슬롯 mock 회귀 모두 통과.
19. **Asset Analysis UX**: 저장 직후 Derived3개는 unclassified/미분석, 자동 호출0. 사람이 대표+Derived3개를 선택 분석해4/5완료(긴 Source 미분석). #2 product99%/Hero91%, #8 detail98%/Hero42%, #15 product97%/Hero84%, 대표 product98%/Hero86%. 확대 사진의 낮은 대표 적합도와 전체 사진의 높은 적합도가 합리적이었다. ‘잘림’은 인물/근접을 구분하지 않는 기존 한계.
20. **Product Analysis UX**: 새1회, Facts/관찰/전략 분리. 상품명40매·60×60 표기를 활용하고, 시각 사진이 흡수·탈취·누수·안전성을 입증하지 않음을 명시했다. 상품명 ‘냄새잡는’을 새 검증된 성능 Fact로 확장하지 않았다.
21. **Fact Validation UX**: supported6/insufficient0/conflict0/needs_review0. S1 원본과 대상 값의 일치로 판단했으며 원본이 Facts와 같은 입력일 수 있다는 경고를 포함했다. 외부 진실 인증이나 독립 증명이 아니다. placeholder를 supported로 만든 사례0. 실패 시 이전 성공 보존은 mock 회귀.
22. **Planner stale UX**: 실제 A는 latest Plan이며 Final stalePlan=false. Fact/Options/Derived/Analysis/policy 변경과 재설계 실패·Sections 보존은 기존 Planner/visual-assets/options mock 회귀 통과. 보호 hash를 유지하기 위해 실제 QA Facts를 일부러 변경하지 않았다. B 옛 canonical replay의 stale 안내는 남은 정책/입력 차이로 별도 기록하고 최신 새 Plan으로 간주하지 않는다.
23. **Section Generation**: A 첫 호출 hero→imageText→specification→option4개. 반복 이미지0, 제목/문구 중복 detector0, meta-observation detector0, 근거 없는 성능/최고/보장0. 다만 아래 M3의 사람이 읽기에 건조한 문장은 존재한다. B replay5개(hero/imageText/detail/specification/option), raw long0. C 새 생성 미실행; 제한 옵션 출력 방지는 mock.
24. **Title relevance**: A first Hero 원문 상품명, imageText ‘패드 표면 근접 모습’, spec ‘등록 정보’, option ‘옵션 안내’. 세트/패키지/복수 구성 발명0. 수동 Editor 검증에서 imageText 제목을 ‘패드 표면’으로 명시 저장했다. 이후 quality warning0, manual review1. 첫 생성 원문은 별도 artifact로 보존했다.
25. **Editor save/dirty/concurrency**: 제목/여백(여유롭게→기본) 명시 저장, Section 이동·다른 페이지 이동 전 저장/버림/취소 안내, dirty 상태에서 AI 재생성 disabled. 두 번째 탭의 stale title 저장은 ‘다른 변경사항이 먼저 저장되었습니다. 최신 내용을 다시 불러와 주세요.’로 거부하고 draft 유지. 명시 버림→최신 불러오기 복구. 옵션 순서를 앞뒤로 이동·저장 후 원래 순서 복원, 새로고침 유지. dirty 상태의 browser reload 시도 후 draft가 유지됐지만 native confirm 자체는 도구에 노출되지 않아 별도 확인했다고 주장하지 않는다. beforeunload 등록도 코드 확인. 최종에는 임시 확인 문구를 버렸고 ‘패드 표면’만 저장 상태다.
26. **Section regeneration**: 이번 실제 호출0. 기존 strict type/evidence/ownership/stale/revision/CAS/candidate-first/preview/explicit apply/기존 성공 보존 회귀가 전체 suite에 포함된다. 실제 후보 UI 전체를 재실행했다는 주장은 하지 않는다. dirty일 때 재생성 차단은 실제 UI 확인.
27. **Hero quality**: A Derived `ad97844f-92bf-4e1e-879f-cb448f3af8c1` product, intrinsic822×823, rendered680×680.8125, ratio0.82725, lowResolution=false. 330px 대표보다 적합한 전체 제품컷, close-up을 Hero로 승격하지 않았다. B replay Derived635×792→560×698.453125, ratio0.88189, warning없음. 1.5배 cap 유지. C Hero미생성.
28. **Crop quality**: A3개 저장822×823,434×435,434×445. #8 sourceRect434×445→output434×435로 기존 bounded trim 적용. 제품 재생성/upscale/배경 제거 없음, 원본 hash 일치. #2 원본의 회색·초록 프레임은 남아 M4로 기록. 긴 이미지를 통째로 Final에 넣지 않았다.
29. **Specification**: A5행(카테고리+정확한4spec), Final rows와 Plan supported Fact 값 exact, 옵션과도 별도. raw placeholder0개 출력. B replay의 canonical spec도 현재 Renderer로 유지. 2~3행/6행 이상/긴 value는 기존 Renderer/quality mock·fixture 회귀 범위이며 새 실제 C 스펙 시각 QA는 아님.
30. **Options Renderer**: A1그룹1값 compact inline, B1그룹6값 wrap 정보 칩. A canonical groups/UUID/label snapshot exact. 가격/재고/구매 selector 없음. C 후보는 confirmed row/Section/Final에 유입되지 않았고 미확인을 빈 확정 옵션으로 저장하지 않았다.
31. **Notice**: A/B evidence 없는 보일러플레이트 Notice0. 사이트 배송/반품 문구를 생성하지 않았다. Notice type의 일반 렌더링은 기존 fixture 회귀.
32. **Visual layout**: A4 Sections,2서로 다른 사진,Final article860×1932.9375 CSS px. Hero 제목2줄, 제품사진→근접·텍스트→5행표→단일옵션 흐름. contain2개, 가로overflow0, 텍스트 가로 clipping0, surface controls0. B5 Sections/3사진/860×2744. 관리화면 요소·검토 경고는 article 밖. 원본 프레임·건조한 문구·sparse 여백은 backlog, 새로운 empty Section 없음.
33. **PNG result**: A860×1933,613,042B. B canonical replay860×2744,1,009,246B. 첫/마지막 Section·옵션1/6·이미지2/3 확인. A 실제 UI에서 PNG 다운로드 double-click→disabled→다운로드 시작 안내도 확인. C미생성.
34. **JPG result**: A860×1933,180,550B. B replay860×2744,278,564B. 디코더·실제 파일 검증. PNG와 같은 배치이며 압축에 따른 평균 RGB 차이는 A0.98854/B0.94120(0~255 scale), 픽셀 동일을 주장하지 않는다.
35. **Export repeatability**: A/B 각각PNG2회, 각dimensions·bytes 동일, PNG binary equality도 true. AI0/DB write0. 파일명 timestamp는 캡처 article에 들어가지 않는다. JPG와PNG dimensions 동일, 실제시각 검토와 DOM 확인을 병행했다.
36. **Performance timings**: DB attempt의 startedAt→finishedAt 기준 AExtraction56,555ms,Product13,892ms,Validation4,182ms,Planner13,002ms,Section5,255ms. AExport service wall-clock PNG2,523ms/JPG4,353ms/repeat3,535ms. BImport689ms/Option443ms, CImport586ms/Option443ms. B replay PNG1,690ms/JPG1,264ms/repeat1,527ms. A Import/Option과 Asset4개 개별 소요 시간은 시작 timestamp 미수집으로 N/A. 재호출해 측정값을 꾸미지 않았다. 짧은 QA측정이며 일반 SLA/10~20분 달성률이 아니다.
37. **AI token observations**: 현재 persisted response projection에 usage 없음. token/cost N/A. 과거 응답/모델 가격을 추정하거나 새 billing integration을 추가하지 않았다. 호출16회만 확정 계수했다.
38. **Duplicate request protection**: AExtraction/Asset1/Product/Validation/Planner/Section/Export를 실제 빠른 두 클릭으로 확인했고 각 loading disabled/단일 완료를 관찰. URL/Option Import/개별 regeneration의 actual double-click은 별도 추가 호출하지 않고 기존 synchronous ref/state guard·server lease/CAS와 mock을 검토했다. 분산 job 보장으로 확대하지 않는다.
39. **Loading/empty/error states**: 신규 A에서 Product/Image/Option/Plan/Sections 빈 상태 안내와 후속 행동, 분석/생성 중 실제 loading·disabled 확인. 가짜 percentage 없음. 충돌은 복구 가능한 한국어 안내, server/provider 원문 없음. Import/Export missing browser·timeout·too tall·invalid origin 등은 기존 safe error mock. DB/provider 실패를 실제 운영 데이터에 유발하지 않았다. 최신 조회 중 ‘저장 중…’ 문구는 L2.
40. **Accessibility**: desktop1280px·375px Editor 확인.375px document360px, 가로넘침0, 미리보기/섹션/속성 전환 가능. textbox에서 Tab→본문textarea 포커스 outline solid, labels·checkbox·disabled·image alt 존재. 정식 WCAG/스크린리더 감사는 아님. 추출 checkbox 수동 on/off와0개 disabled도 실제 확인.
41. **Security regression**: server-only SDK/Sharp·3종키, Product/Asset 소속, signed URL 임시 사용, SSRF/DNS/private-IP/redirect/timeout/10MiB/40MP/최대30Asset/재귀Derived제한 유지. fixed API endpoint/no redirect 및 octet-stream signature 정책 미변경. 새 remote endpoint·HTMLcrawler·OpenAI image generation 없음. 이번 source1.98MB는 기존10MiB 이내.
42. **DB consistency**: AProject1/Product1/Facts1/Options1/Page1/Sections4/Assets5. BProduct/Facts/Options 각1,Page/Assets0. CProduct/Facts 각1,Options/Page/Assets0. 페이지/옵션 중복0, Derived(parent/hash/rect)중복0, A private objects5=Asset5,orphan0. 원본 bytes hash와 모든5파일 byte length 확인.
43. **Existing user data protection**: 시작 시7테이블14행의id+SHA-256을 baseline으로 저장하고 반복 비교 일치. A/B/C 확정 후 Product name/category/description/raw/sourceURL, Facts/source_snapshot,Options 전체row hash를 보호해 AI/Editor/Export 이후 동일함을 확인했다. AI 결과·Plan·Section은 이 QA Project에만 저장했다.
44. **QA cleanup**: manifest의3개 명시 ID이면서 QA-TASK032-prefix인 Project·자식 DB행과 A의 private Storage5개를 제거했다. 각 상품 prefix 잔여0, 최종 DB7테이블 baseline exact equal(기존14행) 확인. 미확인 prefix Project 발견 시 중단하는 guard와 ID+name 조건 삭제를 사용했다. broad delete 없음. 로컬 시각 증거는 유지한다.
45. **Tests**: 신규3개 service 회귀—role만 변경된 동일pixels 기존Asset 재사용/메타 불변; 동일rect2역할+남은1slot 성공; 다른parent/hash/rect 재사용금지. 기존 SSRF/security/stale/lease/CAS/실패보존/canonical purity/Export 경계 유지. source refresh·Editor conflict·repeatability는 실제 QA 증거도 기록했다.
46. **Total test count**: 최종849/849,fail/cancel/skip0,64,514.7409ms. 기존846개 유지+신규3개. 자동 테스트 유료API0. 테스트 개수만 늘리는 구현 문자열 복제 테스트 없음.
47. **Typecheck/lint/build**: `npx.cmd next typegen`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `git diff --check` 통과. lint warning0. 기존 Node MODULE_TYPELESS_PACKAGE_JSON/Windows Git LF→CRLF 안내를 관련 없는 package 변경으로 숨기지 않았다.
48. **Secret scan**: production client JS/map26개,src/docs/tests,artifact text의 실제 OpenAI/Supabase service-role/Dome 키 exact-match 모두0. client provider marker0, inspection server-only 유지. env 값/전체 signed URL/raw SDK exception을 리포트에 출력하지 않았다.
49. **BLOCKER count**: 관찰한 범위0. C 미실행 후속/토큰·일부 시간 미측정은 검증 한계로 공개한다.
50. **HIGH count**: 관찰한 A first result/B replay/C 차단 범위0. 제품 일반화나 공개배포 안전성의 보증은 아니다.
51. **MEDIUM count**: 4(M1인물vs제품잘림, M2부분타일복구, M3건조한카피, M4원본장식경계). M1/M2는 이월, M3는A/B구체사례, M4는A사진프레임. 재현/수정모듈/데이터영향/테스트경계는 RELEASE_BACKLOG에 기록했다.
52. **LOW count**: 2(L1sparse여백, L2읽기refresh중저장문구). 기능·데이터 손상 없음. 미세 polish를 끝없이 반복하지 않았다.
53. **Fixed issues**: 옵션source 갱신 지연(M),role변경 동일rect 중복과capacity(UI/server)불일치(M),Images이후단계미구현 안내(L). 큰 구조·보안 변경 없음. 같은 입력에서 과거 중복row를 강제정리하지 않는다.
54. **Deferred issues**: M4/L2와 이전 M1~3/L1. C 후속 full E2E, 개별regeneration 실제새후보, 다른상품 일반화는 미검증 또는 mock/기존QA로 한정한다. 재호출 선별 없이 첫 결과의 한계를 보고했다.
55. **Release backlog**: `docs/RELEASE_BACKLOG.md`에 Before public deployment/Post-MVP/Nice-to-have 분리. scope밖 기능을 이번에 만들지 않는다.
56. **Full smoke result**: A 새Project의 Import→저장→공식옵션→제품컷→AI→Validation→Planner→Section→Editor read/save→Renderer→PNG/JPG PASS. session interruption은 데이터가 저장된 단계에서 재개했다. 최종 UIcapacity 보완은 기존 결과 재사용 화면과 전체mock/build로 확인했다.
57. **사용자 관점 A~F**: A) 단계 navigation·다음 행동·loading으로 진행 가능하나 Fact/Planner 용어 학습과 데스크톱 우선 전제는 남는다. B) 후보/출처/Inspector/수동 문구 경고로 검토·수정 가능. C) 오류·stale·CAS에서 이전 성공을 보존하며 실제 CAS와 mock provider failure를 확인했다. D) 긴 Source에서 고른 실제 Derived2개로 새 페이지를 생성했다. E) 확정 Fact/Option의 보호 hash와 canonical exact 검사를 통과했다. F)860px PNG/JPG를 후처리 입력으로 사용할 수 있으나 게시 전 사람이 검토해야 한다. 자동 무검토 게시를 보장하지 않는다.
58. **v0.1.0 Release Candidate verdict**: **PASS — local/internal single-user MVP**. B0/H0, A full smoke 성공,849 tests·필수 검사 통과, secret0, 기존14행 불변, QA DB/Storage 정리 완료. B는 replay 포함/C는 제한 옵션까지라는 범위를 유지한다. 공개 SaaS 출시 승인이 아니다.
59. **Public SaaS blockers**: Auth,owner_id,user-specific RLS,Storage user policy 미구현. 인터넷 공개 차단. 이 구조적 전제를 이번 TASK의 내부 B0/H0와 혼동하지 않는다.
60. **Recommended next step**: 로컬 결과물의 판매자 검토 후 M3카피/M4경계 처리 우선순위를 결정한다. 공개 배포가 목표라면 먼저 Auth/소유권/RLS/Storage 격리 TASK를 수행한다. 내부 `v0.1.0` tag를 추천할 수 있으나 commit/merge/tag는 별도 명시 승인 전 실행하지 않는다.

## 검증 증거와 재현 경계

증거 디렉터리: `C:/Users/alswn/Documents/Codex/2026-09-09/c-projects-detailforge/artifacts/TASK-032/`.

- `case-A/B/C.json`: 필요한 domain projection. 전체 공식 API 응답·HTML·키·signed URL·private path를 보존하지 않는다.
- `first-generation-A.json`: Editor 수정 전 첫 AI Section. `quality-A/B.json`, `verification.json`: canonical exactness/이미지·타이밍·형식 비교.
- `import-B/C.json`: 실제 Import와 공식 후보의 최소 projection. token/판매자연락처제외.
- `A.png`, `A.jpg`, `A-repeat.png`, `B.png`, `B.jpg`, `B-repeat.png`: 실제 production Export. B만 local replay.
- `candidates-after.png`, `reuse.json`, `replay.json`: 추출·기존결과재사용·fixture경계.
- `tests-final.txt`, `typegen.txt`, `typecheck.txt`, `lint.txt`, `build.txt`, `secret-check.json`, `cleanup.json`: 검사증거.
- helper는 QA명시범위만 변경한다. 원격 B/C에는 과거 이미지/Plan/Section을 복제하지 않는다. 로컬 B replay는 read-only JSON과 원본의 실제rect crop만 사용하고 write405/외부network차단한다.

## 수동 회귀 절차

1. 빈 QA Project에서 URL Import 후 Product 저장. 새로고침 없이 공식 옵션 불러오기 enabled 확인. 후보 반영만 한 상태에서 Product 재저장, draft 보존 확인, 별도 Options 저장.
2. Images Source 후보 보기에서 저장된3개 disabled, 남은 신규 고유 영역5/슬롯25. 저장0개 disabled, 기본 false 수동 선택 허용, 다른 AI 분석 자동 실행 없음.
3. Editor 두 탭의 같은 revision으로 시작. 한 탭 문구·style 저장 후 다른 탭 저장→friendly conflict/draft 보존. 최신 불러오기→명시 버림으로 복구. reorder 저장/복원/refresh. 미저장 Section/route 이동의 취소/저장/버림 확인.
4. Final article860px/contain/2이미지/5spec/1옵션 확인. PNG/JPG/PNG 반복, 관리 UI·경고 미포함.375px 관리 UI 패널·키보드 포커스 확인.
5. manifest scope로 Storage→Project 순서로 정리, DB7테이블 baseline exact 일치와 QA private prefix 잔여0 확인.

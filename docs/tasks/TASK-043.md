# TASK-043 — Observation-Narration Guard Patch & Actual AI Revalidation

2026-09-22, `C:\Projects\detailforge`, `feat/copy-role-dedup`. TASK-041/042 미커밋 변경을 보존하고 H1만 보완했다. **H1 resolved by TASK-043, M3 RESOLVED. BLOCKER0/HIGH0, MEDIUM2(M1/M4), LOW1(L1)**. 이는 고정 corpus와 이번 실제 상품의 명시된 gate 통과이며 모든 한국어 카피의 의미 판정을 보장하는 것은 아니다.

## 원인과 최소 변경

TASK-042 첫 gallery intro `전면과 등 쪽 착용 실루엣, 목둘레·앞여밈 부분의 외관을 담았습니다.`는 기존 `detectMetaObservationCopy`의 media/inspection·보입니다·wearing scene·camera 구문 어디에도 맞지 않았다. 사진이라는 단어 없이 외관을 수록했다는 보고를 해도 통과한 누락이다.

- `src/features/page-quality/commerce.ts`의 기존 detector만 확장했다. 상품 ID나 H1 문장 전체를 비교하지 않는다. 새 패턴 코드는 `capture_narration`, 기존 `meta_observation` 오류/`copy_quality` 응답/`meta_observation_copy` warning 계통을 그대로 사용한다.
- 외관/모습/실루엣/디테일/장면/구도/전면/후면 + 목적격 조사 + 제한된0~2개 부사/매체 위치 + 담았습니다/담아냈습니다/촬영했습니다/포착했습니다 또는 담은/담아낸 사진·이미지·컷·화면·모습 등의 구조를 검사한다. 종결/구두점 경계를 요구한다. H1처럼 매체가 생략된 짧은 capture 문장도 검출한다.
- 보여줍니다/나타납니다는 단독으로 금지하지 않는다. 같은 문장·절 안의 사진/이미지/컷/화면과 시각 대상 연결이 있어야 하며 사이 길이를32문자로 제한한다. 문장/절 간 단어를 이어 붙여 추론하지 않는다.
- 기존 촬영한/담은 구도 패턴은 `입니다/이다` 종결도 읽도록 보완했다. `근접 촬영한 구도입니다`가 기존 camera family로 거부된다.
- “담” substring blacklist, 원문 rewrite, 새로운 품질 service/AI pass/embedding, grounding 대체는 없다. 정상 실루엣·디자인 명사구, 소지품 수납/포장 뜻의 담다, 부정/다른 문장 경계는 negative로 보호한다. detector allow는 Fact 확인을 대신하지 않는다.
- `src/features/page-quality/policy.ts`의 기존 warning 한국어만 `사진에 무엇이 담겼는지를 설명하는 문장보다 제품 특징을 직접 설명해 주세요.`로 갱신했다. UI 구조/Final/Export 코드는 바꾸지 않았다.
- **COMMERCE_COPY_VERSION3와 prompt/Planner 입력을 유지**했다. 기존 “이미지 분석 보고체 금지” 계약의 guard 누락을 보완하는 패치이며 Plan 배분/schema/입력 의미는 바꾸지 않았다. 전체 생성 및 후보 생성·명시 apply에서 현재 guard를 다시 실행한다. 패치 전 유효하게 서명됐다고 가정한 H1 후보도 apply에서 `copy_quality`로 거부되는 회귀를 추가해 version 유지로 검증 우회가 생기지 않음을 확인했다. 기존 Planner가 실제로 stale=false여서 재호출하지 않았다.

## Fixtures / 회귀

- `tests/fixtures/v0.2/capture-narration.mjs`: H1 원문 포함 capture reject19, allow19, 기존 관찰/촬영 family reject6. H1 외 문장은 synthetic이며 상품의 사실이 아니다.
- allow19에는 요청된 정상 명사구7개, 수납/40매 포장2개, 둥근 목둘레/앞면 포켓/보아 소재3개, 부정·장식 패턴·매체 없는 제품 서술·절 분리·소지품 담기7개가 있다. 소재/수량/사용성의 supported 여부는 기존 grounding 책임이다.
- `tests/fixtures/v0.2/task042-first-sections.json`: TASK-042의 첫 canonical4개를 meta/provider envelope 없이 보존했다. 실제 상품명/title/body/스펙6행/confirmed option6개/IDs·순서·version을 담았다. replay에서 검출되는 commerce text는 H1 body1개뿐이며 다른 title·스펙·옵션·gallery 구조는 그대로다.
- `tests/capture-narration.test.mjs`: 신규51개. 위44문장과 실제 replay, title/원문 데이터 경계, NFKC/구두점/절/부정, 한국어 warning/Renderer 분리, 전체 생성 실패 보존, 수동 저장 및 재생성 거부, 기존 서명 후보 apply 재검증7개.
- H1 AI 전체 생성/개별 regeneration은 mock provider1회 후 reject, 이전 rows·Product/Facts/Assets/Plan/Options 보존, 자동 retry0. 수동 save는 정확한 원문 그대로 성공하고 warning만 추가한다.
- 기존 TASK-037 fixture와 ID/expected/currentBaseline은 변경하지 않았다. **22/22 PASS, allow9/warning7/reject6, C6/C10/C19 warning·C13 reject**. 기존22+focused44문장 분류가 모두 기대값과 일치하며 allow false positive0이다.
- 집중123/123 PASS, 전체 **1142/1142 PASS**(기존1091+신규51), 실패/취소/skip/todo0, 전체60.59초. TASK-040 retry/review와 기존 V-only/숫자/원문 스펙 grounding도 계속 PASS.

## 실제 AI — 첫 응답1회만 평가

TASK-042 upstream 및 최초 canonical snapshot을 `QA-TASK043-67695797` loopback 메모리 DB/Storage fixture로 복제했다. project ID `c67e6d83-9e2b-4a20-adf3-0e8aad0f534f`는 격리 메모리 안에서만 사용했다. 원격 DB/Storage 호출0이며 기존 사용자 데이터를 수정하지 않았다. 테스트는 mock, 이 절의1회만 실제 OpenAI다.

- preflight: Planner stale=false, planReady=true, prerequisite=ready, copyVersion3.
- 실제 **Section Engine1 / Planner0 / regeneration0**, model `gpt-5.6-terra`, HTTP200, accepted. 자동 retry/추가 생성0. Asset Analysis/Product Analysis/Extraction/도매 API0.
- usage: 입력7,153, 출력463, 총7,616 tokens. 금액은 추정하지 않는다. raw provider 전체 응답/요청/prompt를 저장하지 않고 파싱한 domain output과 usage만 로컬 보존했다.
- 이번 실제 revalidation은 **Case B(정상 commerce copy accepted)**다. 실제 H1 출력 reject가 발생한 Case A라고 보고하지 않는다. H1 및 variants reject는 실제 TASK-042 텍스트 replay와 mock service 회귀로 확인했다.
- regeneration의 provider/service/grounding 경로가 같은 detector를 사용하고 신규 reject/apply 회귀가 PASS하여 유료 재생성은 추가하지 않았다. TASK-042 실제 candidate-first/명시 apply 기록은 보존하지만 TASK-043에서 다시 실제 호출한 것으로 세지 않는다.

첫 canonical4개:

1. **hero**: headline=`여성 양털 후리스 뽀글이 조끼 퍼 베스트 수면조끼`, subheadline=null, highlights0. F1, asset `344d9a39-1181-46c7-9480-3410fb00755d`, intent=identity. 확인된 원래 상품명이며 새 재질 claim이 아니다.
2. **gallery**: title=`착용 및 디테일 외관`, intro=`앞면 여밈과 양쪽 포켓, 등 쪽 실루엣, 목둘레와 앞여밈 일부의 외관 구성.`. V1/V2/V3, assets `6486cb5b-aeb6-4a52-bad1-42ced34f11c5`, `785e8ad6-e2f2-4b6a-a929-9b6aac377091`, `927a9163-bcc2-4695-8abb-bca309b1b2bb`, intent=visual_description. 제목에 없는 부위 정보를 본문이 추가하며 촬영/관찰을 보고하는 동사가 없다.
3. **specification**: title=`상품 및 제조 정보`, F3~F8, assets0, intent=specification. 카테고리=`의류/언더웨어 > 여성의류 > 조끼`, 원산지=`수입산 / 아시아 / 중국`, 제조사=`디에이치트레이딩`, 품명 및 모델명=`컬리 집업 베스트`, 제조국 또는 원산지=`중국`, 상품번호=`67695797`. label/value6행 exact.
4. **option**: title=`옵션 안내`, 서버 confirmed snapshot, F/V/asset0, intent=selection_information. `아이보리 90`, `아이보리 95`, `코코아 90`, `코코아 95`, `브라운 90`, `브라운 95`. group1/value6/UUID/order/version1 exact.

자동+human 검토: **meta0, camera0, capture narration0, title/body problematic redundancy0, cross-section problematic repetition0, unsupported V-only0**. exact/normalized/Fact marketing/visual-message도0, UI quality warning0. Hero 정체성·gallery 외관·canonical 표/선택값의 역할을 구분했다. 이번 출력에 없는 imageText/detail/feature 조합이나 임의의 동의어·한국어 구문 전체까지 실제로 검증했다는 뜻은 아니다.

## Browser / Final / Export

- 실제 Next16.3.4 production app을 desktop1440×1000에서 검증했다. Editor gallery를 선택하고 H1 원문을 소개 필드에 직접 넣어 저장했다. `저장되었습니다`, 원문 동일, `검토1건`과 새 한국어 warning을 확인했다. 자동 rewrite/저장 차단/raw enum 노출0.
- 수동 H1 상태의 Final canonical `article[data-detail-render-surface="1"]`: width860, warning0, controls0, missing images0, **사람이 입력한 H1 본문은 그대로**였다. 이는 human agency 보존이며 AI guard가 manual prose까지 삭제한다는 뜻이 아니다. Review shell 경고는 article 밖에 있다.
- QA manual edit 후 최초 새 AI canonical로 정확히 복구했다. 그 상태의 Final article860×3057, review warning0, capture narration0, controls0, debug label0, 이미지4/누락0, 가로 overflow0, 스펙·옵션 exact.
- 실제 Export route에서 PNG1/JPG1, 각각 HTTP200. 기존 Chromium article capture를 사용했다. 둘 다 **860×3057**, 같은 layout, H1 보고체/내부 warning/Editor UI0, 모든 제품 사진·표·옵션 표시를 시각 확인했다. PNG1,493,664B, JPG357,016B. 수동 H1 상태를 export하지 않았다.
- `editor-warning.png`, `final-browser.png`, `final.png`, `final.jpg` 및 DOM/수동 snapshot을 gitignored `artifacts/TASK-043/`에 보존했다.

## 데이터 보호 / 최종 검사

Products/Facts/Options/Assets는 TASK-042 입력과 deep-equal. 원래 TASK-030 evidence/source 이미지와 TASK-035 snapshot hash도 그대로다. TASK-042 snapshot 불변. 원격 DB/Storage mutation0. QA manual 상태를 첫 새 AI 상태로 복구한 뒤 메모리 DB·관리 endpoint·Next 서버·브라우저 탭을 종료하고 임시 viewport를 해제했다. 3043/4343/53169 포트 닫힘 확인. 원본 사용자 파일 초기화·삭제 없음.

`npx.cmd next typegen`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs`, `git diff --check` 모두 PASS. source/docs/tests 및 untracked fixtures, `.next/static` bundle, TASK-043 text/log/domain artifacts에서 실제 설정 secret3개와 key/signed URL 패턴 발견0. 키 값은 출력하지 않았다. migration/dependency0, package0.1.1, extraction retry 코드 변경0. 기존 TASK-041/042 diff를 보존했다.

## 완료 보고 — 56개 항목

1. **TASK 목적**: H1 bounded guard 보완 및 첫 실제 AI 재검증.
2. **branch**: `feat/copy-role-dedup` 유지.
3. **TASK-042 H1**: ‘외관을 담았습니다’ accepted 이력을 보존하고 resolved by TASK-043로 연결.
4. **H1 root cause**: 암묵적 사진 수록/보고 구문의 미검출.
5. **detector 변경 위치**: 기존 `page-quality/commerce.ts`의 `detectMetaObservationCopy`.
6. **reason code**: `capture_narration` → 기존 meta_observation/copy_quality 및 한국어 warning.
7. **H1 actual phrase 결과**: AI reject, manual warning only PASS.
8. **유사 phrase 결과**: H1 포함19개 reject PASS, 기존 family6개 PASS.
9. **정상 false-positive corpus 수**: allow19.
10. **false-positive count**: focused allow0, 기존 allow0, 실제 정상 output reject0.
11. **기존 C6 결과**: warning PASS.
12. **C10 결과**: warning PASS.
13. **C13 결과**: reject PASS.
14. **C19 결과**: warning PASS.
15. **전체 M3 corpus**: 기존22/22 및 focused44/44 문장 분류 PASS, 기존 ID/expected 유지.
16. **AI 전체 생성 정책**: 현재 guard로 reject, 이전 canonical 보존, 자동 retry0.
17. **regeneration 정책**: 생성 및 apply 재검증, H1 reject/기존 Section 보존.
18. **manual edit 정책**: 저장 허용, warning only, 자동 rewrite0.
19. **Browser warning UX**: 실제 저장 성공·원문·한국어 warning 확인 PASS.
20. **Final Renderer warning count**: canonical article0; Review shell은 별도.
21. **실제 OpenAI 호출**: 총1, Planner0.
22. **Section Engine 호출**: 1.
23. **regeneration 호출**: 실제0, 신규 mock reject/apply 회귀 PASS.
24. **QA 상품**: 67695797, 격리 loopback fixture.
25. **실제 Section 구조**: hero→gallery→specification→option, 총4.
26. **실제 title 목록**: 원래 상품명 headline / 착용 및 디테일 외관 / 상품 및 제조 정보 / 옵션 안내.
27. **meta-observation count**: accepted 새 output0.
28. **camera-framing count**: 0.
29. **capture-narration count**: 0.
30. **title/body redundancy count**: problematic0.
31. **cross-section repetition count**: problematic0.
32. **unsupported V-only count**: 0.
33. **AI accepted/rejected**: 실제 accepted1/rejected0, Case B PASS. mock/replay H1 reject와 구분.
34. **Specification exactness**: 원문6행 exact.
35. **Options exactness**: 6값/UUID/order/version exact.
36. **PNG/JPG 결과**: 각1회 HTTP200, 둘 다860×3057, warning/H1/누락 이미지0.
37. **생성 파일**: 이 문서, focused test1개·fixture2개, ignored QA helper/artifacts.
38. **수정 파일**: commerce.ts/policy.ts 및 TASK-042/계약/roadmap/backlog/tasks index5개 문서.
39. **migration**: 0.
40. **dependency**: 0, package0.1.1 유지.
41. **tests**: 신규51, 집중123 PASS, 전체 회귀 PASS.
42. **total test count**: 1142/1142, fail/cancel/skip/todo0.
43. **typegen**: PASS.
44. **typecheck**: PASS.
45. **lint**: PASS.
46. **build**: PASS, 기본 production build.
47. **diff check**: PASS.
48. **secret scan**: 실제 설정 secret3개/key/signed URL 패턴 발견0.
49. **BLOCKER**: 0.
50. **HIGH**: 0, H1 종료.
51. **MEDIUM**: 3→2, M1/M4.
52. **LOW**: 1, L1.
53. **M3 최종 상태**: RESOLVED, 이 문서의 corpus/실제 QA 범위.
54. **M2 regression**: 전체 suite PASS, extraction retry 코드 변경0, RESOLVED 유지.
55. **다음 권장 TASK**: 선택 TASK-044 L1 bounded spacing 또는 TASK-045 release 검증. M1/M4는 유지하며 실제 release/commit/merge/tag는 별도 요청.
56. **git diff summary**: TASK-041/042 미커밋 변경 보존. TASK-043 추가분은 production2파일 최소 수정, test1+fixture2+문서1 신규, 기존 문서5개 갱신. staging/commit/main merge/tag/reset/restore/clean 없음.

검증 로그와 파싱한 최초 output: `artifacts/TASK-043/api-ledger.json`, `first-section-output.json`, `latest-tables.json`, `quality.json`, `editor-dom.txt`, `manual-surface.json`, `final-dom.json`, `audit.json`, `focused-tests.log`, `tests.log`, `typegen.log`, `typecheck.log`, `lint.log`, `build.log`, `diff-check.log`. provider raw envelope는 보관하지 않는다.

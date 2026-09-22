# TASK-042 — M3 Actual AI Output & Browser Validation

## 후속 판정 — H1 resolved by TASK-043

이 문서의 첫 출력·H1 발견·당시 NEEDS_WORK 판정은 보존한다. [TASK-043](TASK-043.md)에서 기존 detector의 bounded capture narration 패턴을 보완했고 H1/variants·allow19·기존22개 및 전체1142 tests가 PASS했다. 실제 Section1회(Planner/regen0)의 첫 accepted output에서 보고체·문제 반복·unsupported V-only0, Browser manual warning/Final·PNG/JPG purity도 확인했다. **현재 H1 종료, M3 RESOLVED, BLOCKER0/HIGH0, MEDIUM2(M1/M4)/LOW1(L1)**. 아래 수치와 이력은 TASK-042 당시 결과다.

2026-09-22, `C:\Projects\detailforge`, `feat/copy-role-dedup`. 사용자 지정 범위는 TASK-041의 실제 QA다. 기존 roadmap의 TASK-042 검토 UX 계획을 이 범위로 대체한다. TASK-041 미커밋 변경을 그대로 보존했으며 production 코드·prompt·threshold를 이번 QA에서 변경하지 않았다. commit/main merge/tag 없음.

**판정: QA 실행 완료, M3 NEEDS_WORK.** 첫 유효 생성의 title/body·섹션 간 문제 반복은 0이지만 gallery의 “외관을 담았습니다”가 관찰 보고체로 남는다. deterministic meta 검출은 0, human QA는 1이다. 이를 M3에 연결한 HIGH finding H1으로 기록하고 RESOLVED 처리하지 않는다. 최초 결과를 재생성 후보로 바꾸어 품질 판정하지 않았다.

## 실행 경계와 근거

- `git branch --show-current`와 `git status`로 지정 브랜치와 TASK-041 변경을 확인했다. AGENTS/CLAUDE, 계약/roadmap/backlog/TASK-037/041, 변경 diff, 설치된 Next.js16.3.4 문서와 실제 서비스·Renderer·Export 경계를 읽었다.
- 상품67695797의 TASK-030 원본 사진/실제 evidence와 TASK-035 upstream snapshot을 **격리된 loopback 메모리 DB/Storage fixture**에 복제했다. QA 이름은 `QA-TASK042-67695797`, project ID `c67e6d83-9e2b-4a20-adf3-0e8aad0f534f`. UUID를 재사용했지만 원격 사용자 DB에 해당 row를 만들거나 수정하지 않았다.
- Planner 정책v2→현재v3로 stale여서 Planner1회, Section Engine1회, 실제 Editor의 개별 regeneration1회. 모두 `gpt-5.6-terra`, HTTP200. Asset/Product Analysis·Extraction·도매 API 재호출0, 자동 재시도0. 총3회 이후 relay가 추가 실제 호출을 막았다.
- 사용 토큰: Planner 입력5,636/출력1,149/총6,785; Section 입력7,153/출력460/총7,613; regeneration 입력2,799/출력134/총2,933. provider usage 값이며 비용 금액은 추정하지 않는다.
- 최초 준비 중 QA helper의 변수 초기화 오류1회는 외부 호출0에서 발생했다. helper만 수정했고 `preflight-zero-calls.json`에 남겼다. 유료 호출을 반복하거나 실패한 모델 출력을 숨긴 사례가 아니다.
- provider 전체 response/request/prompt를 파일에 기록하지 않았다. 파싱한 domain output, canonical snapshot, 호출 수/usage, DOM 측정, 화면 및 검사 로그만 로컬 gitignored artifact로 저장했다. `first-section-output.json`은 서버가 붙인 옵션을 제외한 AI domain output, `quality.json`은 옵션을 포함한 canonical4개다.
- 실제 provider 호출은 기존 구현을 사용했다. 브라우저는 실제 Next production app, same-origin route, 후보 서명/명시 적용/수동 저장 경로를 사용했다. 외부 DB/Storage 대신 loopback fixture라는 한계가 있다.

## 첫 유효 canonical output — 섹션별 기록

### 1. hero / `hero`

- title: 해당 없음. headline: `여성 양털 후리스 뽀글이 조끼 퍼 베스트 수면조끼`.
- body/subheadline: null. item/bullet: highlights0.
- Fact IDs / Evidence IDs: F1 / F1. Asset IDs: `344d9a39-1181-46c7-9480-3410fb00755d`.
- copy intent: identity. 원래 확인된 상품명 그대로다. 상품명 속 재질 관련 단어를 새 V-only 재질 주장으로 생성한 것이 아니다.

### 2. gallery / `visual-gallery`

- title: `착용 및 목둘레 디테일`. headline: 해당 없음.
- body/intro: `전면과 등 쪽 착용 실루엣, 목둘레·앞여밈 부분의 외관을 담았습니다.`
- item/bullet: 없음. 전면 착용/후면 착용/목둘레 상세 사진3개.
- Fact IDs: 없음. Evidence IDs: V1, V2, V3.
- Asset IDs: `6486cb5b-aeb6-4a52-bad1-42ced34f11c5`, `785e8ad6-e2f2-4b6a-a929-9b6aac377091`, `927a9163-bcc2-4695-8abb-bca309b1b2bb`.
- copy intent: visual_description. 제목보다 전면·등·앞여밈 정보를 추가하므로 명확한 title/body redundancy로 세지 않았다. 다만 마지막 “외관을 담았습니다”는 제품 설명을 사진 수록에 대한 보고로 바꾸므로 human meta-observation1(H1)이다.

### 3. specification / `specification`

- title: `상품 및 제조 정보`. headline/body: 해당 없음. copy intent: specification.
- Fact IDs / Evidence IDs: F3,F4,F5,F6,F7,F8 / 동일. Asset IDs: 없음.
- rows6: 카테고리=`의류/언더웨어 > 여성의류 > 조끼`(F3); 원산지=`수입산 / 아시아 / 중국`(F4); 제조사=`디에이치트레이딩`(F5); 품명 및 모델명=`컬리 집업 베스트`(F6); 제조국 또는 원산지=`중국`(F7); 상품번호=`67695797`(F8).
- 모든 label/value를 supported Fact snapshot과 대조했다. 카테고리·원산지 등 canonical 표 값의 재등장은 마케팅 중복으로 세지 않는다.

### 4. option / `options`

- title: `옵션 안내`. headline/body: 해당 없음. copy intent: selection_information.
- Fact IDs / Evidence IDs / Asset IDs: 모두 없음. 서버가 confirmed options snapshot으로 구성한다.
- group1 `옵션`, values6: `아이보리 90`, `아이보리 95`, `코코아 90`, `코코아 95`, `브라운 90`, `브라운 95`.
- row/version1, group/value UUID, label, 순서가 원본 confirmed groups와 deep-equal. AI가 옵션을 재작성하지 않았다.

## 자동 판정과 human QA

- 최초 output exact0, normalized0, Fact marketing reuse0, title/body redundancy0, cross-section purpose repetition0, visual-message repetition0. production helper와 human QA가 이6범주에서는 일치했다.
- Hero는 정체성, gallery는 서로 다른 외관, specification은 원문 사실, option은 확정 선택값이다. imageText/detail/feature는 이번 첫 출력에 없어 해당 실제 조합을 모두 검증했다고 일반화하지 않는다.
- 자동 meta0/camera0, human meta1/camera0. H1은 gallery intro의 위 표현이다. 단어 “외관” 자체나 정상적인 외형 명사구가 문제라는 뜻이 아니다. 미검출 이유는 현재 bounded scene-report/camera 패턴이 “외관을 담았습니다”를 포함하지 않기 때문이다.
- unsupported V-only claim0. 편안함/보온성/부드러움/흡수력/튼튼함/실용성 등 새 이점 주장이 없다.
- 실제 정상 output을 막은 false-positive reject0. 허용 canonical 반복도 생성에 영향을 주지 않았다. Hero+canonical name, marketing size+canonical size, option heading+values의 경계는 고정 allow corpus로도 확인했다. 실제 상품에 없는 size marketing 문장을 임의로 만들지 않았다.
- context 없이 `copyQuality`만 부른 초기 보조 측정에는 title_relevance 경고가 있었으나, 실제 UI와 같은 asset role snapshot을 전달한 최종 측정에서는0이다. 이는 generation reject가 아니며 초기 보조 측정만으로 UI false positive를 보고하지 않았다.
- C1~C22는 **allow9/warning7/reject6**, frozen expected/baseline 유지, gap0/allow false positive0. 이 corpus 통과는 실제 모든 관찰 보고체의 검출을 보장하지 않는다. H1은 동결22개 밖의 새 실제 관찰이다.

## Browser / candidate / manual / Final

- Desktop1440×1000, 실제 Editor에서 Section 선택·편집·저장·AI 후보 비교·명시 apply를 실행했다. 가로 overflow 없음. three-column 레이아웃과 한국어 이유를 확인했다.
- gallery regeneration1회의 후보: title=`착용 외관과 앞여밈 디테일`, intro=null. Evidence/Assets/type/plannerKey 유지, 자동 중복0. 후보 응답 및 apply 전 canonical hash는 최초 결과와 동일했다. “새 결과 적용” 후 선택 gallery만 변경되고 성공 안내를 확인했다.
- 이번 실제 OpenAI 후보에는 검토 warning이 없었다. 이를 보완하려고 **외부 전송이 없는 synthetic provider 응답2개를 실제 Browser/production route에 전달**했다. 첫 후보는 `앞면 지퍼 여밈`/`앞면에는 지퍼 여밈이 적용되어 있습니다.`이며, 후보 비교에서 한국어 제목/본문 검토 이유·활성 apply 버튼을 확인하고 “기존 내용 유지”를 선택했다. 두 번째 `모델이 착용하고 있는 모습입니다.`는 품질 검증 실패 안내를 표시하고 후보/apply 버튼0이었다. 두 경우 모두 canonical/protected data 불변, 추가 실제 AI0. 화면의 provider/model 표시는 기존 UI이고 이2개 응답은 OpenAI가 생성한 것이 아니다. `browser-replay.json`, `regeneration-warning.png`, `regeneration-reject.png` 및 DOM 기록을 실제 AI ledger와 분리했다.
- `copy-role-service.test.mjs`의 mock/SSR도 경고 이유·비차단 명시 apply, C13 거부1회·기존 row 보존을 검증한다. frozen C7/C8는 hard repetition reject다. title/body warning을 hard reject인 것처럼 보고하지 않는다.
- 실제 Editor에서 gallery title=`앞면 지퍼 여밈`, intro=`앞면에는 지퍼 여밈이 적용되어 있습니다.`로 저장했다. 저장 성공, 입력 text 그대로, quality warning1과 “2번 · 서로 다른 구도와 디테일: 제목과 본문이 같은 정보를 되풀이합니다. 역할을 나누고, 생략 가능한 본문은 비우는 것을 검토해 주세요.”를 확인했다. enum/원시 Evidence·Asset ID는 이유에 노출되지 않았다.
- warning이 실제 존재하는 수동 편집 상태에서도 `/render`의 **canonical `article[data-detail-render-surface="1"]`** 안은 검토 문구0·controls0·debug label0·missing images0였다. Review shell에는 허용된 검토 UI가 있다. `/render` 전체 문서에 review UI가 없다고 주장하지 않는다.
- QA 수동 edit와 적용한 regen을 최초 생성 canonical로 복구한 뒤, 첫 output 그대로 Final/PNG/JPG를 검증했다. final article860×3057, 이미지4개 모두 decode, 스펙6행·옵션6개 exact. 최종 페이지 가로 overflow 없음.
- 실제 `/api/projects/.../export`를 PNG1회/JPG1회 호출해 각각 HTTP200. Export는 기존 서버 Chromium의 article capture 경로를 사용했다. 두 이미지 모두 **860×3057**, 같은 레이아웃, 내부 경고/검토 이유/Editor UI/debug label0, 누락 이미지0을 시각 확인했다. PNG1,492,389B, JPG357,190B. 수동 경고 상태의 PNG/JPG 추가 export는 하지 않았다.
- screenshot `editor.png`, `regeneration.png`, `final-browser.png`와 실제 Export `final.png`, `final.jpg`를 로컬 보존했다. viewport screenshot 두 장의 해상도 한계는 DOM 기록으로 보완한다. Final full-page/실제 export는 전체 내용이 확인된다.

## 정리 및 상태 집계

기존 Products/Facts/Options/Assets collection은 원본 snapshot과 deep-equal, 원본 evidence/source/snapshot 파일 hash도 불변이다. source hash 검증 뒤 원본 rect/trim으로만 QA 파생 이미지를 재구성했다. 실제 원격 DB/Storage 요청0. QA canonical은 최초 생성 hash로 복구했다. 메모리 DB·OpenAI relay·Next QA 서버 및 브라우저 탭을 종료하고 임시 viewport를 해제했다. 보완 synthetic replay도 canonical/protected data 불변으로 종료했다. 3042/4342/50697/61797 포트 닫힘 확인. 원격 cleanup delete나 사용자 파일 초기화가 필요하지 않았다. 증거 파일은 gitignored 상태로 남긴다.

TASK-040의 실제 controlled E2E·1054 tests 증거에 더해 이번 원본 저장소의 전체1091 tests와 기본 production build가 PASS했다. 따라서 당시 문서 적용/원본 build 대기는 해소됐고 **M2 RESOLVED**로 최종화한다. M2 코드는 변경하지 않았다. 예전 문서의 MEDIUM4는 이 대기를 포함한 역사적 수치다. 현재 backlog **MEDIUM3(M1/M3/M4), LOW1(L1)**을 유지한다. TASK-042의 **BLOCKER0/HIGH1**은 QA finding 등급이며 H1은 기존 M3에 연결하므로 새로운 backlog 과제로 중복 집계하지 않는다. M3 해결에 따른 MEDIUM3→2 감소는 수행하지 않는다.

## 완료 보고 — 요청한 59개 항목

1. **TASK 목적**: TASK-041 첫 실제 AI output·Browser·Final/Export 검증.
2. **branch**: `feat/copy-role-dedup` 유지.
3. **M3 시작 상태**: deterministic/mock 구현 완료, actual QA pending.
4. **실제 OpenAI 총 호출**: 3, 자동 retry0.
5. **Planner 호출**: 1, 정책 stale로 필요, accepted.
6. **Section Engine 호출**: 1, 최초 유효 output accepted.
7. **Section regeneration 호출**: 1, accepted, explicit apply 검증.
8. **QA 상품**: 67695797, loopback 격리 fixture.
9. **Section 구조**: hero→gallery→specification→option, 총4.
10. **title 목록**: 위 첫 결과4개 기록; Hero는 title 대신 headline.
11. **exact repetition**: 0.
12. **normalized repetition**: 0.
13. **Fact marketing repetition**: 0.
14. **title/body redundancy**: 실제 첫 output0; 의도적 manual edit1 검출.
15. **cross-section repetition**: 자동0/human0, 이번4개 구조 범위.
16. **visual-message repetition**: 0.
17. **meta-observation**: 자동0/human1, H1 미해결.
18. **camera-framing**: 자동0/human0.
19. **unsupported V-only claim**: 0.
20. **AI output accepted/rejected**: 실제3회 모두 accepted, rejected0. accepted여도 human QA H1 존재.
21. **false-positive count**: 실제 reject0, allow corpus0. 모든 상품에 대한 보장은 아님.
22. **C6 결과**: warning PASS.
23. **C10 결과**: warning PASS.
24. **C13 결과**: reject PASS.
25. **C19 결과**: warning PASS.
26. **22-case corpus**: 22/22 PASS, allow9/warning7/reject6, gap0.
27. **manual edit warning**: 실제 Browser PASS, 저장·원문 보존·한국어 이유 확인.
28. **regeneration candidate UX**: 실제 OpenAI 정상 후보 비교/명시 apply PASS. synthetic 응답2개로 실제 Browser의 warning 이유/비차단 버튼·기존 내용 유지, hard reject/apply 불가/불변 PASS. mock/SSR도 PASS.
29. **review reason UX**: 실제 Editor 이유 확인, raw ID/enum0, 수정할 위치·역할·행동 안내.
30. **Final Renderer review warning count**: canonical article0, controls0/debug0. Review shell은 별도.
31. **PNG review warning count**: 0.
32. **JPG review warning count**: 0.
33. **Specification exactness**: label/value6행 exact.
34. **Options exactness**: group1/value6/UUID/label/order/version exact.
35. **PNG dimensions**: 860×3057.
36. **JPG dimensions**: 860×3057.
37. **Browser QA 결과**: Desktop 선택/편집/저장/후보/apply/Final PASS, 가로 overflow0. warning/reject는 synthetic 응답 Browser 검증이며 실제 AI 발생 사례와 구분.
38. **QA cleanup**: canonical 복구, 메모리 DB/relay/Next/tab 종료, viewport 해제, 증거 로컬 보존.
39. **기존 user data protection**: Product/Facts/Options/Assets deep-equal, 원본 파일 hash 불변, 원격 요청0.
40. **생성 파일**: 이 문서, ignored `artifacts/TASK-042/*`, ignored `node_modules/.cache/task042/*` QA helper.
41. **수정 파일**: 계약/roadmap/backlog/tasks index/TASK-041의 현재 QA 상태. TASK-042 production 변경0.
42. **migration**: 없음.
43. **dependency**: 없음, package0.1.1 유지.
44. **tests**: 기존 전체 test suite 재실행, TASK-042 신규 test0.
45. **total tests**: 1091/1091 PASS, fail/cancel/skip/todo0, 63.36초.
46. **typegen**: `npx.cmd next typegen` PASS.
47. **typecheck**: `npx.cmd tsc --noEmit` PASS.
48. **lint**: `npm.cmd run lint` PASS.
49. **build**: `npm.cmd run build` PASS, 기본 Turbopack/모든 route 생성.
50. **diff check**: `git diff --check` PASS.
51. **secret scan**: tracked/untracked source·docs·tests, `.next/static`, QA text/log/domain artifacts 검사. 실제 설정 secret3개 및 key/signed URL 패턴 발견0. 값 출력0.
52. **BLOCKER**: 0.
53. **HIGH**: 1, H1 관찰 보고체 accepted; M3에 연결.
54. **MEDIUM**: 기존3(M1/M3/M4) 유지, M3 해결에 따른 감소 없음. 예전4→3은 M2 대기 최종화분.
55. **LOW**: 1(L1) 유지.
56. **M3 최종 상태**: NEEDS_WORK, RESOLVED 아님.
57. **M2 regression**: TASK-040 retry/review 포함 전체 PASS, M2 코드 변경0; 기존 실제 E2E + 원본 build 대기 해소로 RESOLVED.
58. **다음 권장 TASK**: H1의 “외관을 담았습니다”와 정상 외형/수록 문구 negative를 최소 재현으로 고정하고 bounded guard를 보완. 이번 첫 결과는 replay regression에 사용하고 새 유료 QA는 후속 명시 범위로 제한. L1보다 M3 gate 우선.
59. **git diff summary**: 기존 TASK-041의 source7개·tests2개·docs6개 tracked 변경과 신규 구현/회귀/문서를 보존. 이번 TASK는 TASK-042 문서1개 추가와 기존 문서5개 갱신, 앱/DB/의존성 추가 수정0. Git staging/commit/merge/tag/초기화 없음. untracked 파일은 일반 `git diff --stat` 수치에 포함되지 않는다.

로컬 증거: `artifacts/TASK-042/api-ledger.json`, `quality.json`, `first-section-output.json`, `first-regeneration-output.json`, `manual-surface.json`, `final-dom.json`, `audit.json`, `browser-replay.json`, `tests.log`, `typegen.log`, `typecheck.log`, `lint.log`, `build.log`, `editor.png`, `regeneration.png`, `regeneration-warning.png`, `regeneration-reject.png`, `final-browser.png`, `final.png`, `final.jpg`. Git에 추가하지 않았다.

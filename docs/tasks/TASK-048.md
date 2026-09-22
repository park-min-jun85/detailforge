# TASK-048 — Actual Product Image Boundary Before/After QA

2026-09-23, `feat/image-boundary-real-qa`, HEAD `cea04fd`. **M1 RESOLVED（이번 추가-trim 안전성 gate 범위）, M4 NEEDS_WORK.** BLOCKER0/HIGH0/MEDIUM1(M4)/LOW0. 공식 release와 package는 v0.2.0 그대로다. v0.2.1 release 검증으로 진행하지 않는다.

## 관찰 방법과 한계

현재 production을 수정하기 전에 local 실제 source 두 개와 기존 저장 Derived의 candidate rect 26개로 전후를 생성했다. BEFORE는 `git show f693151:src/features/detail-extraction/edge-trim.ts`로 읽은 test-only helper, AFTER는 HEAD의 `cropImage`다. checkout/원본 Derived 재저장 없이 같은 decode 결과·후보·출력 인코딩으로 비교했다. SHA256와 crop raw hash를 기록했고 중복 이미지 count는 0이다. 상품번호·fixture label·knownContentBounds는 production 판정에 전달하지 않았다.

원본 경로의 공통 root는 `C:/Users/alswn/Documents/Codex/2026-09-09/c-projects-detailforge/artifacts/`다. A67399861은 `TASK-024/source.jpg`(860×12900)와 `TASK-026/evidence.json`의 Derived7개, B67695797은 `TASK-030/source.jpg`(800×23982)와 `TASK-031/evidence.json`의 Derived19개를 재사용했다. 별도 상품 C는 추가하지 않았다. 유색 frame 후보는 이 두 상품에서 확보했다. 원본 두 개/메타데이터 두 개의 hash는 비교 전후 및 종료 audit에서 같았다.

시각 분류는 Codex가 contact sheet 4개 전체와 문제 후보의 원본 크기 이미지를 직접 검토한 기록이다. **사용자가 수행한 human sign-off라고 주장하지 않는다.** `same`17개는 byte exact도 확인했다. `worse`9개는 예전 helper가 제거하던 얇은 흰 띠를 다시 보존하여 residue가 증가한 경우이며 제품 내용 손실을 뜻하지 않는다. 결과 분류 ambiguous0과 배경 판정 모호함10은 다른 차원이다. possible content loss0이므로 해당 sample의 추가 human review 대기 건은 없다.

AFTER는 26개 모두 inset0이다. 따라서 고정 candidate 내부에서 새로 잘린 내용은 없지만, **현재 detector가 실제 상품에서 적극적으로 trim하면서 안전했다는 증거는 아니다.** 기존 후보에 이미 존재하는 얼굴/문자 잘림은 별도 후보 geometry 문제이며 M1의 이번 gate인 “AFTER의 추가 내용 손실”에 넣지 않는다. 인체/제품 의미 구분이나 모든 실제 입력의 무손실을 보장하지 않는다.

## 완료 보고 — 66항목

1. **TASK 목적:** 실제 source의 전후 비교로 M1/M4를 독립 판정. 결과 관찰 전 threshold/detector/fixture/contract 변경0.
2. **branch:** `feat/image-boundary-real-qa`, 기준 HEAD `cea04fd`.
3. **QA source/product 수:** 실제 source2 / 상품2(A67399861, B67695797).
4. **실제 crop sample 수:** 26(A7+B19), 서로 다른 decoded crop hash26, 복제 count0.
5. **white/light:** 15. A01~05/A07, B01~05/B08~11.
6. **dark:** 10. B06~07/B12~19. 혼합 색상 사진도 어두운 실제 제품을 포함하며 category는 중첩 가능.
7. **human/model touching edge:** 11. A02~03, B08~09/B11~17.
8. **close-up:** 9. A02~03/A05~06, B02~05/B11.
9. **colored-frame candidate:** 6. A01/A04/A06/A07/B01/B06. 후보 전체가 안전 제거 가능한 frame이라는 뜻은 아님.
10. **background ambiguity:** 10. A01/A04/A06/A07/B08/B10/B12/B15~17.
11. **BEFORE:** pre-TASK047 `f693151` edge-trim v1 helper. source decode와 JPEG95/4:4:4 출력 조건을 AFTER와 일치시킴. production에 legacy 분기 추가0.
12. **AFTER:** `cea04fd` production `cropImage` / trim policy2, 원래 candidate rect 그대로.
13. **cleaner:** 0.
14. **same:** 17, encoded bytes까지 동일.
15. **worse:** 9, 흰 띠의 minor residue 증가만 해당. A02/A03/A07/B08/B10/B12/B15/B16/B17.
16. **ambiguous visual change:** 0. 배경/제품 경계 모호함은 별도 tag와 메모로 기록.
17. **BEFORE obvious residue:** 3(A01/B01/B02).
18. **AFTER obvious residue:** 3, 새 obvious regression0.
19. **clear new content loss:** 0/26. AFTER removed0px.
20. **possible new content loss:** 0/26. source candidate 전체 보존과 시각 검토 근거.
21. **false-positive content trim:** 0. 제거를 전혀 하지 않은 실제 표본의 결과로 한정.
22. **problematic frame/panel miss:** 3(A01 녹색 테두리, B01 갈색 L자 패널, B02 내부 카드 조각). 마지막 둘은 균일 외곽 band 가정 밖의 원본 패널/후보 geometry도 관련된다.
23. **white-product:** 15개 밝은 제품의 edge·표면·봉제선 추가 손실0. 사진 배경도 보존.
24. **dark-product:** 10개 어두운/혼합 제품의 실루엣·소매·조끼 추가 손실0.
25. **human/person:** 11개 손·팔·머리·몸의 candidate 안 픽셀 유지. 기존 candidate 밖 내용 복원은 미구현.
26. **close-up:** 9개 목둘레·지퍼·봉제선·표면·제품 층 보존. 내부 separator 추가 손실0.
27. **colored-frame:** 후보6개 모두 보존, 실제 개선0. 모호한 배경 보존은 정상이나 M4 실효성 gate 미충족.
28. **background:** 벽·바닥·회색 상품 배경을 frame으로 새로 자른 사례0.
29. **max trim cap:** AFTER 모든 변0, 26개 각각 floor(axis×3%) 이하. BEFORE의 최대 제거16px도 기록.
30. **deterministic repeatability:** 26/26 두 번 호출, rect/dimensions/trim metadata/encoded bytes exact. 최소5 초과.
31. **pixel identity:** 같은 decoded 실제 source의 PNG companion26개 retained raw exact. 원본 JPEG를 그대로 PNG라 부르지 않음. JPEG26개는 동일 source extract를95/4:4:4로 인코딩한 기준과 decoded pixels exact. resample/의도적 색변환0.
32. **policyVersion:** 실제26개는 적용 trim이 없으므로 `derivation.trim` 없음이 정상. 실제 저장3개도 동일. 별도 M1-A2 합성 source의 production save/read에서 version2 / 16px4변 / 608×608 확인. 이 양성 대조는 실제26개에 포함하지 않음.
33. **provenance:** 실제 저장3개 parent/hash/candidate/sourceRect/role/실제 dimensions 일치. AFTER rect=sourceRect. A2의 insets/postTrimDimensions까지 저장·읽기 일치.
34. **Derived save regression:** loopback 격리 DB/Storage mock에서 B08/B11/B16 후보 선택→`saveProductShots`3개 저장→`listAssets` 동일 JPEG bytes/metadata 조회 PASS. 같은 선택 재저장은 existing3/추가저장0. 원본 bytes·Product/Facts 불변.
35. **Planner/Renderer:** 저장3개를 실제 inventory/prompt projection에서 확인하고, 별도 local Next fixture의 GET page-plan에서도3개 available 확인. canonical hero/gallery에서3개 고유 AFTER, img4개(hero1개 재사용), natural dimensions 정상·contain·누락0·overflow0. 기존 CSS 수정0. 이전 Plan은 QA asset 교체로 stale일 수 있으며 AI 재계획은 하지 않음.
36. **Export:** 실제 POST export/captureWithChromium 경로 PNG/JPG 모두 **860×3055**. export 이미지 시각 확인, 누락/추가 crop/왜곡 없음. DOM 높이3054.25→ceil3055, fixture hash 불변/DB 쓰기0.
37. **contact sheet:** `artifacts/TASK-048/contact-sheet.png`(760×9880), 확대 검토용 `review-1.png`~`review-4.png`. ID/role/BEFORE/AFTER/LTRB 표기, pair 공통 배율. before/after 각26 JPEG. 모두 ignored, Git stage0.
38. **실제 bug:** 새 HIGH/BLOCKER content-loss나 명백한 detector 구현 오류0. M4의 실제 한계/기존 패널 miss3 및 minor residue regression9 관찰. smoke 초기 fixture의 단일 signed-URL endpoint 누락은 QA harness만 보완; 실제 DB mutation 오류 아님.
39. **algorithm 수정:** 0. threshold/detector/pixel signals/cap/fixture/contracts의 판정 규칙 그대로. 문서는 실제 QA 결과·상태만 추가.
40. **추가 regression test:** 0. 일반화 가능한 production bug를 찾지 못해 상품번호 전용 test 추가 안 함. ignored QA harness의 geometry/bytes/provenance/smoke assertions 실행.
41. **M1 synthetic:** 기존12+A2 3=15종 PASS, content-loss0. 동일 pixels/config invariant 및 기존 cap/최소크기/alpha/detail guard tests PASS.
42. **M4 synthetic:** 기존10+A2 5=15종 PASS, content-loss0. separator 있는 제한된 양성의 frame trim 유지. 실제 개선 확인과 구분.
43. **생성 파일:** tracked 대상 문서 `docs/tasks/TASK-048.md`1개. ignored `artifacts/TASK-048/` 증거와 `node_modules/.cache/task048/` 재현 helper 별도.
44. **수정 파일:** contracts, RELEASE_BACKLOG, tasks README 문서3개. production/test/fixture/UI/Renderer/CSS 변경0.
45. **migration:** 0.
46. **dependency:** 0, package-lock 내용 불변.
47. **OpenAI calls:** 0. A2 포함 분석 provider 미호출, 기존 후보 메타데이터 재사용.
48. **external API calls:** Domeggook0/remote source fetch0/기타0. loopback fetch만 사용, QA 앱 및 save harness는 비-loopback fetch 차단.
49. **remote mutation:** 원격 DB/Storage read/write0. 격리 in-memory mock에만 새 Derived 저장. 기존 사용자 source/Derived/Product/Facts/Options 자동 재저장0.
50. **tests:** 전체 glob 실행 PASS, fail/cancelled/skip/todo0. 합성30종 content-loss oracle 별도 재확인.
51. **total test count:** **1253 PASS**, 신규0.
52. **typegen:** `npx.cmd next typegen` PASS.
53. **typecheck:** `npx.cmd tsc --noEmit` PASS.
54. **lint:** `npm.cmd run lint` PASS.
55. **build:** `npm.cmd run build` PASS, installed Next16.3.4. 해당 build로 Renderer/export 실행.
56. **diff check:** `git diff --check` 및 새 문서 whitespace/conflict-marker 검사 PASS.
57. **secret scan:** tracked/untracked source·문서·tests, client bundle 및 TASK048 JSON/log/text에서 실제 설정 key3종 exact match와 credential/signed-token 패턴 findings0. 값 출력0. 상세 파일 수는 `audit.json`; Git 전체 history 검사는 아님.
58. **package version:** package/lock root0.2.0. version bump0.
59. **BLOCKER:** 0, 이번 이미지 품질 범위.
60. **HIGH:** 0.
61. **MEDIUM:** 1(M4 NEEDS_WORK). minor residue9/miss3은 동일 M4의 표본이며 별도 issue로 중복 집계하지 않음.
62. **LOW:** 0.
63. **M1 최종:** **RESOLVED**, 이번 명시 gate인 고정 후보에 대한 추가-trim 손실0 + synthetic PASS 기준. 실제 적극 trim 표본0/상품2라는 한계를 유지. 기존 semantic crop/인체 인식 전체 해결 선언 아님.
64. **M4 최종:** **NEEDS_WORK**. synthetic 양성 PASS만으로 실제 frame 개선을 대신하지 않음. obvious residue3→3, cleaner0, minor worse9.
65. **다음 권장:** TASK-049 M4 실제 frame/panel miss 구분과 최소 재현 계약. A01 외곽 테두리와 B01/B02 후보/패널 문제를 분리하고, cap 내 pixel-only 구별 신호의 존재부터 확인. 안전한 경우에만 일반화 fixture/최소 fix, 모호하면 preserve. **Final Release Validation 아님**, threshold 완화·상품번호 분기·CSS 은폐 금지 유지.
66. **git diff summary:** 문서 신규1+수정3=4개, **+140/-0행**(untracked 신규 문서120행 포함). production/tests/fixtures/package/SQL0, stage/commit/main merge/tag0.

## 증거와 재현

`artifacts/TASK-048/comparison.json`에 sources/hash/legacy helper hash/원래 candidate/intrinsic 및 전후 rect·dimensions·insets·removed pixels/area%/edge count/decision을 기록했다. `review.json`은 category·시각 판정·residue·content-loss·메모를 합친26개 전수 기록이다. `flow.json`, `saved-real-rows.json`, `planner-read.json`, `renderer-fixture.json`, `smoke.json`, `audit.json`, 각 validation log와 `renderer.png`/`renderer.jpg`를 함께 남겼다. 실제 임시 signed token을 artifact에 저장하지 않았으며 fixture URL은 local mock 값이다.

로컬 재현 helper는 ignored `node_modules/.cache/task048/compare.mjs`, `flow.mjs`, `annotate.mjs`, `serve.mjs`, `next.cjs`, `smoke.mjs`, `audit.mjs`다. compare/flow/audit는 `node --conditions=react-server --import ./tests/register.mjs <helper>`로 실행한다. compare는 위 원본 artifact 경로와 Git ref가 필요하다. annotations는 기록된 시각 판정으로 자동 추론 모델이 아니다. serve는4348, production Next는3048의 loopback만 사용했다. smoke 후 둘 다 종료했다. 사람 검토용 이미지는 Git에 추가하지 않는다.

## sample별 전후 geometry와 시각 기록

각 rect는 orientation-normalized source pixels `(x,y,width,height)`, inset 순서는 L/T/R/B다. A의 source intrinsic은860×12900, B는800×23982. 아래 intrinsic은 crop 후보의 고유 크기이며 source/product 연결은 ID 접두사로 유지한다. removed% 분모는 trim 전 후보 면적이다.

- **A01 / product** (light, coloredFrameCandidate, backgroundAmbiguity): candidate/sourceRect(x,y,w,h) `19,505,821,825`, intrinsic 821×825; BEFORE rect `19,505,821,825` / 821×825, AFTER rect `19,505,821,825` / 821×825. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue obvious→obvious, loss none. 녹색 사각 테두리와 바깥 띠가 그대로 남음. 회색 사진 배경과 흰 제품·강아지는 보존. problematic miss.
- **A02 / usage** (light, personEdge, closeup): candidate/sourceRect(x,y,w,h) `0,4965,434,443`, intrinsic 434×443; BEFORE rect `0,4965,434,435` / 434×435, AFTER rect `0,4965,434,443` / 434×443. L/T/R/B 0/0/0/8→0/0/0/0, removed 3472→0px (1.806→0%), edges 1→0. **worse**, residue minor→minor, loss none. 손과 흰 패드의 가장자리 보존. 아래 흰 띠 8px 복원으로 minor residue 증가.
- **A03 / usage** (light, personEdge, closeup): candidate/sourceRect(x,y,w,h) `425,4965,435,443`, intrinsic 435×443; BEFORE rect `425,4965,435,435` / 435×435, AFTER rect `425,4965,435,443` / 435×443. L/T/R/B 0/0/0/8→0/0/0/0, removed 3480→0px (1.806→0%), edges 1→0. **worse**, residue minor→minor, loss none. 패드 단면과 손 보존. 아래 흰 띠 8px 복원으로 minor residue 증가.
- **A04 / product** (light, coloredFrameCandidate, backgroundAmbiguity): candidate/sourceRect(x,y,w,h) `0,7850,434,445`, intrinsic 434×445; BEFORE rect `0,7850,434,445` / 434×445, AFTER rect `0,7850,434,445` / 434×445. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue none→none, loss none. 패드 바깥의 넓은 회색 영역은 배경/프레임 구분이 모호함. 안전한 제거 근거 없어 보존.
- **A05 / detail** (light, closeup): candidate/sourceRect(x,y,w,h) `424,7850,436,445`, intrinsic 436×445; BEFORE rect `424,7850,436,445` / 436×445, AFTER rect `424,7850,436,445` / 436×445. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue minor→minor, loss none. 물방울과 흰 표면 close-up 보존. 얇은 외곽 여백 잔존.
- **A06 / product** (closeup, coloredFrameCandidate, backgroundAmbiguity): candidate/sourceRect(x,y,w,h) `89,10772,699,673`, intrinsic 699×673; BEFORE rect `89,10772,699,673` / 699×673, AFTER rect `89,10772,699,673` / 699×673. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue minor→minor, loss none. 회색 외곽과 흰 패드 층의 경계가 인접함. 실제 제품의 흰 가장자리를 frame으로 취급하지 않음.
- **A07 / product** (light, coloredFrameCandidate, backgroundAmbiguity): candidate/sourceRect(x,y,w,h) `0,11528,860,894`, intrinsic 860×894; BEFORE rect `0,11528,860,878` / 860×878, AFTER rect `0,11528,860,894` / 860×894. L/T/R/B 0/0/0/16→0/0/0/0, removed 13760→0px (1.790→0%), edges 1→0. **worse**, residue minor→minor, loss none. 회색 배경 위 포장 제품 보존. 위쪽 흰 구분선 잔존, 아래 흰 띠 16px 복원.
- **B01 / product** (light, coloredFrameCandidate): candidate/sourceRect(x,y,w,h) `360,2000,380,572`, intrinsic 380×572; BEFORE rect `360,2000,380,572` / 380×572, AFTER rect `360,2000,380,572` / 380×572. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue obvious→obvious, loss none. 왼쪽 아래 갈색 L자 패널 잔존. 비대칭/불연속 영역으로 균일한 외곽 띠가 아님. problematic miss.
- **B02 / detail** (light, closeup): candidate/sourceRect(x,y,w,h) `54,2711,691,547`, intrinsic 691×547; BEFORE rect `54,2711,691,547` / 691×547, AFTER rect `54,2711,691,547` / 691×547. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue obvious→obvious, loss none. 아래쪽에 다른 카드의 윗부분이 들어온 기존 후보 영역. 내부 패널 조각 잔존, 외곽 균일 띠 문제가 아님. problematic miss.
- **B03 / detail** (light, closeup): candidate/sourceRect(x,y,w,h) `360,5019,395,367`, intrinsic 395×367; BEFORE rect `360,5019,395,367` / 395×367, AFTER rect `360,5019,395,367` / 395×367. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue minor→minor, loss none. 밝은 목둘레·라벨·봉제선과 얇은 외곽 여백 보존.
- **B04 / detail** (light, closeup): candidate/sourceRect(x,y,w,h) `360,5588,392,366`, intrinsic 392×366; BEFORE rect `360,5588,392,366` / 392×366, AFTER rect `360,5588,392,366` / 392×366. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue minor→minor, loss none. 밝은 밑단·봉제선 close-up 보존.
- **B05 / detail** (light, closeup): candidate/sourceRect(x,y,w,h) `360,6156,392,367`, intrinsic 392×367; BEFORE rect `360,6156,392,367` / 392×367, AFTER rect `360,6156,392,367` / 392×367. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue minor→minor, loss none. 지퍼·표면 close-up 보존.
- **B06 / option** (dark, coloredFrameCandidate): candidate/sourceRect(x,y,w,h) `68,6931,693,304`, intrinsic 693×304; BEFORE rect `68,6931,693,304` / 693×304, AFTER rect `68,6931,693,304` / 693×304. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue minor→minor, loss none. 세 색상 아래 베이지 띠가 옷과 맞닿아 있음. 배경/디자인 띠 후보이며 cap보다 넓어 강제 제거하지 않음.
- **B07 / product** (dark): candidate/sourceRect(x,y,w,h) `77,8512,647,298`, intrinsic 647×298; BEFORE rect `77,8512,647,298` / 647×298, AFTER rect `77,8512,647,298` / 647×298. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue none→none, loss none. 세 색상과 아래에서 부분적으로 보이는 원본 글자 보존. 글자의 기존 잘림은 고정 candidate에 존재.
- **B08 / product** (light, personEdge, backgroundAmbiguity): candidate/sourceRect(x,y,w,h) `84,11524,648,756`, intrinsic 648×756; BEFORE rect `84,11524,636,756` / 636×756, AFTER rect `84,11524,648,756` / 648×756. L/T/R/B 0/0/12/0→0/0/0/0, removed 9072→0px (1.852→0%), edges 1→0. **worse**, residue minor→minor, loss none. 모델 손·옷 윤곽·벽 보존. 오른쪽 흰 띠 12px 복원. 위쪽 얼굴 잘림은 기존 candidate에 존재.
- **B09 / product** (light, personEdge): candidate/sourceRect(x,y,w,h) `91,12402,315,550`, intrinsic 315×550; BEFORE rect `91,12402,315,550` / 315×550, AFTER rect `91,12402,315,550` / 315×550. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue minor→minor, loss none. 팔·옷·벽 보존. 위쪽 인물 잘림은 기존 candidate에 존재.
- **B10 / usage** (light, backgroundAmbiguity): candidate/sourceRect(x,y,w,h) `413,12544,313,549`, intrinsic 313×549; BEFORE rect `413,12544,307,549` / 307×549, AFTER rect `413,12544,313,549` / 313×549. L/T/R/B 0/0/6/0→0/0/0/0, removed 3294→0px (1.917→0%), edges 1→0. **worse**, residue minor→minor, loss none. 전신 착용·벽·바닥 보존. 오른쪽 흰 띠 6px 복원.
- **B11 / detail** (light, personEdge, closeup): candidate/sourceRect(x,y,w,h) `85,13251,647,741`, intrinsic 647×741; BEFORE rect `85,13251,647,741` / 647×741, AFTER rect `85,13251,647,741` / 647×741. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue minor→minor, loss none. 주머니에 넣은 손·옷 디테일 보존. 원본 후보의 위쪽 잘림과 왼쪽 패널 경계 그대로.
- **B12 / usage** (dark, personEdge, backgroundAmbiguity): candidate/sourceRect(x,y,w,h) `86,14376,646,790`, intrinsic 646×790; BEFORE rect `86,14376,634,790` / 634×790, AFTER rect `86,14376,646,790` / 646×790. L/T/R/B 0/0/12/0→0/0/0/0, removed 9480→0px (1.858→0%), edges 1→0. **worse**, residue minor→minor, loss none. 코코아 조끼·손·배경 보존. 오른쪽 흰 띠 12px 복원.
- **B13 / usage** (dark, personEdge): candidate/sourceRect(x,y,w,h) `413,15310,313,537`, intrinsic 313×537; BEFORE rect `413,15310,313,537` / 313×537, AFTER rect `413,15310,313,537` / 313×537. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue minor→minor, loss none. 목 주변 손·코코아 조끼 보존. 원본 후보의 인물 잘림 그대로.
- **B14 / usage** (dark, personEdge): candidate/sourceRect(x,y,w,h) `92,15433,314,467`, intrinsic 314×467; BEFORE rect `92,15433,314,467` / 314×467, AFTER rect `92,15433,314,467` / 314×467. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue minor→minor, loss none. 측면 손·코코아 조끼 보존. 원본 후보의 인물 잘림 그대로.
- **B15 / usage** (dark, personEdge, backgroundAmbiguity): candidate/sourceRect(x,y,w,h) `85,16096,647,736`, intrinsic 647×736; BEFORE rect `85,16096,635,736` / 635×736, AFTER rect `85,16096,647,736` / 647×736. L/T/R/B 0/0/12/0→0/0/0/0, removed 8832→0px (1.855→0%), edges 1→0. **worse**, residue minor→minor, loss none. 등·머리 일부·배경 보존. 오른쪽 흰 띠 12px 복원.
- **B16 / usage** (dark, personEdge, backgroundAmbiguity): candidate/sourceRect(x,y,w,h) `86,18114,646,736`, intrinsic 646×736; BEFORE rect `86,18114,634,736` / 634×736, AFTER rect `86,18114,646,736` / 646×736. L/T/R/B 0/0/12/0→0/0/0/0, removed 8832→0px (1.858→0%), edges 1→0. **worse**, residue minor→minor, loss none. 어두운 조끼·검은 소매·팔과 머리 윤곽 보존. 오른쪽 흰 띠 12px 복원.
- **B17 / usage** (dark, personEdge, backgroundAmbiguity): candidate/sourceRect(x,y,w,h) `86,18997,646,737`, intrinsic 646×737; BEFORE rect `86,18997,634,737` / 634×737, AFTER rect `86,18997,646,737` / 646×737. L/T/R/B 0/0/12/0→0/0/0/0, removed 8844→0px (1.858→0%), edges 1→0. **worse**, residue minor→minor, loss none. 어두운 조끼·폰을 든 손 보존. 오른쪽 흰 띠 12px 복원.
- **B18 / option** (dark): candidate/sourceRect(x,y,w,h) `80,20140,636,284`, intrinsic 636×284; BEFORE rect `80,20140,636,284` / 636×284, AFTER rect `80,20140,636,284` / 636×284. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue none→none, loss none. 밝고 어두운 세 색상과 흰 배경 보존.
- **B19 / mixed** (dark): candidate/sourceRect(x,y,w,h) `54,3739,709,1072`, intrinsic 709×1072; BEFORE rect `54,3739,709,1072` / 709×1072, AFTER rect `54,3739,709,1072` / 709×1072. L/T/R/B 0/0/0/0→0/0/0/0, removed 0→0px (0.000→0%), edges 0→0. **same**, residue none→none, loss none. 어두운 조끼·모델 및 PRODUCT DETAIL 글자가 있는 패널 보존. 텍스트 패널을 제거 목표로 계산하지 않음.


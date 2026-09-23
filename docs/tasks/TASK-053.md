# TASK-053 — Actual Manual Crop Browser, Derived Save & Export QA

2026-09-23. **M1 RESOLVED 유지 / M4 RESOLVED. BLOCKER0/HIGH0/MEDIUM0/LOW0.** Branch `feat/manual-crop-real-qa`, 시작 HEAD `30e5a6f`, clean. Production 변경 없이 TASK-052 상태 그대로 실제 source Browser QA를 먼저 수행했다. [최신 계약](../V0_2_1_MANUAL_CROP_DESIGN.md). package0.2.0, stage/commit/main merge/tag0.

## 요청한 72개 완료 보고 항목

1. **TASK 목적:** 실제 A01/B01/B02의 검토→조정→선택→실제 save route/service→Derived 재조회→Renderer/export로 M4 최종 판정.
2. **branch:** `feat/manual-crop-real-qa`, HEAD `30e5a6f` 유지. 시작/종료 branch 확인.
3. **QA environment:** production Next16.3.4 localhost3053 + in-memory Supabase REST/Storage fixture4353. 실제 React/UI/route/service/Sharp 사용, persistence만 loopback. A/B 별도 격리 project/product/source scope, 기존 source 파일은 read-only.
4. **A01 review:** 기존 `(19,505,821,825)`/source860×12900. 바깥 회색과 녹색 separator, 제품·강아지 경계를 직접 검토. grey strip만 제거하여 오른쪽 사진 경계와 맞닿은 강아지를 보존한다.
5. **A01 manual insets:** **L16/T17/R15/B18**. fixture의 자동 권장값이 아니며 실제 원본·Browser overlay를 보고 입력한 QA 선택값.
6. **A01 preview dimensions:** **790×790**, SVG F `(35,522,790,790)`.
7. **A01 saved dimensions:** **790×790**, manual v2 Derived 재조회 일치.
8. **A01 WYSIWYG:** Browser card viewBox=stored F, source F→JPEG95/4:4:4 기준 encoded bytes/decoded pixels exact. 추가 auto trim0. JPEG가 원래 source decode와 무손실이라는 뜻은 아님.
9. **A01 content loss:** 관찰한 clear/possible 추가 손실0. 제품/강아지·사진 경계 보존. 기존 candidate 경계 밖의 내용 복원을 주장하지 않는다.
10. **A01 quality result:** **cleaner**. 회색 외곽 띠 제거, 녹색 separator는 의도적으로 남음. 모든 frame residue 제거가 성공 조건은 아니다.
11. **B01 review:** 기존 `(360,2000,380,572)`/source800×23982. 갈색 L자 panel은 왼쪽8px/아래26px, 안쪽 인물·옷 경계를 확인.
12. **B01 manual insets:** **L8/T0/R0/B26**. F `(368,2000,372,546)`.
13. **B01 >3% behavior:** bottom26/572≈4.55%, auto cap floor(572×.03)=17 초과. manual26 그대로 반영, 재축소0.
14. **B01 saved dimensions:** **372×546**, preview·metadata·실제 JPEG 재조회 일치.
15. **B01 content loss:** 관찰한 clear/possible 추가 손실0. 왼쪽/하단 패널 제거, 원래 candidate 안 인물·의류 보존.
16. **B01 quality result:** **cleaner**, 갈색 L자 residue 제거. 나머지 얇은 흰 여백을 무리하게 제거하지 않는다.
17. **B02 review:** 기존 `(54,2711,691,547)`. bottom38 preview에서 내부 카드뿐 아니라 양옆 제품 texture도 dim 영역으로 들어감을 확인.
18. **B02 user decision:** **Escape/Cancel 및 preserve**. 초안 생성/선택 자동 변경0. 후속 zero/remove 검증에서 automatic full 후보691×547 저장도 확인.
19. **B02 auto safety:** 실제 source automatic plan은 trim없음/full rect. UI가 강제 적용하지 않으며 unsafe38px는 저장하지 않았다.
20. **B02 quality result:** **same / preserve PASS**. 내부 카드 조각은 남지만 제품 질감 보존 결정을 존중한다.
21. **selection preservation:** A01/B01 unchecked→Apply 후 false→명시 check→Save 후 false. B02 Cancel false 유지, partial failure true 유지. UI 조정은 자동 선택하지 않는다.
22. **retry/draft preservation:** 실제 source review의 순서·revision 변경을 fixture에서 만들고 상태 새로고침. B02 zero draft+explicit false 유지. signed URL token 갱신에도 유지. AI retry0, 완전 reload 복구와 구분.
23. **zero override:** B01 partial batch 및375px A01에서 `[후보 전체로]`→Apply→Save. V2 manualInsets0/0/0/0 유지, full380×572/821×825 manual 변형 생성. 실제 source helper instrumentation에서 manual+zero auto trim 호출0.
24. **override removal:** B02 `[수동 조정 해제]` 뒤 실제 POST에 manualInsets 없음. v1 automatic provenance, trim없음, full691×547 저장. insets0 객체와 없음 구분.
25. **partial save behavior:** B01 zero 신규 성공/B02 upload fault/B03 기존 auto 재사용. 실제 route/service에서 saved2(existing1)/failed1. B01/B03 selection·draft clear, B02 selection·draft 유지. stale review를 재현하는 GET saved 목록 override와 두 번째 upload 실패만 fixture 주입.
26. **duplicate Derived:** A01 같은 manual F를 실제 route에 재요청: existing=true/동일 Asset ID/추가 row0/기존 provenance 불변. UI의 이미 저장됨 필터와 서버 중복 보호를 구분해 검사.
27. **auto/manual duplicate:** B03 full automatic 저장→zero manual 동일 F 요청은 기존 Derived 재사용, 추가 row0/provenance v1 덮어쓰기0.
28. **variant behavior:** 같은 A01/B01의 조정 F와 full-zero F는 서로 다른 Derived. 최종 신규6개=manual4+automatic2. 원본2개 포함 local assets8개.
29. **asset limit:** 실제 UI 남은 슬롯 표시와 asset_limit 한국어/0슬롯 메시지, draft/선택 유지 확인. 메시지는 mock409, 실제30슬롯/duplicate preflight는 기존 service tests 회귀 PASS.
30. **manual provenance:** schemaVersion2/kind detail_image_crop, adjustment.mode=manual/insets, sourceRect=base, normalized sourceDimensions/coordinateSpace, candidateId/parent/sourceFingerprint 검증. A hash `ffc49a546991f56b620080cb1a76fdd817a52dfdbaf5f37fd47318135c7ef4e8`, B hash `32a08abba067f3410d3f04e8d8b293f29b9c5290a7a5d7d1062964c74e4adb59`. trim field 없음. 민감 storage path는 이 보고서에 복사하지 않는다.
31. **stale validation:** 실제 UI 요청의 candidateId를 unknown hash로 fault injection→실제 route의 stale409/한국어 재확인. draft/selection 유지, 자동 재전송0.
32. **CAS/conflict:** 오래된 expectedRevision과 실제 CAS update miss 두 경우 모두 실제 service conflict409. 각 요청1회, fresh GET 후 draft 유지. 전체 service CAS/lease 회귀 PASS.
33. **save failure draft preservation:** actual upload partial failure 및 crop_too_small/stale/conflict/CAS, mock asset_limit에서 값·선택 보존. 조작은 실패 재현용 fixture/요청 경계에만 있음.
34. **Desktop Browser:**1440×1000 actual source open→Arrow/drag→numeric→Apply→select→save→read 완료. Browser pageerror0.
35. **Mobile Browser:**375×812 actual A01 dialog/preview/numeric/Cancel/full-zero Apply/명시 save까지 PASS. 가로 overflow0, full821×825 Derived 확인.
36. **keyboard:**실제 A01/375px에서 Arrow1/Shift+Arrow10, Tab22회 dialog 내부 순환, Shift+Tab/Tab 양방향 wrap, Escape focus 복귀, Enter 적용 확인. 필수 build 후에도 재실행 PASS.
37. **focus:**B02 Escape 후 `[자르기 조정]`으로 복귀 확인.375px에서 Apply 버튼 focus→Enter 정상.
38. **user error messages:** 최소크기400, unknown candidate stale409, revision/CAS conflict409는 실제 route. asset_limit409는 mock. 모두 한국어 안내, raw code만 노출0, 요청별 자동 retry0.
39. **Planner visibility:**6개 Derived 모두 실제 `buildVisualAssetInventory`의 kind=derived. 각 단독 변형 available=true. B의 실제 page-plan GET에서도 manual 후보 available 확인. full-zero와 매우 유사한 B01 작은 변형은 기존 near-duplicate 순위로 suppressed되며 provenance 때문이 아니다. A는 Facts 없는 격리 source 검토 project라 deterministic inventory로 검증.
40. **Renderer:**A canonical hero1 이미지, B hero/gallery3 이미지(대표 재사용 포함) 정상. natural dimensions/contain, 누락0/가로 overflow0. A DOM860×888.71875, B860×2467.828125.
41. **Final surface isolation:**surface 내 button/input/dialog/slider0, manualInsets/sourceFingerprint/자르기 control·warning text0. 실제 export 이미지도 직접 확인.
42. **PNG dimensions:**대표 B 페이지 **860×2468**,819,404bytes. 실제 export POST/captureWithChromium 경로.
43. **JPG dimensions:**대표 B 페이지 **860×2468**,242,474bytes. 이미지 누락0.048의860×3055보다587px 짧지만 이미지 구성이 달라 height를 품질 개선 수치로 해석하지 않는다.
44. **M1 regression:**전체 합성 safety/content-loss/cap/alpha/detail/동일 pixels-config 계약 PASS, detector 변경0. 실제 source automatic3개 preserve 재확인.
45. **M4 synthetic regression:**A/H ambiguous preserve와 A2 분리 신호 safe trim, real-miss 계약 등 기존 suite PASS. 이번 manual 결과를 자동 detector 능력으로 주장하지 않는다.
46. **M2 regression:**retry/selection/checkpoint/partial/CAS 기존 tests PASS. OpenAI 실제 retry 없음.
47. **M3 regression:**copy-role/observation guard·section/render 등 기존 tests PASS. 실제 AI copy 생성0, 이번 production copy 변경0.
48. **existing user data protection:**TASK-048 보호 source2+metadata2 hash 동일,049 patch3 hash 동일. original Product/Facts/Options/Assets/Derived·Page 수정0. QA 내부 protected project/product/facts/options와 source bytes도 불변.
49. **QA cleanup:**3053 Next와4353 persistence 종료, 두 포트 closed 확인. in-memory rows/objects 폐기, evidence 파일만 ignored artifacts에 보존. 원격 cleanup 대상 없음.
50. **external calls:**OpenAI0/Domeggook0/remote source fetch0. Next fetch와 Browser는 loopback만 허용. 기존 실제 source는 local 파일.
51. **remote mutation:**원격 DB/Storage read/write0. 격리 QA source lease/revision·Derived rows만 local memory에서 변경.
52. **생성 파일:**tracked 대상 `docs/tasks/TASK-053.md`1개. ignored artifacts/TASK-053 및 node_modules/.cache/task053 helper 별도, Git stage0.
53. **수정 파일:**manual crop design, boundary contracts, RELEASE_BACKLOG, tasks README 문서4개. production/test/fixture/UI/CSS 변경0.
54. **migration:**0.
55. **dependency:**0, package/lock 변경0.
56. **tests:**신규 repository tests0. QA harness assertions와 기존 전체1417 테스트 실행. first run의 local fixture created_at default/OR filter 누락만 보완, production bug 아님.
57. **total tests:** **1417 PASS**, fail0/skip0. 새 source-specific test를 production corpus에 추가하지 않았다.
58. **typegen:**`npx.cmd next typegen` PASS.
59. **typecheck:**`npx.cmd tsc --noEmit` PASS.
60. **lint:**`npm.cmd run lint` PASS.
61. **build:**`npm.cmd run build` PASS. source 변경0이며 QA는 같은 production 코드의 기존 build에서 실행, 종료 후 필수 build 재확인.
62. **diff check:**`git diff --check` 및 새 문서 whitespace/newline/conflict 검사 PASS.
63. **secret scan:**tracked/untracked 문서·source·tests, client bundle,053 artifacts/helper의 configured secret3종 값과 key/signed-token 패턴 findings0. 값 출력0, Git 전체 history scan은 아님.
64. **package version:**0.2.0 유지. v0.2.1 release/tag 미생성.
65. **BLOCKER:**0.
66. **HIGH:**0.
67. **MEDIUM:**0 — M4 실제 QA 대기 건 종료.
68. **LOW:**0.
69. **M1 상태:**RESOLVED 유지, 기존 추가 automatic trim 안전성 범위.
70. **M4 최종 상태:** **RESOLVED**. 안전 자동 trim+ambiguous preserve+사용 가능한 명시 manual review/save+exact F+provenance/중복/상태 보호+Renderer/export gate 충족. 모든 colored frame 자동 제거라는 뜻은 아니다.
71. **다음 권장 TASK:**TASK-054 v0.2.1 Final Release Validation. 목표 B0/H0/M0/L0. 이번 범위에서는 release/merge/tag하지 않는다.
72. **git diff summary:**문서 신규1+수정4, **+124/-4 lines**(신규 포함). production/tests/fixtures/package 변경0, stage0. numstat와 신규 lines는 `artifacts/TASK-053/audit.json`. commit/main merge/tag0.

## 관찰 근거와 한계

시각 분류는 Codex가 실제 before/after·Browser overlay·최종 PNG/JPG를 직접 본 결과이며 사용자 human sign-off가 아니다. actual samples는 source2개/EXIF1이다. EXIF1~8은 기존 domain/Sharp tests, touch/resize/focus trap은052 actual browser 회귀 범위와 구분한다. 모든 화면·브라우저·물리 입력기기의 보편적 검증을 주장하지 않는다.

원본은 TASK-048 comparison.json의 hash 고정 파일, 후보는 동일 ID/rect다. legacy review metadata를 QA Source row에 재구성하여 AI 분석을 생략했다. 실제 production Product/Facts/Options는 쓰지 않았다. B canonical page는 이전 local fixture의 사실정보/문구를 유지하고 QA 이미지 참조만 교체했다. 현재 사진 구성을 설명하는 새 copy QA 또는 실제 판매용 publication을 수행한 것은 아니다.

WYSIWYG의0차이는 **추출 영역/크기 및 동일 기존 인코딩 기준과의 차이0**다. 실제 저장 형식은 JPEG95이며 원래 source JPEG를 decode한 값과 무손실 압축 같음을 뜻하지 않는다. 결과6개에 대해 encoded SHA/decoded raw SHA를 보관했다. Browser 표시 자체는 responsive scaling을 사용하므로 screenshot pixels와 원본 pixels를1:1 같다고 주장하지 않는다.

`A01-before.png`, `A01-after.png`, `B01-before.png`, `B01-after.png`, `B02-review.png`, `crop-editor-desktop.png`, `crop-editor-mobile.png`, `renderer-A.png`, `renderer-B.png`, `final.png`, `final.jpg`가 ignored artifacts/TASK-053에 있다. `browser.json`, `pixel-verification.json`, `bypass.json`, `errors.json`, `planner.json`, `smoke.json`, `first-phase-ledger.json`, `ledger.json`, `cleanup.json`, `audit.json`과 validation logs를 함께 보관한다. signed URL은 local mock token뿐이다.

재현 helper는 ignored `node_modules/.cache/task053/{serve.mjs,next.cjs,browser.mjs,errors.mjs,keyboard.mjs,verify.mjs,bypass.mjs,smoke.mjs,audit.mjs}`. serve→production Next→Browser→verify/smoke/errors/keyboard→종료 순서이며, verify/bypass는 `node --conditions=react-server --import ./tests/register.mjs`로 실행한다. source 원본 위치는 기존048 comparison을 읽는다. helper는 repository product 코드나 runtime에 포함하지 않는다.

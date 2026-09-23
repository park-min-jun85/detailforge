# TASK-052 — Manual Crop Editor UI, Selection & Retry Integration

2026-09-23. **UI 및 로컬 Browser QA 완료 / 실제 상품 QA는 TASK-053 대기.** `feat/manual-crop-editor-ui`, 기준 HEAD `f2d0518`, 시작 clean. [최신 실행 계약](../V0_2_1_MANUAL_CROP_DESIGN.md). 기존 파일 초기화·stage·commit·main merge·tag0.

## 요청한 75개 완료 보고 항목

1. **TASK 목적:** 저장 전 후보 내부 영역을 사람이 조정하고 기존 선택/재시도/명시 저장 흐름에 연결. 실제 A01/B01/B02 저장 QA는 수행하지 않았다.
2. **branch:** `feat/manual-crop-editor-ui`, HEAD `f2d0518` 유지. 요청 branch 일치.
3. **Candidate control 위치:** Assets Candidate Review의 saveAllowed 카드, checkbox 아래 secondary `[자르기 조정]`. 기본 제외지만 수동 선택 가능한 후보에도 제공하고 prohibited에는 표시0.
4. **editor 형태:** 기존 panel/button/input 스타일을 재사용한 native bounded `<dialog>`. 새로운 UI library0, 후보1개 working copy만 편집.
5. **preview:** 기존 source URL을 SVG image로 사용하고 candidate base viewBox/clip 안만 표시. source 전체를 별도 canvas로 만들지 않는다.
6. **overlay:** 포함 사각형은 흑백 이중 경계, 제외 영역은 even-odd dim path로 표시. 바깥 영역 확장 도구 없음.
7. **handles:** L/T/R/B 네 SVG slider, ResizeObserver로44 CSS px 크기 유지. source pixels로 고정한 터치 크기를 쓰지 않는다.
8. **drag:** Pointer Events/capture/rAF 사용. mouse/pen/touch 공통 경로이며 Chromium mouse와 mobile CDP touch를 실행 검증. SVG root touch-action:none으로 브라우저 스크롤 취소를 막는다. pointercancel/lostcapture/resize는 해당 drag 시작값으로 복귀.
9. **coordinate mapping:** inverse SVG screen CTM으로 client 좌표를 normalized source 좌표로 변환하고 drag 시작점의 delta를 정수화. 표시 크기/letterbox/DPR/URL을 저장 좌표로 쓰지 않는다.
10. **numeric inputs:** 왼쪽/위쪽/오른쪽/아래쪽 source pixel 입력, type=number/min0/step1. blank/소수/음수/비정상값은 숨겨 보정하지 않고 오류로 표시.
11. **dimensions display:** 동일 shared F로 `저장 크기: width × height px`를 실시간 표시. 예 L20/T10/R30/B40,600×500→550×450.
12. **minimum size UX:** 폭·높이≥160, 면적≥64000. pointer/keyboard는 최소크기까지 clamp, numeric invalid는 설명 및 Apply disabled. 서버가 최종 검증 권위.
13. **Apply:** candidateId별 local draft만 적용하고 editor 닫기. Storage/DB/AI 요청0, 카드 preview를 F로 변경.
14. **Cancel:** 이번 working copy만 폐기. 이전 applied draft/선택 유지, Escape도 동일. backdrop click으로 폐기하지 않는다.
15. **candidate-full reset:** editor `[후보 전체로]`는0/0/0/0. Apply하면 명시 manual override를 유지하고 자동 trim을 건너뛴다.
16. **manual override removal:** card `[수동 조정 해제]`는 override/receipt 제거 후 다음 저장을 auto 경로로 돌린다. 선택 상태·기존 Derived 불변.
17. **selected state behavior:** checked/unchecked 모두 Apply/Cancel/remove로 바뀌지 않는다. unchecked draft에는 저장하려면 선택하라는 안내.
18. **manual draft state:** Source panel workspace에 review/selected/drafts/receipts/notice. drafts는 candidateId별 basisKey/baseRect/sourceDimensions/insets/stale. URL/index 기반 key0, localStorage0.
19. **base rect identity:** ID+base rect+basisKey+dimensions를 비교. revision만 바뀌면 보존. 바뀐 basis는 stale 격리하고 기존 insets를 새 후보에 자동 적용하지 않는다.
20. **retry merge:** 안정 ID 유지, 제거 ID draft/selection 삭제 및 안내, 새 ID 무상속/defaultSelected, 변경 base stale. stale draft는 save builder에서 제외하고 자동 crop으로 대체하지 않는다.
21. **order change:** array 순서와 무관한 ID map. 실제 retry 후 reverse 후보 순서에서 draft와 explicit false가 유지됨.
22. **signed URL refresh:** pixel state와 분리. URL 갱신 후 draft 유지, 새 이미지 load/dimensions 확인 전 Apply/save 잠금. panel remount0.
23. **save builder:** 선택된 eligible/미저장 후보만 strict V2 items로 구성하고 최신 expectedRevision 포함. manual은 insets, automatic은 candidateId만 전달.
24. **zero override request:** all-zero 객체도 반드시 manualInsets에 포함. 브라우저 실제 POST body에서 확인.
25. **V1 compatibility:** 기존 `requestCropSave` IDs-only 경로 유지. 신규 `requestCropSaveV2` 추가, route/schema/server 변경0. V1/V2 transport와 기존 서버 회귀 PASS.
26. **save success:** successful candidate만 selection=false/pending draft 제거. 저장한 F는 별도 read-only receipt로 표시하고 fresh savedCrops로 확인한다.
27. **reused save:** existing=true도 성공 처리. selection/draft 제거하며 새 variant는 canonical base에서 명시 조정할 수 있다.
28. **partial failure:** A 신규 성공/B crop_too_small/C reused 시 A/C clear, B selection+draft 유지. 성공 F receipt와 failed 재편집을 Browser에서 확인.
29. **crop_too_small UX:** 후보 번호와 `저장 영역이 너무 작습니다. 자르기 영역을 다시 조정해 주세요.` 안내. raw code만 표시하지 않는다.
30. **stale UX:** 즉시 draft 삭제0. 최신 review 조회 후 같은 basis 유지, 바뀐 base stale 안내/재승인, 사라진 후보 제거. 자동 Save retry0.
31. **conflict UX:** 안전한 변경 안내와 fresh GET. 선택/draft merge 후 사용자가 다시 저장해야 한다. Browser에서 POST1회 확인.
32. **asset-limit UX:** 남은 슬롯과 최대 예상 저장 수 안내. 오류 후 selection/draft 보존. 실제 duplicate/슬롯 preflight는 기존 서버 책임.
33. **storage/persistence UX:** upload/database 실패의 기존 safe message와 draft/selection 유지. fresh GET 실패 시 mutation 잠금, 상태 새로고침 제공.
34. **client geometry helper:** 새 `manual-crop-client.ts`에 pointer/keyboard/clamp/merge/builder/settle. 기존 client-safe `crop-geometry.ts`의 manualCropRect/insetRect 재사용.
35. **WYSIWYG mapping:** editor/card의 F와 서버 shared formula 동일. zero도 추가 trim 없음. pure geometry 및 Browser viewBox/크기, 기존 TASK-051 exact PNG/EXIF 회귀 검증. 실제 상품 export QA는053.
36. **client/server boundary:** 별도 browser bundle dependency graph에 Sharp/server-only/Supabase/service/images/review server 모듈0. 서버 권한 검증을 UI에서 대체하지 않는다.
37. **accessibility:** aria-modal/labelledby/describedby, labelled slider/input, 연결된 validation, aria-live 크기/상태, visible focus. 오류 시 Apply 금지.
38. **keyboard:** 방향키로 physical boundary1px, Shift10px. right/bottom inset 부호 반대. 숫자 입력과 함께 drag-only 방지.
39. **focus:** native modal+명시 Tab/Shift+Tab wrap, 열 때 첫 interactive control, 닫기/Escape 후 진입 버튼 복귀. Browser 검증 중 확인한 native SVG 역방향 Tab 이탈을 보완했다.
40. **responsive375:** 375×812 contain preview,2열 숫자 입력, viewport 내 dialog/가로 overflow0. 화면 height 변경에도20px inset 보존. 실제 screenshot에서 제목·preview·버튼 확인.
41. **image loading:** source image preload/natural dimensions 일치 gate. 실패/크기 불일치 안내, editor 안 실패도 alert와 Apply disabled. 취소 후 새로고침 가능.
42. **performance:** rAF로 pointer 렌더 병합, local-only. 편집 중 fetch/router refresh/임시 crop Storage/huge canvas0. 기존 source/clip 재사용.
43. **general instruction:** `프레임이나 불필요한 여백이 보이면 저장 전에 자르기 영역을 조정할 수 있습니다.` 관리 화면에만 표시.
44. **auto-frame warning:** 구현0. detector/threshold/3%/policyVersion 변경0, knownContentBounds/semantic fixture label production 입력0.
45. **Final isolation:** 변경은 assets management/detail-extraction UI·client helper만. Final Renderer/PNG/JPG control·badge 추가0, 해당 production 파일 diff0.
46. **UI tests:** 실제 React 컴포넌트/실제 CSS를 local-only HTTP fixture+Chromium으로 검증. prohibited/open/Cancel/local Apply/선택/zero/remove/dimensions/minimum/numeric/drag/keyboard/focus/모바일 포함.
47. **draft merge tests:** D1 same keep, D2 removed drop, D3 new no inheritance, D4 rect/basis/dimensions stale, D5 reorder, D6 URL 무관성 및 Browser URL 갱신 PASS.
48. **selection/draft tests:** checked/unchecked Apply 유지, explicit false/default true와 explicit true/default false의 retry 유지. TASK-040 검사1개는 옛 변수명 문자열 의존에서 workspace 동작 검증으로 갱신, 테스트 삭제0.
49. **save builder tests:** selected-only/eligible-only/manual/automatic/explicit zero/unselected manual/stale/invalid/duplicate 필터, V1/V2 transport PASS.
50. **partial save tests:** pure settle 및 두 viewport Browser에서 A/C clear와 B preserve 확인. 저장 receipt preview와 다음 variant save 가능성도 검증.
51. **Browser desktop QA:** Chromium1440×1000 PASS. 실제 pointer/numeric/Apply/Cancel/full/reset/remove/selection/V2/partial/retry/error, console pageerror0, 외부 요청0.
52. **Browser375 QA:** Chromium375×812 PASS. desktop 동일 흐름에 mobile touch/resize/focus trap/44px handle/viewport containment 검증. 물리 pen 기기와 실제 상품 QA는 수행하지 않았다.
53. **생성 파일:** 이 보고서, crop-editor.tsx, manual-crop-client.ts, manual-crop-client.test.mjs, manual-crop.browser.mjs, 합성 manual-crop-ui.mjs — 총6개. 실행 logs/screenshots/audit는 ignored artifacts/TASK-052.
54. **수정 파일:** extraction-panel.tsx, detail-extraction/client.ts, asset-manager.tsx, 기존 retry test1개, manual crop design, boundary contracts, release backlog, tasks README — 총8개.
55. **migration:**0. DB schema 및 Supabase migration 변경0.
56. **dependency:**0. package/package-lock 변경0. 기존 React/Next/Playwright/Sharp/Tailwind 사용.
57. **external AI:**0. Browser retry는 loopback mock response, 실제 모델 호출 없음.
58. **remote mutation:**0. actual A01/B01/B02·기존 Derived·원본·Storage/DB 불변. TASK-048 보호 원본과049 patch hash 검증.
59. **tests:** 신규28 pure/client transport tests. 기존1389 테스트의 계약 유지, 옛 state 변수명 검사1개 갱신. 별도 Browser2 viewport 전체 흐름 PASS.
60. **total tests:** **1417/1417 PASS**, fail0/skip0. `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs`.
61. **typegen:** `npx.cmd next typegen` PASS.
62. **typecheck:** `npx.cmd tsc --noEmit` PASS.
63. **lint:** `npm.cmd run lint` PASS, warning/error0.
64. **build:** `npm.cmd run build` PASS. production server 경계·route 생성 확인.
65. **diff check:** `git diff --check` PASS, conflict/trailing whitespace/newline 검사 PASS.
66. **secret scan:** tracked/untracked source/docs/tests 및 generated client bundle/logs/artifacts에서 configured secret값과 key/token pattern 검사, finding0. 값은 출력하지 않았다.
67. **package version:**0.2.0 유지. v0.2.1 release/tag 미생성.
68. **BLOCKER:**0.
69. **HIGH:**0.
70. **MEDIUM:**1 — 실제 상품 manual review/save QA 미완료, M4 gate 유지.
71. **LOW:**0.
72. **M1 상태:**RESOLVED 유지. 기존 추가 auto trim 안전성 범위를 확대하지 않는다.
73. **M4 상태:**NEEDS_WORK. UI/mock QA만으로 실제 상품 frame/residue 해결 판정하지 않는다.
74. **다음 권장 TASK:**TASK-053 Actual A01/B01/B02 Manual Crop Browser & Save QA. 실제 preview/F/Derived/내용 보존·provenance·기존 데이터 불변 확인 후054 release 검증 판단.
75. **git diff summary:**8 modified+6 new, **+786/-134 lines**(신규 포함), stage0. numstat/신규 line count/secret scan/보호 hash 결과는 `artifacts/TASK-052/audit.json`. commit/main merge/tag0.

## 검증 재실행과 증거

`node tests/manual-crop.browser.mjs`는 기존 Playwright Chromium과 Next에 포함된 webpack/TypeScript/Tailwind를 이용해 production client 컴포넌트를 독립 번들한다. fixture HTTP는127.0.0.1만 bind하며 브라우저 외부 origin을 차단한다. mock save는 in-memory 응답만 만들고 실제 route/service/DB를 호출하지 않는다. 서버 save/pixel 보장은 전체 기존 domain/service 테스트가 별도로 검증한다.

실행 증거: `artifacts/TASK-052/{tests,typegen,typecheck,lint,build,browser}.log`, `browser.json`, `editor-1440.png`, `editor-375.png`, `partial-1440.png`, `partial-375.png`, `audit.json`. generated bundle/loader는 ignored `node_modules/.cache/task052`. 비밀정보와 실제 상품 이미지는 fixture에 넣지 않았다.

문서의 baseline 역사와 최신 계약을 분리했다. TASK-050의 editor Reset→automatic/성공 draft 유지 설계는 이번 요청으로 full-zero/remove 분리 및 successful pending draft clear로 대체한다. panel/Source 전환과 beforeunload 확인은 제공하지만 draft는 session memory이며 임의 SPA 링크 전체 이탈 차단·crash 복구는 보장하지 않는다.

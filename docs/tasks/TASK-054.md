# TASK-054 — v0.2.1 Final Release Validation & Release Preparation

2026-09-23. **PASS — v0.2.1 Local/Internal MVP Release Candidate.** Branch `release/v0.2.1`, 시작 HEAD `240a943`, 시작 clean. M1/M4 RESOLVED, M2/M3 regression PASS, 기존 품질 backlog **BLOCKER0/HIGH0/MEDIUM0/LOW0**. QA PASS 후 package/lock0.2.1로 갱신했다. Git stage/commit/main merge/tag/Release 게시 없음.

## 요청한 68개 완료 보고 항목

1. **TASK 목적:** 기능 동결 상태의 최종 회귀와 v0.2.1 version/문서/Release notes 준비. 새 기능·앱 수정0.
2. **branch:** `release/v0.2.1`, HEAD `240a943` 유지. `git branch --show-current`·`git status` 확인, local main도 같은 HEAD. 공식 최신 tag는 v0.2.0.
3. **v0.2.1 scope:** content-loss guard/colored-frame/pixel-only 결정, manual domain/V2/editor, ID 선택·retry, 출처·중복 재사용, Renderer/Export 격리를 실제 source와 실행으로 확인. 새 algorithm/threshold/UI/AI/Auth/Adapter0.
4. **Auto Crop regression:** 흰/어두운 제품·사람·문자/icon·배경 ambiguity·alpha/detail·최소크기·3% cap PASS. A/H 같은 pixels/config는 preserve, separator 구분 신호 A2는 safe trim. knownContentBounds/semantic label은 production에 전달하지 않는다.
5. **Manual Crop regression:** inward 정수·최소크기·0px·auto bypass·3% 초과·정확한 F·stale/CAS·dedup·출처 PASS. 서버 canonical/source hash/revision 검사와 실제 Sharp save 경로 확인.
6. **A01 결과:** L16/T17/R15/B18, F `(35,522,790,790)`, preview/saved790×790. cleaner, 관찰한 추가 content-loss0. 회색 외곽 제거·녹색 separator/제품·강아지 보존.
7. **B01 결과:** L8/T0/R0/B26, F `(368,2000,372,546)`, preview/saved372×546. cleaner, 관찰한 추가 content-loss0. bottom26>자동 cap17 그대로 적용, 인물·의류 보존.
8. **B02 결과:** bottom38 preview의 양옆 제품 texture 제외를 확인하고 Escape/Cancel. 뒤이은 override 제거→automatic 저장도 full691×547/추가 trim0. same/preserve PASS.
9. **Desktop QA evidence:** Chromium1440×1000, 실제 이미지/production UI→V2 route→save service/Sharp→격리 persistence. dialog/preview/overlay/handles/numeric/Apply/Cancel/reset/remove PASS. `crop-editor-desktop.png`, `browser.json`, `ui/browser.json`.
10. **Mobile QA evidence:** Chromium375×812 실제 A01 full-zero 저장, 가로 overflow0. 동일 production React의 합성 UI 회귀에서 touch/resize/44px handle 포함 PASS. `crop-editor-mobile.png`, `ui/editor-375.png`.
11. **keyboard/accessibility:** 실제 A01 Tab22회·양방향 wrap/Arrow1px/Shift10px/Enter Apply/Escape focus 복귀 PASS. labelled controls·dialog/validation association 코드와 numeric error/Apply 차단 확인. 스크린리더·물리 입력기기 전체 인증을 주장하지 않는다.
12. **selection preservation:** checked/unchecked/default false 명시 check, Apply·Cancel·remove 비선택, stable candidate ID reorder/retry/read refresh/URL refresh 보존. actual+합성 Browser 및 기존 TASK-040 회귀 PASS.
13. **retry/draft preservation:** crop_too_small/stale/revision conflict/CAS miss 실제 route 오류에서 초안·선택 유지/자동 재전송0. asset_limit Browser mock, upload 실제 local 실패, database Browser mock+service 보상 회귀 PASS. read 실패 후 mutation 잠금도 유지.
14. **zero override:** all-zero manualInsets가 V2 body에 유지. A01/B01 full-zero는 manualv2 새 변형, B03 auto와 같은 F는 기존 재사용. 실제 source instrumentation에서 manual+zero trimCrop 호출0.
15. **partial save:** B01 zero 신규 성공/B02 upload 실패/B03 reused 실제 batch saved2(existing1)/failed1. 성공·재사용 selection/draft clear, B02 keep. 실패한 신규 object만 정리하는 service 보상 회귀 PASS.
16. **duplicate Derived:** 같은 parent+source hash+final rect의 반복 요청은 같은 Asset ID·추가 row0·provenance 불변. role/base/mode 차이 회귀 PASS, 실제 auto B03→zero manual 재사용 확인.
17. **different variants:** A01/B01 조정F와 full-zeroF는 별도 Derived. local 신규6개=manual4+automatic2, 원본2 포함8개. 30개 limit·고유F 슬롯 계산 회귀 PASS.
18. **provenance:** parent/hash/candidate/sourceRect=base/normalized dimensions/adjustment.mode manual·insets/schemaVersion2 검증. F는 base+insets로 파생. manual trim 필드 없음, 재사용한 auto v1 출처 덮어쓰기0.
19. **legacy Derived compatibility:** trim 없음/auto trim policy1·2/manual derivation2 reader·inventory·dimensions·중복 회귀 PASS. pre-v0.2.1 row rewrite/migration0.
20. **existing Derived protection:** 기본 auto 재요청은 승인된 기존F를 재사용. version 변경만으로 recrop/원본·기존 파일·Page 참조 변경0. 원격 DB/Storage 미접속.
21. **Planner visibility:** 실제 `buildVisualAssetInventory`에서6개 모두 derived, 각 단독 변형 available. 대표 B page-plan GET에 manual 포함. 매우 유사한 변형은 기존 mode-independent near-duplicate 정책으로 억제될 수 있다. A Facts 없는 fixture는 deterministic inventory로 검증.
22. **Renderer purity:** A hero1/B hero+gallery3 이미지 정상·contain, 누락0/가로 overflow0. capture surface button/input/dialog/slider 및 crop·internal warning/provenance text0. 최종 PNG/JPG 직접 시각 확인.
23. **PNG dimensions/bytes:** 대표 B canonical1회, **860×2468 / 819,404bytes**. TASK-053 PNG와 encoded bytes exact.
24. **JPG dimensions/bytes:** 대표 B canonical1회, **860×2468 / 242,474bytes**. TASK-053 JPG와 encoded bytes exact. source geometry/구성이 같아 height 변경 없음.
25. **WYSIWYG:** Browser previewF=serverF=Asset dimensions. 실제 Derived6개 sourceF→기존 JPEG95/4:4:4 reference bytes·decoded pixels exact. PNG fixture exact subset/EXIF1~8 회귀 PASS. JPEG 원본 raw와 무손실 같음을 뜻하지 않는다.
26. **M1 regression:** synthetic content-loss0 및 실제 A01/B01 관찰한 추가 손실0, B02 보존. auto guard 약화/threshold 변경0, RESOLVED 유지.
27. **M4 regression:** safe auto+ambiguous preserve+explicit manual/WYSIWYG/provenance/dedup/stale/CAS 및 A01/B01 cleaner/B02 safe preserve·Desktop/Mobile·Renderer/Export PASS.
28. **M2 regression:** failed-only retry/checkpoint/선택·초안/partial/CAS 회귀 PASS. 이번 실제 provider retry0.
29. **M3 regression:** role-aware copy/observation-narration/capture guard와 Renderer 회귀 PASS. 신규 실제 AI 출력0, 기존 TASK-043 실제 출력 근거와 구분.
30. **Product/Facts/Options protection:** local project/product/facts(Validation 포함)/options hash 불변. Specification6행·Options1그룹6값 DOM exact, canonical content/snapshot IDs·version 불변. 기존 사용자 원격 데이터 변경0.
31. **original asset hash protection:** source2+metadata2 보호 파일 SHA256 및 실제 patch3 hash 동일. A `ffc49a546991f56b620080cb1a76fdd817a52dfdbaf5f37fd47318135c7ef4e8`, B `32a08abba067f3410d3f04e8d8b293f29b9c5290a7a5d7d1062964c74e4adb59`. local stored source bytes도 불변.
32. **security:** bounded Candidate/strict V2/client path·hash authority 금지/same-origin/8KiB/recursive Derived 차단/safe response·checkpoint projection/SSRF 회귀 PASS. client server dependency graph·configured key scan 이상0.
33. **Public SaaS blockers:** Authentication, owner_id, user-specific RLS, Storage ownership policy 미완료. 별도 공개 배포 blocker이며 내부 품질 severity0과 혼동하지 않는다. Local/Internal MVP 범위.
34. **external API calls:** Domeggook0/remote source fetch0/기타 외부 API0. local 파일과 loopback QA만 사용, Browser와 Next fetch 외부 origin 차단.
35. **OpenAI calls:**0. 기존 canonical 후보·문구/fixture 재사용, 실제 분석·Planner/Section 재생성 없음.
36. **remote mutation:** DB/Storage read/write0. local in-memory lease/revision/Derived rows만 변경, 임시 QA scope 사용.
37. **tests:** `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs` 전체 실행. 테스트 추가·삭제·필터0. 별도 actual Browser/save/pixel/export 및 합성2viewport regression 실행.
38. **total tests:** **1417/1417 PASS**, fail/cancel/skip/todo0. baseline1417 유지, discovery 감소0.
39. **typegen:** `npx.cmd next typegen` PASS.
40. **typecheck:** `npx.cmd tsc --noEmit` PASS.
41. **lint:** `npm.cmd run lint` PASS, warning/error0.
42. **build:** `npm.cmd run build` PASS. QA 전 production build, 버전0.2.1 변경 뒤 production build 재확인 PASS. Browser/Export는 동일 앱 source의 전자 build 사용.
43. **diff check:** `git diff --check` PASS. 신규 TASK 문서 whitespace/newline/conflict marker·수정 문서 local link도 별도 확인.
44. **secret scan:** tracked/untracked source/docs/tests, client static bundle,054 artifacts/helper/UI bundle의 설정된 비밀값3종·credential/signed-token 패턴 findings0. 값 출력0, 전체 Git 역사/모든 비밀 유형을 보장하는 검사는 아니다.
45. **package version before:**0.2.0. QA preflight PASS 당시 아직0.2.0이었음을 기록.
46. **package version after:**0.2.1. QA PASS 뒤 변경.
47. **package-lock version:**top-level 및 packages root 모두0.2.1. 두 version 필드 외 parsed deep equality, dependency tree 불변.
48. **dependency changes:**0. package dependencies/devDependencies/scripts 및 lock packages 불변.
49. **migration changes:**0. Supabase SQL·generated types·기존 data rewrite0.
50. **CHANGELOG:**`0.2.1 - 2026-09-23` Added/Improved/Safety / Data Integrity/Validation/Known Limitations 추가. 보수 자동+명시 수동 결합 및 공개 blocker 명시.
51. **README:**current0.2.1 RC, Candidate Review 조정·0px/해제·별도 저장·범위와 Local/Internal 표시만 최소 갱신. 공식 latest0.2.0과 미게시RC 구분.
52. **RELEASE_BACKLOG:**v0.2.1 목표 완료, M1/M4 RESOLVED, 기존 품질 B0/H0/M0/L0. 아래 오래된 M1/M4 열린 설명도 현재 종료 정의로 정정, public blockers 별도 유지.
53. **RELEASE_CHECKLIST:**검증한 항목만[x], Auth/owner_id/user RLS/Storage ownership·fresh install/새 외부 full E2E·Git release 작업은[ ] 유지.
54. **QA cleanup:**Next3054/persistence4354 정상 종료 후 listener0·process exit0 확인. 별도 UI fixture/Chromium도 종료. in-memory rows/objects 폐기, ignored evidence만 보관. 실제 사용자 데이터 정리/삭제0.
55. **BLOCKER:**0.
56. **HIGH:**0.
57. **MEDIUM:**0.
58. **LOW:**0.
59. **M1 final state:**RESOLVED, 추가 automatic trim content-loss 안전성 gate 범위. 보편적 의미 인식/외부 content 복원 보장은 아니다.
60. **M4 final state:**RESOLVED, 보수 자동 경계 처리와 명시적 수동 Crop의 결합. 모든 frame 자동 제거를 주장하지 않는다.
61. **M2/M3 state:**RESOLVED 유지, regression PASS. 앱 변경0.
62. **RC verdict:** **PASS — v0.2.1 Local/Internal MVP Release Candidate.** 공개 SaaS readiness 승인이 아니다.
63. **recommended commit:**`chore: prepare v0.2.1 release` — 제안만, 미실행.
64. **recommended tag:**annotated `v0.2.1` — 제안만, 미생성.
65. **GitHub Release title:**`DetailForge v0.2.1 — Image Extraction Quality Patch`.
66. **Release notes draft:**아래 실제 검증 기반 초안. 게시0.
67. **exact next Git commands:**아래 사용자 실행용 명령. 이번 실행0.
68. **git diff summary:**문서8개(신규 TASK-054 포함)+package/lock2개=10파일. 기존9개 수정/신규1개, **+223/-11행**(신규122행 포함). 앱/tests/fixtures/SQL/dependency0. numstat는 ignored `artifacts/TASK-054/audit.json`, binary artifacts stage0.

## GitHub Release notes 초안

DetailForge v0.2.1은 **Local/Internal MVP**의 Image Extraction Quality Patch입니다. 보수적 자동 경계 처리와 명시적 수동 Crop을 결합했습니다.

- 제품·인물·문자 경계 보호를 우선하며, 확실한 pixel 구분 신호가 있는 frame만 보수적으로 자동 정리합니다. 모호한 배경·패널·내용 접촉 경계는 보존합니다.
- Candidate Review에서 저장 전 후보 내부의 네 가장자리를 드래그·방향키·숫자로 조정하고 미리본 영역을 명시적으로 저장합니다. 선택·초안과 실패 복구 상태를 유지합니다.
- 수동 영역은 추가 자동 trim 없이 저장하며 source/candidate/revision·CAS를 검사합니다. 같은 최종 영역은 Derived를 재사용하고 기존 승인 이미지·출처를 덮어쓰지 않습니다.
- 전체1417개 회귀, Desktop/375px Browser·실제 local save, 원본 데이터 보호와860×2468 PNG/JPG 검증을 통과했습니다. A01/B01은 cleaner·관찰한 추가 내용 손실0, B02는 취소/보존을 확인했습니다. M1/M4 해결, M2/M3 회귀 PASS입니다.
- 모든 frame 자동 제거 또는 임의 수동 입력의 내용 보존을 보장하지 않습니다. 기존 Derived 직접 편집/outward 확장/AI 이미지 생성·배경 제거·upscale은 미지원입니다. JPEG/WebP는 기존 품질 설정으로 재인코딩됩니다.
- Auth/owner_id/사용자별 RLS/Storage ownership policy가 미완료이므로 공개 SaaS 배포용 릴리스가 아닙니다.

## 최종 검토 후 사용자가 실행할 명령

아래는 제안이며 실행하지 않았다. 예상 branch가 아니거나 예상하지 못한 diff/원격 변경, fast-forward 실패가 있으면 먼저 검토한다. `origin` 존재와 현재 local main=`240a943`를 읽기 확인했으며 원격 상태를 새로 조회하지는 않았다. GitHub 게시도 사용자에게 남긴다.

```powershell
Set-Location C:\Projects\detailforge
git branch --show-current
git status
git diff --check
git diff
git add -- package.json package-lock.json README.md CHANGELOG.md docs/RELEASE_BACKLOG.md docs/RELEASE_CHECKLIST.md docs/V0_2_1_IMAGE_BOUNDARY_CONTRACTS.md docs/V0_2_1_MANUAL_CROP_DESIGN.md docs/tasks/README.md docs/tasks/TASK-054.md
git diff --cached --stat
git diff --cached
git commit -m "chore: prepare v0.2.1 release"
git fetch origin
git switch main
git merge --ff-only origin/main
git merge --ff-only release/v0.2.1
git tag -a v0.2.1 -m "DetailForge v0.2.1 — Image Extraction Quality Patch (Local/Internal MVP)"
git push origin main
git push origin v0.2.1
```

명령은 단계별로 성공을 확인하며 실행한다. 원격/main이 바뀌어 fast-forward가 실패하면 자동 merge/force-push하지 않는다. main push 실패 시 tag push도 진행하지 않는다. 완료 후 GitHub의 tag `v0.2.1`에 위 title/notes로 Release를 게시한다. `git add .`나 artifacts staging은 포함하지 않았다.

## 재현 근거와 검증 한계

AGENTS/CLAUDE·지정 docs/TASK-046~053·package/lock을 읽고 설치된 Next16.3.4 Playwright guide를 따랐다. source 검토는 `frame-analysis/edge-trim/images/crop-geometry/schemas/service/http/public-response`, `manual-crop-client/crop-editor/extraction-panel`, visual inventory와 Renderer/save route를 포함한다. 문서만으로 구현 상태를 판단하지 않았다.

local source2/EXIF1와 canonical metadata는 기존048/043 자료를 재사용했다. 053 helper를054 폴더/포트/격리 IDs로 복제해 실제 앱을 실행했고 원격 persistence만 in-memory REST/Storage로 대체했다. 오류 재현은 요청 fault injection/CAS miss/upload 실패 및 일부 mock 응답이다. 실제 유료 API나 원격 Supabase E2E를 실행했다는 뜻은 아니다. 별도 `ui.mjs`는 repository `manual-crop.browser.mjs`를 증거 출력 경로만 바꾸어 실행했다. 신규 dependency0.

시각 판정은 Codex가 before/after·실제 dialog·PNG/JPG를 직접 본 결과이며 사용자 human sign-off가 아니다. JPEG95 reference exact는 geometry/동일 인코딩 기준 일치이고 원본 raw 무손실 보장이 아니다. 임의 사용자 crop의 semantic safety, 모든 브라우저/물리 기기/원격 설치를 보장하지 않는다. 기존 canonical B 문구·스펙·옵션을 그대로 재사용했으며 새 사진에 맞춘 copy 생성은 이번 범위 밖이다.

Ignored 증거는 `artifacts/TASK-054/`의 tests/typegen/typecheck/lint/build-before-version/build 로그, browser/ui/browser/errors/keyboard/pixel-verification/bypass/planner/smoke/ledger/cleanup/preflight/audit JSON, actual before/after·editor·renderer·final PNG/JPG다. TASK-053 증거는 덮어쓰지 않았다. 최종 canonical PNG/JPG는053과 byte identity도 확인했지만 동일 환경의 회귀 결과이며 모든 환경에서의 byte 재현성을 보장하지 않는다.

재현 helper는 `node_modules/.cache/task054/`다. serve→production Next→browser→verify/bypass→errors/keyboard→smoke→정상 종료→preflight 순서, verify/bypass는 `--conditions=react-server --import ./tests/register.mjs`를 사용한다. 종료 직후 listener 검사 timing만 재확인했으며 production defect나 잔류 process는 없었다. release version 변경 후 production build와 최종 문서/lock/diff/secret audit를 수행했다.

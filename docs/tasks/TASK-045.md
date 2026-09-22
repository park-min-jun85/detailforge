# TASK-045 — v0.2.0 Final Release Candidate Validation & Release Preparation

2026-09-22, `C:\Projects\detailforge`, `release/v0.2.0`, 시작 HEAD `b9f42f7`, clean. **RC PASS — DetailForge v0.2.0 Local/Internal MVP Release Candidate**. BLOCKER0/HIGH0/MEDIUM2(M1/M4 의도적 이월)/LOW0. package/lock0.2.0으로 준비했으며 commit/main merge/tag/GitHub Release는 하지 않았다. 공식 tag는 아직 v0.1.1이다.

## Release freeze와 검증 경계

AGENTS/CLAUDE, README/CHANGELOG/Checklist/Backlog/Roadmap/Contracts/TASK-040~044, package/lock과 실제 checkpoint/retry/review/selection/copy/renderer/service 코드를 대조했다. 앱·테스트·prompt·AI 단계·migration·dependency·M1/M4는 변경하지 않았다. 원래 diff는 없었으며 최종 변경은 문서7개와 package2개뿐이다.

이번 full smoke는 **같은 상품67695797의 단계별 격리 fixture 재사용 검증**이다. 새 원격 Project를 만들고 외부 API를 처음부터 끝까지 호출한 단일 E2E가 아니다. 사용자 허용에 따라 기존 실제 TASK-030/040/043 결과를 재사용했고 현재 서비스/브라우저/전체 회귀로 연결을 확인했다. 외부 API/OpenAI/Domeggook/원격 DB·Storage0회. 실서비스 호출 없이 실행한 synthetic provider/UI 응답은 실제 OpenAI 결과와 구분한다.

- Project/Wholesale Import/Product save: 로컬 Project fixture에서 실제 previewImport→saveImport→getProductDetail 실행. HTML은 실제67695797의 확정 이름/설명/스펙을 재구성한 JSON-LD fixture다. preview 무변경, 명시 저장 후 Facts exact. 실사이트의 현재 HTML/접근 가능성을 새로 검증한 것은 아니다.
- Option Import: 위 저장 Product를 다음 격리 DB에 전달해 실제 previewImportedOptions→prepareImportedOptions→saveProductOptions 실행. 공식 API 형태의 frozen6값 응답을 주입했다. 후보 반영은 read-only, 별도 저장 후 label/순서 exact·Product 불변.
- Images/Extraction/Derived: 실제 B 원본과 기존 crop bytes/출처 metadata를 재사용했다. 현재 Images 화면과 전체 suite의 업로드·partial checkpoint·failed-only retry·Derived 저장/중복 guard를 검증했다. 새로운 실제 AI 분석이나 새 원격 Derived 저장은 하지 않았다.
- B fixture의 사용하지 않는 원본 thumbnail1개는 기존 로컬 byte 자료가 없어 Images 화면에 미리보기 불가로 남는다. 최종 페이지가 참조하는4개는 모두 실제 byte로 로드됐다. 전체 원격 Storage 가용성을 이번 smoke로 보장하지 않는다.
- Product/Asset Analysis→Fact Validation→Planner: 기존 실제 결과를 브라우저에서 차례대로 확인했다. 원본 canonical 상태에서 상품 분석 완료, Fact7개 supported, Planner prerequisite=ready/stale=false, Section planReady=true/stale=false다. current reader/grounding/security 회귀도 통과했다.
- Section Engine: TASK-043의 **첫 accepted domain output 그대로**를 production generateSections의 server-only DI provider로 replay1회.4개 accepted, marketing/spec copy와6 options exact. 새 실제 모델 출력의 평가가 아니다.
- Editor→Renderer→PNG/JPG: 실제 Next production app·same-origin API·조건부 저장·candidate signature/명시 apply·실제 Chromium Export를 사용했다. 최종 export 전에 QA 임시 문구/재생성 상태를 TASK-043 canonical Sections로 복구했다.

## M2 / M3 / L1 및 사용자 화면

M2의 실제 failed-only OpenAI 근거는 TASK-040(준비1+retry1, 성공 tile 재호출0)을 재사용했다. 이번 전체 suite는 T1~T8, checkpoint bounded persistence, 재시도 대상/호출 수, 성공 보존, stale/conflict/no-op, Derived save/dedup을 다시 실행했다.

추가 Browser M2 검증은 별도800×3600 실제 원본 segment에 **합성 Review DTO**를 연결했다. 화면상3tile(성공1/실패2)은 UI 상태 검증용이며 실제 segment를3tile로 분석했다고 주장하지 않는다. 현재 production panel/client를 사용하고 QA harness만 응답을 제공했다. 기본 true A, explicit false B, 기본 false→explicit true C를 선택한 뒤 retry1 POST. 완료 시 C/A/new-true/new-false/B 순으로 재정렬되어도 true/false 모두 보존했다. full reanalysis0. stale에서는 failed-only 버튼 대신 전체 재분석 안내, conflict 후 read 실패에서는 현재 후보/선택 보존과 상태 새로고침 안내/작업 잠금을 확인했다. 이 UI fixture를 제거한 뒤 원본 canonical 기반 다음 단계를 진행했다. 실제 provider 실패/과금 여부는 이번에 검증하지 않았다.

M3는 기존 frozen22개·capture 정상/거부 corpus를 포함한 전체 회귀 PASS. TASK-043 첫 canonical의 exact/normalized/Fact marketing reuse/title-body/cross-purpose/visual-message/meta/camera/capture 문제 수가 각각0, 스펙/옵션 exact다. 기존 실제 결과의 재평가이지 새 AI 표본 증가가 아니다. unsupported V-only와 Section/regen reject의 기존 성공 보호도 회귀 PASS.

Editor에서 gallery를 ‘앞면 지퍼 여밈’ / ‘앞면에는 지퍼 여밈이 적용되어 있습니다.’로 수동 편집했다. dirty 확인 후 local DB save failure를 주입해 입력 보존, 오류 제거 후 재시도 저장 성공, 한국어 제목/본문 반복 이유, 재조회 후 문구 유지 확인. 정상 mock regeneration1회는 후보 상태에서 canonical hash 불변, ‘새 결과 적용’ 후 gallery만 변경. 두 번째 mock의 ‘외관을 담았습니다.’는 copy_quality 거부, apply 버튼0·직전 canonical hash 동일. UI의 provider/model 표시는 기존 앱 동작이며 이2개 응답은 OpenAI 생성물이 아니다.

L1은 TASK-044의 고정 A/B와 비교했다. A sparse2035px, B dense/visual-rich3057px 유지. 모든 섹션 높이·문구·첫 visual offset217px·이미지 크기 동일. A spec210/option81/feature167/notice155px, B spec494/option216px. 기존 M1/M4 원본 픽셀 문제는 수정·종료로 세지 않는다.

## Export / 데이터 보호 / 보안

실제 export POST5회: A PNG/JPG 각1, B PNG2/JPG1. A860×2035: PNG615,039B/JPG182,455B. B860×3057: PNG1,493,664B/JPG357,016B. B repeat PNG는 크기·raw pixels·bytes 모두 동일했다. Final DOM은860px, zoom1, transform none, overflow false, controls0, alerts0, review/debug/candidate text0. 이미지 로드 및 원문 스펙/옵션 exact. B PNG/JPG를 새로 시각 확인했고 A 출력은 TASK-044와 파일 hash까지 동일하다. 새 clipping/누락/가로 overflow0. Review shell의 안내는 상품 article 및 export 밖이다.

Products/Facts/Validation 입력/Options/기존 Assets(전체 Derived parent/source fingerprint/crop rect/approval metadata 포함) deep equality PASS. TASK-030 source/evidence, TASK-040 metrics, TASK-043 canonical 파일 SHA-256 불변. source를 Sharp로 읽어 QA byte buffer를 만들었지만 원본 파일은 쓰지 않았다. QA에서 기존 Derived 자동 삭제/수정0. Section generation/retry/regen/export/CAS 실패 보존은 전체 회귀로 재검증했다.

키는 loopback 앱용 dummy만 주입하고 외부 fetch를 차단했다. 실제 설정 secret3종 값은 출력하지 않고 source/docs/tests/untracked 문서·`.next/static`·TASK-045 text/log에 exact match 및 credential/signed-token pattern scan을 실행했다. findings0. provider raw error 비노출, checkpoint raw cache DTO 제거와 SSRF/DNS/redirect/size guard는 전체 회귀 PASS. 이는 현재 파일/알려진 값/패턴과 회귀 범위의 검증이며 전체 Git 역사나 신규 외부 penetration test가 아니다.

QA용 Next/DB/Storage/관리 endpoint를 종료했다.3044/4344/3045/4345 및 runtime DB port listener0, 작업 중 만든 browser tab 닫음. 기존 사용자 서버를 종료하지 않았고 임시 branch/worktree/원격 객체도 만들지 않았다. artifact는 gitignored이며 stage0.

## 완료 보고 — 62항목

1. **TASK 목적:** v0.2.0 최종 RC 회귀·사용자 flow·보호 경계 검증 및 릴리스 준비.
2. **branch:** release/v0.2.0, 시작 b9f42f7 clean, branch 변경0.
3. **scope summary:** partial checkpoint/cache, failed-only explicit retry, review UI/selection, role repetition/capture guard, sparse rhythm.
4. **Full smoke 상품:** 67695797 우선, sparse 보조67399861 계열. 위 단계별 replay 범위 PASS.
5. **Import:** 실제 preview/save 서비스, frozen HTML 응답, 상품/Facts exact, 외부0.
6. **Options:** 후보→반영→명시 저장 서비스 PASS, 원문6개 유지.
7. **Extraction:** 기존 실제 source/결과 재사용, 현행 checkpoint/retry suite PASS.
8. **M2 retry regression:** partial·failed count·명시 버튼·실패 대상만 호출·성공 재호출0·stale/conflict/no-op PASS.
9. **selection preservation:** checked/unchecked/새 default/재정렬 Browser 및 회귀 PASS.
10. **Derived regression:** save/dedup/parent/hash/rect/approval 보존 PASS, 새 원격 저장0.
11. **Product Analysis:** 기존 실제 완료 결과 재사용·최신 상태 확인, 관련 서비스 회귀 PASS.
12. **Fact Validation:** 기존 실제7개 supported 재사용, source/Facts 불변·현재성 PASS.
13. **Planner:** 기존 실제4개 Plan 재사용, prerequisite ready/stale false 확인.
14. **Section Engine:** frozen 첫 accepted 출력 DI replay1회/4개 accepted, 실제 AI0.
15. **M3 regression:** 반복6범주0·frozen corpus/grounding 회귀 PASS.
16. **capture narration regression:** 첫 canonical0, Browser mock reject1·원문 보존, 정상 negative corpus PASS.
17. **L1 regression:** A2035/B3057 및 모든 섹션/이미지 크기 유지.
18. **Editor:** dirty/실패 입력 보존/재시도 저장/한국어 이유/refresh PASS.
19. **regeneration:** mock2회, candidate-first/명시 apply/거부 시 기존 성공 보존 PASS.
20. **Final Renderer purity:** 상품 article 내부 review/retry/control/debug/candidate0.
21. **Specification exactness:** B6행·A2행 원문/순서 exact.
22. **Options exactness:** B6값·A1값 원문/순서 및 저장 snapshot 보호.
23. **PNG dimensions/bytes:** A860×2035/615,039B, B860×3057/1,493,664B.
24. **JPG dimensions/bytes:** A860×2035/182,455B, B860×3057/357,016B.
25. **export repeatability:** 같은 B PNG2회 dimensions/pixels/bytes identical.
26. **Product/Facts/Options protection:** deep equality 및 원본 파일 hash PASS, 원격 mutation0.
27. **security:** 키/원시 오류/cache exposure·SSRF 회귀와 secret scan PASS.
28. **Public SaaS blockers:** Authentication/owner_id/per-user RLS/Storage ownership 미완료 유지.
29. **external API call count:** 0. loopback fixture 요청은 외부 호출로 세지 않는다.
30. **OpenAI call count:** 0. 별도 mock Section1/regen2, M2 UI 합성 응답.
31. **tests:** 정확한 전체 harness 실행, 테스트 추가/삭제/skip0.
32. **total tests:** 1156 PASS, fail/cancel/skip0. 숫자를 향후 계약으로 고정하지 않는다.
33. **typegen:** npx.cmd next typegen PASS.
34. **typecheck:** npx.cmd tsc --noEmit PASS.
35. **lint:** npm.cmd run lint PASS.
36. **build:** npm.cmd run build PASS, version 변경 후 재확인.
37. **diff check:** git diff --check PASS.
38. **secret scan:** configured keys3종·패턴, findings0. 최종 파일 수는 audit.json 참조.
39. **package version before:** 0.1.1.
40. **package version after:** QA PASS 후0.2.0.
41. **package-lock version:** top-level/packages root0.2.0, 나머지 deep-equal.
42. **CHANGELOG:** 0.2.0 - 2026-09-22 Added/Improved/Safety/Validation/Known Limitations 추가.
43. **README:**0.2.0 RC·부분 실패 retry·known limitations만 제한 갱신.
44. **RELEASE_BACKLOG:** M2/M3/L1 RESOLVED, MEDIUM2/LOW0.
45. **RELEASE_CHECKLIST:** 실행 범위 체크, 새 실제 API/fresh install/Public SaaS/commit/tag/publish 미실행은 unchecked.
46. **QA cleanup:** baseline Sections 복구, 로컬 메모리·서버·탭 종료, listener0, stage0.
47. **BLOCKER:**0.
48. **HIGH:**0.
49. **MEDIUM:**2.
50. **LOW:**0.
51. **M1:** 의도적 이월, 인물/제품 잘림 구분 한계 유지.
52. **M4:** 의도적 이월, 원본 유색 프레임 보존 한계 유지.
53. **M2:** RESOLVED.
54. **M3:** RESOLVED.
55. **L1:** RESOLVED.
56. **v0.2.0 RC verdict:** PASS — Local/Internal MVP. 공개 SaaS Ready 아님.
57. **recommended commit:** chore: prepare v0.2.0 release.
58. **recommended tag:** annotated v0.2.0, 이번에는 생성하지 않음.
59. **GitHub Release title:** DetailForge v0.2.0 — Local/Internal MVP Release.
60. **GitHub Release notes draft:** 다음 절의 사용자 관점 초안.
61. **exact next Git commands:** 아래 사용자 실행용 명령. 현재 실행0.
62. **git diff summary:** 문서7개 + package/lock2개 =9파일, production/test/SQL/dependency 변경0. artifacts 미추적·미stage.

## GitHub Release notes 초안

DetailForge v0.2.0은 ‘검토와 재시도의 예측 가능성’을 개선한 Local/Internal MVP 릴리스입니다.

- 상세이미지 분석이 부분 실패하면 실패한 영역만 직접 재시도할 수 있습니다. 성공 결과와 후보의 체크·해제 상태를 보존합니다.
- Section 제목/본문 및 역할 간 반복과 촬영·관찰 보고체 검증을 보완했습니다. 검토 이유는 편집 화면에 표시하며 상품 출력에는 포함하지 않습니다.
- 짧은 텍스트 Section의 여백을 줄이고 이미지 크기와 상세한 스펙·복수 옵션의 배치를 유지했습니다.
- 전체1156개 회귀와 격리 smoke,860px PNG/JPG·반복 출력·원본 데이터 보호 검증을 통과했습니다. M2/M3/L1 해결, BLOCKER0/HIGH0/MEDIUM2/LOW0입니다.
- 알려진 한계: M1 인물/제품 잘림 구분, M4 원본 유색 프레임. AI 결과는 사람의 검토가 필요합니다.
- Auth/owner_id/사용자별 RLS/Storage ownership은 아직 없으므로 **공개 SaaS 배포용 릴리스가 아닙니다**.

## 최종 검토 후 사용자가 실행할 명령

아래 명령은 제안이며 이번 TASK에서 실행하지 않았다. 예상하지 못한 변경/충돌이 보이거나 `--ff-only`가 실패하면 그 상태를 먼저 검토한다. `git add .` 대신 릴리스 파일만 명시하며 artifacts를 stage하지 않는다.

```powershell
Set-Location C:\Projects\detailforge
git branch --show-current
git status
git diff --check
git diff
git add -- package.json package-lock.json CHANGELOG.md README.md docs/RELEASE_BACKLOG.md docs/RELEASE_CHECKLIST.md docs/V0_2_ROADMAP.md docs/tasks/README.md docs/tasks/TASK-045.md
git diff --cached --stat
git commit -m "chore: prepare v0.2.0 release"
git fetch origin
git switch main
git merge --ff-only release/v0.2.0
git tag -a v0.2.0 -m "DetailForge v0.2.0 Local/Internal MVP Release"
git push origin main
git push origin v0.2.0
```

그 뒤 GitHub의 새 Release에서 tag `v0.2.0`, 위 title/notes를 선택해 사용자가 게시한다. main의 원격 push가 거부되면 force-push하지 않고 원격 변경을 검토한다.

## 로컬 근거

`artifacts/TASK-045/`: import-smoke.json, readiness.json, generation-smoke.json, quality.json, ledger.json, audit.json, cleanup.json, tests/typegen/typecheck/lint/build 로그, product/analysis/validation/planner/sections DOM, M2 before/after/stale/conflict 근거, Editor failure/warning/candidate/applied/rejected, A/B final metrics와 PNG/JPG/B repeat PNG. 모두 gitignored.

`node_modules/.cache/task045/`의 로컬 harness는 production 파일과 분리되어 있다. B 원본 이미지 reconstruction은 기존 TASK-042 helper를 재사용했다. A는 TASK-044 동일 fixture/harness 재사용이다. 외부 키·raw provider 응답·실제 signed URL token은 결과물에 기록하지 않았다.

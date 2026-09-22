# DetailForge Release Checklist

## v0.2.0 — TASK-045 현재 판정

2026-09-22 · `release/v0.2.0` · 시작 HEAD `b9f42f7`, 당시 main도 동일. **PASS — v0.2.0 Local/Internal MVP Release Candidate.** 현재 공식 tag는 v0.1.1이며 아래 release 작업은 사용자에게 남긴다. [상세 범위·근거](tasks/TASK-045.md).

- [x] Release freeze: production/test/prompt/SQL 수정0, dependency0. package와 릴리스 문서만 변경.
- [x] 전체1156 tests PASS, fail/skip/cancel0. M2 checkpoint/failed-only/provider 대상·selection·stale/CAS/no-op/Derived dedup 및 오류 보존 회귀 포함.
- [x] M3 exact/normalized/title-body/cross-purpose/visual/camera/meta/capture/V-only guard 회귀. TASK-043 첫 accepted canonical 재평가의 해당 문제0.
- [x] 67695797 단계별 full smoke: import preview→Product/Facts save→옵션 preview/apply/save는 현재 서비스+격리 DB로 실행. Images/Extraction/Derived/Analysis/Validation/Planner는 기존 실제 fixture 재사용과 현재 서비스/브라우저/회귀를 결합. Section Engine은 TASK-043 첫 출력 DI replay1회 accepted. 새 실제 외부 full E2E로 보고하지 않는다.
- [x] M2 실제 provider 근거는 TASK-040 재사용. 이번 Browser retry는 합성 DTO2failure→complete·체크/해제/새 default·재정렬·stale·conflict-refresh failure 검증. 새 실제 retry 호출0.
- [x] 실제 Editor 수동 반복 문구 dirty→저장 실패(입력 보존)→재시도 성공→한국어 warning reason→재조회. mock provider 정상 후보1개는 비교/명시 apply, capture narration 후보1개는 거부·기존 성공 보존.
- [x] L1 A2035px/B3057px와 섹션 높이/첫 이미지 위치/이미지 크기/문구가 TASK-044 이후와 동일. Final 폭860, scale/zoom 없음.
- [x] Final 상품 article 내부 controls/alerts/review/debug/candidate state0. warning은 review shell에만 존재.
- [x] A PNG860×2035/615,039B, JPG860×2035/182,455B. B PNG860×3057/1,493,664B, JPG860×3057/357,016B. 스펙/옵션 exact, 이미지 누락/새 clipping/가로 overflow0.
- [x] 같은 B canonical PNG2회 dimensions/pixels/bytes 동일. 이 환경의 관찰이며 모든 환경의 byte 재현성을 약속하지 않는다.
- [x] Product/Facts/Validation 입력/Options 및 기존 Assets·Derived metadata deep equality, 원본 evidence/image 파일 hash 보존. 원격 DB/Storage mutation0.
- [x] Extraction retry/Section reject/Regeneration reject/Export failure/CAS conflict에서 기존 성공 보존 회귀 PASS.
- [x] 서버 전용 키·provider 오류·checkpoint cache DTO·SSRF 회귀 PASS. source/docs/client bundle/QA text의 configured secret3종·credential/signed-token 패턴 findings0.
- [x] next typegen, tsc --noEmit, lint, production build, git diff --check PASS. 버전 변경 후 기본 production build 재확인.
- [x] 검증 PASS 후 package0.1.1→0.2.0, lock top-level/packages root도0.2.0. version 필드 외 lock deep equality.
- [x] CHANGELOG0.2.0/README/Backlog/Checklist/Roadmap/tasks 갱신. M2/M3/L1 RESOLVED, BLOCKER0/HIGH0/MEDIUM2/LOW0.
- [x] QA 종료: 임시 편집/생성 상태를 baseline Sections로 복구, 메모리 DB/서버 종료, browser tab 닫음, listener0. gitignored artifacts만 보존, git stage0.
- [ ] 새 실제 외부 API full flow 재실행 — 이번 범위에서는 불필요해 실행하지 않음.
- [ ] 빈 머신의 fresh install / 새 Supabase DB·Storage 설치 — 이번 재검증 범위 밖.
- [ ] Public SaaS Authentication / owner_id / 사용자별 RLS / Storage ownership policy — 계속 미완료.
- [ ] 사용자 최종 diff 검토 후 `chore: prepare v0.2.0 release` commit.
- [ ] 사용자 main fast-forward merge.
- [ ] 사용자 annotated `v0.2.0` tag와 원격 push.
- [ ] 사용자 GitHub Release 게시.

## v0.1.1 — TASK-035 당시 판정

2026-09-20 · `release/v0.1.1` · 기준 `19735a6`. **PASS — v0.1.1 Local/Internal MVP Release Candidate.** commit/main merge/tag는 미실행. 아래 v0.1.0 기록의 미확인 설치·원격 조회와 공개 SaaS 전제는 계속 미확인/미완료다.

- [x] Release freeze: 앱/prompt/CSS/테스트 구현 변경 없음. package/lock 버전과 릴리스 문서만 변경, dependency/migration/generated types 불변.
- [x] package.json 및 package-lock root/packages root 0.1.1 일치. dependency version 변경 없음.
- [x] 실제 상품 67695797의 기존 자료를 로컬 QA DB로 복제, 실제 Planner 1회·Section Engine 1회 첫 출력 accepted. 카피 정책 v1 Plan이 stale여서 Planner를 갱신했다. 자동 재시도/Asset·Product·Validation·Extraction 재호출/도매 API 0회.
- [x] 신규 Section 5개: Hero/ImageText/Detail/Specification/Option. 촬영 설명형 0, 기존 meta-observation 0, unsupported V-only claim 0, title mismatch 0. 사람 검토에서 허용 불가능한 Section 간 목적 중복 0. 규칙 검사가 모든 자연어 품질을 보장하지 않는다.
- [x] Specification 6행 원문 exact, 확정 옵션 1그룹 6값·UUID·순서/version exact. AI 옵션 생성 없음.
- [x] M2 partial UI의 전체 재분석 비용/이전 성공 보존 안내, L2 읽기·저장·실패·draft 유지·취소·재조회 실제 브라우저 확인. 재분석 버튼 실행 없음.
- [x] 전체 865 mock tests, fail/skip/cancel 0. crop 안전 fixture 6종 및 실패 시 이전 성공 보존 검사 포함. 문서/version 변경에 의미 없는 새 test를 추가하지 않음.
- [x] next typegen, tsc --noEmit, lint, production build, git diff --check 통과.
- [x] 새 canonical의 PNG 860×2744px / 1,007,889 bytes, JPG 860×2744px / 277,521 bytes 각 1회. 이미지3·스펙6행·옵션6값 유지, controls/검토 경고/글자 잘림/가로 overflow 0. Export는 앱 로직이 동일한 기존 production build에서 실행했고 버전 변경 뒤 production build도 통과했다.
- [x] Git tracked+신규 문서·production client bundle·QA 텍스트의 실제 3종 키 일치 0, client provider marker 0, 실제 secret 노출 0. 알려진 값/패턴 범위의 검사다.
- [x] 실제 DB/Storage 연결·변경 0. 로컬 service fixture에서 새 Plan/Sections만 갱신, protected 입력 불변. UI/Export replay는 mutation 0(실패 주입용 쓰기 요청 1회는 거부). 원본 자료·기존 사용자 자료 보존.
- [x] CHANGELOG 0.1.1, README, Backlog, TASK-035/작업 목록 갱신. M2/M3 부분 보완 상태, 미해결 MEDIUM 4/LOW 1, BLOCKER 0/HIGH 0.
- [ ] 사용자 최종 diff 검토 후 `chore: prepare v0.1.1 release` commit.
- [ ] 사용자 main fast-forward merge.
- [ ] 사용자 승인 후 annotated `v0.1.1` tag. 정확한 제안 명령은 [TASK-035](tasks/TASK-035.md)에 있다.

## v0.1.0 — TASK-033 당시 검증 기록

다음은 당시 실행 범위의 역사적 기록이다. 이후 v0.1.0 tag가 06d80bb로 생성된 것은 확인했으며 아래 당시 체크 여부를 소급 변경하지 않는다.

2026-09-20 · `release/v0.1.0` · 기준 `ee47cb7` (main과 동일). **판정: PASS — DetailForge v0.1.0 Local/Internal MVP Release.** 공개 SaaS 승인이 아니다. TASK-032의 실제 E2E와 TASK-033의 재검사를 구분하며, 미확인 환경은 체크하지 않는다.

## Scope

- [x] Project/Product/Facts/Assets, Generic URL Import, 공식 도매매 옵션 후보 확인·명시적 저장.
- [x] Fact normalization, 긴 이미지 추출·Product-Relevance Guard·Derived Asset, 이미지/상품 분석·Fact Validation·Planner·Section Engine.
- [x] Editor/reorder/개별 AI 재생성, Final Renderer/PNG/JPG, Commerce Copy/Visual·Hero 해상도·title relevance guard.
- [x] 기능 동결: 앱 코드·prompt·dependency·migration 변경 없음. 미지원 범위는 README/CHANGELOG에 명시.

## Code Quality

- [x] TASK-033: next typegen, tsc --noEmit, lint, production build 통과.
- [x] package/lock root/lock packages root 모두 0.1.0. 데이터 schemaVersion 유지.
- [x] git diff --check 및 릴리스 문서/설정만의 diff 검토.

## Tests

- [x] TASK-033 전체 자동 테스트 849 pass, 0 fail/skip/cancel. 테스트 추가·삭제·범위 제외 없음. 이 수치는 이번 실행 기록이며 향후 개수 계약이 아니다.
- [x] 아래 전체 명령을 repository root에서 실행. 자동 테스트는 mock provider만 사용.

```powershell
node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs
npx.cmd next typegen
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
git diff --check
```

## Database

- [x] 0001 core → 0002 products.ai_analysis → 0003 product_facts.validation → 0004 detail_pages.plan → 0005 product_options. 중복 번호·새 untracked SQL 없음, 기존 SQL 불변.
- [x] generated database.types.ts의 테이블·JSON 컬럼·product_options version/FK를 migration과 정적 대조. 타입 검사 통과.
- [x] 기존 TASK-020 사용자 확인 기록: linked Local/Remote 0001~0005 일치, generated types 재생성 완료.
- [ ] TASK-033에서 원격 migration 목록 재조회. CLI 로그인 토큰이 이 실행환경에 없어 확인 불가; schema push/type 재생성은 하지 않았다.
- [ ] 완전히 새로운 빈 DB에 migration 실제 적용. 이번에는 수행하지 않았으며 README에 link → list → dry-run 검토 → push → list → types 절차를 기록했다.

## Storage

- [x] migration 0001과 서버 코드의 private `product-assets` 및 5분 임시 signed URL 정책 대조. URL 영구 저장 없음.
- [x] TASK-032 실제 QA Storage 생성·표시·삭제 성공 기록. 이번 smoke는 로컬 fixture이고 원격 Storage를 변경하지 않았다.
- [ ] 새 Supabase Project에서 bucket과 정책 실제 설치 재검증.

## Environment

- [x] Node 24.18.1/npm 11.16.0 환경에서 설치된 의존성 조회, npm ci dry-run, Playwright install dry-run, build와 실행 확인. Node 24.x 안내, 임의 patch engines 추가 없음.
- [ ] 빈 머신에서 npm ci·Chromium 다운로드·전체 설정을 처음부터 설치. dry-run을 fresh install 성공으로 간주하지 않는다.
- [x] .env.example의 모든 값은 빈 값. 실제 코드의 required/feature-required/optional 설정과 일치.
- [x] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, DOMEGGOOK_API_KEY, DETAILFORGE_APP_ORIGIN과 모델 override/Playwright cache 설명.
- [x] dev origin 기본값과 production-mode 로컬 실행 시 origin 필수, cache 설치/실행 경로 일치 설명.
- [x] Domeggook 키 누락은 해당 기능의 설정 오류이며 앱 전체 crash가 아님. mock 테스트와 키가 빈 로컬 smoke에서 앱 실행 확인.

## AI

- [x] 코드 기본값: Asset/Extraction gpt-5.6-luna, Product/Validation/Planner/Section/Regen gpt-5.6-terra. override는 선택 사항.
- [x] 이번 TASK-033 OpenAI/도매 API 호출 0. TASK-032 실제 QA와 기존 canonical replay를 구분.
- [x] Copy·시각 해석·추출 후보 사람 검토, supported 의미 및 저해상도 한계를 명시.

## Data Integrity

- [x] Facts/AI 해석 분리, 원본/Derived 분리, 확정 옵션 snapshot, candidate-first, CAS/lease/복구 회귀 테스트 유지.
- [x] TASK-032 기존 7테이블 14행 hash 불변 및 QA3 Project/5 Storage 정리 기록.
- [x] TASK-033 격리된 읽기 전용 fixture로 smoke. DB/Storage 실데이터 변경 없음; fixture hash 유지와 mutation 0 확인.

## Security

- [x] Git tracked 366파일 + 신규 릴리스 문서, production client bundle 26개, smoke 텍스트 산출물에서 실제 3종 키 일치 0.
- [x] OpenAI/JWT/service-role/signed token/Bearer 패턴 검토. 검출된 token 2곳은 명시적 temporary-test-token fixture이며 실제 노출 0. 알려진 키 대조/패턴 범위의 검사이지 전체 Git 역사·모든 가능한 비밀에 대한 증명은 아니다.
- [x] client provider marker 0. SSRF/DNS/redirect·응답 크기·서버 키 정책 변경 없음.
- [x] .env/Next/dependency/QA artifacts/browser profile/temp ignore, .env.example 추적 가능. Git tracked artifact/실제 env 0.

## Export

- [x] 같은 TASK-030 canonical B를 TASK-033 로컬 replay로 읽기 → production Renderer → 실제 Chromium Export.
- [x] PNG 860×2744px / 1,009,246 bytes; JPG 860×2744px / 278,564 bytes. 반복 PNG bytes 동일.
- [x] 이미지 3개 로드, 5 Sections, 옵션 1그룹 6개. PNG/JPG를 직접 열어 첫/마지막 Section·한글·동일 배치 확인.
- [x] capture article 안의 controls 0, review/debug 문구 0, 누락 이미지 0. 옛 canonical의 stale-plan 안내는 article 밖 검토 UI에만 존재한다.

## QA

- [x] TASK-032 실제 A full E2E, B 실제 옵션+canonical replay, C 제한 조합 차단의 범위를 유지. B/C를 새 full AI E2E로 과장하지 않는다.
- [x] 기존 관찰 BLOCKER 0/HIGH 0 유지. 이번 release-only 변경과 smoke에서 신규 B/H 없음.
- [x] MEDIUM 4/LOW 2 미해결 상태를 RELEASE_BACKLOG에 유지. 강제 품질 수정 없음.

## Documentation

- [x] README 설치·환경·migration·Storage·검사·지원/미지원·공개 차단 최신화.
- [x] CHANGELOG 0.1.0 - 2026-09-20 작성. 중복 Release Notes는 추가하지 않음.
- [x] README/CHANGELOG/이 문서에 개인 사용자 경로 없음. 이전 TASK의 역사적 QA 경로는 유지.
- [x] TASK-033 상세 보고와 tasks/README 상태 갱신.

## Public Deployment Blockers

아래는 후속 공개 SaaS의 필수 전제다. 내부 MVP 통과로 완료 처리하지 않는다.

- [ ] Auth.
- [ ] owner_id 및 사용자 소속 검증.
- [ ] user-specific RLS.
- [ ] Storage ownership policy와 사용자 간 격리 검증.
- [ ] 공개 환경의 권한·비용·실행 자원/Chromium/글꼴 운영 검증.

## Git Release Steps

- [x] main에 TASK-032 `ee47cb7` 포함, release/v0.1.0이 같은 HEAD에서 생성됨을 확인. history rewrite 없음.
- [x] 최종 diff가 문서/환경 주석/ignore로 제한됨. commit/main merge/tag는 실행하지 않음.
- [ ] 사용자가 diff 검토 후 `chore: prepare v0.1.0 release` commit.
- [ ] 사용자가 main으로 fast-forward merge.
- [ ] 사용자 승인 후 annotated `v0.1.0` tag. 권장 명령은 [TASK-033](tasks/TASK-033.md)의 마지막 항목에 있으며 자동 실행하지 않는다.

설치 안내는 [README](../README.md), 미해결 제품 품질·공개 전제는 [Release Backlog](RELEASE_BACKLOG.md), 실제 이전 QA는 [TASK-032](tasks/TASK-032.md)를 따른다.

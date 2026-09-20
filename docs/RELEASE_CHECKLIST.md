# DetailForge v0.1.0 Release Checklist

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

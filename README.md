# DetailForge

## TASK-065 현재 상태 — 2026-10-01

CODE/LOCAL release validation COMPLETE, Local RC PASS. Fresh/upgrade drift 0; RLS 143 / Storage 74 / Admission 37 / Auth 20 / Export 27 / Cross-user 40 + corpus 97 / Own-user 40 및 공식 1,487 tests PASS. **Production rollout: BLOCKED / OPERATOR ACTION REQUIRED.** 실제 production target/config/migration/deployment는 검증·실행하지 않았다. 운영 토폴로지·headers·Auth/Storage·한도·backup·monitoring·post-deploy smoke 승인 전 공개 배포하지 않는다. [릴리스 검증과 운영 gate](docs/V0_3_RELEASE_VALIDATION.md).

아래 내용은 이전 TASK 단계 기록이며 현재 gate는 위 판정을 따른다.

## TASK-064 현재 상태 — 2026-09-30

Full Own-user Workflow Regression COMPLETE. 실제 Local Supabase + Next production + Chrome에서 OWN40, PNG/JPG 860px Export, reload/re-login, mobile smoke, DB/Storage integrity를 확인했다. 일반 admin DB/Storage0, 실제 외부 provider0. 이전 RLS143/Storage74/Admission37/Auth20/Export27/Cross-user40+corpus97 및 공식 tests1487 PASS. **Public SaaS deployment remains BLOCKED: TASK-065 release validation이 남는다.** [검증 계약과 workflow inventory](docs/V0_3_OWN_USER_WORKFLOW_REGRESSION.md).

이전 TASK 상태 기록은 아래에 보존하며 현재 배포 gate는 위 상태를 따른다.

## TASK-063 현재 상태 — 2026-09-29

Cross-user Security E2E COMPLETE. 실제 Local Supabase + Next production + Chromium에서 XUSER40/exact-ID corpus97, 7-table/Storage 무변경, denied provider/capture0를 확인했다. Section 옵션 foreign/absent 응답을404로 정정했다. 이전 RLS143/Storage74/Admission37/Auth20/Export27 및 full1487 PASS. Public SaaS deployment remains BLOCKED: TASK-064/065가 남는다. [검증 계약과 전체 inventory](docs/V0_3_CROSS_USER_SECURITY_E2E.md).

아래 내용은 이전 TASK 단계의 기록이며 현재 완료 상태는 위 계약을 따른다.


## TASK-062 현재 상태 — 2026-09-28

TASK-062 Export authorization COMPLETE. 실제 Local Supabase/Next production/Chromium으로 EXPORT-01~25 PASS, 티켓 동시8개 중1성공/7거부를 확인했다. 사용자 JWT·쿠키를 capture에 전달하지 않으며 user-RLS snapshot + 90초 DB single-use capability를 사용한다. Production privileged boundary는 admission과 finite export RPC 두 곳이고 generic admin CRUD/Storage fallback은 없다. Public SaaS deployment remains BLOCKED: TASK-063/064/065가 남는다.

[Export 보안 계약](docs/V0_3_EXPORT_AUTHORIZATION.md). 기존 renderer/프로젝트 URL, DB·Storage RLS, admission, Auth UX 계약을 유지한다. Chrome sandbox/maintenance/부하·운영 설정은065 gate다.

## 이전 단계 기록

아래 내용의 미완료062 및 단일 privileged boundary 설명은 해당 단계 당시 기록이다. 현재 상태는 위 TASK-062 계약을 따른다.

## TASK-061 현재 상태

TASK-061에서 이메일 로그인·가입·POST 로그아웃, PKCE callback, 렌더링 전 getUser 보호 경로를 연결했다. 실제 Local Auth/Browser20·RLS143·Storage74·admission37 및 전체1481 tests PASS. **Public SaaS deployment remains BLOCKED**. 다음은 TASK-062 Export authorization이다. [Auth UX 계약](docs/V0_3_AUTH_UX_AND_PROTECTED_ROUTES.md), [검증 결과](docs/tasks/TASK-061.md).

## 이전 단계 기록

도매상품의 사실정보와 실제 제품 사진을 보존하면서 판매용 상세페이지를 재구성하는 **v0.2.1 Local/Internal MVP**다. TASK-054 검증과 v0.2.1 tag 이후 현재 v0.3.0 Public SaaS 기반을 단계적으로 구현 중이며 package version은0.2.1을 유지한다.

**공개 인터넷 SaaS 배포는 차단한다.** TASK-058 DB RLS와 TASK-059 Storage 격리를 실제 A/B/anon Local Supabase에서 검증했다. TASK-060에서 일반 데이터·Storage를 사용자 client로 이전하고 atomic upload/AI admission을 구현했다. Auth UX, Export 및 전체 공개 검증은 남아 있다. 로컬 실행도 신뢰하는 사용자만 접근하도록 한다.

## 지원 범위와 작업 흐름

Project 관리 → URL 가져오기 또는 수동 Product/Facts 입력 → 상품정보·스펙·이미지 후보 검토 및 저장 → 도매꾹 공식 API의 도매매 옵션 후보 확인·입력란 반영·별도 저장 → 긴 상세 이미지의 제품컷 후보 추출·부분 실패 시 실패 영역만 명시적으로 재시도·사람이 선택해 Derived Asset 저장 → 이미지/상품 AI 분석 → Fact Validation → Page Planner → Section 생성 → Detail Editor에서 문구·스타일·순서 편집 또는 개별 Section 재생성 후보 검토 → Final Renderer → PNG/JPG Export.

재시도는 입력이 같은 유효한 checkpoint에서만 가능하며 기존 성공 후보와 체크·해제 선택을 보존한다. 자동 재시도는 없고 비용이 발생할 수 있다. 제목/본문과 역할 간 반복·촬영 보고체 검토를 보완했으며, 짧은 텍스트 Section의 여백을 줄였다. v0.2.1은 보수적 자동 경계 처리와 명시적 수동 Crop을 결합한다. 추가 trim 안전성(M1)과 이 결합 범위의 유색 프레임 처리(M4)는 RESOLVED이며, 모호한 경계는 자동 보존한다. [v0.2.1 검증 범위](docs/tasks/TASK-054.md).

Candidate Review의 **자르기 조정**에서 후보 내부의 네 가장자리를 드래그·방향키·숫자로 조정한다. 적용은 로컬 초안이며, 후보를 선택하고 저장해야 새 Derived가 생성된다. 수동 영역은 추가 자동 trim 없이 저장되며 0px도 명시적 보존이다. ‘수동 조정 해제’는 자동 경계 처리로 돌아간다. 기존 Derived 직접 편집·후보 밖 확장은 지원하지 않고 기존 이미지도 자동 재가공하지 않는다. 제품·인물·문자가 제외되지 않는지 미리보기에서 확인해야 한다.

Generic URL Import와 도매꾹 공식 옵션 API를 지원하며 모든 도매사이트의 호환성을 보장하지 않는다. Fact placeholder 정규화, Product-Relevance Guard, Commerce Copy Quality Guards, Commerce Visual System, Hero 해상도·제목 관련성 검사를 포함한다. 상품정보/옵션/이미지는 각각 명시적으로 저장하며 미적용 후보·미저장 편집은 Export에 포함되지 않는다.

Facts와 AI 해석, 원본과 Derived를 분리한다. 확정 옵션은 deterministic snapshot으로 전달하고 조건부 저장/CAS·lease·복구 경계로 충돌을 처리한다. AI 검증이 정확성을 보장하지는 않으므로 카피·시각 관찰·추출 후보의 사람 검토가 필요하다. Fact Validation의 supported는 입력된 근거 범위에서 일관됨을 뜻한다. 긴 이미지 추출도 후보 추천이며 최종 승인 후 저장한다. 낮은 원본 해상도는 후보 순위·확대 상한·경고로 대응하며 없는 픽셀을 복원하지 않는다.

미지원: Public SaaS·다중 사용자 앱 통합·로그인/회원가입 UI·운영 ownership 전환·운영 Storage 정책 적용, marketplace publishing, SKU 조합 엔진·가격/재고 동기화, AI 이미지 생성·AI upscale·배경 제거, PDF·분할 Export, theme marketplace, 광범위한 도매 Adapter.

TASK-058의 migration0007은 backfill 완료 후 owner NOT NULL, FK/path 불변성, 사용자별 DB RLS를 확정한다. 실제 runtime143 checks와 전체1465 tests PASS이며 운영 migration/backfill은 실행하지 않았다. **Project 생성 action은 이제 검증된 principal을 요구한다. 로그인 UI는 TASK-061 범위다.** [DB 계약](docs/V0_3_DATABASE_RLS_SECURITY.md), [11항목 결과](docs/tasks/TASK-058.md). TASK-059의0008은 기존 path를 보존하면서 private bucket/JPEG·PNG·WebP/10MiB와 root ownership 정책을 구현했다. 실제 Storage 최초73·최종74 checks 및 전체1470 tests PASS. TASK-060에서 서버 내부 승인 발급과 atomic quota를 구현했다. 운영 한도 설정이 없으면 upload/AI admission은 닫힌다. [Storage 계약](docs/V0_3_STORAGE_SECURITY.md), [13항목 결과](docs/tasks/TASK-059.md). TASK-060의 실제 서비스37·RLS143·Storage74 checks와 전체1476 tests PASS. [현재 계약](docs/V0_3_USER_SCOPED_ACCESS_AND_ABUSE_CONTROL.md), [19항목 결과](docs/tasks/TASK-060.md). 다음은 TASK-061 Auth UX이며 공개 배포는 계속 BLOCKED다.

## 기술 환경

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase PostgreSQL/private Storage, OpenAI Structured Outputs + Zod, Sharp, Playwright Chromium을 사용한다. 버전은 package-lock.json을 기준으로 설치한다.

Windows PowerShell에서 **Node.js 24.x와 npm**을 사용한다. 현재 테스트 loader는 Node 24의 내장 TypeScript/registerHooks를 사용한다. Next 자체의 최소 Node 요구(20.9+)와 프로젝트 전체 검증 환경은 다르다. 정확한 patch 버전을 강제하는 engines는 추가하지 않았다.

## 로컬 설치와 환경변수

저장소 루트에서 실행한다. 기존 `.env.local`이 있으면 덮어쓰지 않는다.

```powershell
npm.cmd ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npx.cmd playwright install chromium
```

`.env.local`에 아래 서버 설정을 넣는다. 키를 커밋하거나 `NEXT_PUBLIC_` 변수에 넣지 않는다.

- DB/Storage: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- AI 기능 실행: `OPENAI_API_KEY`. 미설정 시 AI 기능의 설정 오류로 처리한다.
- 공식 옵션 가져오기: `DOMEGGOOK_API_KEY`. 없으면 해당 요청만 설정 오류를 반환하며 앱 전체가 시작 시 종료되지는 않는다. 버튼이 자동으로 비활성화되는 것은 아니다.
- Export: `DETAILFORGE_APP_ORIGIN`. dev 기본값은 `http://127.0.0.1:3000`; `npm.cmd start`에서는 로컬이어도 필수다. 실행 중인 origin/port와 일치시킨다. 예: `http://localhost:3000`. 요청 Host로 추론하지 않는다.
- 선택 사항: `OPENAI_ASSET_MODEL`, `OPENAI_DETAIL_EXTRACTION_MODEL`의 코드 기본값은 `gpt-5.6-luna`; `OPENAI_PRODUCT_MODEL`, `OPENAI_VALIDATION_MODEL`, `OPENAI_PLANNER_MODEL`, `OPENAI_SECTION_MODEL`, `OPENAI_SECTION_REGEN_MODEL`은 `gpt-5.6-terra`다. 모두 optional override이며 모델 이용 권한은 사용하는 계정에서 확인한다.
- 선택 사항: `PLAYWRIGHT_BROWSERS_PATH`. 설치와 앱 실행에 같은 경로를 사용한다. Playwright CLI는 `.env.local`을 자동으로 읽지 않으므로 사용자 지정 경로를 쓴다면 설치 명령 전 PowerShell 환경변수에도 같은 값을 설정한다. 비워 두면 기본 browser cache를 사용한다.

## Supabase 준비

새 Supabase Project를 준비하고 아래 명령에서 실제 project ref를 입력한다. 로그인은 로컬 CLI에서 진행하며 비밀키를 명령 인수나 채팅에 넣지 않는다.

```powershell
npx.cmd supabase login
$projectRef = Read-Host 'Supabase project ref'
npx.cmd supabase link --project-ref $projectRef
npx.cmd supabase migration list --linked
npx.cmd supabase db push --linked --dry-run
```

새 빈 Project라면 0001~0005가 순서대로 예정되어야 한다. 기존 Project라면 이미 적용된 migration은 제외되어야 한다. 대상 Project와 dry-run의 pending 목록이 예상과 일치하는지 확인한 뒤에만 적용한다.

```powershell
npx.cmd supabase db push --linked
npx.cmd supabase migration list --linked
npx.cmd supabase gen types typescript --linked --schema public > src/lib/supabase/database.types.ts
npx.cmd next typegen
npx.cmd tsc --noEmit
```

순서는 `0001_initial_schema` → `0002_add_product_ai_analysis` → `0003_add_fact_validation` → `0004_add_detail_page_plan` → `0005_add_product_options`다. 적용한 파일을 수정하거나 강제 재적용하지 않는다. 생성 타입 diff도 검토한다. PowerShell의 출력 인코딩 차이를 피하려면 타입 파일이 UTF-8인지 확인한다.

0001이 만드는 **private `product-assets` bucket**이 필요하다. 공개 bucket으로 바꾸지 않는다. 서버에서 소속/경로를 검증한 뒤 5분 signed URL을 발급하며 URL을 DB에 저장하지 않는다. 현재 RLS는 일반 클라이언트 접근을 막고 service-role 서버로 작업하는 경계이며 사용자별 격리가 아니다. 상세 schema는 [Database](docs/03_DATABASE.md)를 따른다.

## 실행과 검사

Auth foundation 개발에는 `.env.example`의 `NEXT_PUBLIC_SUPABASE_URL` 및 **공개용** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`가 필요하다. 같은 Supabase 프로젝트의 실제 publishable key만 사용하며 service/secret/legacy JWT를 public 변수에 넣지 않는다. 두 값이 모두 없으면 기존 내부 앱은 그대로 동작하고 Auth helper만 설정 오류를 반환한다. Auth POST는 기존 `DETAILFORGE_APP_ORIGIN`도 필요하다. 현재 signup/login 화면과 원격 Auth QA는 제공하지 않는다. [Auth 개발 계약·테스트 범위](docs/V0_3_AUTH_CONTRACT.md).

```powershell
npm.cmd run dev -- --hostname 127.0.0.1
```

`http://127.0.0.1:3000`에서 실행한다. 별도 포트라면 `--port`와 Export origin도 함께 맞춘다.

```powershell
node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs
npx.cmd next typegen
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
git diff --check
```

자동 테스트는 mock provider를 사용한다. 전체 테스트 명령의 파일 범위를 임의로 줄이지 않는다. 실제 외부 API QA는 별도 검증 Project에서 최소 호출로 수행한다.

Auth browser 모듈은 UI에 연결하기 전에도 `node tests/auth-browser-bundle.mjs`로 별도 web-target graph/secret marker 검사를 실행할 수 있다. 실제 Supabase Local/Auth/두 사용자 RLS E2E를 대신하는 검사는 아니다.

production 모드의 **로컬 확인**은 `.env.local`에 `DETAILFORGE_APP_ORIGIN`을 설정한 뒤 `npm.cmd run build` → `npm.cmd start -- --hostname 127.0.0.1`이다. Chromium 설치와 실제 이미지/한글 글꼴 표시까지 확인한다. 기본 최종 폭은 860px이며 Export는 높이 16,000px·16MP·75초 제한을 유지한다. 초과 페이지의 자동 분할은 제공하지 않는다.

[Changelog](CHANGELOG.md) · [Release Checklist](docs/RELEASE_CHECKLIST.md) · [현재 작업](docs/tasks/README.md) · [실제 E2E QA](docs/tasks/TASK-032.md) · [공개 전제와 후속 과제](docs/RELEASE_BACKLOG.md)

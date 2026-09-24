# v0.3.0 Public SaaS Foundation Architecture

2026-09-23 · TASK-055 · **설계 확정, 구현 전** · 기준 v0.2.1 / `cf77916` / `plan/v0.3.0`.

v0.2.1은 Local/Internal MVP다. 품질 backlog BLOCKER/HIGH/MEDIUM/LOW 0은 공개 서비스의 보안 요건 완료를 뜻하지 않는다. 이 문서의 목표 상태는 아직 구현되지 않았다. 인증, 소유권, DB/Storage 정책, 일반 요청의 service-role 제거, 안전한 Export 및 비용 제한을 모두 검증하기 전에는 public ingress를 열지 않는다. [위협·검증 계약](V0_3_THREAT_MODEL.md), [93항목 완료 보고](tasks/TASK-055.md).

## TASK-057 구현 상태 — Ownership foundation PARTIAL

후속 TASK-057A: 실제 local Supabase/GoTrue에서 SQL runtime34 checks와 전체1465 tests PASS로057 최종 완료. 아래 SQL 미검증 항목은 해소됐으나 RLS/Storage/일반 service-role 이전/Export·공개 gate는 계속 OPEN이다. [46항목 runtime 결과](tasks/TASK-057A.md).

2026-09-24: migration0006(nullable owner/FK RESTRICT/index), 명시 allowlist bootstrap CLI와 Stage C NOT NULL 절차, principal 기반 CRUD/child chain helper를 작성했다. `Project.ownerId`는 required domain이고 UI/legacy projection은 분리했다. 새 CRUD는 사용자 client와 owner filter를 사용하지만 기존 internal31개 factory 경로는 유지된다. [Ownership contract](V0_3_OWNERSHIP_CONTRACT.md), [76항목 보고](tasks/TASK-057.md).

0007은 아직 생성하지 않았다. 기존 §14 예상과 달리 운영 입력이 필요한 Stage C는 automatic migrations 밖에 두고 TASK-058에서 다시 NOT NULL을 enforce하도록 한다. bootstrap에는 단일 owner와 모든 NULL Project의 explicit allowlist가 필요하며 다중 owner mapping은 별도 운영 계약으로 남긴다. DB default owner 없이 서버 principal로 지정한다. 실제 local PostgreSQL 설치가 불완전하여 SQL rehearsal/type generation은 미실행, 원격 mutation0이다. RLS/Storage/일반 service-role 이전/Export와 공개 배포는 계속 BLOCKED이며 다음은 TASK-058이다. 아래 TASK-055/056 inventory는 해당 시점 기록이다.

## TASK-056 구현 상태 — Authentication foundation PARTIAL

2026-09-24: SSR0.12.7·browser/session client·getUser principal·guards·bounded signup/signin/signout·Next16 refresh-only Proxy를 구현했다. legacy server client는 admin.ts로 분리하고 기존31곳에는 호환 alias를 유지한다. §1~4의 code/env inventory는 TASK-055 당시 snapshot이다. owner/RLS/Storage/일반 service-role 이전/Export/비용 gate는 여전히 미구현이다.

첫 Auth adapter는 publishable key만 지원하며 직접 JWT decode 없이 legacy anon/secret을 거부한다. 기존 DETAILFORGE_APP_ORIGIN을 재사용한다. local public env가 없어 실제 Auth integration은 미실행이다. Auth/로그아웃 UI와 전체 route enforcement는 아직 없다. future public `/`는 데이터 없는 landing 전환 이후이며 현재 개인 Dashboard를 공개하지 않는다. [구현 계약](V0_3_AUTH_CONTRACT.md), [73항목 결과](tasks/TASK-056.md). 다음은 TASK-057이다.

## 1. 실제 기준과 조사 방법

- 로컬 `HEAD`, `main`, 캐시된 `origin/main`, `v0.2.1^{commit}`은 모두 `cf77916dfa9e2dc67c4af981b6a9b2633e76e9c9`. 원격 fetch/배포 상태 확인은 하지 않았다.
- `package.json`: 0.2.1; Next.js 16.3.4, 설치된 `@supabase/supabase-js` 2.115.0, Supabase CLI 의존성 `^2.116.0`. `@supabase/ssr` 없음. App Router 사용, `next.config.ts`에는 별도 인증 설정 없음.
- `AGENTS.md`, `CLAUDE.md`, README/CHANGELOG, docs/00~07, RELEASE_BACKLOG/CHECKLIST, TASK-045/054, migration 0001~0005와 실제 Supabase 호출 및 그 상위 요청 경로를 확인했다.
- `src` TypeScript AST와 텍스트 검색을 대조했다. factory **호출식** 31개/21파일, SDK constructor 1개, DB `.from` 호출식 **76개**, Storage `.from` 호출식 **8개/5파일**, `.auth.*` 호출 0개. `Array.from`/`Buffer.from`은 DB 집계에서 제외했다. 요청 수나 실행 횟수가 아니다.
- 실제 원격 DB catalog/Auth 설정/Storage 정책은 조회하지 않았다. 아래 현황은 **저장소 migration 및 runtime source 기준**이며 배포 전 drift 검사가 필요하다. `.env.local` 값은 출력하지 않고 변수 존재와 key 형식만 검사했다.

## 2. 현재 인증과 service-role inventory

`src/lib/supabase/server.ts:16`은 `SUPABASE_SERVICE_ROLE_KEY`를 읽어 `createClient`를 생성한다. `autoRefreshToken`, `detectSessionInUrl`, `persistSession`은 false다. 요청 쿠키·사용자 JWT를 전달하지 않는다. Auth UI/browser client/SSR session/proxy가 없고, ID와 Project 관계를 검사해도 호출자의 소유권은 확인할 수 없다.

분류 A = 일반 사용자 작업, B = 실제 필요한 privileged system operation, C = 테스트/관리 전용. **아래 production factory 31개는 전부 A, B 0, C 0**이다. 각 행의 client 및 재조회/보상/cleanup까지 같은 요청의 user-scoped client로 이전한다. `server-only`는 비밀키의 번들 경계이며 사용자 authorization이 아니다.

| # | 실제 파일:호출 줄 (`src/features/` 기준) | 작업 | 분류 / 이전 조건 |
| --- | --- | --- | --- |
| 1 | asset-analysis/service.ts:77 | analyzeAsset | A / Asset RLS 확인 후 sign·비용 예약·provider |
| 2 | assets/service.ts:19 | getAssetContext 기본 인자 | A / client 필수 주입, admin 기본값 제거 |
| 3 | assets/service.ts:48 | listAssets | A / 목록·sign 모두 사용자 client |
| 4 | assets/service.ts:77 | uploadAsset | A / Product 소유권·upload reservation·cleanup |
| 5 | assets/service.ts:131 | deleteAsset | A / Storage와 DB 삭제 모두 사용자 권한 |
| 6 | detail-editor/service.ts:30 | editorContext | A / 조회·저장·옵션 비교/적용에 전파 |
| 7 | detail-extraction/retry.ts:59 | retryProductShots | A / source·tile checkpoint 재조회에도 전파 |
| 8 | detail-extraction/review.ts:23 | getExtractionReview | A / 원본과 후보의 실제 소유권 |
| 9 | detail-extraction/service.ts:39 | analyzeProductShots | A / source·Product/Facts·비용 예약 |
| 10 | detail-extraction/service.ts:157 | saveProductShots | A / 자동/수동 Derived upload·DB·보상 |
| 11 | detail-renderer/service.ts:23 | getRenderView | A / Renderer와 Export의 공통 RLS read |
| 12 | fact-validation/service.ts:60 | getValidationView | A / 조회 시 stale recovery도 사용자 권한 |
| 13 | fact-validation/service.ts:110 | validateFacts | A / Facts·Asset RLS 및 비용 예약 |
| 14 | page-planner/service.ts:85 | getPlannerView | A / 읽기·recovery 포함 |
| 15 | page-planner/service.ts:143 | planPage | A / page 생성·계획 저장·비용 예약 |
| 16 | product-analysis/service.ts:60 | getProductAnalysisView | A / 읽기·recovery 포함 |
| 17 | product-analysis/service.ts:101 | analyzeProduct | A / Product/Facts/Assets·비용 예약 |
| 18 | product-options/import-service.ts:44 | previewImportedOptions | A / 외부 API 이전 scope 확인 |
| 19 | product-options/import-service.ts:79 | prepareImportedOptions | A / ticket의 actor·Product·version 재검증 |
| 20 | product-options/persistence.ts:17 | saveProductOptions | A / version CAS 유지 |
| 21 | product-options/queries.ts:35 | getConfirmedProductOptions | A / scope helpers에 전파 |
| 22 | products/persistence.ts:79 | saveProductInformation | A / 두 테이블 저장·보상에도 RLS |
| 23 | products/queries.ts:17 | getProductDetail | A / Project/Product/Facts |
| 24 | projects/actions.ts:20 | createProjectAction | A / name 입력, owner는 인증 identity |
| 25 | projects/queries.ts:21 | getProjects | A / 목록과 total count 모두 RLS |
| 26 | projects/queries.ts:48 | getProjectDashboard | A / `/`의 counts·recent 포함 |
| 27 | section-engine/service.ts:51 | getSectionView | A / journal recovery 포함 |
| 28 | section-engine/service.ts:65 | generateSections | A / lease·write·recovery·비용 예약 |
| 29 | section-regeneration/context.ts:20 | regenerationContext | A / candidate 생성과 적용 모두 재검증 |
| 30 | section-reorder/service.ts:23 | reorderSections | A / page lease·개별 write·보상 |
| 31 | wholesale-import/service.ts:53 | importImage | A / ticket·Asset 중복 확인·upload |

client를 받아 사용하는 하위 DB helper도 포함한다: `assets/metadata.ts`, `detail-editor/option-application.ts`, `detail-extraction/{persistence,product-context}.ts`, `product-options/{queries,import-service}.ts`, `section-engine/{persistence,edit-lease}.ts`, `section-regeneration/service.ts`, `section-reorder/persistence.ts`. Storage 하위 helper는 §4에 기록한다. 이들은 독립 factory가 없다는 이유로 누락할 수 없다. Renderer/Editor→Planner/Options처럼 중첩된 호출도 동일 AuthContext를 전달하고 요청 간 singleton client를 금지한다.

**별도의 secret 사용 1곳:** `src/features/section-regeneration/candidate.ts:8`은 service-role key를 candidate HMAC의 root로 사용한다. DB 호출은 아니므로 31에 더하지 않는다. 일반 사용자 workflow의 A이며, 별도 서버 전용 서명키로 교체하고 actor+Project+Section+revision+expiry를 bind한다. key rotation/cutover 시 이전 임시 candidate를 무효화하고 canonical Section은 보존한다. 따라서 secret을 직접 읽는 production 위치는 factory와 HMAC의 **2곳**이다.

**C는 별도 집계:** `tests/helpers/{asset-db,product-db,section-db,fact-validation,product-analysis,page-planner,options-db}.mjs` 및 `tests/projects-queries.test.mjs`는 loopback mock용 dummy key 설정이다. `tests/detail-extraction-checkpoint-persistence.test.mjs`, `tests/visual-assets.test.mjs`의 factory 호출은 이 mock 범위다. `tests/options-section.browser.mjs`는 명시 opt-in으로 실제 환경 client를 사용해 UUID 한정 fixture 생성/cleanup을 하는 C다. 이번 TASK에서는 이 browser integration script를 실행하지 않았다. 이 C 코드는 사용자 RLS 통과의 증거가 될 수 없다.

**현재 B를 요구하는 production job/admin route는 발견하지 못했다.** 미래 offline bootstrap과 격리 테스트 seed/teardown은 별도 운영 도구로 격리할 수 있다. 추측한 background job을 이유로 web runtime에 service-role key를 남기지 않는다. 공개 web deployment에서 이 key를 제거하는 것이 TASK-060의 완료 조건이다.

## 3. 실제 DB inventory

출처: `supabase/migrations/0001_initial_schema.sql`부터 마지막 **0005** product_options migration까지. 아래 모든 id는 UUID PK이며 default UUID 생성이다. 모든 parent FK는 NOT NULL, 현재 ON DELETE CASCADE다. 직접 owner column은 **7개 모두 없음**.

| Table | parent FK / unique | Project ownership chain | 현재 RLS | anon / authenticated / service_role |
| --- | --- | --- | --- | --- |
| projects | 없음 | root | ENABLED, 사용자 policy 없음 | ALL revoke / ALL revoke / ALL grant |
| products | project_id → projects.id, UNIQUE | project_id → projects | 동일 | 동일 |
| product_facts | product_id → products.id, UNIQUE | product → project | 동일 | 동일 |
| assets | project_id → projects.id; product_id → products.id | project 및 product의 project가 일치해야 함 | 동일 | 동일 |
| detail_pages | project_id → projects.id, UNIQUE | project_id → projects | 동일 | 동일 |
| sections | detail_page_id → detail_pages.id | page → project | 동일 | 동일 |
| product_options | product_id → products.id, UNIQUE | product → project | 동일 | 동일 |

`detail_pages.product_id`, `sections.project_id`는 실제 컬럼이 아니다. `assets`의 두 FK는 현재 독립적이어서 다른 Project의 Product를 조합한 row를 DB가 막지 못한다. 기존 앱 검사는 public DB 제약을 대신하지 않는다. `assets.storage_path`도 현재 UNIQUE가 아니다.

기존 index는 7 PK, products.project_id / product_facts.product_id / detail_pages.project_id / product_options.product_id의 UNIQUE index, assets_project_id_idx / assets_product_id_idx, sections_detail_page_id_sort_order_idx다. projects owner index는 없다. RLS enable은 grants/policy 없이 사용자에게 접근을 주지 않으며 service role은 bypass한다. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

`set_updated_at` trigger는 assets 외 6개에 존재하며 함수 EXECUTE는 일반 사용자에게 revoke되어 있다. 새로운 authenticated write와 trigger 실행/권한을 실제 DB에서 검증하고, 불필요한 RPC 실행 권한을 부여하지 않는다. 현재 SQL은 FORCE RLS를 지정하지 않으며 DB owner/service의 administrative 접근은 별도다.

## 4. 실제 Storage inventory

private bucket **`product-assets`**. 초기 migration은 bucket을 public=false로 보장하나 `storage.objects` 사용자 policy나 bucket MIME/size 제한을 작성하지 않았다. 원격의 관리형 기본 ACL/실제 설정은 미확인이다.

경로는 `projects/{projectId}/products/{productId}/{assetId}.{jpg|png|webp}`. 생성 함수 `src/features/assets/schemas.ts:storagePath`가 UUID/MIME를 검증한다. originals, imported, auto/manual Derived 모두 같은 규칙이며 별도 user prefix가 없다.

| 실제 위치 (`src/features/` 기준) | 동작 / TTL |
| --- | --- |
| assets/service.ts:97 | 원본 upload, server UUID, upsert=false; Object 업로드 후 Asset INSERT |
| assets/service.ts:58 | 목록 createSignedUrls, 300초 |
| assets/service.ts:68 | 삭제 및 실패 cleanup remove helper |
| asset-analysis/service.ts:92 | provider용 createSignedUrl, 300초 |
| detail-extraction/service.ts:138 | persistCrop Derived upload, 신규 UUID, upsert=false, 이후 Asset INSERT |
| detail-extraction/service.ts:126 | Derived 실패 cleanup remove helper |
| detail-extraction/source.ts:37 | 원본 download를 위한 createSignedUrl, 60초 |
| visual-assets/inspection.ts:15 | dimension 검사 createSignedUrls, 60초 |

`wholesale-import/service.ts`는 검증된 외부 bytes를 `uploadAsset`에 전달한다. Renderer는 `listAssets`/visual inspection 경유로 sign한다. `detail-export/{service,browser}.ts`는 Renderer를 Chromium으로 캡처하고 bytes를 응답한다. **Export 산출물의 Storage upload는 없다.** 정상 삭제는 Object→Asset row 순서이고 DB write의 성공 여부가 불명확할 때 무조건 Object를 지우지 않는 기존 보상 규칙을 유지한다.

## 5. Auth 선택과 client/session 경계

| 후보 | 복잡도 / Supabase 지원 | UX·복구·테스트 | 비용과 공개 MVP 적합성 |
| --- | --- | --- | --- |
| Email + Password | 중간 / native | 익숙한 반복 로그인, verification/reset 추가; 두 사용자 자동화 용이 | SMTP/abuse 운영 필요, **선택** |
| Magic Link / OTP | 중간 / native | 비밀번호 없음; 매 로그인 이메일/만료/재사용/PKCE 검증 필요 | 지속 email 전송 비용·지연, 다음 후보 |
| OAuth | provider별 중간~높음 / 지원 | redirect·계정 linking·외부 계정 복구 의존; 테스트 복잡 | credential/provider 운영 추가, 초기 제외 |
| Phone/SMS | 높음 / 지원 및 SMS provider 필요 | 번호·국가·재발급·SIM 위험, 테스트 수신 인프라 | SMS 비용/abuse가 커 초기 제외 |

비교의 지원 범위 근거: [Password](https://supabase.com/docs/guides/auth/passwords), [Passwordless](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Social login](https://supabase.com/docs/guides/auth/social-login), [Auth](https://supabase.com/docs/guides/auth). 가격 수치를 추정하지 않는다.

**Email+Password 하나**, signup/email verification/login/logout/password reset을 Must로 선택한다. OAuth/SMS/MFA UI/Teams/Organization/invitation/admin portal/billing은 이번 구현 범위 밖이다. 공개 signup에는 verification·인증 endpoint throttle·bot 대응·실제 발신 가능한 SMTP 설정을 완료해야 한다. 제한된 기본 메일 발송을 공개 운영의 delivery 보장으로 간주하지 않는다. confirmation을 local/dev에도 명시 설정하고 unverified 계정의 보호 데이터 접근 불가를 검사한다.

| Client | 자격 / 생성 범위 | 허용 위치·역할 |
| --- | --- | --- |
| Browser Auth client | public publishable 또는 legacy anon key + 사용자 session | 최소 Client Auth UI/다중 탭 이벤트; service key 절대 금지 |
| Authenticated server client | 같은 public key + 해당 요청의 verified user JWT/cookies | server-only DAL, Server Actions, Route Handlers, RSC; DB/Storage RLS 적용 |
| Privileged admin client | server secret/service key, 명시 환경 확인 | offline bootstrap/격리 fixture 관리만; 일반 web import graph 및 배포 env에서 제외 |

브라우저에서 DB UI를 제공하지 않아도 사용자는 public key+자신의 JWT로 Data API/Storage를 직접 호출할 수 있다. RLS·제약·Storage 정책 및 비공개 보안 ledger가 이 우회를 막아야 한다. 서버 helper의 `projectId` 필터만으로 보호했다고 판단하지 않는다.

Next 16 기준 설치 guide `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, `02-guides/authentication.md`, `03-api-reference/04-functions/cookies.md`를 따른다. **`src/proxy.ts`**, `await cookies()` 및 `@supabase/ssr`의 client를 계획하며 오래된 middleware 예제를 복사하지 않는다. Proxy는 cookie refresh/초기 redirect, DAL은 실제 데이터 접근 인증을 담당한다. RSC에서 cookie를 쓰지 않는다. Proxy refresh에서 갱신된 request와 response cookies를 모두 전달하고 redirect 응답에도 유지한다. [공식 SSR client 지침](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

요청 흐름: cookies → request client → 검증된 identity → Project/child RLS read → operation → 같은 client의 write/sign. Proxy의 `getClaims()`로 토큰을 검증/refresh하고, 서버 보호 진입점에서는 `getUser()` 결과를 request-local AuthContext로 만든다. `getSession()`의 user JSON이나 client body userId를 신뢰하지 않는다. DB는 **실제 JWT의 auth.uid()**로 다시 판정한다. JWT signature 검증과 계정/session의 즉시 철회는 같은 보장이 아니다. logout 후 이미 발급된 access JWT의 잔여 유효기간은 배포 설정/테스트에 기록하고 즉시 전역 철회를 약속하지 않는다.

표준 Supabase SSR browser flow는 브라우저도 token을 읽어 refresh하므로 모든 session cookie가 HttpOnly라고 문서화하면 안 된다. production Secure, SameSite=Lax, host-only, 올바른 path/chunk 처리를 검증한다. callback의 PKCE/code/token_hash는 서버 검증 후 깨끗한 URL로 이동하고 로그에 남기지 않는다. raw HTML/JS 금지, CSP 검토 및 XSS 회귀를 유지한다. [SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

개인 데이터 응답은 `private, no-store`. 사용자별 RSC/Route 응답이나 refresh Set-Cookie를 CDN/shared ISR/cache에 저장하지 않는다. 요청 안의 중복 조회 최적화와 사용자 간 global cache를 구별한다. Signed URL을 포함한 DTO도 공유 cache 금지다.

## 6. 보호 화면과 UX

- 보호 대상: **`/` Dashboard**, `/projects`, `/projects/**`(images/planner/editor/render 포함), `/api/projects/**`, Project 생성/Product 저장 등의 Server Actions. 현재 API route 파일 24개를 하나씩 확인하며 URL matcher로 Action 보호를 대체하지 않는다.
- `/settings`, `/templates`는 현재 placeholder로 user data 없음. 일관된 보호 App Shell 안에 두되 이번에 실제 설정/템플릿 기능은 만들지 않는다.
- 공개 Auth 화면: `/login`, `/signup`, `/forgot-password`, `/auth/confirm` callback. `/reset-password`는 유효 recovery session이 필요한 화면; 일반 session만으로 recovery를 흉내내지 않는다. 확인 대기/재발송은 signup 상태로 표현한다.
- 미로그인 화면 요청은 login으로 이동. API는 HTML redirect 대신 401 JSON, expired session에도 동일하다. 인증 사용자에게 foreign/missing resource는 같은 404/message; CSRF 실패 403, own-resource revision 충돌 409, quota 429, 정책/서비스 불가 503으로 구분한다. DB/FK 오류·stack·다른 owner ID를 응답하지 않는다.
- `next`는 allowlist된 앱 내부 상대 path만 허용한다. scheme/host/`//`/backslash/control/중복 인코딩 우회/인증 callback loop를 거부한다. 로그인 후 원래 페이지를 **새 RLS 확인 후** 열며 권한이 없으면 404 또는 `/projects` 안내로 끝낸다.
- logout은 same-origin POST에서 signOut, cookie chunk 제거, server cache 재검증과 full navigation으로 민감 UI/draft/이미지 URL을 제거한다. Auth state 이벤트와 focus 재검증으로 다른 탭도 화면을 비운다. 계정 전환 시 이전 user의 editor state를 재사용하지 않는다. 진행 중 AI를 새 사용자로 자동 재시도하지 않는다.
- 공유 기기에서 back/forward·bfcache·네트워크 오류 시 stale 보호 화면이 다시 보이지 않도록 pageshow/focus 인증 재검증 및 no-store를 E2E로 확인한다. 이미 내려받은 이미지/스크린샷 자체는 회수할 수 없다.
- login/signup/reset 실패는 계정 존재를 과도하게 드러내지 않는 일반 메시지. 메일 전달 결과는 동일한 확인 안내를 사용한다. 비밀번호/토큰/개인 이메일을 analytics나 QA fixture에 넣지 않는다. Password reset은 **Must**, 기본 account profile 화면은 Should다.

## 7. Ownership 선택과 기존 데이터 보존

| 후보 | Query/RLS·성능 | 일관성·migration·미래 sharing |
| --- | --- | --- |
| 모든 table owner_id | 단순 predicate, owner index 반복 | 중복 owner drift와 7개 backfill; parent/child owner 일치 제약 필요 |
| Project root만 owner_id | indexed FK join/EXISTS 필요 | 현재 7개 graph와 일치, backfill 1곳, 미래 membership 정책 변경도 root 중심; **선택** |
| 혼합 | 일부 hot path 단순화 | 분기된 policy/중복 identity 관리, 측정된 필요 없음 |

`projects.owner_id`: 최종 **NOT NULL UUID → auth.users.id, ON DELETE RESTRICT**, 생성 후 불변. 계정 삭제로 제품/이미지를 암묵적으로 cascade 삭제하지 않는다. account deletion/export/보존 정책은 후속 운영 설계이며 이번에 self-service 삭제 UI를 넣지 않는다. 한 사용자는 여러 Project를 만들 수 있고 각 Project owner는 정확히 한 명이다. ownership transfer/reparent/share는 지원하지 않는다.

생성 UI는 name만 보낸다. 서버 검증 user.id로 owner를 지정하고 DB default/auth.uid 및 INSERT CHECK도 같은 user를 강제한다. owner/row PK/parent FK는 UPDATE column 권한 또는 불변 trigger로 DB에서 고정한다. 사용자 자신의 두 Project 사이 이동도 금지한다. RLS old/new 검사만으로는 같은 소유자 내 reparent를 막지 못하므로 별도 제약이 필요하다.

`assets(product_id, project_id)`와 `products(id, project_id)`의 복합 FK/참조 UNIQUE를 추가할 계획이다. 기존 두 FK만 믿지 않는다. `storage_path`의 Project/Product/leaf Asset UUID·확장자 정합성, 경로 유일성 및 불변성을 함께 보장한다. JSON의 asset/source/section ID도 권한 증거가 아니며 모든 실제 조회에서 RLS와 같은 Project scope를 재확인한다.

기존 데이터 전략은 **nullable 추가 → 명시 bootstrap backfill → 검증 → NOT NULL/policy 활성화**. B(사전 Auth user 준비)는 A의 선행 조건으로 결합한다. C(archive/reset)는 기본 해법에서 배제한다. 자동 첫 가입자 claim, migration에 임의 UUID 하드코딩, 실패 row 삭제는 금지한다.

환경별 운영 절차:

1. public ingress와 기존 service-role 앱의 write를 maintenance로 닫는다. DB snapshot 및 bucket object inventory/bytes hash를 접근 제한 위치에 저장한다. raw metadata/사용자 UUID/email manifest는 Git에 넣지 않는다.
2. 해당 dev/staging/prod **동일 Supabase 환경**에 검증된 bootstrap Auth user를 준비한다. 프로젝트 ref 일치와 실제 user 존재/verification을 운영자가 확인한다.
3. 운영 입력으로 project→owner mapping manifest를 제공한다(단일 owner 환경도 명시 allowlist). dry-run은 모든 기존 Project가 정확히 한 번 매핑되는지, 대상 user가 존재하는지, orphan/cross-FK/path mismatch가 없는지 확인한다. 의심 row는 격리 조사하고 삭제/추측 귀속하지 않는다.
4. privileged offline tool로 nullable owner를 transaction 안에서 backfill한다. null만 갱신하고 기존 다른 owner는 오류; 재실행은 동일 mapping만 허용한다. migration SQL에 환경 identity를 넣지 않는다.
5. owner NULL 0, graph/path 오류 0, table별 row count/PK/content hash 및 모든 원본/Derived bytes 동일을 확인한다. timestamp trigger 때문에 발생할 수 있는 owner 갱신 timestamp 차이는 미리 좁게 정의하고 canonical content/provenance/version/hash 변경은 허용하지 않는다.
6. NOT NULL/제약/RLS/Storage/code 전환을 완료한 뒤 두 사용자 테스트를 통과해야 ingress를 연다. 누락 또는 모호함은 fail-closed 유지다.

## 8. DB RLS 계약과 성능

아래 `Own(row)`는 **auth.uid() IS NOT NULL이고 chain 끝의 projects.owner_id = auth.uid()**라는 뜻이다. policy는 authenticated role에만 적용한다. grants와 policy를 같은 전환 단계에서 설정하며 anon은 revoke 유지. 사용자에게 table ALL, TRUNCATE, 권한 위임을 주지 않고 필요한 SELECT/INSERT/UPDATE/DELETE만 허용한다.

| Table | Own 판정의 실제 chain | SELECT USING | INSERT WITH CHECK | UPDATE USING / WITH CHECK | DELETE USING |
| --- | --- | --- | --- | --- | --- |
| projects | row.owner_id = auth.uid() | Own(old) | Own(new) | Own(old) / Own(new) + owner 불변 | Own(old) |
| products | row.project_id → projects | Own(old) | Own(new) | Own(old) / Own(new) + parent 불변 | Own(old) |
| product_facts | row.product_id → products.project_id → projects | Own(old) | Own(new) | Own(old) / Own(new) + parent 불변 | Own(old) |
| assets | row.project_id → projects AND row.product_id가 그 Project의 Product | Own(old) | Own(new) + FK/path 일치 | Own(old) / Own(new) + FK/path 불변 | Own(old) |
| detail_pages | row.project_id → projects | Own(old) | Own(new) | Own(old) / Own(new) + parent 불변 | Own(old) |
| sections | row.detail_page_id → detail_pages.project_id → projects | Own(old) | Own(new) | Own(old) / Own(new) + parent 불변 | Own(old) |
| product_options | row.product_id → products.project_id → projects | Own(old) | Own(new) | Own(old) / Own(new) + parent 불변 | Own(old) |

INSERT에는 USING이 없고 DELETE에는 WITH CHECK가 없다. UPDATE는 old row 접근과 new row 관계를 모두 검사한다. UPDATE/DELETE에서 0 rows는 성공적인 변경이 아니며 앱은 not-found로 정규화한다. UPSERT도 INSERT/UPDATE 양 경로와 SELECT 권한을 테스트한다. RLS는 concurrent version/CAS/원본 보존 계약을 대체하지 않는다.

기존 parent-child CASCADE는 유지하되 Project 소유권과 graph 정합성 아래서만 삭제한다. FK/unique referential checks는 RLS를 우회할 수 있으므로 child policy가 cascade를 막아줄 것이라 가정하지 않는다. root를 바꿀 수 없게 하고 혼합 graph를 먼저 제거해야 한다. [PostgreSQL Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

DB cascade는 Storage bytes를 삭제하지 않는다. 현재 없는 Project 삭제 UI를 새로 만들지 않는다. 향후 own Project 전체 삭제를 구현할 때 Object 정리→DB root 삭제, 제한된 manifest/retry, 실패 시 복구 가능 상태를 정의한다. direct DB delete가 남긴 Object는 root가 사라져 읽을 수 없어야 하고 offline orphan 검토 대상으로 남긴다. 다른 사용자 데이터 cleanup 권한을 web에 추가하지 않는다.

index 계획: 기존 child FK/unique index를 재사용하고 `projects(owner_id, updated_at DESC, id)`를 목록/owner 조회에 검토·추가한다. assets 복합 FK용 `products(id, project_id)` UNIQUE는 제약 목적의 추가다. storage path UNIQUE도 migration 전 중복 audit 후 추가한다. 필요시 `(select auth.uid())`를 통한 statement 내 identity 재사용을 검토한다. 실제 2-user 대량 fixture에서 EXPLAIN ANALYZE로 nested policy 비용을 측정하고 owner 중복 컬럼을 선제 도입하지 않는다. [RLS 성능 지침](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 9. Storage isolation과 upload 계약

| 후보 | 장점 | 부담 | 결정 |
| --- | --- | --- | --- |
| `{userId}/{projectId}/...` 새 prefix | UID 식별 쉬움 | 모든 path/metadata/fingerprint 참조와 Object copy/move 필요, prefix 위조는 여전히 검증 필요 | 미선택 |
| 현재 `projects/P/products/Q/A.ext` + 관계 조회 | 기존 bytes/path/provenance 보존, 동일 root 모델 | policy의 Project/Product join 필요 | **선택** |

대량 rename/copy는 필요 없다. 기존 Object는 경로→실제 Product→Project→owner 조회로 보호한다. Object의 `owner_id` metadata 또는 폴더 문자열만으로 권한을 부여하지 않는다. Storage ownership metadata 자체는 접근 정책이 아니다. [Storage ownership](https://supabase.com/docs/guides/storage/security/ownership).

`product-assets`에만 아래 정책을 계획한다. 다른 bucket의 정책은 수정하지 않는다. 기존 foreign/광범위 permissive policy가 OR로 권한을 넓히는지 실제 catalog에서 확인하고 이 bucket의 충돌 policy를 제거해야 한다.

| Operation | authenticated 정책 |
| --- | --- |
| SELECT/list/download/sign | bucket 일치 + 엄격한 경로 shape/UUID + Product의 project 일치 + root owner=auth.uid(); malformed path는 cast error 대신 deny |
| INSERT | 위 조건 + 서버가 생성한 정확한 신규 path의 유효 upload reservation; upsert=false, bytes/MIME bucket 상한 |
| UPDATE/overwrite/move | 불필요: **허용 policy/권한 없음**, upsert/copy로 범위 우회도 테스트 |
| DELETE | root 소유권 및 경로 일치; Asset row가 없어도 자신의 업로드 실패 Object 정리 가능 |

현재 upload가 Asset INSERT보다 먼저이므로 INSERT/실패 cleanup DELETE policy에 Asset row 존재를 요구하면 정상 workflow가 깨진다. path의 실제 Project/Product 관계를 기준으로 삼는다. 이미 소유한 legacy Object read/delete에는 신규 reservation을 요구하지 않는다. 다른 사용자 namespace로의 copy/move, parent ID 위조, UUID-like invalid string, URL decode traversal을 거부한다. [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

sign은 인증 서버 client→Asset RLS/scope→Storage policy→짧은 URL 순서. 60/300초 TTL을 용도별 유지·최소화하고 사용자가 TTL/path/bucket을 임의 지정하지 못하게 한다. **발급된 signed URL은 bearer URL**이므로 가진 사람은 만료까지 사용할 수 있고 logout은 이미 발급한 URL을 즉시 회수하지 않는다. 따라서 “B가 경로를 알아도 sign/download deny”와 “유효 signed URL을 전달받은 B도 deny”를 혼동하지 않는다. 두 번째는 현 방식으로 보장할 수 없다. URL 로그/공유 cache 금지, Referrer-Policy no-referrer, TTL 경계 테스트가 필요하다. [Signed downloads](https://supabase.com/docs/guides/storage/serving/downloads).

기존 업로드는 10MiB/MIME/signature/파일명/상품당 30개를 검사한다. **일반 uploadAsset은 full pixel decode를 하지 않고 width/height를 null로 저장**한다. downstream inspection/extraction의 pixel/decoded-memory 제한을 전체 upload에 이미 적용했다고 보고하지 않는다. 공개 전에는 모든 신규 이미지에 bounded decode·pixel 상한을 적용하고 bucket 크기/MIME 제한도 설정한다. import의 SSRF/DNS/redirect/byte 제한, source만 추출·Derived 재추출 금지, manual crop의 원본 hash/rect/version/CAS/provenance, 동일 pixels+config⇒동일 decision 및 ambiguous preserve를 유지한다.

직접 Storage 호출은 앱의 30개/비용 제한을 우회할 수 있다. 따라서 §11의 원자적 quota ledger에서 Project/user별 활성 Object+예약 bytes/slot을 예약한 **한 개 immutable path**만 INSERT 가능하게 한다. 10MiB bucket cap을 예약량 상한으로 계산하고 실패/만료 정산은 실제 Object 존재 확인 후 서버만 수행한다. 예약당 upsert 금지와 unique Object name으로 동시 업로드도 상한을 넘지 못하게 한다. 사용자가 owner metadata/파일명/Asset JSON을 써서 예약을 만들거나 환불할 수 없다. Storage 정책으로 이미지 내용의 정상성을 증명할 수 없으므로 읽기/AI 처리 시 실제 bytes를 다시 검증한다. reservation은 새 추측 기능이 아니라 공개 write 권한 개방의 비용 상한 조건이며 TASK-059/060에서 실제 Storage API로 검증한다.

## 10. Export 인증 설계

현재 `exportDetail`은 server-role `getRenderView`로 전후 fingerprint를 확인하고, **session cookie 없는 fresh Chromium context**가 `/projects/{id}/render`를 연다. 현재의 origin/GET allowlist, service worker 차단, 이미지/font readiness, single render article, dimensions/bytes/75초 timeout 및 browser finally cleanup은 유지한다. 이것만으로 공개 환경 사용자 인증은 성립하지 않는다.

| 후보 | 보안·복잡도 | 선택 |
| --- | --- | --- |
| A. caller session cookies 제한 복사 | 구현 비교적 단순; refresh token/chunks 노출 범위와 refresh rotation·동시 탭 문제, path/domain 제한 필요 | 초기 추천에서 제외 |
| B. short-lived internal token만 사용 | 재사용·scope 확대·service client로 교환 위험; token 자체는 RLS identity가 아님 | 단독 사용 불가 |
| C. server-only render endpoint + 서명된 일회 authorization | replay ledger/별도 endpoint 필요; user JWT를 함께 사용해 RLS 유지 가능 | **선택** |
| D. internal origin + service role | origin을 아는 요청이 임의 page를 읽는 backdoor가 될 수 있음 | 금지 |

권장 C의 구체적 계약:

1. Export POST에서 session 검증→Project/Page/Assets RLS→canonical fingerprint. 사용자 access token 잔여 시간이 capture 75초+여유보다 짧으면 **issuer 요청에서 먼저 refresh**, 불가능하면 401. refresh token을 Chromium으로 넘기지 않는다.
2. server signing key로 `{actorId, projectId, pageId, fingerprint, assetSnapshotDigest, method:GET, exactPath, jti, exp}`를 서명한다. TTL 최대 90초, 1회. JWT와 grant를 URL/query/DOM/로그에 넣지 않는다. JWT와 grant의 actor가 달라지면 거부한다.
3. ephemeral Chromium context의 route interception에서 **그 exact navigation 1건에만** user access JWT와 grant header를 주입한다. context-global extraHTTPHeaders/cookies/storageState를 사용하지 않고 외부 이미지/static request에는 Authorization/grant가 전파되지 않는다.
4. 전용 render Route Handler는 grant signature/expiry/path/method, Auth identity, 실제 RLS 소유권을 모두 확인하고 비공개 nonce ledger에서 원자적으로 consume한다. replay는 2개 서버에서도 1건만 허용한다. 동일 shared Renderer로 문서를 만들며 **어떠한 service-role read/fallback도 없다**. 토큰만으로 DB identity를 대신하지 않는다.
5. 해당 handler 및 render 응답은 no-store/no-referrer. ready marker와 fingerprint를 대조하고 최초 snapshot 이후 변경 시 실패한다. issuer에서 승인한 Asset ID/path/fingerprint/정확한 signed URL map을 nonce의 짧은 수명 private context에 bind한다. handler는 fresh RLS/Asset scope를 재검사한 뒤 이 map을 사용하며 임의 재발급한 URL로 바꾸지 않는다. issuer와 handler가 서로 다른 시각에 sign하면 query가 달라질 수 있기 때문이다. map은 capture보다 충분한 잔여 TTL을 갖고 최대300초 이내이며 nonce context에는 refresh/access JWT를 저장하지 않는다. 서브리소스는 정확한 static 경로 및 이 map의 signed URL **query까지** allowlist, redirect/새 탭/WebSocket/service worker는 차단한다. 현재 이미지 allowlist의 origin+pathname 비교만으로 query 변조까지 막았다고 간주하지 않는다.
6. 완료 직전 issuer에서도 같은 user client로 재조회/fingerprint 확인. 사용자 권한/토큰/서명이 불확실하면 실패하고 새 권한으로 자동 retry하지 않는다. 실패·성공 모두 context/browser 종료, 메모리 credential 폐기, TTL 지난 nonce만 제한 정리한다.

전용 endpoint는 인터넷에서 주소를 알아도 유효 grant **및** user JWT/RLS 없이 접근 불가해야 한다. 일회 token은 제한된 render 권한이고 관리 권한이 아니다. 현재 일반 `/render` 화면은 정상 사용자 SSR session 경로로 계속 보호한다. 이 설계의 구현·운영 복잡도는 TASK-062에서 contract/integration 테스트로 확인하며 실패 시 Export 기능을 닫고 공개 통과로 처리하지 않는다.

## 11. AI, 비용, 임시 capability

OpenAI/Domeggook credentials, model, system prompt, provider request 구조는 서버 설정만 사용한다. 사용자 입력은 allowlisted domain fields이고 provider API key/model/raw request override를 받지 않는다. 사실정보의 Source of Truth, grounding/schema validation, 관찰과 사실 분리, copy 역할, 원본 이미지 보존은 그대로다.

현재 방어의 실제 한계:

| Workflow | 현재 방어 | 공개 환경에서 부족한 점 |
| --- | --- | --- |
| Asset/Product analysis, Facts, Planner | process Set/cap + 상태 CAS/attempt/fingerprint | user 일일 예산 없음; 여러 resource/instance 호출 가능 |
| Extraction/retry | source lease/CAS, tile checkpoint, failed-only 재사용, 최대16 tile | 새 source·새 run의 비용 제한 없음; user/global reserve 필요 |
| Section Engine/Editor/reorder | page lease/journal, revision 및 recovery | write 충돌 완화이지 과금 quota/transaction 보장이 아님 |
| Regeneration | provider 실행 중 process Set, candidate/revision 검증 | DB provider lease 없음; 다른 instance 중복 비용 가능 |
| Wholesale/Export | process jobs Set / export busy flag, timeout | 분산 user/IP rate limit·global capacity 아님 |

로그인만으로 비용 보호가 되지 않는다. **Must:** verified user + per-user/IP 요청 throttle + DB의 원자적 per-user/global concurrency 및 일일 비용 예약 + 작업별 input/output/token/tile 상한 + provider 측 global spend cap/kill switch. in-process lock은 추가 최적화일 뿐 보안 경계로 사용하지 않는다. billing/credits UI는 Out이다. Auth 자체의 rate limit도 앱의 AI quota를 대신하지 않는다. [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

작업 순서는 auth→fresh Project/resource RLS→input/schema/limits→quota reserve/lease→provider→schema/grounding→같은 user RLS/CAS write→비용 정산이다. foreign resource 요청은 **provider 호출·quota 차감·Storage sign 0회**. quota key에 actor+operation+resource+input fingerprint+idempotency key를 bind하고, retry는 failed tile의 새 비용만 예약한다. concurrent reserve는 user와 global 한도 둘 다 transaction 내 검증한다. timeout 후 provider가 실행했는지 불명확하면 예약을 보수적으로 유지하고 자동 재호출/무조건 환불하지 않는다. 외부 API의 exactly-once는 약속하지 않는다.

**구현 예정 control plane:** 비용/업로드 예약·lease·export nonce를 private schema ledger에 둔다(업무 테이블 owner 중복 아님). 사용자 direct SELECT/WRITE/정산 권한 없음. 서버는 사용자 JWT + 별도 서버 HMAC operation proof로 좁은 reserve/settle/consume RPC를 호출한다. proof는 auth.uid, operation, resource/path, 상한, nonce, expiry를 bind하며 DB가 검증; 브라우저가 만든 수치/환불/완료 주장은 거부한다. secret은 offline provisioning한 private DB 설정과 서버에만 저장하고 migration literal에 넣지 않는다. 필요한 SECURITY DEFINER 함수는 이 ledger만 조작하며 identity/root 소유권을 함수 안에서도 검증, 고정 `search_path=''`, schema-qualified 참조, PUBLIC EXECUTE revoke 및 필요한 role만 grant한다. business table/Storage 전체 bypass 기능을 만들지 않는다. [함수 보안 지침](https://supabase.com/docs/guides/database/functions).

RPC의 JSON canonical signing/재사용 방지·원자성·정산 불확실성은 TASK-060의 필수 검증 항목이다. 검증되지 않으면 유료/업로드 기능을 닫는다. 이는 일반 사용자 경로에 service key를 다시 도입하지 않으면서 서버 비용 권위를 구분하기 위한 제한된 DB 권한 설계다. ledger가 중단되면 fail-closed 503, quota 초과는 429; 공개 배포 전 운영 한도값을 반드시 설정하고 “0=unlimited” fallback을 금지한다.

임시 token/cache도 actor scope가 필요하다. 현재 wholesale ticket은 Project+20분 Map이고 `previewImage`는 ticket만으로 외부 fetch할 수 있으므로 **thumbnail GET도** user/Project RLS를 먼저 확인한다. Options ticket은 Product/revision/HMAC/Map, regeneration candidate는 HMAC/10분이며 모두 actor bind를 추가한다. 이전 ticket은 cutover 시 무효. instance 이동으로 ticket이 없으면 명시 재조회 안내, 자동 외부/AI 재시도 금지. visual dimension cache는 authorization 조회 후만 접근하고 actor+path+content fingerprint로 격리; global cache가 소유권 확인을 대체하지 않는다.

## 12. CSRF, IDOR, API 오류

현재 `src/features/assets/http.ts:assertSameOrigin`은 Request URL의 host를 **요청 Host header로 덮어쓴 뒤** Origin과 비교한다. missing Origin을 거부하지만 trusted public origin allowlist나 caller identity 검증은 아니다. Public에서는 설정된 HTTPS application origin과 신뢰할 reverse proxy/Host 규칙으로 검사하고 임의 Host/X-Forwarded-Host를 권한 판단에 사용하지 않는다. local localhost 예외는 dev 환경만 허용한다.

cookie mutation API는 POST/DELETE 등 명시 method + exact Origin(없음/null 거부), JSON/form/content-type/body cap, 안전한 SameSite 쿠키를 함께 사용한다. GET은 사용자 의도 없는 write를 수행하지 않게 audit한다. 현재 getView의 stale recovery mutation은 명시 인증된 mutation 경로 또는 제한된 서버 정리 단계로 분리할 계획이다. Server Actions의 기본 Origin 검사를 활용하되 Action 내부 auth/RLS는 별도로 수행한다. wildcard credential CORS는 사용하지 않는다.

client body/query의 userId/ownerId/metadata role은 identity가 아니다. 모든 nested ID, signed URL, Export, candidate, wholesale thumbnail, API의 read/update/delete/유료 호출을 직접 요청했다고 가정한다. `auth.uid()`와 실제 FK chain을 DB/Storage에서 검증하며 helper에서 추가 scope/revision을 검사한다. 외부 provider 전에 RLS를 확인하고 모든 error response는 존재 여부/secret을 숨긴다. 구체적 공격·검증 matrix는 [위협 모델](V0_3_THREAT_MODEL.md)을 따른다.

## 13. Local 개발과 검증

기존 mock unit tests는 빠른 regression용으로 유지한다. CLI 의존성은 이미 있으므로 local Supabase(Postgres/Auth/Storage, container runtime 준비)를 우선하고 별도 remote dev project는 대안이다. 앱 로그인은 실제 Auth를 거치며 dev-only bypass/admin fallback을 만들지 않는다. 개인/production 이메일 대신 run별 `qa-a-<run>@example.invalid`, `qa-b-<run>@example.invalid`와 local mail inbox를 쓴다. 비밀번호는 실행 중 생성하여 로그/fixture에 저장하지 않는다. confirmation/reset 메일 링크는 local inbox에서만 읽는다.

seed/teardown만 명시 C 자격을 사용하고 사용자 테스트는 실제 A/B Auth token 및 anon으로 수행한다. RLS 검증은 **실제 migration을 적용한 Postgres/PostgREST**에서 CRUD/USING/WITH CHECK/constraint/cascade/grants/EXPLAIN을 실행한다. Storage는 실제 Storage API를 거쳐 upload/list/download/sign/remove/upsert/copy/move를 확인한다. mock 통과를 RLS 보안 성공으로 계산하지 않는다. CI secrets/logs/artifacts에 session·signed URL을 남기지 않는다.

기존 데이터 upgrade fixture는 v0.2.1 schema에서 생성한 full graph, auto/manual Derived와 구형/신형 metadata, options/Section 참조, bytes hash를 포함한다. bootstrap/backfill 이후 ID·row 수·canonical content·path·bytes 동일과 NULL 0을 검사한다. 잘못된 mapping/mixed FK/중복 path에서는 중단되고 데이터가 삭제되지 않아야 한다. 새 migration 후 local schema에서 `src/types/database.types.ts`를 재생성하고 diff/typecheck 및 relation type을 검사한다. TASK-055에서는 파일을 생성하지 않는다.

## 14. Migration, rollout, rollback

예상 **4 migration**, 현재 마지막 0005 다음 번호를 구현 시 재확인한다. 아래는 단계 이름이며 SQL은 아직 없다.

| 예정 | 내용 | 공개 조건 |
| --- | --- | --- |
| 0006 ownership preparation | nullable owner/FK/index, 기존 graph/path audit 준비 | 기존 anon/auth grants 닫힘, maintenance |
| offline bootstrap | 환경별 mapping 입력·backfill·hash 검증, migration 아님 | NULL/불일치가 하나라도 있으면 중단 |
| 0007 ownership enforcement + DB RLS | NOT NULL, immutable/FK/path constraints, CRUD grants/policies | DB integration 통과, 아직 public closed |
| 0008 Storage isolation | bucket bounds와 해당 bucket policies | reservation gate는 준비 전 deny; service fallback 없음 |
| 0009 private security ledger | quota/lease/upload reservation/export nonce + 제한된 RPC, Storage reservation 연결 | TASK-060/062 완료 및 전체 보안 gate 필요 |

0008은 아직 없는 ledger를 참조하는 broken policy를 만들지 않는다. 이 단계에서는 INSERT deny로 유지하고 0009에서 검증된 reservation predicate를 원자적으로 연결한다. 기존 read/delete는 owner 기반 테스트 가능하다. 0006에서 필요한 제약의 검증이 불가능하면 추가 단계 분리로 개수는 늘어날 수 있으며 security를 개수 목표에 맞추지 않는다.

단일 통제 release: staging에서 backup/upgrade rehearsal→production maintenance/기존 write 정지→bootstrap user 확인→0006/backfill/0007/0008/0009→types 및 session-scoped 앱 배포→service key 없는 web env 확인→A/B/anon DB·Storage·Export·비용 gate→own-user 전체 회귀→ingress 개방. Auth UI만 먼저 공개하는 순서는 금지한다. 서로 다른 schema/code 버전이 동시에 public write하지 않게 이전 instance를 drain한다. Postgres transaction과 Storage/Auth/API 배포 전체가 하나의 atomic transaction이라는 주장은 하지 않는다.

NULL/invalid owner, 없는 public key, session 불명확, RLS/Storage/ledger 오류, backfill 누락 시 데이터/유료 요청을 거부한다. fallback service role, 임시 public bucket, permissive RLS, 첫 로그인 자동 owner 배정은 금지한다.

rollback은 **ingress/유료 기능 정지→RLS/Storage 유지→보안 schema와 호환되는 앱 버전으로 복귀 또는 forward-fix**다. v0.2.1 service-role 앱을 공개 재배포하지 않는다. 데이터 복원은 격리 maintenance에서 backup/owner mapping/object hash를 검증하고 보안 정책을 유지·재적용한 뒤 다시 gate를 통과한다. RLS disable/grant-all/public bucket 전환을 정상 복구 절차로 사용하지 않는다. 이미 공유된 bearer URL/JWT는 TTL 잔여 위험을 별도로 다룬다.

## 15. Scope와 TASK 순서

**Must:** Auth/session/verification/reset, root ownership/backfill, DB CRUD RLS와 FK 불변성, Storage isolation/bytes·slot 제한, 일반 service-role 제거, 보호 DAL/API/Actions, error privacy/CSRF/cache, actor-bound tickets, 안전한 Export, 분산 cost/rate control, real A/B/anon integration, 원본 보존 upgrade 및 own-user 회귀, fail-closed rollout/rollback.

**Should:** basic account page, quota 잔여 UX/운영 지표 상세, 이메일 전달성·접근성 polish, 큰 데이터 RLS 성능 개선(필수 baseline 검증은 Must). **Out:** 결제/구독/credits 판매, teams/org/membership/invitation/sharing/transfer, OAuth/SMS, admin dashboard, marketplace 자동등록, 신규 AI/이미지 기능. memberships table을 선제 생성하지 않는다.

| TASK | 범위 / 선행조건 | 완료 gate |
| --- | --- | --- |
| 056 | Auth client/session foundation, public key/SSR 설계 구현; 055 후 | 검증된 identity/refresh/cookie·no-cache; 아직 공개 금지 |
| 057 | ownership schema와 offline bootstrap 도구; 056 계약 | 기존 data-loss 0 rehearsal, mapping/NULL gate |
| 058 | DB RLS/grants/FK 불변성·types; 057 후 | 실제 7-table A/B/anon CRUD 및 forged parent 차단 |
| 059 | Storage path 보존·정책/bucket bounds; 058 후 | actual API isolation, pre-row cleanup; upload는 060 gate 전 deny |
| 060 | 31 factory 및 하위 호출 user-scoped 이전, HMAC/ticket actor; **private ledger/분산 비용·업로드 제한 포함** | web service key 0, atomic quota·다중 instance·direct API 우회 테스트 |
| 061 | login/signup/verify/reset/logout/protected App UX; 056~060 후 | Desktop/mobile, 다중 탭, redirect/cache/session expiry |
| 062 | 일회 Export authorization/nonce; 060 ledger 및 061 후 | user JWT/RLS, replay·header 누출·cross-user deny |
| 063 | 전체 cross-user security E2E; 056~062 통합 | 모든 resource/API/Storage/비용 부작용 deny |
| 064 | 실제 own-user 전체 workflow/기존 data migration 회귀; 063 후 | Import→AI→manual crop→Editor→PNG/JPG, 데이터 손실 0 |
| 065 | release validation/운영 설정/backup·rollback rehearsal; 모든 gate 후 | 별도 공개 가능 판정, version/Git 작업은 해당 TASK 요청 범위 |

각 TASK에서도 관련 integration은 즉시 작성·실행하고 063까지 미루지 않는다. 060은 필요하면 data-access와 control-plane 작업으로 나누되 둘 다 061/public의 선행조건이다. 055 문서 완료는 이후 TASK 실행/배포/Git commit 요청을 대신하지 않는다. **TASK-056 foundation 이후 다음 추천은 057**이다. 056의 실제 Local Auth 미검증 범위는 구현 계약에 기록했다.

## 16. Dependency와 환경 변경 계획

TASK-055에서 예상한 **`@supabase/ssr` 1개**를 TASK-056에서0.12.7로 고정 추가했다(peer supabase-js ^2.114.0, 현재2.115.0 유지). 기존 SDK 자체로 Auth HTTP 호출은 가능하지만 Next cookie chunk/PKCE/refresh request-response adapter를 직접 재구현해야 하므로 공식 helper를 사용한다. 새로운 Auth framework/state library/결제 SDK는 추가하지 않았다. [SSR 안내](https://supabase.com/docs/guides/auth/server-side).

현재 local env에는 SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY가 있다. 후자는 **legacy JWT 형식, decoded role=service_role**이며 signature 검증/원격 프로젝트 key 설정 확인은 하지 않았다. SUPABASE_ANON_KEY/PUBLISHABLE_KEY/SECRET_KEY 및 NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/PUBLISHABLE_KEY는 없다. 따라서 해당 프로젝트가 새 key를 지원하는지 또는 이미 보유하는지 추측하지 않는다.

| 계획 변수/설정 | 공개성 / 목적 |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | browser 공개 가능; 실제 프로젝트에서 발급한 publishable key 권장 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | legacy 환경 대안; 두 key를 모호하게 fallback하지 않고 한 모드를 명시 |
| SUPABASE_URL | 서버 동일 프로젝트 endpoint; public URL과 일치 검증 |
| SUPABASE_SERVICE_ROLE_KEY / 새 secret key | offline 관리/격리 fixture만; public web env 제거 |
| APP_ORIGIN | 서버 trusted HTTPS origin 및 Auth redirect allowlist 설정 기준 |
| CANDIDATE_SIGNING_SECRET, EXPORT_SIGNING_SECRET, OPERATION_SIGNING_SECRET | 제안 이름, 서로 분리한 서버 secret; 마지막은 private DB 검증 설정과 동기화 |
| user/global rate·일일 예산·동시 실행·Storage slot/bytes 한도 | 서버/DB 운영 설정, 누락 시 해당 기능 fail-closed |
| SMTP, Auth Site URL/redirect allowlist, verification, token TTL/bot 대응 | Supabase 프로젝트 운영 설정; 개인 secret을 NEXT_PUBLIC에 넣지 않음 |
| OPENAI_API_KEY 및 기존 provider 설정 | 계속 server-only; model/raw 요청 override 금지 |

publishable/legacy anon key 자체는 사용자 신분이 아니며 RLS에 사용자 JWT가 함께 필요하다. secret/service-role은 RLS를 bypass하므로 browser에 절대 전달하지 않는다. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys). 환경별 key와 signing secret은 운영자가 별도 provision하며 문서/소스/로그에는 값이나 실제 개인 이메일을 기록하지 않는다.

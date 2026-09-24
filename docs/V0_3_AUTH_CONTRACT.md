# v0.3.0 Auth Client & Session Contract

2026-09-24 · TASK-056 · **Authentication foundation IMPLEMENTED/PARTIAL**. Package0.2.1, Next16.3.4. 로그인 UI/기존 route enforcement/owner/RLS/Storage 격리/일반 service-role 이전/Export 인증은 아직 없다. 공개 SaaS 배포는 계속 BLOCKED다. [73항목 보고](tasks/TASK-056.md), [전체 설계](V0_3_PUBLIC_SAAS_ARCHITECTURE.md), [위협 모델](V0_3_THREAT_MODEL.md).

## 구현 경계와 dependency

기존 `@supabase/supabase-js` 2.115.0을 유지하고 **`@supabase/ssr` 0.12.7을 exact pin**했다. npm registry의 peer 요구는 supabase-js `^2.114.0`이며 현재 설치본이 충족한다. 추가 transitive dependency는 cookie1.1.1이다. 기존 SDK만으로 Auth HTTP 요청은 가능하지만 Next cookie adapter/분할·정리/PKCE 저장을 직접 작성해야 하므로 공식 SSR helper를 사용했다. 설치된 SSR source의 lazy session 초기화, `getAll`/`setAll(cookies, headers)`, no-cache header 전달을 확인했다. [공식 SSR client 지침](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

새 Auth 코드는 기존 Project feature에 적용하지 않았다. 새 `/login`, `/signup`, Auth API/proof endpoint, Header/Sidebar UI는 없다. `src/proxy.ts`는 조건부 **refresh-only**이며 접근 허용 판정이 아니다. 기존 31개 factory 호출식은 그대로다.

| Module | 계약 |
| --- | --- |
| `src/lib/auth/browser.ts` | `createBrowserAuthClient()`: client-safe public key+SDK 쿠키 client |
| `src/lib/auth/server.ts` | `createAuthenticatedServerClient()`: 요청별 `await cookies()`, 기본 read-only RSC |
| `src/lib/auth/session.ts` | `createSessionClient(cookieAdapter)`: 동일 public config의 SDK server client, singleton 금지 |
| `src/lib/auth/principal.ts` | `getCurrentUser`/`requireCurrentUser`, 최소 `AuthenticatedPrincipal={userId}` |
| `src/lib/auth/guards.ts` | `requireApiUser`/`requirePageUser`, 명확한 401/redirect 계약 |
| `src/lib/auth/mutations.ts` | bounded POST Request 기반 signup/signin/signout, server-only 함수이며 공개 endpoint 아님 |
| `src/lib/auth/proxy.ts`, `src/proxy.ts` | request/response 양쪽 cookie refresh, config 없는 내부 앱은 그대로 통과 |
| `src/lib/auth/{config,errors,transport,return-path}.ts` | public config/안전한 오류/provider text 제거/내부 복귀 경로 |
| `src/lib/supabase/admin.ts` | 기존 privileged 구현을 `createSupabaseAdminClient`로 명명 |
| `src/lib/supabase/server.ts` | 기존31곳 전용 `createSupabaseServerClient` compatibility alias; 사용자 session client가 아님 |

새 Auth 모듈은 service-role client/key를 import/read하지 않는다. server-safe module에 `server-only`를 유지하며 browser graph에는 Next headers/Node crypto/fs/Sharp/admin module이 없다. 기존 admin의 key/timeout/에러·DB 동작은 그대로다. 이 물리적 분리 자체가 31곳의 사용자 권한 이전을 의미하지 않는다.

## Environment와 key 모델

현재 로컬에는 legacy `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`가 있으며 browser public Auth 변수는 없다. service key는 legacy JWT 형식이다. 이는 원격 프로젝트의 key 지원/config를 조회한 결과가 아니다. key 값은 로그/문서에 기록하지 않는다.

| 설정 | 공개성 / 동작 |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | public HTTPS origin, local Supabase는 loopback HTTP 허용; path/query/credential/hash 거부 |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | public `sb_publishable_` 형식만 허용, 실제 같은 프로젝트에서 발급 필요 |
| SUPABASE_URL | 기존 internal env 유지; Auth public URL이 있으면 같은 origin인지 서버에서 확인 |
| SUPABASE_SERVICE_ROLE_KEY | 기존 internal admin만 사용. Auth/browser fallback으로 사용하지 않음 |
| DETAILFORGE_APP_ORIGIN | 기존 Export 설정명을 재사용. Auth POST의 trusted Origin도 이 값으로 검증 |

첫 adapter는 **publishable key만 지원**한다. legacy anon JWT는 지원하지 않으며 Auth 설정에 secret/service JWT를 넣어도 즉시 거부한다. 이를 위해 custom JWT decoder/verifier를 만들지 않았다. TASK-055의 legacy-anon 대안은 필요 시 별도 검토 항목으로 남긴다. 실제 프로젝트에서 publishable key를 provision하기 전 real Auth 동작을 주장하지 않는다. public key는 본래 브라우저에 노출 가능한 자격이고 사용자 신분은 별도 session이다. [Supabase key 구분](https://supabase.com/docs/guides/getting-started/api-keys).

두 public 변수가 모두 없으면 build와 refresh proxy는 기존 internal workflow를 유지한다. **Auth client/helper를 호출하면 configuration 오류503**이다. 일부만 있거나 형식이 틀리면 next.config의 조기 검증에서 build/start 실패, runtime Auth도 동일한 안전 오류다. Next가 public 환경 값을 JS에 inlining하기 전에 secret/JWT 오입력을 거부한다. 값은 출력하지 않는다. `.env.local`은 수정하지 않았으며 `.env.example`에 이름·구분만 추가했다.

## 세션 검증과 cookie

`getCurrentUser()`는 Supabase **`auth.getUser()`**를 호출해 Auth server가 반환한 사용자만 신뢰한다. cookie의 user JSON, body userId, JWT payload를 직접 decode한 결과를 권한으로 사용하지 않는다. `getSession()`의 user를 신뢰하지 않는다. 존재하는 verified user UUID만 `{userId}`로 변환하고 provider 전체 User/email/metadata/token은 반환하지 않는다. Supabase anonymous user는 principal로 인정하지 않는다. [getUser](https://supabase.com/docs/reference/javascript/auth-getuser).

session 없음·invalid/expired token·철회된 refresh는 null/unauthenticated401. Auth network/provider 장애는 temporary_failure503이고 로그인 redirect와 구분한다. `requireCurrentUser`는 null이면 bounded AuthFailure를 던진다. 향후 Project 소유권은 별도 RLS/관계 검증으로 구현하며 이 helper가 resource authorization을 수행하지 않는다.

Next16의 설치된 `16-proxy.md`/`cookies.md`에 따라 `src/proxy.ts`, `await cookies()`를 사용한다. Proxy에서 SDK `getClaims()`로 refresh/검증을 수행하고 SDK의 cookie writes를 **incoming request와 outgoing response에 모두 반영**한다. response 재생성 시 앞서 쓴 cookie와 private/no-store·Pragma·Expires header를 잃지 않는다. GET session 조회가 기존 DB/Storage를 사용자별로 보호한다는 주장은 하지 않는다.

Proxy matcher는 `/`, `/projects/**`, `/api/projects/**`, settings/templates, 예정 Auth 화면/callback을 포함한다. cookie 없다고 login redirect하거나 기존 route를 막지 않는다. public Auth config가 없는 경우의 pass-through는 이번 internal 호환을 위한 refresh 부재이며 auth guard 우회 기능이 아니다. 향후 새로운 protected path를 만들면 matcher도 함께 검토해야 한다.

RSC client는 **read-only**: 쓰기 callback에서 cookie를 바꾸지 않고 Proxy의 선행 refresh에 의존한다. Route Handler/Server Action에서 mutation할 때는 `createAuthenticatedServerClient({mode:'write', responseHeaders})`로 명시 생성한다. write 실패를 catch-and-ignore하지 않는다. 응답에는 `responseHeaders`를 전달해야 한다. Server Action wrapper는 요청의 실제 Origin/헤더를 보존하고 Proxy/no-store를 유지해야 한다. RSC에서 signIn/signOut을 수행하면 안 된다.

cookie 이름/분할/base64/PKCE/삭제·만료는 SDK가 담당한다. `Path=/`, SameSite=Lax, production Secure, domain 미설정(host-only)을 사용한다. 브라우저도 session을 읽어야 하므로 **HttpOnly=false**이며 모든 cookie가 HttpOnly라고 표시하지 않는다. SDK 기본 cookie lifetime과 Auth의 access/refresh 유효성은 별개다. custom localStorage/application DB에 token을 저장하지 않는다. logout은 발급된 access JWT/signed URL의 즉시 전역 무효화를 보장하지 않는다. [SSR cookie 안내](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

## Guard 사용 계약

- `requireApiUser()`는 요청 cookie를 쓸 수 있는 client로 확인한다. 성공은 `{ok:true, principal, headers}`, 실패는 `{ok:false, response}`다. 호출자는 실패 response를 그대로 반환하고 성공 response에도 전달된 headers를 붙인다. 401 JSON이며 login HTML redirect가 아니다.
- `requirePageUser(returnPath)`는 검증된 principal을 반환하거나 `/login?next=...` redirect를 던진다. configuration/provider 장애는 redirect하지 않는다. 해당 login UI가 없는 이번 TASK에서는 기존 페이지에 연결하지 않는다.
- `safeReturnPath`/`loginLocation`은 길이2048 이내의 내부 `/`, `/projects/**`, `/settings`, `/templates`만 받는다. scheme/외부 host/이중 slash/backslash/control/중첩 encoding·dot traversal/Auth callback loop는 fallback `/projects`로 바꾼다. URL 복귀 후 권한 재검증은 향후 caller 책임이다.
- body/query의 userId/ownerId를 guard에 전달하는 API는 없다. test dependency injection은 서버 코드 경계이며 HTTP 입력으로 client/factory를 받지 않는다.

## Auth mutations와 오류 privacy

`signUpWithPassword(request)`, `signInWithPassword(request)`, `signOut(request)`는 기존 요청의 JSON body를 직접 읽고 safe JSON Response를 반환하는 내부 함수다. `use server` directive나 app route가 없으므로 지금 원격으로 호출할 수 없다. 미래 Route Handler는 원래 Request를 넘기고, Action wrapper는 입력 크기를 제한하고 실제 요청 헤더를 보존해야 한다.

모든 mutation은 POST·기존 `assertSameOrigin`·설정된 DETAILFORGE_APP_ORIGIN을 함께 확인한다. login CSRF도 예외가 아니다. missing/null/foreign Origin과 임의 Host로 trusted origin을 바꾸는 요청은 거부한다. 기존 Project API의 same-origin 구현은 이번에 변경하지 않았다. Body는 Content-Length와 실제 stream 모두 **8192 bytes** 제한, JSON only, strict fields. 이메일254자/유효 형식, 비밀번호1~1024자이며 복잡도 규칙은 provider config가 담당한다. 비밀번호를 trim/normalize하거나 로그에 남기지 않는다. userId/ownerId/options/model/redirectTo 입력은 거부한다.

| Operation | 성공·실패 계약 |
| --- | --- |
| signup | email/password만 전달. 새 계정/SDK fake user/이미 가입됨 모두 같은 submitted 안내; user/session 반환0. confirmation-disabled 환경에서 session이 돌아오면 local signout하여 암묵 로그인 방지 |
| signin | signInWithPassword 후 getUser로 다시 검증한 principal만 반환. invalid_credentials/email_not_confirmed는 같은 일반 오류 |
| signout | SDK local scope(현재 session) 사용, cookie 정리. signed_out + clearClientState=true + next=/login 계약. 다른 기기 전체 logout을 주장하지 않음 |

Auth provider가 중복 signup에 fake user 또는 오류를 반환할 수 있어 사용자 존재 여부를 앱이 더 구체화하지 않는다. 성공 여부·시간 차이의 완전한 indistinguishability를 보장하는 것은 아니다. email 확인/reset delivery, CAPTCHA/rate-limit, redirect config 및 완성 UI는 후속 Must다. [signUp 반환 의미](https://supabase.com/docs/reference/javascript/auth-signup).

오류는 configuration503 / unauthenticated401 / invalid_credentials401 / invalid_input400 / password_rejected400 / forbidden403 / rate_limited429 / temporary_failure503만 반환한다. rate_limited는 provider 응답 매핑이며 **앱의 rate-limit 구현이 아니다**. foreign-resource404는 TASK-058/060에서 구현한다.

provider의 raw message/stack/headers/URL/body를 응답하지 않는다. SDK가 debug=false여도 refresh 오류를 자체 출력할 수 있어 공통 Auth transport가 **오류 body를 allowlisted code+고정 문구로 교체**한 뒤 SDK에 전달한다. network exception도 고정 문구이며 private/no-store, fetch당10초 timeout, redirect:error다. 정상 session 응답은 SDK에 그대로 전달하고 application DTO/log에는 저장하지 않는다. 앱에서 console/global logger를 monkeypatch하지 않는다. SDK의 제한된 refresh 재시도 동작은 유지하며 business/AI 자동 재시도와 무관하다.

logout 성공 후 실제 draft/cache 제거·full navigation·다중 탭·back/bfcache 처리는 TASK-061 UI에서 이 계약을 소비해야 한다. 실패를 성공으로 표시하지 않으며 provider가 revocation을 완료했는지 불명확하면 temporary_failure다. SDK가 이때 local cookie를 정리할 수 있어도 원격 철회 성공을 보고하지 않는다. 세션 만료 action은401+login required, 초안의 안전한 복구 UX는 후속이다.

## 현재/향후 route 구분

| Surface | 현재056 | 향후 공개 목표 |
| --- | --- | --- |
| `/` | 기존 개인 Dashboard, internal-only 접근 전제 유지 | 사용자 요청의 public root는 **데이터 없는 landing으로 전환한 뒤** 가능; 기존 개인 Dashboard는 protected 위치로 이동하거나 인증 분기 |
| `/login`, `/signup`, `/forgot-password`, `/auth/confirm` | 화면/endpoint 없음, matcher 기반만 | public Auth entry/callback, provider token 검증 |
| `/reset-password` | UI 없음 | 진입은 가능하나 유효 recovery session 없이 비밀번호 변경 불가 |
| `/projects/**`, `/api/projects/**`, Server Actions | 기존 내부 service-role 흐름, guard 미적용 | Auth guard+owner/RLS/Storage 검증 |
| `/settings`, `/templates` | 기존 placeholder | 보호 App Shell 유지 |

이는 TASK-055에서 `/`를 보호 Dashboard로 다룬 것과 TASK-056 요청의 future public `/`를 구분한 계약이다. 지금 개인 Dashboard를 공개해도 된다는 의미가 아니다.

## 테스트와 미검증 범위

`tests/auth-foundation.test.mjs`의27개 case로 AUTH-01~15를 검증했다. A/B `example.test` fixture와 **실제 설치 SDK + mock fetch/cookie jar + NextRequest/NextResponse**를 사용한다. cookie 안의 forged user가 아니라 Auth 응답이 principal의 근거인지, SDK refresh/chunk write/delete·Proxy 전달, guard401/allow/redirect, 악성 return path, CSRF/body bounds, 오류/로그 privacy·missing env를 확인한다. 이것은 실제 GoTrue 인증 또는 DB RLS integration이 아니다.

`node tests/auth-browser-bundle.mjs`는 앱에 proof page를 만들지 않고 browser entry를 web target으로 별도 bundle한다. 57개 module graph에서 서버 모듈0/실행 코드 secret marker0을 확인하고 공개 fixture key의 정상 inlining은 허용한다. 출력은 `node_modules/.cache/task056/browser/`, 결과는 ignored `artifacts/TASK-056/browser/result.json`. third-party 문서 comment를 제거한 비압축 audit 출력이며 제품 bundle 크기 측정이 아니다. `.next/static`도 실제 secret 값/marker로 별도 검사한다.

현재 저장소에 `supabase/config.toml`/Local CI workflow가 없고 이 환경에서 Docker 실행 파일이 발견되지 않았다. public Auth env도 없다. 따라서 Local Auth server와 실제 signup/confirmation/refresh/reset/browser login E2E는 미실행, **remote Auth mutation0**. 실제 A/B RLS/Storage는 TASK-058 이후이며 ownership migration0, DB/RLS0, Storage path/policy0. 다음 TASK는 **057 Project Ownership Schema Migration & Existing-data Backfill Contract**다.

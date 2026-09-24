# TASK-056 — v0.3.0 Authentication Client & Session Foundation

2026-09-24 · **Authentication foundation IMPLEMENTED/PARTIAL · Public SaaS BLOCKED**

요청 범위의 client/helper/guard/session 기반을 구현했다. 실제 인증 UI, 기존 route enforcement, owner/RLS/Storage 격리는 아직 없다. 상세 사용 계약은 [Auth contract](../V0_3_AUTH_CONTRACT.md), 후속 보안 경계는 [architecture](../V0_3_PUBLIC_SAAS_ARCHITECTURE.md)와 [threat model](../V0_3_THREAT_MODEL.md)에 기록한다.

1. **TASK 목적**: 사용자 session 기반 Supabase client, 검증된 principal, 안전한 Auth mutation/guard/cookie refresh를 다음 ownership 작업의 기반으로 제공한다.
2. **Branch**: `feat/auth-session-foundation`. 시작 시 clean 확인. HEAD/main/로컬 origin/main ref는 `c8e0514dba67ad146a1211e85f62778fbf265e2b`, 기존 v0.2.1 tag commit은 `cf77916dfa9e2dc67c4af981b6a9b2633e76e9c9`. fetch/commit/stage/merge/tag/reset/restore/clean 없이 작업했다.
3. **Existing Supabase packages**: `@supabase/supabase-js` 설치본2.115.0, SSR helper는 없었다. Next 설치본16.3.4의 docs와 SDK source를 기준으로 구현했다.
4. **Dependency decision**: SDK만으로 Auth HTTP는 가능하지만 cookie chunk/PKCE/SSR adapter를 직접 구현해야 하므로 공식 `@supabase/ssr`0.12.7을 exact pin했다. peer `supabase-js ^2.114.0`과 설치본이 호환된다. registry 확인 후 최소 추가했다.
5. **Key model**: 기존 로컬은 SUPABASE_URL + JWT 형식 SUPABASE_SERVICE_ROLE_KEY를 사용한다. 원격 key 설정을 조회한 것은 아니다. 새 Auth adapter는 `sb_publishable_` key만 허용하고 legacy anon JWT/secret/service-role fallback은 거부한다. custom JWT verifier는 없다.
6. **Browser-safe env**: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 `.env.example`에 값 없이 추가했다. HTTPS origin 또는 local loopback HTTP, publishable key 형식을 검증한다. 실제 동일 프로젝트의 공개 key provision은 후속 설정이다.
7. **Server-secret env**: SUPABASE_SERVICE_ROLE_KEY는 기존 admin 전용이다. Auth가 읽거나 browser로 전달하지 않는다. OPENAI 등 기존 secret naming도 유지했다.
8. **Env backward compatibility**: 기존 SUPABASE_URL 등을 변경하지 않았다. Auth public URL을 설정하면 기존 서버 URL과 같은 origin인지 검사한다. 기존 DETAILFORGE_APP_ORIGIN을 mutation의 trusted origin으로 재사용한다. `.env.local` 수정0.
9. **Browser client**: `src/lib/auth/browser.ts`의 createBrowserAuthClient. client-safe SSR SDK client와 검증된 public config만 사용한다. Auth session/state 기능은 SDK가 제공하며 privileged DB/Storage wrapper는 없다.
10. **Server auth client**: createAuthenticatedServerClient는 요청마다 `await cookies()`를 읽는다. read-only RSC와 명시적 write mode를 구분하며 singleton을 사용하지 않는다. write mode의 responseHeaders를 실제 응답으로 전달해야 한다.
11. **Admin client separation**: 기존 구현을 `src/lib/supabase/admin.ts`의 createSupabaseAdminClient로 이동했다. server.ts의 deprecated createSupabaseServerClient alias는 기존31개 호출의 호환만 담당한다. 새 session client와 admin client가 분리됐다.
12. **Current user helper**: server-only getCurrentUser/requireCurrentUser. HTTP 입력 userId를 받지 않고 SDK Auth 응답에서 사용자 identity를 얻는다.
13. **Principal model**: immutable `AuthenticatedPrincipal = Readonly<{userId:string}>`. verified UUID만 반환하며 email/metadata/User/session/token을 domain에 전파하지 않는다. Supabase anonymous user는 인정하지 않는다.
14. **Session/user verification method**: 권한 경계는 `auth.getUser()`로 Auth server에 확인한다. getSession의 cookie user나 JWT payload를 신뢰하지 않는다. Proxy의 getClaims는 선행 refresh용이며 DAL의 getUser를 대체하지 않는다.
15. **Unauthenticated behavior**: missing/invalid/expired/revoked session은 null 또는 unauthenticated401. provider/network 장애는 temporary_failure503이다. raw provider error를 반환하지 않는다.
16. **API auth guard**: requireApiUser는 성공 시 principal+private headers, 실패 시 bounded JSON401/503 Response를 반환한다. 기본 client는 cookie write mode다. caller는 성공 응답에도 반환 headers를 붙여야 한다. 기존 API에는 아직 연결하지 않았다.
17. **Protected route primitive**: requirePageUser는 verified principal을 반환하거나 미인증일 때만 안전한 login redirect를 던진다. configuration/provider 장애를 login redirect로 숨기지 않는다.
18. **Return-path validation**: 2048자 이내 내부 `/`, `/projects/**`, `/settings`, `/templates` allowlist. scheme/외부 host/이중 slash/backslash/control/중첩 encoding/traversal/Auth loop를 거부하고 `/projects`로 fallback한다.
19. **Session refresh strategy**: Proxy에서 SDK가 refresh한 cookie를 incoming request와 outgoing response 양쪽에 전달한다. chunk write/delete, 기존 response cookie, private/no-store headers를 보존한다. RSC는 Proxy의 선행 refresh에 의존한다.
20. **Proxy/middleware decision**: 기존 Proxy가 없었으며 Next16 convention의 `src/proxy.ts`를 추가했다. refresh-only이며 access enforcement가 아니다. matcher는 프로젝트/API와 예정 Auth 경로를 포함하고 static asset은 제외한다.
21. **Cookie strategy**: SDK getAll/setAll adapter가 분할/정리/PKCE를 담당한다. Path=/, SameSite=Lax, production Secure, host-only, browser session 공유를 위한 HttpOnly=false. SDK cookie lifetime과 Auth token expiry는 별개다.
22. **Sign-up primitive**: server-only signUpWithPassword(Request). strict email/password만 받는다. 신규/중복/fake user 응답을 같은 submitted 안내로 축약한다. confirmation-disabled SDK session은 local signout하여 암묵 로그인을 막는다.
23. **Sign-in primitive**: signInWithPassword(Request)는 SDK 로그인 후 getUser로 principal을 재확인한다. session/token은 application response로 반환하지 않는다.
24. **Sign-out primitive**: SDK local scope로 현재 session을 정리하고 signed_out/clearClientState/next=/login을 반환한다. anonymous logout은 idempotent. provider 실패는 성공으로 보고하지 않는다. UI draft/cache 제거·full navigation·다중 탭 처리는 TASK-061이다.
25. **Auth error contract**: configuration503, unauthenticated401, invalid_credentials401, invalid_input400, password_rejected400, forbidden403, rate_limited429, temporary_failure503. provider 원문/stack/URL/headers/cause는 전달하지 않는다.
26. **Email enumeration**: invalid_credentials와 email_not_confirmed는 같은 일반 오류로 반환한다. signup의 duplicate/fake/new user 정보는 응답하지 않는다. provider 시간 차이까지 동일함을 보장하지 않으며 CAPTCHA/요청 제한은 후속이다.
27. **Password handling**: 빈 값/1024자 초과만 로컬에서 거부한다. trim/normalize/임의 복잡도 규칙을 추가하지 않는다. provider password config가 최종 정책이며 secret을 로그에 남기지 않는다.
28. **Request bounds**: POST JSON만, Content-Length와 실제 stream 모두8192 bytes 제한. email 최대254자 및 형식 검사. strict schema로 userId/ownerId/options/redirectTo 등 미지원 필드를 거부한다.
29. **Same-origin**: 기존 assertSameOrigin과 configured DETAILFORGE_APP_ORIGIN 검사를 함께 사용한다. missing/null/foreign Origin, Host spoof, 잘못된 method를 거부한다. login CSRF도 포함한다. 기존 Project mutation 정책은 수정하지 않았다.
30. **Token storage**: SDK session cookie mechanism만 사용한다. application DB/custom localStorage 저장0. local logout이 이미 발급한 모든 access JWT/signed URL의 즉시 전역 무효화를 보장하지 않는다.
31. **Logging/privacy**: 앱 Auth code의 credential logging0. SDK refresh 오류가 자체 로그에 출력될 수 있어 Auth transport가 실패 body를 allowlisted code+고정 문구로 정제한다. network exception도 고정 문구, fetch당10초 제한이다. global console monkeypatch는 없다.
32. **Missing-env behavior**: 두 public env가 모두 없으면 기존 internal build와 refresh proxy는 유지한다. Auth client/helper 호출은 configuration503이다. 일부만 있거나 잘못된 key이면 build/start/runtime에서 값 없이 명확히 실패한다.
33. **Public/protected routes**: 실제 보호 연결0. 향후 Auth entry는 public, projects/API는 guard+owner/RLS 대상이다. 현재 `/`는 개인 Dashboard이므로 데이터 없는 landing으로 바꾸거나 인증 분기하기 전 공개할 수 없다. reset password는 recovery session 검증이 필요하다.
34. **UI scope**: login/signup/reset/proof page, Auth endpoint, Header/Sidebar 변경0. 함수는 server-only이며 `use server` endpoint가 아니다. 완성 UI는 TASK-061이다.
35. **User A/B fixture groundwork**: `tests/helpers/auth.mjs`의 별도 UUID와 user-a/user-b@example.test, SDK cookie jar/mock Auth transport를 제공했다. synthetic token은 test fixture이며 production JWT verifier가 아니다.
36. **Local Auth integration**: 미실행. supabase/config.toml과 Local CI workflow가 없고 Docker 실행 파일도 발견되지 않았다. public Auth env도 없다. 실제 GoTrue signup/confirmation/reset/browser login을 검증했다고 주장하지 않는다.
37. **Actual remote Auth mutation**: 0. 테스트는 실제 설치 SDK + mock fetch이며 원격 계정/로그인/session 변경을 하지 않았다.
38. **AUTH-01 result**: PASS. Browser client는 검증된 public config만 사용하고 legacy alias는 별도 admin 구현과 일치한다.
39. **AUTH-02 result**: PASS. Server SDK 요청이 public apikey+request access token을 사용하며 cookie의 forged user와 다른 Auth 응답을 principal로 사용한다.
40. **AUTH-03 result**: PASS. Browser source graph와 별도 web bundle에 server-only/admin/Node privileged module이 없다. 새 Auth source에 service-role 참조0.
41. **AUTH-04 result**: PASS. A/B 요청 client가 분리되고 각각 검증된 최소 principal만 반환한다.
42. **AUTH-05 result**: PASS. cookie 없음→null/401/page redirect, 불필요한 Auth network 요청0. verified user→API/page allow도 별도 검증했다.
43. **AUTH-06 result**: PASS. userId/ownerId/provider options/redirect override를 client 생성과 network 호출 전에 거부한다.
44. **AUTH-07 result**: PASS. invalid_credentials/unconfirmed/rate-limit/provider failure가 bounded category로 매핑되고 성공 시 cookie 저장 후 principal을 재검증한다.
45. **AUTH-08 result**: PASS. SDK cookie 삭제, local logout scope, cache-clear response, anonymous idempotence 및 실패 시 성공 오보고 방지를 검증했다.
46. **AUTH-09 result**: PASS. 외부 URL과 encoding/traversal/Auth loop의 open redirect 방지 및 정상 내부 복귀 경로를 검증했다.
47. **AUTH-10 result**: PASS. 만료 cookie는 SDK refresh 후 getUser로 확인한다. invalid/expired refresh는 principal을 만들지 않고 forged JWT도 Auth 검증 대상으로 보낸다.
48. **AUTH-11 result**: PASS. SDK chunk write/delete와 cache headers, Proxy의 request/response 양쪽 cookie 전달을 검증했다.
49. **AUTH-12 result**: PASS. missing env는 Auth 실패/internal refresh pass-through, partial/secret/legacy key/다른 프로젝트 URL은 값을 노출하지 않고 거부한다.
50. **AUTH-13 result**: PASS. network 오류는 bounded503이며 미인증 redirect로 바뀌지 않는다.
51. **AUTH-14 result**: PASS. 코드 logging/storage 검사와 실제 SDK refresh·잘못된 cookie의 로그 capture에서 provider 원문/password/token 누출이 없다. AUTH-15로 UI/endpoint/blanket redirect 부재도 확인했다.
52. **Existing v0.2.1 regression**: 기존1417개 테스트가 모두 통과했다. Project/Import/Extraction/Manual Crop/AI/Planner/Editor/Export source와 기존 fixture는 변경하지 않았다. 이번 작업에서 실제 상품 브라우저 QA나 remote AI를 재실행하지 않았다.
53. **Generated files**: 신규19개. `src/lib/auth/`의 browser/config/errors/guards/mutations/principal/proxy/return-path/server/session/transport.ts 11개, src/proxy.ts, src/lib/supabase/admin.ts, tests/auth-foundation.test.mjs, tests/auth-browser-bundle.mjs, tests/helpers/auth.mjs, tests/helpers/auth-browser-loader.cjs, docs/V0_3_AUTH_CONTRACT.md, docs/tasks/TASK-056.md. ignored evidence는 artifacts/TASK-056/, 별도 bundle/audit runner는 node_modules/.cache/task056/에 있다.
54. **Modified files**: 기존11개. .env.example, README.md, docs/07_DECISIONS.md, docs/V0_3_PUBLIC_SAAS_ARCHITECTURE.md, docs/V0_3_THREAT_MODEL.md, docs/tasks/README.md, next.config.ts, package.json, package-lock.json, src/lib/supabase/server.ts, tests/register.mjs. test loader의 Next subpath alias를 실제 server entry로 맞췄다.
55. **Migration**: 신규/수정 SQL migration0. 기존 데이터 backfill0.
56. **DB/RLS changes**: schema/owner_id/RLS/policy/원격 DB mutation0. Auth principal만으로 기존 Project 권한이 보호되었다고 주장하지 않는다.
57. **Storage changes**: bucket/policy/path/업로드/삭제 변경0. 기존 service-role Storage 흐름은 후속 이전 대상이다.
58. **Dependency changes**: direct `@supabase/ssr`0.12.7 한 개, transitive cookie1.1.1 한 개 추가. 기존 dependency version은 유지했다. install scripts는 실행하지 않았다.
59. **Package version**: package.json/package-lock.json 모두0.2.1 유지. v0.3.0 bump/tag 없음.
60. **Tests**: `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs` PASS. SDK+mock/architecture Auth27개, 별도 `node tests/auth-browser-bundle.mjs` PASS. evidence는 artifacts/TASK-056/{tests,auth-tests}.log와 browser/result.json에 있다.
61. **Total test count**: 1444/1444 PASS, 실패/취소/skipped/todo0. 기존1417 + Auth27. 최종 전체 실행61592.7462ms.
62. **Typegen**: `npx.cmd next typegen` PASS. artifacts/TASK-056/typegen.log.
63. **Typecheck**: `npx.cmd tsc --noEmit` PASS. artifacts/TASK-056/typecheck.log.
64. **Lint**: `npm.cmd run lint` PASS, error0/warning0. artifacts/TASK-056/lint.log.
65. **Build**: `npm.cmd run build` PASS. 기존 route inventory에 refresh Proxy만 추가되었다. public Auth env 없는 internal 호환 경로의 production build이며 실제 Auth provider integration 검증은 아니다.
66. **Diff check**: `git diff --check` PASS. 신규 파일도 trailing whitespace/conflict marker와 문서 local link를 별도 검사했다. 최종 audit 결과는 artifacts/TASK-056/audit.json.
67. **Secret scan**: 추적/신규 텍스트, 실제 .next/static, TASK-056 evidence와 별도 browser bundle을 검사했다. 설정된 secret의 실제 값과 credential 패턴 일치0. 값 자체는 출력하거나 보고서에 저장하지 않았다.
68. **Client bundle secret scan**: 실제 .next/static의 secret 값/privileged marker0. 별도 browser entry web bundle57 modules, server module0, executable secret marker0, public fixture key inlining 정상. 문서 comment를 제거한 비압축 audit bundle590630 bytes이며 제품 bundle 크기 지표가 아니다.
69. **Service-role usage in new auth code**: 0. runtime dependency graph에도 admin import0. 기존 feature의31개 factory 호출은 그대로 유지했다. admin 구현 분리는 전체 call-site 권한 이전이 아니다.
70. **Public SaaS readiness**: **BLOCKED**. Authentication foundation만 IMPLEMENTED/PARTIAL이다. 공개 배포/일반 사용자 회원가입 사용 가능을 선언하지 않는다.
71. **Remaining blockers**: Project ownership/backfill, DB RLS, Storage ownership,31곳 service-role 최소화, safe Export authorization, 실제 Local Auth/이메일 확인/reset/다중 탭·cache UI 검증, abuse/cost control 및 기존 route guard 적용이 남았다.
72. **Next recommended TASK**: TASK-057 — Project Ownership Schema Migration & Existing-data Backfill Contract. principal.userId를 projects.owner_id와 연결할 schema/backfill 계약부터 진행한다. RLS/Storage/Export 완성은 각각 후속 gate다.
73. **Git diff summary**: 신규19개+수정11개, 총30개 파일. 변경은 Auth foundation/테스트/설정/문서에 한정된다. staged0, commit/main merge/tag0. 세부 추가·삭제 line count, ref·원본4개/patch3개 hash 보존 결과는 artifacts/TASK-056/audit.json에 기록한다.

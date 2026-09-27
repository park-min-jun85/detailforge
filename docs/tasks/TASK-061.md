# TASK-061 — Auth UX / Protected Routes

2026-09-27 · C:\Projects\detailforge · package0.2.1 / Next16.3.4

## 1. Status

**TASK-061 COMPLETE. Public SaaS deployment remains BLOCKED.** 실제 GoTrue 이메일 확인/브라우저 쿠키와 기존 user-scoped 서비스/RLS를 연결했고 browser20·RLS143·Storage74·admission37 및 전체1481 회귀를 완료했다. [Auth UX 보안 계약](../V0_3_AUTH_UX_AND_PROTECTED_ROUTES.md).

## 2. Route inventory

Public /login,/signup. Protected root/projects/settings/templates 및 모든 Project API. Callback /auth/callback, POST signin/signup/signout, GET session 추가. 기존 URL 이동/route group 재작성0. 아래는 최종 실제 파일 목록이며 auth prefix 외 application page/API는 Proxy에서 인증한다. 기존 data service는 추가로 getUser/RLS를 적용한다.

| Path | Source |
| --- | --- |
| `/api/projects/[projectId]/assets` | `src/app/api/projects/[projectId]/assets/route.ts` |
| `/api/projects/[projectId]/assets/[assetId]/analyze` | `src/app/api/projects/[projectId]/assets/[assetId]/analyze/route.ts` |
| `/api/projects/[projectId]/assets/[assetId]/extract-product-shots/retry` | `src/app/api/projects/[projectId]/assets/[assetId]/extract-product-shots/retry/route.ts` |
| `/api/projects/[projectId]/assets/[assetId]/extract-product-shots` | `src/app/api/projects/[projectId]/assets/[assetId]/extract-product-shots/route.ts` |
| `/api/projects/[projectId]/assets/[assetId]/extract-product-shots/save` | `src/app/api/projects/[projectId]/assets/[assetId]/extract-product-shots/save/route.ts` |
| `/api/projects/[projectId]/assets/[assetId]` | `src/app/api/projects/[projectId]/assets/[assetId]/route.ts` |
| `/api/projects/[projectId]/editor` | `src/app/api/projects/[projectId]/editor/route.ts` |
| `/api/projects/[projectId]/export` | `src/app/api/projects/[projectId]/export/route.ts` |
| `/api/projects/[projectId]/fact-validation` | `src/app/api/projects/[projectId]/fact-validation/route.ts` |
| `/api/projects/[projectId]/options/import/apply` | `src/app/api/projects/[projectId]/options/import/apply/route.ts` |
| `/api/projects/[projectId]/options/import` | `src/app/api/projects/[projectId]/options/import/route.ts` |
| `/api/projects/[projectId]/options` | `src/app/api/projects/[projectId]/options/route.ts` |
| `/api/projects/[projectId]/page-plan` | `src/app/api/projects/[projectId]/page-plan/route.ts` |
| `/api/projects/[projectId]/product-analysis` | `src/app/api/projects/[projectId]/product-analysis/route.ts` |
| `/api/projects/[projectId]/sections/generate` | `src/app/api/projects/[projectId]/sections/generate/route.ts` |
| `/api/projects/[projectId]/sections/reorder` | `src/app/api/projects/[projectId]/sections/reorder/route.ts` |
| `/api/projects/[projectId]/sections` | `src/app/api/projects/[projectId]/sections/route.ts` |
| `/api/projects/[projectId]/sections/[sectionId]/apply-candidate` | `src/app/api/projects/[projectId]/sections/[sectionId]/apply-candidate/route.ts` |
| `/api/projects/[projectId]/sections/[sectionId]/options` | `src/app/api/projects/[projectId]/sections/[sectionId]/options/route.ts` |
| `/api/projects/[projectId]/sections/[sectionId]/regenerate` | `src/app/api/projects/[projectId]/sections/[sectionId]/regenerate/route.ts` |
| `/api/projects/[projectId]/sections/[sectionId]` | `src/app/api/projects/[projectId]/sections/[sectionId]/route.ts` |
| `/api/projects/[projectId]/wholesale-import/images` | `src/app/api/projects/[projectId]/wholesale-import/images/route.ts` |
| `/api/projects/[projectId]/wholesale-import/preview` | `src/app/api/projects/[projectId]/wholesale-import/preview/route.ts` |
| `/api/projects/[projectId]/wholesale-import/save` | `src/app/api/projects/[projectId]/wholesale-import/save/route.ts` |
| `/auth/callback` | `src/app/auth/callback/route.ts` |
| `/auth/session` | `src/app/auth/session/route.ts` |
| `/auth/signin` | `src/app/auth/signin/route.ts` |
| `/auth/signout` | `src/app/auth/signout/route.ts` |
| `/auth/signup` | `src/app/auth/signup/route.ts` |
| `/login` | `src/app/login/page.tsx` |
| `/` | `src/app/page.tsx` |
| `/projects/new` | `src/app/projects/new/page.tsx` |
| `/projects` | `src/app/projects/page.tsx` |
| `/projects/[projectId]/analysis` | `src/app/projects/[projectId]/analysis/page.tsx` |
| `/projects/[projectId]/editor` | `src/app/projects/[projectId]/editor/page.tsx` |
| `/projects/[projectId]/images` | `src/app/projects/[projectId]/images/page.tsx` |
| `/projects/[projectId]` | `src/app/projects/[projectId]/page.tsx` |
| `/projects/[projectId]/planner` | `src/app/projects/[projectId]/planner/page.tsx` |
| `/projects/[projectId]/render` | `src/app/projects/[projectId]/render/page.tsx` |
| `/projects/[projectId]/sections` | `src/app/projects/[projectId]/sections/page.tsx` |
| `/projects/[projectId]/validation` | `src/app/projects/[projectId]/validation/page.tsx` |
| `/settings` | `src/app/settings/page.tsx` |
| `/signup` | `src/app/signup/page.tsx` |
| `/templates` | `src/app/templates/page.tsx` |

## 3. Files

신규17 / 수정12 / 삭제0.

신규:

- `docs/V0_3_AUTH_UX_AND_PROTECTED_ROUTES.md`
- `scripts/auth-local-stack.mjs`
- `src/app/auth/callback/route.ts`
- `src/app/auth/session/route.ts`
- `src/app/auth/signin/route.ts`
- `src/app/auth/signout/route.ts`
- `src/app/auth/signup/route.ts`
- `src/app/login/page.tsx`
- `src/app/signup/page.tsx`
- `src/features/auth/components/auth-form.tsx`
- `src/features/auth/components/logout-button.tsx`
- `src/features/auth/components/session-boundary.tsx`
- `src/lib/auth/origin.ts`
- `tests/auth-ux.browser.mjs`
- `tests/helpers/auth-ux-app.cjs`
- `tests/helpers/auth-ux-local.mjs`
- `docs/tasks/TASK-061.md`

수정:

- `README.md`
- `docs/RELEASE_BACKLOG.md`
- `docs/V0_3_AUTH_CONTRACT.md`
- `docs/V0_3_PUBLIC_SAAS_ARCHITECTURE.md`
- `docs/V0_3_THREAT_MODEL.md`
- `docs/tasks/README.md`
- `src/components/app-shell/app-header.tsx`
- `src/components/app-shell/app-shell.tsx`
- `src/lib/auth/mutations.ts`
- `src/lib/auth/proxy.ts`
- `src/proxy.ts`
- `tests/auth-foundation.test.mjs`

Package/lock/dependency 변경0, 삭제0. DB schema/policies/grants/admission 변경0. 주요 신규 파일은 Auth pages/handlers/forms, trusted origin helper, local stack/browser harness 및 문서다.

## 4. Login

label/email/password/autocomplete/keyboard submit/pending disabled/aria-busy/error focus 제공. Strict bounded POST JSON+configured Origin으로 기존 primitive를 호출한다. Password sign-in 뒤 GoTrue getUser 확인, SDK cookie 저장, safe next로 전체 문서 이동. invalid credentials/email-unconfirmed는 같은 고정 오류다. Password는 응답에 echo하지 않고 완료/실패 후 input을 비운다.

## 5. Signup

최소8자+기존 provider 정책, duplicate는 동일 submitted 안내. 기존056 계약상 signup 응답에서 implicit login하지 않는다. confirmation-disabled가 session을 반환해도 signOut하고 login을 안내한다(unit 회귀). Local actual은 confirmation-enabled이며 UI로 가입→Mailpit 메일→GoTrue verify→PKCE callback→protected app을 검증했다. 원격 Auth 설정은 조회/변경0. 가입만으로 session 발급/로그인 완료를 가정하지 않는다.

## 6. Logout

POST만 지원한다. SDK local scope signOut/cookie 제거, cache/storage Clear-Site-Data, 전체 문서 이동과 credential 없는 cross-tab event를 적용했다. 같은 탭의 broadcast/direct navigation 중복을 실제 브라우저에서 발견해 중단 flag로 수정했다. logout 이후 session401/cookie 제거/back·reload·직접 URL login을 검증했다. 발급된 access JWT 자체의 잔여 TTL을 즉시 철회한다고 주장하지 않는다.

## 7. Protected routes

Proxy에서 getUser principal을 확인한 뒤 route 실행을 허용한다. anon page GET/HEAD는 login+safe next, API/Action POST는401. RSC/prefetch를 제외하지 않는다. 설정/네트워크 장애는503 fail-closed. client AppShell 분기는 presentation만 담당한다. Layout children의 병렬 실행을 보안 경계로 삼지 않았으며 기존 DAL principal/RLS도 유지했다. 이미 로그인한 login/signup은 safe next 또는 projects로 이동한다.

## 8. Redirect security

단일 safeReturnPath: 내부 root/projects/settings/templates만 허용. https 외부 URL, //, 다중 encoding, javascript:, backslash, credential URL, Auth/API loop 차단. authAppOrigin은 configured origin을 검증하며 Host 기반 redirect는 쓰지 않는다. Callback invalid/replay는 고정 confirmation_failed 화면으로 이동한다.

## 9. A/B isolation

A UI Project 생성의 owner를 Local SQL로 확인했다. A 목록에 own Project만, B HTML/RSC에 A 이름 없음. A의 exact B Project/상품/이미지 페이지는 실제 browser not-found, assets API404. RSC는 스트리밍200인 경우에도 not-found boundary이며 foreign 이름/Product/signed URL 없음. 별도의 Product UUID URL은 현재 구조에 없으므로 Project 하위 Product route를 검증했다. 전체 commerce/Asset E2E는063/064 범위다.

## 10. Browser runtime

Playwright 1.63.0 / Chromium 153.0.8010.52. 실제 Local GoTrue A/B password 계정, UI signup C, Mailpit confirmation, Next production build/start. Mock Auth가 아니다. agent-browser CLI/Playwright 전용 executable이 없어 설치된 Chrome channel을 사용했으며 dependency 변경/브라우저 다운로드0.

| Matrix | Result |
| --- | --- |
| AUTHUX-01 | PASS — anon login renders accessible form |
| AUTHUX-02 | PASS — anon direct/nested/RSC/prefetch redirects before protected render |
| AUTHUX-03 | PASS — real User A login establishes SSR cookie |
| AUTHUX-04 | PASS — invalid credentials fail generically without echo |
| AUTHUX-05 | PASS — login restores safe internal next |
| AUTHUX-06 | PASS — external and encoded redirects never leave application |
| AUTHUX-07 | PASS — signed-in login and signup redirect without loop |
| AUTHUX-08 | PASS — signup validation and same-origin enforcement |
| AUTHUX-09 | PASS — actual signup requires configured email confirmation without session |
| AUTHUX-10 | PASS — email confirmation PKCE callback reaches protected app; replay fails safely |
| AUTHUX-11 | PASS — browser Project create derives owner from verified principal |
| AUTHUX-12 | PASS — A sees own Project |
| AUTHUX-13 | PASS — B cannot see A Project in HTML or RSC |
| AUTHUX-14 | PASS — A exact B Project/product/image routes disclose no foreign data |
| AUTHUX-15 | PASS — POST logout clears browser auth cookies and session |
| AUTHUX-16 | PASS — logout back/refresh/direct protected access returns to login |
| AUTHUX-17 | PASS — invalid/stale cookie fails closed; real refresh persists new cookies |
| AUTHUX-18 | PASS — anon direct Server Action POST cannot mutate |
| AUTHUX-19 | PASS — HTML/RSC/static/console contain no secret/password/token |
| AUTHUX-20 | PASS — browser and app remain on fixed local endpoints |

총20 PASS. 응답310개/static JS28개 secret findings0. UI screenshot은 login.png/own-project.png이며 비밀번호를 포함하지 않는다. Playwright raw HTTP가 loopback Secure cookie를 제외하는 차이를 처리했고 HTML/RSC 격리는 실제 browser fetch로 최종 검사했다.

## 11. Session/cookies

기존 SSR/browser SDK cookie·read-only RSC/write handler·Proxy request/response refresh를 재사용한다. Production Secure/SameSite=Lax/path=/, foundation의 httpOnly=false 계약 유지. getSession.user/cookie JSON을 신분으로 신뢰하지 않는다. Session endpoint의 client projection은 userId뿐이다.

실제 refresh는 SDK expiry metadata를 과거로 만들어 GoTrue refresh와 cookie 교체를 검증했다. JWT 벽시계 만료를 기다린 검사는 아니다. malformed cookie와 실제 GoTrue signOut으로 철회한 refresh token+변조 access signature는 거부된다. 유효 access JWT는 refresh 철회 후에도 TTL까지 유효할 수 있어 이를 잘못된 session 승인으로 판단하지 않는다. 분할 cookie/삭제/오류 redaction은056 unit 회귀도 유지했다. Password/token/service key는 HTML/RSC/static/console에 노출되지 않았고 custom token storage0. Cookie/storageState/trace/메일 원문은 저장하지 않았다.

## 12. Security regression

TASK-058 actual143 PASS, TASK-059 actual74 PASS, TASK-060 actual37 PASS(ABUSE-01~06 포함). Upload3/12·AI2/8 동시성 유지. production 일반 admin CRUD/Storage 복원0, RLS/grant/ownership/admission 완화0. Regression JSON은 artifacts/TASK-061에 복사했다.

## 13. Regression

공식 전체1481/1481 PASS, fail0/skip0. 기존1476+Auth UX guard5. typegen/typecheck/lint/build/diff-check PASS. Secret scan/client bundle scan PASS. Foundation web bundle57 modules/590630 bytes/serverModules0/secretMarkers0, 실제 Next static JS도 별도 검사했다. 원본4·fixture patch3 hash 보존. 최종 감사는 artifacts/TASK-061/audit.json.

## 14. Security findings

- BLOCKER:062 Export 권한 전달,063 전체 cross-user E2E,064 own workflow,065 release/운영 설정 미완료.
- HIGH: 이번 검증 범위에 미해결 인증 우회/foreign 데이터 노출 finding 없음. 운영 SMTP/redirect allowlist/Auth rate/secret/admission provisioning은 배포 전에 확정해야 한다.
- MEDIUM: access JWT와 이미 발급된 signed bearer URL의 TTL 잔여, shared SDK cookie의 XSS 노출면, 다중 브라우저/전체 workflow QA는 남는다. refresh metadata 검사와 실제 JWT 만료 대기는 구분했다.
- LOW: 별도 미해결 LOW 없음. Browser harness의 Secure-cookie/relative redirect/RSC 표현 차이는 실제 browser 증거로 보정했다.

## 15. Mutation

Remote DB0/Auth0/Storage0/external provider0. API58521/DB58522/Mailpit58524/Next3061 고정, linked project 거부. Test app은 env-file loader를 대체하고 remote fetch/redirect를 차단하여 .env.local 원격 자격을 사용하지 않았다. A/B/C 계정/Project/메일 fixture 정리, namespace 보안 기록 유지. TASK-058~061 전용 테스트 스택 4개 종료를 완료했으며 종료 전후 Docker 메타데이터로 기존 볼륨 보존을 확인했다.

## 16. Remaining Public SaaS blockers

TASK-062 Export authorization,063 cross-user Security E2E,064 own-user full workflow,065 release validation/운영 configuration. **Public SaaS deployment remains BLOCKED**.

## 17. Git

Branch feat/auth-ux-protected-routes. HEAD/main7f3038ce6ba98feedfe68fd904e940341dec08c8 유지. cached origin/main8906c0cee85b01281f2ddfa557469482cb58a981은 조회 시점 상태이며 fetch/push0. 시작 tree clean. stage/commit/merge/tag0, reset/restore/clean 미사용. 변경은 미스테이징 상태다.

## 18. Next

TASK-062 — Export authorization. 인증된 요청의 권한을 Chromium capture에 안전하게 전달하는 별도 계약을 구현해야 한다. admin fallback으로 우회하지 않는다.

재현:

```powershell
node scripts/auth-local-stack.mjs start
node tests/auth-ux.browser.mjs
node scripts/auth-local-stack.mjs stop
node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs
npx.cmd next typegen
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
git diff --check
```

058/059/060은 각 전용 stack wrapper와 기존 runtime script로 재검증했다. 테스트 로그·runtime JSON·screenshots는 ignored artifacts/TASK-061에 있다. Local 설정의 email confirmation/rate값은 production entitlement/운영 정책이 아니다.

# v0.3.0 Auth UX / Protected Routes

## TASK-062 현재 상태 — 2026-09-28

TASK-062 Export authorization COMPLETE. 실제 Local Supabase/Next production/Chromium으로 EXPORT-01~25 PASS, 티켓 동시8개 중1성공/7거부를 확인했다. 사용자 JWT·쿠키를 capture에 전달하지 않으며 user-RLS snapshot + 90초 DB single-use capability를 사용한다. Production privileged boundary는 admission과 finite export RPC 두 곳이고 generic admin CRUD/Storage fallback은 없다. Public SaaS deployment remains BLOCKED: TASK-063/064/065가 남는다.

[Export 보안 계약](V0_3_EXPORT_AUTHORIZATION.md). 기존 renderer/프로젝트 URL, DB·Storage RLS, admission, Auth UX 계약을 유지한다. Chrome sandbox/maintenance/부하·운영 설정은065 gate다.

## 이전 단계 기록

아래 내용의 미완료062 및 단일 privileged boundary 설명은 해당 단계 당시 기록이다. 현재 상태는 위 TASK-062 계약을 따른다.

TASK-061 · 2026-09-27 · **Public SaaS deployment remains BLOCKED**.

## 변경 범위와 route inventory

기준7f3038c의 기존 App Router URL을 유지한다. route group 이동/DB migration/dependency 변경은 없다. 기존 root AppShell은 public Auth 화면에서 chrome을 생략하는 presentation 분기만 추가했다. 이 client 분기는 인증 경계가 아니다.

| 분류 | 경로 | 처리 |
| --- | --- | --- |
| Public page | `/login`, `/signup` | anon 폼, 인증 상태면 safe next 또는 `/projects` |
| Protected page | `/` | own Dashboard, anon은 `/login?next=%2F` |
| Protected page | `/projects`, `/projects/new` | 사용자 목록/생성 |
| Protected page | `/projects/[projectId]` 및 `images`, `analysis`, `validation`, `planner`, `sections`, `editor`, `render` | 인증 뒤 기존 user-scoped 서비스/RLS |
| Protected page | `/settings`, `/templates` | 인증 필요, 기존 화면 유지 |
| Protected API | `/api/projects/**`의 모든 기존 route | anon401, 인증 후 기존 resource scope/RLS/admission |
| Auth mutation | POST `/auth/signin`, `/auth/signup`, `/auth/signout` | bounded JSON + configured Origin/Host 검사 + 기존 Auth primitive |
| Session | GET `/auth/session` | verified `{userId}`만 반환, anon401, 장애503 |
| Callback | GET `/auth/callback` | bounded one-use code + SDK PKCE exchange + getUser |

전체 실제 파일 경로는 [TASK-061](tasks/TASK-061.md)의 inventory/evidence를 참조한다. Product/Asset은 별도 public detail URL 대신 Project 하위 서비스/API에 연결되는 현재 구조를 유지한다. Password recovery/social/MFA route를 추가하지 않았다.

## 렌더링 전 server gate

`src/proxy.ts`의 명시 matcher가 root/projects/settings/templates 및 Project API의 direct GET·RSC·prefetch·POST에 적용된다. SDK cookie adapter가 요청과 응답 양쪽에 갱신 cookie를 전달하고, **GoTrue getUser**가 확인한 principal 없이는 protected route handler/Server Component/Action에 진입시키지 않는다. Cookie의 user JSON/단순 토큰 존재/getClaims만으로 승인하지 않는다.

Anon GET/HEAD는 safe `next`를 포함해 로그인으로 이동한다. Anon API 및 Action POST는 redirect HTML 대신401 bounded JSON을 반환한다. 설정 누락/네트워크 장애는503이며 admin fallback은 없다. Auth POST/session/callback은 각 handler가 별도로 검증한다.

Proxy는 리소스 접근 권한을 대체하지 않는다. TASK-060 DAL이 다시 verified principal을 요구하고, DB/Storage RLS가 own/foreign UUID의 최종 권한을 결정한다. 모든 기존 Server Action도 서비스 진입 전에 principal을 검증한다. Layout만으로 자식의 병렬 data load를 보호했다고 주장하지 않는다.

## Login / Signup / Confirmation

이메일/비밀번호는 POST JSON body로만 전달한다. body8KiB, email254자, password1024자 상한과 기존 strict schema를 유지한다. Signup은 최소8자를 추가 검증하며 provider의 추가 비밀번호 정책도 안전한 오류로 전달한다. Labels/type/autocomplete/keyboard submit/pending disabled/aria-busy/error announcement/focus를 지원한다. 실패·가입 안내 후 password input을 비우며 응답·URL·로그·DOM debug로 되돌려 주지 않는다.

Login은 password sign-in 뒤 getUser를 재검증하고 SDK cookie를 저장한다. Client에는 token/전체 Auth User를 반환하지 않는다. 성공 시 전체 문서 이동으로 이전 계정의 Router/RSC memory를 버린다.

Signup은 기존056의 **implicit login 금지·중복 계정 응답 통일** 계약을 유지한다. confirmation-enabled에서는 가입 안내 후 메일 확인을 기다린다. confirmation-disabled에서 즉시 session이 발급돼도 server가 이를 signOut하고 동일한 안내를 반환한다. 화면은 확인 메일이 있으면 인증하고, 확인이 필요 없거나 이미 가입했다면 로그인하라고 설명한다. 설정과 무관하게 이미 로그인했다고 가정하지 않는다. Local에서는 실제 confirmation-enabled 동작을 검증하며, disabled 분기는 SDK primitive unit 회귀로 검사한다. 원격 Auth 설정은 조회/변경하지 않는다.

확인 메일의 redirect target은 request body가 아니라 검증된 `DETAILFORGE_APP_ORIGIN`의 `/auth/callback`이다. 원래 브라우저의 SDK verifier cookie와 one-use code로 PKCE exchange한다. 성공 후 getUser 검증 및 safe next를 사용하고, invalid/expired/replay/missing code는 `/login?notice=confirmation_failed`로 보낸다. Provider raw error/query를 화면에 표시하지 않는다. 다른 브라우저에서 확인 링크를 재사용해 session을 얻을 수 없다.

## Logout / session privacy

로그아웃은 명시적인 POST이다. SDK local-scope signOut으로 현재 refresh session을 철회하고 cookie를 제거한다. GET logout은 지원하지 않는다. 성공 응답에는 cache/storage Clear-Site-Data가 있으며, 전체 문서 이동으로 app memory를 버린다. 이미 발급되어 복사된 access JWT의 만료 전 유효성까지 즉시 철회한다고 주장하지 않는다.

Client SessionBoundary는 **privacy 보조**다. 페이지가 숨겨지거나 history로 나갈 때 내용을 숨기고, visibility/pageshow 복귀 때 no-store `/auth/session`을 다시 확인한다. 계정이 바뀌면 전체 reload, session이 없으면 login으로 이동한다. BroadcastChannel에는 credential 없이 logout event만 전달한다. 같은 탭은 먼저 중단 표시하여 broadcast와 직접 navigation의 중복 이동을 막는다. 다른 탭은 내용을 숨기고 로그인으로 이동한다. Custom localStorage/sessionStorage에 token을 저장하지 않는다.

Auth server 장애와 logout 실패는 성공으로 표시하지 않는다. 현재 브라우저 쿠키가 실제 제거됐는지와 로그인 화면 복귀/보호 경로 재접근은 실제 runtime에서 확인한다. 세션 API는 최소 userId만 반환하며 client 주장은 authorization 근거가 아니다.

## Cookie / redirect / error contract

SDK의 분할 cookie·refresh 처리를 재사용한다. RSC는 read-only cookie이며 Proxy가 request/response cookie refresh를 수행한다. Handler는 write adapter를 명시한다. SameSite=Lax, path=/, production Secure, shared SSR/browser SDK 계약상 httpOnly=false를 유지한다. 모든 Auth/gated 응답은 private/no-store이며 redirect에서도 변경 cookie를 보존한다.

`safeReturnPath` 한 곳에서 내부 `/`, `/projects/**`, `/settings/**`, `/templates/**`만 허용한다. 외부 URL, protocol-relative, 재귀 encoding, javascript scheme, backslash, control characters, credential URL 및 Auth/API 복귀 loop는 `/projects`로 대체한다. Absolute redirect origin은 검증된 설정에서 얻고 Host/forwarded header를 신뢰하지 않는다. Next의 loopback hostname 정규화에도 같은 origin을 유지한다.

오류는 기존 AuthFailure taxonomy(401/400/403/429/503)와 고정 한국어 메시지를 쓴다. invalid credential/email-unconfirmed는 같은 메시지다. Provider stack/message/내부 식별자는 클라이언트 응답으로 전달하지 않는다.

## Local verification architecture

TASK-061 전용 API58521/DB58522/Mailpit58524, Next3061을 사용한다. Linked project를 거부하고 endpoint hostname/port를 고정한다. CLI 자격은 메모리에만 보관한다. Test Next subprocess의 preload는 `@next/env` 파일 로드를 대체하고 fetch의 원격 origin/redirect를 거부한다. Production 앱은 이 test helper를 import하지 않는다.

실제 GoTrue A/B 계정 + UI 가입 C, Next production build/start, Playwright의 격리된 Chrome context를 사용한다. 머신에 Playwright 전용 Chromium이 없어 설치된 Chrome channel을 사용하며 dependency/browser 다운로드는 하지 않았다. 원래 브라우저의 user cookie로 HTML/RSC를 검사한다. Playwright raw HTTP API가 HTTP loopback의 Secure cookie를 제외하므로 이 검사에만 실제 browser cookie jar를 메모리에서 전달한다. Password/cookie/token/메일 원문/storageState/trace는 artifact에 저장하지 않는다.

실제 session refresh 검사는 cookie의 SDK expiry metadata를 과거로 설정해 GoTrue refresh와 새 cookie 전파를 유발한다. JWT의 벽시계 만료를 기다리는 검사는 아니다. invalid/revoked refresh도 별도로 차단한다. Mailpit 확인 링크와 secret 값은 메모리에서만 다루고 해당 run의 메일·계정·Project를 정리한다. namespace 보안 기록은060 계약대로 유지한다.

결과/정확한 수치와 AUTHUX-01~20은 [완료 보고](tasks/TASK-061.md)에 기록한다. 인증 UX 대표 사례만 검증하며 Export capture 권한 전달/전체 commerce workflow 검증을 완료했다고 주장하지 않는다.

## Remaining gates

**Public SaaS deployment remains BLOCKED**. TASK-062 Export authorization,063 cross-user Security E2E,064 own-user full workflow,065 운영 Auth redirect/mail/rate/secret/admission 설정과 release가 남는다. production SMTP/delivery/abuse 운영 정책이나 MFA/billing/password reset을 이번 TASK에서 확정하지 않았다.

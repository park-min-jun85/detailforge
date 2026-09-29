# TASK-062 — Export Authorization Hardening

2026-09-28 · C:\Projects\detailforge · baseline55e0507 · Next16.3.4

## 1. Status

**TASK-062 COMPLETE. Public SaaS deployment remains BLOCKED.** 실제 Export25개와 migration/access2개(runtime27), 별도 fresh migration3개를 검증했다. [상세 보안 계약](../V0_3_EXPORT_AUTHORIZATION.md).

## 2. Export inventory before

POST /api/projects/[projectId]/export → handleExport → exportDetail → getRenderView(user RLS) → captureWithChromium → 일반 /projects/[projectId]/render → RenderReview/RenderSurface. 기존 anonymous Chromium은061 gate를 통과할 수 없었다. Asset URL은 사용자 listAssets signing에서 생성했다. Export 자체 admin fallback0, 요청 body는PNG/JPG+quality strict, configured origin, no temp file, 기존 canonical fingerprint/Buffer/dimension/timeouts가 있었다. user-specific response no-store/nosniff·sanitized filename도 유지한다.

## 3. Files

신규13, 수정17, 삭제0, dependency/package/lock 변경0.

신규:

- `docs/V0_3_EXPORT_AUTHORIZATION.md`
- `docs/tasks/TASK-062.md`
- `scripts/export-local-stack.mjs`
- `src/app/export-capture/data/route.ts`
- `src/app/export-capture/page.tsx`
- `src/features/detail-export/authorization.ts`
- `src/features/detail-export/components/capture-surface.tsx`
- `supabase/migrations/0010_export_authorization.sql`
- `tests/export-migration.supabase.mjs`
- `tests/export-runtime.browser.mjs`
- `tests/export-security.test.mjs`
- `tests/helpers/export-app.cjs`
- `tests/helpers/export-local.mjs`

수정:

- `README.md`
- `docs/RELEASE_BACKLOG.md`
- `docs/V0_3_AUTH_UX_AND_PROTECTED_ROUTES.md`
- `docs/V0_3_PUBLIC_SAAS_ARCHITECTURE.md`
- `docs/V0_3_THREAT_MODEL.md`
- `docs/V0_3_USER_SCOPED_ACCESS_AND_ABUSE_CONTROL.md`
- `docs/tasks/README.md`
- `src/components/app-shell/app-shell.tsx`
- `src/features/detail-export/browser.ts`
- `src/features/detail-export/http.ts`
- `src/features/detail-export/service.ts`
- `src/features/detail-export/types.ts`
- `src/lib/abuse/privileged.ts`
- `src/lib/supabase/database.types.ts`
- `src/proxy.ts`
- `tests/admission-security.test.mjs`
- `tests/detail-export.test.mjs`

0001~0009 및 기존 RLS/Storage/admission production 로직 변경0. abuse privileged 파일은 유일한 admin이라는 낡은 주석만 갱신했다. .env.local/AGENTS 변경0.

## 4. Export authorization architecture

getUser의 verified principal + 사용자 RLS Project/Page/Section/Asset 조회 → 256bit token+256bit worker proof → DB에는 digest만 저장. actor/Project/Page/fingerprint/format/quality/860px/issued/expiry를 bind한다. TTL90초. row FOR UPDATE 내 단일 used 전환과 snapshot NULL 처리로8개 동시 consume 중1성공/7거부. 위조/만료/replay/actor·project override 차단. session 복제 없이 정확한 일회성 projection을 전달한다.

## 5. Render authorization

고정 /export-capture GET은 capability가 있어야 상품 데이터 없는 bootstrap을 반환한다. /export-capture/data POST가 검증/소비 후 snapshot만 반환한다. cookie/Authorization/query/body scope 주장을 거부한다. Next가 RSC markers를 정규화하는 경우 유효 capability의 RSC GET200은 빈 bootstrap만 포함하며 snapshot은 나오지 않는다. 새 route를 일반 사용자 메뉴에 추가하지 않았다.

일반 데이터/Storage download는 사용자 JWT RLS로만 실행한다. finite privileged RPC는 이미 승인된 snapshot만 보관/소비하고 generic query/signing을 허용하지 않는다. 이미지 bytes는 bounded Sharp PNG data URI로 전달해 Chromium에는 signed URL/JWT/service-role/raw cookie가 없다. 원본 Asset bytes는 변경하지 않는다.

## 6. Network/SSRF

앱 origin3062의 고정 shell GET, data POST, /_next/static/ GET만 허용. Storage 원격 origin은 Chromium에 필요 없다. 외부/metadata IP/다른 loopback port/credentials/file/ftp/javascript/blob/WebSocket/service worker/download/popup 차단. route.fetch(maxRedirects:0)에서3xx 자체를 abort하고 final URL을 확인한다. 초기 interception-only 방식의 redirect 한계를 실제 probe로 발견하여 보강했다. 최종 실제 HTTP302 probe와 외부 이미지 probe 각각 차단1/외부전달0.

## 7. Output

PNG860×439(21726bytes), JPG860×439(32660bytes), magic bytes/Sharp metadata/비어 있지 않은 결과/A·B 차이 검증. A PNG를 직접 육안 확인했으며 OCR0. 실제 A 로그인 → Project render 페이지 → PNG 다운로드 버튼 → 다운로드 스트림/Content-Length/Sharp 메타데이터까지 확인했다. 파일은 ignored artifacts/TASK-062/a.png,b.jpg. API는 private,no-store + no-referrer + nosniff + 올바른 image MIME/attachment filename을 반환한다. 서버 temp file0, 응답은Buffer. 사용자 filename/path/CLI args 입력0.

## 8. Runtime matrix

Playwright1.63.0 / Chrome 153.0.8010.53. 실제 Local GoTrue A/B login과 Storage 이미지·Next production Final Renderer/Export endpoint. Mock-only 판정이 아니다.

| Matrix | Result |
| --- | --- |
| EXPORT-01 A own Project actual browser PNG export | PASS |
| EXPORT-02 B own Project actual browser JPG export | PASS |
| EXPORT-03 exact foreign Project denied before authorization/capture | PASS |
| EXPORT-04 exact foreign Project denied before authorization/capture | PASS |
| EXPORT-05 anon export denied | PASS |
| EXPORT-06 malformed/stale session export denied | PASS |
| EXPORT-07 valid ticket returns only exact bound render projection | PASS |
| EXPORT-08 render shell/data without capability denied | PASS |
| EXPORT-09 forged token and worker proof denied | PASS |
| EXPORT-10 expired ticket denied and snapshot reclaimed | PASS |
| EXPORT-11 replay denied including render shell | PASS |
| EXPORT-12 concurrent consume allows exactly one of eight | PASS |
| EXPORT-13 project/page/options scope overrides denied | PASS |
| EXPORT-14 actor/session substitution denied | PASS |
| EXPORT-15 foreign Asset injection cannot issue signing/capture authorization | PASS |
| EXPORT-16 fabricated Asset/path and arbitrary request options denied | PASS |
| EXPORT-17 actual Chromium arbitrary network request intercepted | PASS |
| EXPORT-18 actual HTTP redirect blocked before Chromium can follow | PASS |
| EXPORT-19 actual PNG/JPG magic, dimensions and 860px width | PASS |
| EXPORT-20 user-specific response cache/attachment headers | PASS |
| EXPORT-21 A/B capture text contains no foreign data | PASS |
| EXPORT-22 HTML/RSC/render responses contain no session/service credentials | PASS |
| EXPORT-23 only capability hashes persist; no secrets in logs/artifacts | PASS |
| EXPORT-24 capture failure closes authorization without replay window | PASS |
| EXPORT-25 configured origin only; logout blocks same export URL | PASS |

총EXPORT25 PASS, N/A0. runtime.json의 나머지2개는 upgrade preservation과 privileged ACL 검사다. 네트워크 공격 probe는 Next 시나리오 종료 후 동일 고정 loopback port에 실제 적대적 HTTP fixture를 띄우고 production Chromium interceptor를 변경 없이 실행했다. 외부 endpoint는 접촉하지 않았다. task의 browser globals/wrappers는 tests에만 있다.

## 9. A/B isolation

A/B 각 own export 성공. exact foreign Project는404, 새 티켓0, 주입 capture callback0. foreign Asset ID/조작 storage_path/URL 입력은 capture 전에 거부. A·B snapshot text/asset ID가 섞이지 않음을 확인했다. own Asset user-RLS download만 성공하며 capture projection에 storage_path/signed URL이 없다.

## 10. Concurrency

실제 Next POST+PostgreSQL ticket row 경합: attempts8/success1/rejected7. issued를 읽고 나중에 성공 표시하는 구조가 아니다. process-local busy guard는 기존 자원 보호이며 전역 요금/동시성 entitlement로 주장하지 않는다. used/failed 티켓을 issued로 되돌리는 경로0. 실패 후 snapshot NULL 및 재사용404 확인.

## 11. Previous security regressions

최종0010이 적용된 전용 Local 스택에서 TASK-058143 PASS, TASK-05974 PASS, TASK-06037 PASS(ABUSE-01~06, upload3/12, AI2/8 포함), TASK-061 Auth UX20 PASS. 일반 service-role 데이터 접근 복원0, RLS/grants/admission 완화0. 각 runtime JSON은 artifacts/TASK-062에 복사했다.

## 12. Migration

0010_export_authorization.sql 추가. actual0009→0010에서 기존 Project/Product/Asset/Page/Section/Storage object/admission snapshot 불변 확인. 별도 template0 DB에 실제 플랫폼 schema를 복제하고0001~0010 fresh 적용 PASS. 비교는 함수 정의/security definer/search_path/API 역할 ACL을 포함한다. 플랫폼 DBA postgres의 default EXECUTE grant 차이는 유지하며 anon/authenticated/service_role 권한을 각각 검증했다. 기존0001~0009 파일 변경0, destructive reset0. 검증 clone은 볼륨에 보존한다.

## 13. Regression

공식 전체 **1485/1485 PASS**, 실패/skip0(기존1481 + 신규보안4). typegen/typecheck/lint/npm build/diff-check/secret scan/browser bundle scan PASS. 실제 npm build는 env-file loader·외부 fetch 차단과 명시적 Local env로 실행한다. secret scan은 configured 값과 token/key 패턴, 실제 Next static JS를 검사한다. 상세 수치는 artifacts/TASK-062/audit.json. 외부 provider0. 기존 원본/fixture hash를 확인한다.

## 14. Security findings

- BLOCKER:063 전체 cross-user E2E,064 own-user workflow,065 운영/release 검증 미완료.
- HIGH: 이번 범위에서 미해결 finding 없음. redirect interception 한계는 한 단계 fetch+3xx abort로 수정하고 actual HTTP 검증을 통과했다.
- MEDIUM: 결합 capability 자체의 서버 측 탈취 위험, TTL/maintenance와 multi-instance Chromium 자원 정책/운영 sandbox 검증이 남는다. 발급된 사용자 access JWT TTL 잔여는061 계약 그대로다. 가격 정책/글로벌 Export quota를 임의로 추가하지 않았다.
- LOW: 추가 다중 browser/대형 페이지 성능 QA는063~065에서 수행. Sharp snapshot 상한을 넘으면 안전하게 실패한다.

## 15. Mutation

Remote DB0/Auth0/Storage0/external AI·provider0. Browser의 unexpected 외부전달0, 적대적 probe2건은 차단. fixture는 Local 계정/Project/Object/티켓만 생성·삭제. 원본 파일/기존 business 데이터/볼륨 초기화0. 예전 namespace 보안 기록과 fresh clone DB는 보존한다. 전용 테스트 스택5개 종료를 완료했고 전후 메타데이터로 기존 볼륨11개 보존을 확인했다. 모든 전용 스택의 Project/Object/intent/admission/export ticket/테스트 계정 잔여0을 확인했다.

## 16. Remaining Public SaaS blockers

TASK-063 cross-user Security E2E,064 own-user workflow regression,065 release validation/운영 secret·Auth·export maintenance·sandbox·부하 검증. **Public SaaS deployment remains BLOCKED**.

## 17. Git

Branch feat/export-authorization. HEAD 55e050798e89f265d7e074ce9a57abf2d56f1a70 유지. 시작 working tree clean. Stage/commit/merge/tag0, fetch/push0, reset/restore/clean 미사용. 위 변경은 모두 미스테이징 상태다.

## 18. Next

TASK-063 — Cross-user Security E2E. 실제 브라우저의 여러 계정/리소스/Actions/Storage/export 경로를 연결해 전체 경계를 검증한다.

재현은 전용 stack 시작 후 다음을 사용한다. 모든 계정/키는 local helper가 메모리로 얻고 .env.local을 로드하지 않는다.

~~~powershell
node scripts/export-local-stack.mjs start
node --conditions=react-server --import ./tests/register.mjs tests/export-runtime.browser.mjs
node tests/export-migration.supabase.mjs
node scripts/export-local-stack.mjs stop
node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs
npx.cmd next typegen
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
git diff --check
~~~

Production 환경은 DETAILFORGE_APP_ORIGIN과 사용 가능한 sandbox-enabled Chromium을 명시해야 한다. Local harness는 설치된 Chrome channel을 명시하며 임의 executable path/CLI args를 받지 않는다.

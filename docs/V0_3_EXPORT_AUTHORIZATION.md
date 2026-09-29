# v0.3.0 Export Authorization

## TASK-063 현재 상태 — 2026-09-29

Cross-user Security E2E COMPLETE. 실제 Local Supabase + Next production + Chromium에서 XUSER40/exact-ID corpus97, 7-table/Storage 무변경, denied provider/capture0를 확인했다. Section 옵션 foreign/absent 응답을404로 정정했다. 이전 RLS143/Storage74/Admission37/Auth20/Export27 및 full1487 PASS. Public SaaS deployment remains BLOCKED: TASK-064/065가 남는다. [검증 계약과 전체 inventory](V0_3_CROSS_USER_SECURITY_E2E.md).

아래 내용은 이전 TASK 단계의 기록이며 현재 완료 상태는 위 계약을 따른다.


TASK-062 · 2026-09-28 · **Public SaaS deployment remains BLOCKED**.

## 기존 경로와 변경

기준55e0507에서 `POST /api/projects/[projectId]/export`는 TASK-061 Proxy gate 아래였으며, `exportDetail`은 user-scoped `getRenderView`를 읽은 뒤 세션 없는 Chromium으로 일반 `/projects/[projectId]/render`를 열었다. 이 페이지는 인증이 필요하므로 capture가 막혔다. URL은 설정 기반이고 format/quality strict schema·Buffer 출력·renderer fingerprint·dimension/timeout 검사는 이미 있었다.

일반 미리보기 URL과 기존 `RenderSurface`/SectionRenderer/CSS는 유지한다. 새 capture는 설정된 `DETAILFORGE_APP_ORIGIN`의 고정 `/export-capture`와 POST `/export-capture/data`만 사용한다. 사용자 쿠키/JWT/service key를 브라우저에 복제하지 않는다. 기존 사용자 Project API Proxy, DAL, DB/Storage RLS와 admission은 유지한다.

## 외부 요청의 인증과 canonical scope

브라우저의 기존 Auth session → Proxy GoTrue getUser → user-scoped renderer/DAL → own Project/Page/Sections/Assets RLS 조회 → 서버의 narrow authorization 발급 순서다. foreign Project는404이며 capture/티켓 발급 전에 종료된다. origin은 TASK-061 `authAppOrigin`과 설정 계약을 사용하고 요청 Host/forwarded host로 capture target을 만들지 않는다. 입력은 png 또는 jpg+quality60~100(default90)뿐이다. actor/owner/page/asset/path/URL/width/CLI args는 입력할 수 없다.

발급 직전에 `getUserContext`의 검증된 principal과 사용자 Project를 다시 확인한다. persisted page 폭은860이어야 한다. fingerprint는 기존 canonical renderer 상태를 사용하며 출력 후 user-scoped view를 다시 읽어 변경 여부를 검사한다. 중간 변경/삭제/권한 상실은 출력 실패로 처리한다.

## 티켓 및 privileged boundary

0010의 `app_private.export_tickets`는 RLS enabled이며 anon/authenticated/service_role 직접 CRUD 권한이 없다. random UUID, verified actor, Project/Page, fingerprint, format/quality, width860, issued_at/expires_at, state, exact render projection을 보관한다. TTL은 **90초**의 내부 보안 설정이며 요금 정책이 아니다.

매 capture마다256bit token과 별도256bit worker proof를 생성한다. 원문 대신 각각 SHA-256 digest만 DB에 저장한다. 원문은 서버 메모리와 정확한 내부 요청 header에만 있으며 URL·cookie·React props·RSC·localStorage·로그에 넣지 않는다. 임의 Project/actor query/body override와 사용자 cookie/Authorization header를 거부한다. ticket ID/token만 알아도 worker proof 없이는 사용할 수 없다. 두 비밀을 모두 탈취한 공격자까지 사용자 신분으로 구별하는 시스템이라고 주장하지 않는다. 결합된 capability는 짧은 수명의 bearer이므로 서버/프로세스 로그 접근 자체의 통제가 필요하다.

`authorization.ts`는 `issue_export_ticket`, `use_export_ticket`, `close_export_ticket`만 호출하는 별도 server-only privileged boundary다. client/generic CRUD/Storage signing을 export하지 않는다. 일반 데이터는 모두 먼저 사용자 JWT와 RLS로 읽는다. SQL은 발급/소비 시 actor의 실제 Project ownership과 Page 관계를 다시 확인한다. Chromium이 사용자 세션 없이 스냅샷 한 개를 받기 위해 이 좁은 RPC 권한이 필요하다. admission wrapper와 합쳐 production privileged import는2곳이며 기존 admission 권한은 확대하지 않는다.

RPC는 SECURITY DEFINER, 빈 search_path, qualified identifiers, service_role 전용 EXECUTE다. digest 비교는 DB에서 수행하며 raw secret의 접두사를 비교하지 않는다. 생략되거나 길이/형식이 잘못된 HTTP secret은 DB에 접근하기 전에 거부한다.

## 원자적 소비와 수명

shell GET은 유효 capability만 확인하고 **상품 데이터 없는** 준비 HTML을 반환한다. React client가 POST data를 요청할 때 서버측 Playwright interceptor가 header를 넣는다. POST handler는 payload를 허용하지 않는다. SQL은 ticket row FOR UPDATE 아래 issued/unexpired/digests/current ownership을 확인한 뒤, **같은 transaction에서 used + snapshot=NULL로 바꾸고 기존 projection만 반환**한다. 두 번째 호출은 거부한다. 실제8개 동시 요청에서1성공/7거부였다.

Next16이 RSC marker와 cache-busting query를 Proxy 전에 정규화할 수 있다. 따라서 유효 capability의 RSC GET이200인 경우에도 빈 준비 화면만 포함한다. 데이터 승인 지점은 POST의 원자적 소비이며 GET/RSC는 스냅샷을 읽지 않는다. capability 없는 GET/POST는404다.

`finally`에서 issued 티켓은closed, 모든 snapshot은NULL로 만든다. 이미 used인 티켓은used 상태를 유지한다. 캡처/응답 유실 후 issued로 되돌리는 경로는 없다. 발급 RPC 응답이 불명확해도 close를 시도하며 실패하면 TTL로 닫힌다. DB 불명확/timeout에서는 승인하지 않는다. `expire_export_tickets`는 만료 issued를expired로 전환하며 스냅샷을 제거하고, 만료 시각에서1일 지난 기록을 삭제한다. 새 발급 때도 실행한다. 프로세스 사망 후 요청이 전혀 없을 때의 즉시 물리 삭제는 보장하지 않으며 운영 maintenance 실행 주기는065에서 확정한다. 만료된 capability 자체는 cleanup 전에도 거부된다.

## Asset과 이미지

기존 renderer의 own-asset signing 검증은 유지한다. 캡처용 스냅샷을 만들 때는 referenced IDs를 사용자 RLS로 다시 조회하고 해당 Storage object를 **같은 사용자 JWT**로 download한다. generic privileged signing/fetch를 추가하지 않는다. foreign/fabricated Asset 또는 불러올 수 없는 이미지는 capture 전에 실패한다.

이미지는 Sharp로 픽셀 디코딩·회전·PNG 재인코딩해 metadata/능동 콘텐츠를 제거하고 data:image/png로 넣는다. 입력1개10MiB/40MP, 합계 인코딩 bytes10MB, JSON16MB 상한이다. ticket DB/Chromium에 signed URL·Storage path·JWT를 저장하지 않는다. 이 비용 상한을 넘는 페이지는 안전하게 실패하며 이후 최적화는 별도 범위다. 원본 제품 이미지/DB Asset은 변경하지 않는다.

## Chromium과 네트워크

새 browser/context마다 cookie jar가 비어 있다. 고정 shell GET1회/data POST1회/같은 origin의 `/_next/static/` GET만 허용한다. 이미지·폰트는 data PNG 또는 동일 origin static이다. Supabase Storage origin 자체를 Chromium에 허용할 필요가 없다. 외부HTTP(S), metadata IP, 다른 localhost port, credential URL, query/hash, file/ftp/javascript/blob 요청을 허용하지 않는다. WebSocket/service worker/download/popup을 막는다. CSP는 frame/object/base/form을 차단하고 img-src=data:, connect-src=self로 제한한다.

Playwright route interception만으로 redirect chain이 모두 잡힌다고 가정하지 않는다. 허용 요청은 `route.fetch(maxRedirects:0)`로 한 단계만 가져오고3xx는 abort한다. 나머지 응답만 fulfill한다. final page URL도 고정 target과 일치해야 한다. 실제 로컬 HTTP fixture의302와 외부 이미지 요청을 production interceptor로 검사했고 외부 전달0이다.

headless launch는 `chromiumSandbox:true`, 고정 timeout을 사용한다. 사용자 CLI args/executable path override는 없다. 기본 bundled Chromium 또는 운영자가 설정한 `DETAILFORGE_EXPORT_BROWSER_CHANNEL=chrome`만 지원한다. 실제 검증은 이미 설치된 Chrome을 썼고 브라우저/dependency 다운로드0이다. 배포 환경에서 sandbox가 지원되지 않으면 실패하며 `--no-sandbox` fallback은 없다.

## 출력/실패/캐시

75초 전체 deadline, navigation/readiness/screenshot별 bounded timeout, browser close finally를 유지한다. 이미지 decode·font readiness와 기존 fingerprint/height/pixel/bytes 검사를 통과한 surface만 캡처한다. PNG/JPG Buffer만 사용하며 서버 temp export file/사용자 제어 파일 경로가 없다. Content-Type/Content-Disposition(filename 정규화)/private,no-store/nosniff/no-referrer를 반환한다. Provider·Playwright stack/내부 URL/secret은 고정 오류로 대체한다.

process-local capture busy guard는 자원 보호용이며 다중 인스턴스 요금/concurrency 정책은 아니다. DB 일회성 승인만 원자적 보장이다. 중단된 capture는 새 요청·새 티켓으로만 재시도할 수 있다.

## 검증/남은 작업

실제 Local GoTrue A/B session, Storage object, PostgreSQL, Next production build/start, Chrome, 최종 Renderer/Export endpoint로 검증했다. API58621/DB58622/앱3062 고정, linked project 거부, env-file 차단, 외부 fetch/redirect 거부. 테스트는 승인된 local fixture만 만들고 정리한다. 토큰/쿠키/trace 원문은 artifact로 저장하지 않는다. [TASK-062](tasks/TASK-062.md)에 정확한 matrix/회귀/출력 증거를 기록한다.

**Public SaaS deployment remains BLOCKED**. TASK-063 전체 cross-user E2E,064 own-user workflow,065 운영 secret/maintenance/sandbox/부하·release validation이 남는다.

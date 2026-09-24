# v0.3.0 Threat Model & Security Validation Contract

2026-09-23 · TASK-055 · **계획, 미구현·미검증**. 기준 v0.2.1 / `cf77916`. 본 문서의 PASS 조건은 다음 구현 TASK의 gate이며, TASK-055의 1,417개 baseline 통과와 구분한다. 현재 앱은 공개 배포 불가다. [선택한 architecture](V0_3_PUBLIC_SAAS_ARCHITECTURE.md), [TASK-055 보고](tasks/TASK-055.md).

## 1. 보호 대상과 신뢰 경계

보호 대상은 사용자별 Project/Product/Facts/Options/Assets/Page/Sections, 원본/Derived bytes와 provenance, import/candidate 임시 데이터, private signed URL, session/refresh token 및 provider/signing secret, AI 비용·Storage 용량·Chromium capacity다. Product Facts와 실제 제품 정체성은 보안 변경 중에도 보존한다.

공격자는 미로그인 사용자 또는 정상 계정을 가진 User B이며 User A의 모든 resource UUID와 Object path를 안다고 가정한다. 브라우저 UI를 건너뛰어 API/Server Action/PostgREST/Storage를 직접 호출하고 body/query/headers/JSON/동시성/티켓을 조작할 수 있다. 등록된 사용자의 입력과 외부 도매 HTML/이미지, AI output은 신뢰하지 않는다.

인증은 누구인지, 권한은 그 row/object에 접근할 수 있는지다. 브라우저→Next session/DAL→사용자 JWT→DB RLS 및 Storage policy가 경계다. Next가 서버라는 사실, UUID 난수성, hidden 버튼, CORS, path naming은 소유권 경계가 아니다. 관리 seed/백업 자격은 일반 web 실행 경로 밖에 둔다. 서비스 키가 유출되면 RLS만으로 막지 못하므로 web env/import graph에서 제거한다.

## 2. 위험 register와 구현 gate

우선순위는 v0.3.0 public gate 기준이며 v0.2.1 품질 backlog의 숫자를 재해석하지 않는다. 모든 아래 Must는 아직 열려 있다.

| ID | 공격/현재 노출 | 요구 방어 | 검증·담당 |
| --- | --- | --- | --- |
| T01 | session 없이 Project URL/API/Action 호출 | 검증 identity + 모든 진입점 auth + DB/Storage deny | 056/060/061, anon route/API/Action/직접 DB |
| T02 | B가 A의 Project/child UUID로 read/update/delete | root RLS, old USING/new CHECK, 404 privacy | 058/063, 7-table CRUD 및 0 rows write 확인 |
| T03 | B-owned Asset에 A product_id 조합; own 두 Project 사이 reparent | 복합 FK, owner/PK/parent/path 불변성 | 057/058, INSERT/UPDATE/UPSERT·legacy bad graph |
| T04 | route 1곳에서 검사를 빠뜨리고 admin client 사용 | 31 factory·하위 helper·서명키 분리, web service key 0 | 060, 정적 import/env audit+negative integration |
| T05 | path 위조/sign/delete/overwrite/copy로 A Object 접근 | bucket+엄격한 path+관계 RLS, UPDATE deny | 059/063, 실제 Storage API |
| T06 | URL을 로그/referrer/cache에서 탈취 | 짧은 TTL/no-store/no-referrer/로그 redaction | 059/062, signed bearer 만료와 알려진 한계 |
| T07 | export ID 조작·grant replay·SSR cookie 누출 | one-time scoped grant + 동일 actor user JWT/RLS + nonce atomic consume | 062, 2-instance replay/foreign page/외부 헤더 관찰 |
| T08 | 로그인 후 무한 새 resource·tile·regeneration 호출 | user/global atomic reserve+일일 상한+throttle+provider cap | 060/063, provider spy·병렬 quota test |
| T09 | timeout 후 중복 paid retry, stale lease/정산 위조 | idempotency/lease/상한 예약·불명확 비용 보류, server-proof RPC | 060, ack-loss/crash/expiry/직접 RPC forgery |
| T10 | 쿠키로 cross-site mutation, Host/forwarded host 조작 | trusted origin allowlist, SameSite, API/Action auth, no GET mutation | 060/061, Origin 없음/null/외부/Host spoof |
| T11 | body ownerId/userId 또는 token의 actor 바꾸기 | server identity/DB auth.uid, ticket actor binding+fresh RLS | 056/060, candidate/import/thumbnail ID 교체 |
| T12 | login `next` 외부 주소, callback/token replay, 계정 enumeration | 내부 path allowlist/PKCE·확인/reset 검증/일반 오류 | 061, encoded redirect/만료·재사용/다중 탭 |
| T13 | logout 후 A의 RSC/cache/draft가 B에게 표시 | no shared cache, clear/remount/full navigation, focus/pageshow 재검증 | 061, A logout→B login/back/다른 탭 |
| T14 | upload signature만 맞는 decompression bomb/직접 Storage 무제한 insert | bounded decode, bucket bytes/MIME, slot/byte reservation | 059/060, forged MIME·oversize·concurrent direct upload |
| T15 | import SSRF, 모델/prompt override, AI가 만든 사실/HTML 저장 | 기존 SSRF/pinned DNS/redirect/byte 제한, 서버 model, schema/grounding | 060/064, 기존 corpus + input override |
| T16 | owner NULL fallback/첫 signup에 legacy 전체 귀속/불완전 배포 | offline 명시 mapping/hash gate, maintenance, fail-closed | 057/065, upgrade interruption·bad mapping |
| T17 | 장애 복구로 RLS disable 또는 v0.2.1 admin 앱 공개 | ingress 중지·보안 schema 유지·호환 앱/forward fix | 065, rollback rehearsal |
| T18 | 직통 DB JSON/metadata 조작으로 quota 환불·임의 URL provider fetch | private ledger 권한 분리, schema/scope/실제 bytes 재검증 | 060/063, direct PostgREST·Storage 우회 |

## 3. Resource IDOR 테스트 matrix

각 case는 **A owns resource, B is authenticated, anon**으로 수행한다. A own 정상 허용이 동시에 성공해야 단순 전체 차단을 PASS로 오판하지 않는다. 다른 사용자 ID를 모르는 것처럼 테스트하지 않는다.

| Resource / 실제 FK | A own 허용 | B/anon 및 위조 요청 거부 |
| --- | --- | --- |
| Project | create/list/count/read/update/delete | B의 A SELECT 0/수정0/삭제0, owner=A INSERT 거부; anon 전부 거부 |
| Product → Project | create/read/update/delete | A Project에 child insert, project_id 변경, foreign ID를 own route에 혼합 |
| Facts → Product → Project | create/read/update/delete | product_id 바꾼 insert/upsert/update; source/validation 우회 |
| Options → Product → Project | create/read/update/delete/import preview/apply | foreign product/version/ticket, mixed snapshot references |
| Asset → Product + Project | upload/read/sign/analyze/delete | project와 product 불일치, foreign assetId·sourcePath, metadata 위조 |
| Page → Project | create/read/plan/update/delete/render/export | A pageId와 B projectId 혼합, plan 생성/refresh/recovery 접근 |
| Section → Page → Project | create/read/edit/reorder/delete/regenerate/apply | foreign sectionId/orderedSectionIds/pageId/candidate, 동일 owner reparent도 금지 |
| Source/Derived | review/retry/save/manual crop, duplicate 재사용 | foreign parent/candidate/source hash, path/rect 혼합; 재귀 Derived source |
| Ticket/candidate | 본인의 유효 scope/revision에서 명시 동작 | 다른 actor, 이전 session/만료/변조, foreign thumbnail fetch, key rotation 전 token |

DB 직접 테스트는 authenticated A/B JWT를 사용한 PostgREST와 Postgres role/JWT claims integration을 함께 사용한다. anon 키만 가진 요청은 거부되어야 한다. project owner NULL/존재하지 않는 Auth FK, 혼합 graph, UUID PK 변경, parent 변경은 직접 SQL/REST write에서도 거부한다. 행 필터에 의해 200+빈 배열/수정0이 나오는 DB 응답과 앱의 404 변환은 구별해서 assertion한다. DB denial을 HTTP 403 하나로 고정하지 않는다.

각 table의 SELECT, INSERT CHECK, UPDATE old/new, DELETE, UPSERT 양 경로를 검증한다. own root delete fixture의 expected DB cascade와 **타 사용자 row 불변**을 확인한다. ON DELETE RESTRICT로 Auth user 삭제가 자료를 암묵적으로 제거하지 않는지 확인한다. 실험 전후 B/anon이 볼 수 없는 행을 service fixture 감사자로만 hash 비교하고 service role 성공을 일반 사용자 성공으로 집계하지 않는다.

## 4. Storage 실제 integration

| Case | 기대 결과 |
| --- | --- |
| A own 원본/Derived/import path | 유효 신규 reservation upload, list/read/sign/delete 허용 |
| B가 A path/assetId를 알고 있음 | list 결과 없음, download/sign/delete/upsert/overwrite/copy/move 실패, bytes 불변 |
| anon / key만 있음 | 모든 private data read/write/sign 거부 |
| own Project + 다른 Project의 Product, invalid UUID/path | 거부; cast error/stack 정보 노출 없음 |
| pre-Asset-row upload 실패 cleanup | A가 자신의 Object를 제거 가능; B는 불가 |
| user 없이 생성된 legacy Object | Project backfill 후 A만 접근; object owner metadata에 의존하지 않음 |
| DB root만 삭제된 orphan Object | 접근/sign 거부; bytes는 offline 정리 전 유지, 타 사용자 cleanup 불가 |
| 다른 bucket | 이번 정책이 권한을 추가하거나 제거하지 않음 |
| 직접 Storage 신규 upload | reservation 없는 요청 거부, bucket MIME/10MiB cap, 서버 UUID path 상한 |
| 동시 예약·upload·delete·실패 재시도 | 동일 path/slot을 중복 계산하거나 용량을 무제한 환불하지 않음 |
| A가 받은 유효 signed URL을 B에게 전달 | **만료 전 사용 가능함을 인정·검증**; expiry 후 실패, 로그/analytics/referrer/cache 유출 없음 |

마지막 case는 Storage IDOR 실패가 아니라 bearer URL의 명시된 잔여 위험이다. URL 유출 즉시 회수가 필수인 향후 요구는 proxy streaming 등 별도 설계가 필요하다. [Supabase private downloads](https://supabase.com/docs/guides/storage/serving/downloads).

## 5. Export와 paid side-effect 검증

Export는 PNG/JPG 두 형식에서 A own 성공, B→A/anon/foreign pageId를 전부 거부한다. 서명 변조·다른 actor JWT·method/path/page/fingerprint 변경·TTL 경과·nonce replay·2-instance 동시 소비는 deny. grant만 있거나 JWT만 있는 internal endpoint도 deny. preflight에서 권한이 없으면 Chromium 생성 0회다.

Chromium으로 refresh cookie를 복사하지 않는다. navigation 한 건에만 Authorization/one-time grant가 실리는지 실제 capture request instrumentation으로 확인한다. static·Supabase signed image·redirect target·새 탭·WebSocket에 자격 header가 없어야 한다. issuer와 handler가 같은 nonce-bound Asset/signed URL map을 사용하고 서로 다른 시각의 재서명에 의존하지 않는지 검사한다. 이 map 밖의 query가 다른 signed URL, `/_next/static` 이외의 origin path, 예상 밖 image origin은 실패한다. capture 전후 canonical 변경/삭제·토큰 만료는 실패, context/browser cleanup은 성공/실패/timeout 모두 확인한다. private render HTML은 shared cache에 남지 않는다.

AI negative cases는 실제 DB/Auth/Storage와 **호출 수를 세는 mock provider**를 결합한다. B가 A의 Asset/Product/Facts/Planner/Section/Extraction/retry/regeneration ID를 사용했을 때 provider 호출 **0**, A quota 변화 **0**, A metadata/bytes/canonical 변경 **0**이어야 한다. 인증 실패 후 자동 retry로 유료 호출이 생겨도 실패다. 실제 유료 호출로 공격 테스트를 수행하지 않는다.

비용 테스트는 두 서버 프로세스가 같은 DB ledger를 사용한다. 신규 requestId를 계속 발급해도 per-user/day/global 한도를 넘지 못해야 한다. tile 수/output token/input bytes 증가, quota 직전 동시 요청, worker crash, provider timeout 후 late success, lease expiry, forged settle/refund, expired/재사용 HMAC proof, ledger 장애를 포함한다. 직접 DB JSON 상태를 성공/실패로 바꿔도 quota 권한이 생기지 않는다. Auth rate limit과 process Set만으로 PASS를 주지 않는다.

## 6. Session·CSRF·privacy 검증

유효/만료/서명 변조 token, cookie chunk refresh, request/response cookie 전달, Proxy redirect의 Set-Cookie 보존, Server Action 직접 POST, 보호 API 401 JSON, RSC 보호, signup confirmation 및 reset link single-use/expiry를 검사한다. `getSession().user` JSON만 조작해서 로그인할 수 없어야 한다.

Origin missing/null/외부, Host·X-Forwarded-Host spoof, cross-site form/JSON, 안전하지 않은 method, 인증된 GET의 stale recovery mutation 여부를 검증한다. trusted origin 값은 서버 설정에서 얻고 request header로 대체하지 않는다. 인증 callback의 provider 검증 흐름과 일반 mutation Origin 정책을 혼동하지 않는다.

로그인 후 A→logout→B, 다중 탭·뒤로가기·bfcache·세션 만료·refresh 실패에서 이전 개인 DTO/draft/signed URL을 화면에서 제거한다. 동시에 browser network/빌드 static/log artifact를 scan해 service/provider/signing key 및 session JWT가 노출되지 않았는지 확인한다. 계정 존재·owner UUID·DB/FK detail·raw provider response가 에러로 노출되지 않아야 한다. 이미 발급된 JWT와 signed URL의 TTL 잔여는 별도로 기록하며 logout 즉시 원격 bytes 회수를 보장하지 않는다.

## 7. 기존 데이터와 workflow 회귀

v0.2.1 schema fixture→0006→명시 mapping backfill→0007~0009 upgrade를 검증한다. v1/v2 Derived provenance, source hash/crop rect, failed tile checkpoint, manual adjustments, 기존 Options/Plan/Section/style/order/version을 포함한다. PK/row count/path/object bytes 및 canonical hash는 동일해야 한다. owner 및 의도된 schema 차이만 허용한다. timestamp 변경 가능성도 사전 allowlist로 제한한다.

매핑 누락·wrong environment user·중복 mapping·existing different owner·NULL·mixed Asset FK·중복 path·migration 도중 중단·다시 실행·rollback rehearsal을 검사한다. 실패하면 ingress가 닫혀 있고 원본 row/object가 삭제되지 않아야 한다. 단순 새 빈 DB install 테스트로 upgrade/data-loss 0을 대신하지 않는다.

A와 B 각각의 격리 Project에서 Projects→Product/Facts→Wholesale Import/Options→원본 upload→Long Extraction/failed-only retry→자동/수동 Derived 저장→Asset/Product AI→Fact Validation→Planner→Sections→Editor/Options/Reorder/Regeneration→Renderer→PNG/JPG를 수행한다. 기존 content-loss 0 우선·same pixels+same config→same decision·ambiguous preserve·grounding·860px/shared Renderer 계약을 유지한다. 이전 successful data의 재조회만으로 새 auth flow를 통과했다고 보고하지 않는다.

## 8. 실행 환경, 증거 및 공개 승인 gate

local Supabase의 실제 Auth/Postgres/Storage와 run별 A/B 계정을 사용한다. `qa-a-<run>@example.invalid`, `qa-b-<run>@example.invalid`, 실행 중 생성 비밀번호, local mail inbox를 사용한다. service/admin은 fixture seed와 해당 run UUID만 cleanup하는 별도 C process에 한정한다. production/dev 기존 사용자 데이터에 테스트 cleanup을 적용하지 않는다. CLI/container/local mail 환경을 준비하지 못하면 미검증으로 남기며 mock PASS로 대체하지 않는다.

증거는 테스트 ID, actor label(A/B/anon), operation, allow/deny, row 변화수, Object hash, provider count, quota/nonce 결과, 정제한 error code 및 migration 전후 비교다. 실제 개인 이메일/비밀번호/secret/token/signed query/private 상품 원문은 commit 가능한 보고에 넣지 않는다. Git에 넣지 않는 local evidence도 접근을 제한한다. 운영 drift 검사와 설정 값의 존재 확인 결과만 기록한다.

공개 gate는 다음 모두를 요구한다.

1. 7-table real RLS 및 grants/immutable relation, bucket actual API isolation, 일반 web service-role 0.
2. Auth/session/verification/reset·CSRF·cache·redirect·IDOR 실패 경로, foreign-resource paid side-effect 0.
3. 원자적 분산 quota/lease/Storage reservation, Export 일회 grant 및 RLS, 유효 signed URL의 한계 명시.
4. 기존 데이터 보존 upgrade·own-user 전체 회귀·전체 unit/typegen/typecheck/lint/build/secret scan.
5. production maintenance→policy/code/key 전환→테스트→open 순서 및 **RLS를 유지하는 rollback** rehearsal.

TASK-055에서는 1~5를 설계했으며 미래 보안 integration을 실행하지 않았다. 외부 API/원격 DB·Storage mutation 0, 새 Auth user 생성 0. 향후 한 gate라도 실패/미검증이면 public release 불가다. 남는 위험은 bearer credential의 TTL, XSS/세션 탈취, 계정 대량 생성에 대한 quota 우회 압력, privileged offline 자격 관리, 외부 provider의 불확실 과금, Storage/DB 간 비원자성이다. 각 위험에 최소한 global cap·짧은 TTL·비밀키 격리·보수적 정산·운영 복구를 둔다.

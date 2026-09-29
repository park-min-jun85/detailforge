# v0.3.0 User-scoped Access & Abuse Control

## TASK-062 현재 상태 — 2026-09-28

TASK-062 Export authorization COMPLETE. 실제 Local Supabase/Next production/Chromium으로 EXPORT-01~25 PASS, 티켓 동시8개 중1성공/7거부를 확인했다. 사용자 JWT·쿠키를 capture에 전달하지 않으며 user-RLS snapshot + 90초 DB single-use capability를 사용한다. Production privileged boundary는 admission과 finite export RPC 두 곳이고 generic admin CRUD/Storage fallback은 없다. Public SaaS deployment remains BLOCKED: TASK-063/064/065가 남는다.

[Export 보안 계약](V0_3_EXPORT_AUTHORIZATION.md). 기존 renderer/프로젝트 URL, DB·Storage RLS, admission, Auth UX 계약을 유지한다. Chrome sandbox/maintenance/부하·운영 설정은065 gate다.

## 이전 단계 기록

아래 내용의 미완료062 및 단일 privileged boundary 설명은 해당 단계 당시 기록이다. 현재 상태는 위 TASK-062 계약을 따른다.

2026-09-26 · TASK-060 · **Public SaaS deployment remains BLOCKED**.

[완료 보고·재현](tasks/TASK-060.md), [DB RLS](V0_3_DATABASE_RLS_SECURITY.md), [Storage](V0_3_STORAGE_SECURITY.md), [Auth](V0_3_AUTH_CONTRACT.md).

## Identity와 일반 데이터 접근

기준001b7ef의31개 privileged factory 호출을 AST로 다시 집계했다. 모두 user-requested 경로이며 아래 표의31개 전부 MIGRATED다. `src/lib/supabase/server.ts` admin alias는 제거했다. 이름만 바꾼 alias가 아니라 비동기 `createUserDataClient`가 SSR cookie client를 만들고 실제 GoTrue `auth.getUser()`로 검증한 principal만 허용한다. body/query의 owner/user 주장은 사용하지 않는다.

Project/Product/Facts/Options/Asset/Page/Section의 기존 query·CAS·보상은 같은 사용자 JWT로 실행한다. DB/Storage의 최종 경계는0007/0008 RLS이며 이를 완화하지 않았다. Project 목록·dashboard count도 RLS를 통과한다. `createProjectAction`은 verified principal과 같은 client를 `createProject`에 전달한다. ownerless legacy bridge는 계속 닫혀 있다.

`withUserClient`는 server-only job/테스트 DI이며 제공된 client도 getUser 검증을 거친다. principal 직접 주입/HTTP body client 주입은 없다. AsyncLocalStorage는 요청 실행 범위에만 client/principal을 보관하며 전역 사용자 singleton을 만들지 않는다. Authenticated server client의 read-only cookie/Proxy refresh 계약은 그대로다. Auth 설정이 없거나 세션이 불명확하면 데이터 접근이 거부되고 admin fallback은 없다. 로그인 화면/redirect·401/429 UI의 일관된 표현은061 범위다.

| File at base001b7ef | Function | Before → after |
| --- | --- | --- |
| src/features/asset-analysis/service.ts:77 | analyzeAsset | USER_REQUESTED → MIGRATED |
| src/features/assets/service.ts:19 | getAssetContext | USER_REQUESTED → MIGRATED |
| src/features/assets/service.ts:48 | listAssets | USER_REQUESTED → MIGRATED |
| src/features/assets/service.ts:77 | uploadAsset | USER_REQUESTED → MIGRATED |
| src/features/assets/service.ts:131 | deleteAsset | USER_REQUESTED → MIGRATED |
| src/features/detail-editor/service.ts:30 | editorContext | USER_REQUESTED → MIGRATED |
| src/features/detail-extraction/retry.ts:59 | retryProductShots | USER_REQUESTED → MIGRATED |
| src/features/detail-extraction/review.ts:23 | getExtractionReview | USER_REQUESTED → MIGRATED |
| src/features/detail-extraction/service.ts:39 | analyzeProductShots | USER_REQUESTED → MIGRATED |
| src/features/detail-extraction/service.ts:157 | saveProductShots | USER_REQUESTED → MIGRATED |
| src/features/detail-renderer/service.ts:23 | getRenderView | USER_REQUESTED → MIGRATED |
| src/features/fact-validation/service.ts:60 | getValidationView | USER_REQUESTED → MIGRATED |
| src/features/fact-validation/service.ts:110 | validateFacts | USER_REQUESTED → MIGRATED |
| src/features/page-planner/service.ts:85 | getPlannerView | USER_REQUESTED → MIGRATED |
| src/features/page-planner/service.ts:143 | planPage | USER_REQUESTED → MIGRATED |
| src/features/product-analysis/service.ts:60 | getProductAnalysisView | USER_REQUESTED → MIGRATED |
| src/features/product-analysis/service.ts:101 | analyzeProduct | USER_REQUESTED → MIGRATED |
| src/features/product-options/import-service.ts:44 | previewImportedOptions | USER_REQUESTED → MIGRATED |
| src/features/product-options/import-service.ts:79 | prepareImportedOptions | USER_REQUESTED → MIGRATED |
| src/features/product-options/persistence.ts:17 | saveProductOptions | USER_REQUESTED → MIGRATED |
| src/features/product-options/queries.ts:35 | getProductOptions | USER_REQUESTED → MIGRATED |
| src/features/products/persistence.ts:79 | saveProductInformation | USER_REQUESTED → MIGRATED |
| src/features/products/queries.ts:17 | getProductDetail | USER_REQUESTED → MIGRATED |
| src/features/projects/actions.ts:21 | createProjectAction | USER_REQUESTED → MIGRATED |
| src/features/projects/queries.ts:22 | getProjects | USER_REQUESTED → MIGRATED |
| src/features/projects/queries.ts:49 | getProjectDashboard | USER_REQUESTED → MIGRATED |
| src/features/section-engine/service.ts:51 | getSectionView | USER_REQUESTED → MIGRATED |
| src/features/section-engine/service.ts:65 | generateSections | USER_REQUESTED → MIGRATED |
| src/features/section-regeneration/context.ts:20 | regenerationContext | USER_REQUESTED → MIGRATED |
| src/features/section-reorder/service.ts:23 | reorderSections | USER_REQUESTED → MIGRATED |
| src/features/wholesale-import/service.ts:53 | importImage | USER_REQUESTED → MIGRATED |

추가 분류: application Auth administration0, background privileged worker0. `tests/*runtime.supabase.mjs`, ownership bootstrap CLI의 auth.admin/SQL/fixture 자격은 TEST_ONLY 또는 MIGRATION_ONLY이며 앱 import graph에 없다. 과거 `tests/options-section.browser.mjs`의 fixture factory는 명시적 admin 이름으로 수정했으나 ownerless/비인증 브라우저 시나리오는 현재 보안 계약으로 실행할 수 없다.064에서 user session fixture로 이전할 대상이며 이번 실제 브라우저 증거로 사용하지 않았다.

## Storage 이전

SDK 호출8개/5파일 모두 user client다. `assets/service.ts` upload/remove/batch sign, `asset-analysis/service.ts` single sign, `detail-extraction/source.ts` single sign+bounded fetch, `detail-extraction/service.ts` Derived upload/remove, `visual-assets/inspection.ts` batch sign이다. SDK list/download/move/copy/update production 호출0, signed download는 검증된 origin/path의 fetch다. 기존 JPEG/PNG/WebP·10MiB·UUID path와 Storage-first 순서를 유지한다.

일반 upload와 Derived/manual crop 저장은 `issueUpload` 이후 사용자 JWT로 Storage upload→Asset INSERT→settle한다. 최초 DB INSERT 응답이 유실되면 같은 사용자로 Asset를 확인한 뒤 settle하며, DB 결과가 불명확한 파일을 지우지 않는다. cleanup 성공 시 release는 실제 Object/Asset가 없는지 DB에서 다시 확인한다. source sign과 AI image URL 발급도 사용자 RLS를 통과한다. thumbnail preview에도 fresh Project scope 확인을 추가했다.

## 유일한 production privileged boundary

`src/lib/abuse/privileged.ts:admissionRpc`의 admin factory 호출 **1개: JUSTIFIED_PRIVILEGED**. 이 모듈은 client나 generic CRUD/Storage 메서드를 export하지 않고 두 RPC 이름(`reserve_admission`, `settle_admission`)만 허용한다. 애플리케이션의 일반 DB/Storage service-role 호출은0이다.

사용자는 승인/예산을 임의 발급하거나 환불할 수 없어야 하므로 RPC EXECUTE는 service_role만 가진다. wrapper 진입 전 `requireCurrentUser(userClient)`와 user-RLS Project/Product 조회, UUID/MIME/bytes 검증을 수행한다. actor는 검증된 principal이고 path/Asset UUID는 서버 생성이다. SQL은 실제 root owner·Product 관계를 재검사하며 설정된 한도를 넘길 수 없다. 오류는 provider/DB 상세를 노출하지 않는다. Secret은 server-only admin module 한 곳에서 읽으며 브라우저로 전달하지 않는다.

이는055의 JWT+HMAC reserve RPC 계획을 이번 요청에서 허용한 좁은 privileged wrapper로 구체화한 선택이다. 사용자의 business CRUD/Storage를 service-role로 실행하지 않는다. 서비스키 자체의 넓은 권한은 남으므로065의 secret provisioning/회전/서버 침해 대응은 필요하다.061/062에서 일반 요청 fallback으로 재사용하면 안 된다. 이 예약 기능을 없애기 위한 미완료 CRUD 이전 항목은 없다.

Section candidate HMAC는 service-role key 파생을 제거하고 별도 `DETAILFORGE_TICKET_SECRET`(32자 이상)을 사용한다. 설정 누락은 fail-closed이고 service-key fallback은 없다. 후보 적용 전에 사용자 Project/Section RLS/scope·revision을 확인한다.

## 원자적 업로드 예약

삭제 후 namespace 탈취도 차단한다. `project_namespace_owners`는 최초 Project owner를 private 보안 기록으로 유지하며 Project DELETE로 지워지지 않는다. BEFORE INSERT trigger는 다른 actor의 UUID 재사용을 거부한다. 기존 orphan의 소유자를 모르면 NULL로 격리하고 추측해 귀속하지 않는다. Storage bytes quota도 이 기록으로 계산하므로 Project 삭제로 자기 용량을 줄일 수 없다. 같은 actor의 복원은 허용되며 새 owner로 이전하는 공개 API는 없다. 이 기록과 trigger는 사용자에게 직접 조회/수정/실행 권한이 없다.

0009는 `app_private.admission_limits`와 `admissions`를 추가한다. 둘 다 RLS enabled, public/anon/authenticated/service_role 직접 CRUD 권한0이다. migration에는 limits row가 **없다**. 운영자가 명시적으로 유한한 값을 provisioning하기 전 upload/paid admission은 닫힌다. **이 숫자가 최종 SaaS pricing entitlement가 아니다.** 로컬 테스트 값도 운영 요금제가 아니다.

`reserve_admission`은 단일 limits row를 FOR UPDATE로 잠근다. 따라서 여러 프로세스의 user/global check와 예약 INSERT가 한 transaction으로 직렬화된다. process-local Set은 기존 UX 중복 방지용일 뿐 quota 증거가 아니다.

| 제한 | 계산 |
| --- | --- |
| 사용자/전체 upload concurrency | 미소진·미만료 intent + ledger가 있으면 reserved·미만료 상태; 이전0008 승인도 포함 |
| 사용자/전체 bytes | 실제 Object와 pending/uncertain/expired 예약 path의 UNION, 경로당10MiB |
| Product slot | 실제 Object + 예약 + Asset DB path의 UNION, 기존 제품 상한30개 |
| upload rate | actor별 최근1시간 발급 수; 취소/실패도 차감 유지 |
| upload maximum | bucket10MiB와 기존 MIME/파일 시그니처 검사 |
| reservation expiry | 서버 생성10분; 최대값을 사용자가 선택하지 않음 |

사용자 size 주장 대신 bucket 최대10MiB를 예약하므로 작은 bytes로 승인받아 큰 파일을 올려 한도를 우회할 수 없다. Path는 기존 canonical 구조를 따른다. Asset UUID 및 actor+operation+request key UNIQUE가 중복 발급을 막는다.

`consume_storage_admission`은 새 ledger-backed path의 실제 storage.objects INSERT에서 row lock 후 upload_written을 한 번만 설정한다. Storage permission probe가 rollback되면 소비도 rollback된다. 실제 INSERT 후 Object를 삭제해도 같은 승인으로 다시 upload할 수 없다. 이는 public 데이터 helper를 확장한 것이 아니라 ledger bit만 조작하는 trigger다. SECURITY DEFINER/고정 빈 search_path/완전한 qualified SQL/직접 EXECUTE revoke를 적용했고 managed table ownership은 바꾸지 않았다. 이전0008의 ledger 없는 승인/legacy Object는 보존한다.

Asset INSERT의0008 finalizer가 승인 소진을 기록한다. settle consumed는 기한과 정확한 Asset/path/finalized intent를 재검사한다. release는 Storage/Asset table write lock 아래 Object/Asset 부재를 확인하고 승인 삭제와 ledger 상태 변경을 같은 transaction에서 수행한다. 명확하지 않으면 quota를 유지한다. 애매한 요청을 자동 재업로드하지 않는다.

### 만료된 방치 예약의 안전한 회수 — HIGH finding 수정

기존 구현은 미소진 intent를 만료 여부와 무관하게 슬롯으로 계산하고, `expire_admissions`가 상태만 바꿨다. 따라서 업로드 없이 연결을 끊으면 슬롯/bytes가 영구 점유될 수 있었다. 이 finding을 수정했다.

슬롯은 **지금 사용할 수 있는 업로드 동시성**이다. intent와 연결된 admission이 모두 유효해야 계산한다. 만료된 승인에 Object가 남아 있어도 활성 슬롯은 반환하지만, **storage footprint bytes는 계속 계산**한다. 기존 ledger 없는0008 intent 역시 만료되면 활성 슬롯에서 제외하며, 소유/footprint 불확실성이 있는 legacy bytes는 자동 추정 환불하지 않는다.

`expire_admissions`는 service-only maintenance RPC이며, production `reserve_admission`의 upload 분기도 한도 검사 전에 같은 함수를 호출한다. 따라서 원래 요청자의 settle 또는 별도 scheduler 없이 다음 정상 요청이 방치된 용량을 회수할 수 있다. 회수는 다음을 모두 만족하는 upload ledger에만 적용된다.

- `expires_at <= clock_timestamp()`이고 state가 reserved/uncertain/expired이다.
- 해당 bucket/path의 `storage.objects`가 없다.
- 해당 Asset ID **또는** storage_path와 일치하는 `public.assets`가 없다.

이때만 unfinalized intent를 삭제하고 admission을 terminal `released`로 변경한다. 슬롯/예약 bytes/Product path 예약이 반환된다. ledger 자체와 request key·발급 시각은 보존하므로 replay 및 시간당 rate 예산은 환불되지 않는다. Object 또는 Asset이 있으면 `expired`의 charged 상태를 유지하며 파일·Asset·finalized intent는 삭제하지 않는다. Object 없는 finalized Asset도 자동 환불을 막는다. 불명확한 DB 오류/잠금 timeout은 transaction 실패로 처리하며 반환하지 않는다. AI expiry는 기존 concurrency lease 종료/시간당·일일 비용 유지 계약을 따른다.

Lock 순서는 **limits row → storage.objects SHARE ROW EXCLUSIVE → public.assets SHARE ROW EXCLUSIVE → admission/intent row**다. Storage INSERT는 RowExclusive table lock 후 admission trigger row lock을 얻으므로 cleanup이 먼저 admission row를 잠그는 역순을 피한다. Asset INSERT/finalization과도 직렬화한다. 쓰기가 먼저면 commit 후 새 snapshot에서 Object/Asset을 보고 charge를 유지한다. cleanup이 먼저면 이후 Storage INSERT는 released admission/삭제된 intent 때문에 거부된다. `settle_admission(released)`도 동일 순서를 적용했다. READ COMMITTED 외 isolation은 오래된 snapshot으로 absence를 증명하지 않도록 명시적으로 거부한다. expiry lock timeout은5초이며 오류를 숨기고 승인하는 fallback은 없다.

실제 Local runtime ABUSE-01~06: 방치3건 회수 후 재예약, user/global 각각31,457,280 bytes 반환, Object/Asset 보존과 계속된 bytes 차감, PostgreSQL 양방향 lock 순서 경합, 실제 Storage HTTP 동시 요청8회, 반복 disconnect5주기/15건 후 다른 사용자의 예약 성공을 확인했다. PostgreSQL 경합은 별도 fixture SQL 세션으로 production Storage INSERT trigger의 transaction 시점을 통제하고 실제 lock wait를 확인한다. 일반 서비스/HTTP 검증은 실제 A/B JWT를 쓴다. unsafe refund+live Object 결과0. 상세 증거는 `artifacts/TASK-060/runtime.json`의 `abuse`다.

## AI admission과 비용 상한

실제 OpenAI provider7개, 유료 호출 진입점8개(추출 retry 포함)다. 모두 owned resource 조회·기존 schema/크기 상한 후 `withPaidOperation`을 거쳐 dispatch한다. provider factory 생성 자체는 네트워크 호출이 아니다.

| Operation | max_output_tokens | 기존 추가 경계 |
| --- | --- | --- |
| Asset analysis | 4000 | scoped Asset/sign,10MiB |
| Product analysis | 7000 | bounded evidence/coverage |
| Fact Validation | 16000 | bounded targets/evidence |
| Page Planner | 10000 | current validated input |
| Section Engine | 16000 | bounded planned sections |
| Section regeneration | 6000 | owned Section/revision/candidate |
| Extraction / retry | 4000/타일 | source10MiB/40MP,최대16타일,타일45초 |

provider SDK의 maxRetries0·기존 timeout/Structured Outputs를 유지한다. admission의 최종 직렬화 상한은16MiB이며 기존 operation schema가 더 좁은 의미/수량 상한을 적용한다. 사용자/전체 동시 실행과 최근1시간·1일 호출 수를 같은 DB lock 아래 검사한다. 추출은 실제 dispatch되는 타일별로 예약한다. 통화 청구/실제 token 정산 시스템이 아니라 bounded-call admission이다. 운영 model·입출력 상한에 맞춰 한도를 정해야 하며 금액 기반 요금제를 완성했다고 주장하지 않는다.

성공은 consumed, provider 오류/timeout/응답 불명확은 uncertain이다. uncertain도 시간당/일일 비용 횟수에 포함되며 자동 refund가 없다. concurrency lease는10분으로 각 bounded provider 요청보다 길다. 만료 뒤 동시성 슬롯은 회수 가능하지만 비용 기록은 시간 창 동안 유지한다. 실제 외부 서비스의 exactly-once 완료를 보장하지 않는다.

요청 key는 actor+operation+Project+input hash+generation에 결합된다. 기본 generation은 서버의 분 단위 bucket이므로 같은 입력/operation의 동일 분 재전송은 다시 dispatch되지 않는다. 새 분의 명시적 재실행은 새 요청으로 계산한다. durable generation key 인자를 사용하는 내부 호출도 지원한다. 사용자가 request key로 owner/path/승인을 선택할 수 없다. 동일 key, expired/consumed/uncertain key 재사용은 reject하며 terminal settle은 idempotent다. 임의 입력 변경은 새 요청이지만 quota를 다시 차감한다.

Domeggook/wholesale HTTP·browser fallback은 기존 bounded fetch/SSRF/timeout과 사용자 scope 검증을 유지하며 OpenAI dispatch 집계에 포함하지 않는다. Export Chromium의 session/grant 전파는062 범위다. 현재 renderer가 사용자 client를 요구하므로 비인증 내부 capture는 실패하며 admin fallback으로 복원하지 않는다.

## 실제 검증과 범위

격리 project detailforge-task060, API127.0.0.1:58421/DB58422, linked project 거부, PG 환경 오염 제거, .env.local credential 미사용, local fetch/redirect:error를 사용했다. 실제 GoTrue 사용자2명과 public anon-key+JWT로 application query/service를 호출했다. tests의 withUserClient DI도 실제 getUser 검증을 수행하며 가짜 principal은 사용하지 않는다. 일반 DB/Storage 요청의 service-role0, privileged RPC만 별도로 집계한다.

실제 서비스/SQL37 checks PASS, SRV-01~20 전체 PASS. Upload limit3에12개 동시 요청→3성공/9거부/정리 후 active0. AI limit2에8개 동시 요청→2성공/6거부. bytes cap도 기존 Object1개+예약2개까지만 허용했다. 실제 analyzeAsset가 fake provider1회에 도달했고 foreign/over-limit/anon/missing/invalid 요청은 provider0회였다. 외부 AI 호출0.

최종0009 primary에서 기존 RLS143 checks, Storage74 checks PASS. 기존 실행기의 platform clone과 public trigger 개수 scope를 후속 private schema에 맞게 조정했으며 실제 정책·grants·owner 불변성 검사는 약화하지 않았다. Storage 검사는 새 ledger trigger의 definer/ACL/search_path를 명시적으로 검사한다. Fresh0001~0009 및 기존 Object/Asset/intent가 있는0008→0009 upgrade에서 snapshot/bytes 보존을 확인했다.

공식 harness1476 tests PASS(기존1470+guard/경계6), typegen/typecheck/lint/build/diff/secret/client bundle PASS. 기존 feature unit tests는 loopback mock infrastructure와 admission mock을 사용한다. 그 mock 결과를 보안 증거로 사용하지 않고 위 실제 runtime으로 별도 검증했다. 실제 production 이미지·AI·브라우저 전체 workflow를 다시 실행한 것은 아니다.

남은061 Auth UX,062 Export,063 cross-user browser E2E,064 own-user 전체 workflow,065 설정·release/rollout 전까지 **Public SaaS deployment remains BLOCKED**.

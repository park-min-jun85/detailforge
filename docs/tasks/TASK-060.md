# TASK-060 — User-scoped Data Access / Privileged Boundary / Cost-Abuse Controls

2026-09-26 · C:\Projects\detailforge · package0.2.1.

## 1. Status

**TASK-060 COMPLETE. Public SaaS deployment remains BLOCKED.** 일반 DB/Storage 사용자 경로 이전, 실제 승인 발급·원자적 quota, 실제 Local 서비스/동시성/RLS/Storage·전체 회귀를 완료했다. [상세 계약·31개 호출별 before/after](../V0_3_USER_SCOPED_ACCESS_AND_ABUSE_CONTROL.md).

## 2. Privileged inventory before

기준001b7ef를 AST로 재검사한 factory 호출31개. 모두 user-requested data access이며 production auth.admin0/background privileged worker0이다. Storage SDK8개/5파일도 전부 이전 대상이었다. 함수·파일·당시 줄 번호는 위 계약의31행 표와 ignored artifacts/TASK-060/inventory.json에 기록했다. test/fixture/admin CLI는 production import graph와 분리했다.

## 3. Privileged inventory after

31/31 **MIGRATED**. 일반 business CRUD/Storage admin 사용0. `src/lib/abuse/privileged.ts:admissionRpc` 1개만 **JUSTIFIED_PRIVILEGED**이며 user getUser/RLS scope 검증 이후 reserve/settle RPC만 호출한다. Generic admin alias와 candidate의 service-key HMAC 의존은 **REMOVED**. migration/local fixture는 **MIGRATION_ONLY/TEST_ONLY**다. 일반 data access의 **DEFERRED0**. 로그인 UX·Export capture session/grant·기존 비인증 브라우저 QA는061/062/064 범위로 남는다.

## 4. Files

신규: user client/context, admission service/privileged wrapper,0009, local stack/helper/runtime/security tests 및 mock adapters, 본 보고서와 계약이다. 수정: 모든31개 호출과 관련 Client 타입, Project action, 전용 HMAC env, 기존 테스트 adapters/runtime의 최신 schema 호환, 기존 보안/작업 문서다. 삭제: privileged compatibility alias1개. Dependency/package/lock 변경0.

신규13 / 수정49 / 삭제1.

신규:

- `docs/V0_3_USER_SCOPED_ACCESS_AND_ABUSE_CONTROL.md`
- `docs/tasks/TASK-060.md`
- `scripts/admission-local-stack.mjs`
- `src/lib/abuse/admission.ts`
- `src/lib/abuse/privileged.ts`
- `src/lib/supabase/user.ts`
- `supabase/migrations/0009_enforce_admission_control.sql`
- `tests/admission-runtime.supabase.mjs`
- `tests/admission-security.test.mjs`
- `tests/helpers/admission-abuse.mjs`
- `tests/helpers/admission-local.mjs`
- `tests/helpers/admission-mock.mjs`
- `tests/helpers/user-data-mock.mjs`

수정:

- `.env.example`
- `README.md`
- `docs/03_DATABASE.md`
- `docs/06_CODING_RULES.md`
- `docs/RELEASE_BACKLOG.md`
- `docs/V0_3_AUTH_CONTRACT.md`
- `docs/V0_3_PUBLIC_SAAS_ARCHITECTURE.md`
- `docs/V0_3_STORAGE_SECURITY.md`
- `docs/V0_3_THREAT_MODEL.md`
- `docs/tasks/README.md`
- `docs/tasks/TASK-059.md`
- `src/features/asset-analysis/service.ts`
- `src/features/assets/metadata.ts`
- `src/features/assets/service.ts`
- `src/features/detail-editor/service.ts`
- `src/features/detail-extraction/persistence.ts`
- `src/features/detail-extraction/product-context.ts`
- `src/features/detail-extraction/retry.ts`
- `src/features/detail-extraction/review.ts`
- `src/features/detail-extraction/service.ts`
- `src/features/detail-extraction/source.ts`
- `src/features/detail-renderer/service.ts`
- `src/features/fact-validation/service.ts`
- `src/features/page-planner/service.ts`
- `src/features/product-analysis/service.ts`
- `src/features/product-options/import-service.ts`
- `src/features/product-options/persistence.ts`
- `src/features/product-options/queries.ts`
- `src/features/products/persistence.ts`
- `src/features/products/queries.ts`
- `src/features/projects/actions.ts`
- `src/features/projects/queries.ts`
- `src/features/section-engine/persistence.ts`
- `src/features/section-engine/service.ts`
- `src/features/section-regeneration/candidate.ts`
- `src/features/section-regeneration/context.ts`
- `src/features/section-regeneration/service.ts`
- `src/features/section-reorder/service.ts`
- `src/features/visual-assets/inspection.ts`
- `src/features/wholesale-import/service.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/database.types.ts`
- `tests/auth-foundation.test.mjs`
- `tests/detail-extraction-checkpoint-persistence.test.mjs`
- `tests/options-section.browser.mjs`
- `tests/register.mjs`
- `tests/rls-runtime.supabase.mjs`
- `tests/storage-runtime.supabase.mjs`
- `tests/visual-assets.test.mjs`

삭제:

- `src/lib/supabase/server.ts`

## 5. Auth/user-scoped architecture

Request cookie→SSR public client→GoTrue getUser→AuthenticatedPrincipal→동일 JWT DB/Storage RLS. Request body/query의 owner/user/path 주장은 권한 근거가 아니다. Project 생성 action도 principal을 연결했다. Auth 설정/세션 누락은 fail-closed이고 admin fallback0. AsyncLocalStorage의 server-only DI 역시 getUser 검증을 거친다. Cookie refresh 계약은056과 같다.

## 6. Upload admission

Project 삭제 후에도 최초 owner의 namespace 보안 기록을 유지한다. 다른 사용자의 Project UUID 재사용과 orphan 파일 소유권 탈취를 차단하며, 남은 bytes는 원래 사용자 quota에 계속 포함한다. 실제 삭제→foreign UUID 재사용→download/새 예약 공격을 검증했다.

verified actor→user-RLS Project/Product→서버 UUID/path→DB atomic reservation+10분 intent→JWT upload→Asset finalizer→consume. 파일 크기 주장 대신 경로당10MiB cap을 예약한다. 삭제 후 동일 승인 재업로드는 Storage INSERT trigger의 upload_written으로 거부한다. terminal settle은 idempotent, 동일 reservation key/Asset UUID는 중복 발급 불가다.

HIGH review의 방치 예약 영구 점유 문제를 수정했다. `expire_admissions`는 만료된 reserved/uncertain/expired upload에서 Object 경로와 Asset ID/경로가 모두 없을 때만 unfinalized intent를 삭제하고 `released`로 전환한다. Object 또는 Asset이 있으면 charged expired로 유지하며 삭제/환불하지 않는다. 슬롯은 미만료·사용 가능한 승인만 계산하고 bytes와 분리한다. 따라서 만료된 Object는 슬롯을 계속 잡지 않지만 bytes는 계속 차감한다. 새 upload reserve에도 같은 회수를 연결하여 scheduler나 원래 요청자의 settle 없이 다음 정상 요청에서 회수한다. rate/replay 기록은 유지한다.

limits row→Storage table→Asset table→admission/intent row 순서로 잠그고 absence를 확인한다. Storage/Asset 쓰기와 충돌하는 SHARE ROW EXCLUSIVE를 쓰며, READ COMMITTED 외 isolation과 잠금 실패는 거부한다. `settle(released)`도 같은 lock 순서/Asset ID 또는 path 검사를 적용했다. Object/Asset이 먼저 commit하면 charge를 유지하고, 회수가 먼저 commit하면 후속 Storage INSERT는 거부된다.

## 7. Abuse/cost control

limits singleton FOR UPDATE로 user/global check와 INSERT를 한 transaction으로 직렬화한다. Upload user/global slots·bytes, 기존 Product30 paths, user 시간당 upload 발급 수, AI user/global concurrency·시간당/일일 call budget을 검사한다. Migration은 config row를 넣지 않아 운영 설정 전 admission이 닫힌다. **이 숫자가 최종 SaaS pricing entitlement가 아니다.** 상세 필드·계산·실패/만료 처리 및 운영 선택은 계약 문서 참조.

## 8. AI/Paid operations

Asset/Product analysis, Fact Validation, Planner, Section Engine, regeneration, extraction와 retry의8개 dispatch를 보호했다. 실제 resource 조회→기존 schema/입력 상한→admission 후에만 provider에 진입한다. provider7개 모두 기존 output cap/timeout/maxRetries0 유지. 추출은 타일별 예약이다. 실제 analyzeAsset own 호출만 fake provider1회; foreign/over-limit 거부 경로의 provider0회. 외부 OpenAI/provider 호출0. 시간당/일일 호출 수 상한이며 통화 청구 정산이나 가격 정책을 구현한 것은 아니다.

## 9. Runtime security matrix

실제 Local GoTrue password session의 A/B public anon-key+JWT/getUser와 무세션 anon, 실제 PostgREST/Storage API를 사용했다. application service 검증에 admin 데이터 client를 주입하지 않았다. acceptance 일반 admin DB0/Storage0, 좁은 admission/maintenance RPC는 별도 집계128회다. 결정적인 DB 경쟁 테스트만 fixture SQL 세션으로 transaction 시점을 통제하며 production Storage INSERT trigger와 실제 table-lock 대기를 검사한다.

| Matrix | 결과·이유 |
| --- | --- |
| SRV-01 | PASS — own Project application 목록 |
| SRV-02 | PASS — 양방향 foreign exact Project404 |
| SRV-03 | PASS — own Product service read |
| SRV-04 | PASS — foreign Product not-found |
| SRV-05 | PASS — own sign과 실제 bytes |
| SRV-06 | PASS — foreign sign 차단 |
| SRV-07 | PASS — 실제 issue→JWT upload→Asset→consume |
| SRV-08 | PASS — foreign Product는 privileged RPC 전 거부 |
| SRV-09 | PASS — fabricated parent 거부, 서버 생성 UUID/path |
| SRV-10 | PASS — 동시 upload 예약3/12 |
| SRV-11 | PASS — expired consume 거부·보수적 cleanup |
| SRV-12 | PASS — replay 거부·중복 settle 무효 |
| SRV-13 | PASS — own analyzeAsset→fake provider1회 |
| SRV-14 | PASS — 양방향 foreign AI provider0 |
| SRV-15 | PASS — quota 초과 AI provider0 |
| SRV-16 | PASS — anon 서비스 실행 전 거부 |
| SRV-17 | PASS — missing/invalid session 거부 |
| SRV-18 | PASS — 일반 DB admin 사용0 |
| SRV-19 | PASS — 일반 Storage admin 사용0 |
| SRV-20 | PASS — denied provider call0 |

추가17 checks: fresh/upgrade/bytes 보존, private ACL, 설정 누락, bytes quota, Storage delete-reupload replay, AI concurrency, local guard, own delete, 삭제된 namespace 탈취/용량 우회 차단 및 ABUSE-01~06. 합계 **37 checks PASS**.

| Abuse matrix | 실제 Local 결과 |
| --- | --- |
| ABUSE-01 | PASS — limit3까지 무업로드 예약 후 expiry/cleanup,3건 released·intent 제거·새 예약 성공. 미만료 예약은 유지 |
| ABUSE-02 | PASS — uncertain 포함3건의 user/global 예약 용량 각각31,457,280 bytes 반환, 동일3건 재예약 가능 |
| ABUSE-03 | PASS — expired Object 실제 bytes 보존·10MiB charge 유지, active slot0, user/global bytes 한도 각각 계속 강제 |
| ABUSE-04 | PASS — Object 없는 finalized Asset도 보존·10MiB charge 유지·추가 예약 거부 |
| ABUSE-05 | PASS — INSERT 선행 시 Object 유지/charge, cleanup 선행 시 INSERT 거부; PostgreSQL lock wait 확인, 실제 Storage HTTP 경합8회, unsafe 결과0, stale isolation 거부 |
| ABUSE-06 | PASS — reserve/disconnect5주기·15건, 별도 settle/cleanup 없이 다음 reserve가 회수. 다른 사용자 예약 성공 |

ABUSE baseline은 기존 own Object10MiB/global Object·intent30MiB/legacy active intent1개이며, 회수 후 정확히 이 값으로 복원됐다. 기존 fixture의 용량까지0으로 환불한 것이 아니다. 최종 teardown 후 전체 fixture 잔여0은 별도로 검증한다.

## 10. Concurrency

Upload configured limit3, 동시12→성공3/거부9, active intents3→release 후0. AI limit2, 동시8→성공2/거부6. 별도 bytes cap에서 기존 Object1개를 포함해 추가2개만 승인했다. 모든 임시 Project/Object/intent/admission과 A/B 계정을 정리했고 primary 잔여0을 SQL로 확인했다. 모의 count만으로 판정하지 않았다.

## 11. RLS regression

**TASK-058 actual143 checks PASS**, 최종0009가 적용된 primary에서 A/B/anon CRUD 및 원래7-table 정책28개·권한·불변성을 확인했다. 테스트용 platform 복제에서 후속 app_private와 애플리케이션 Storage 정의를 제외하고, trigger 수는 원래7개 public table로 한정했다. 초기 실패는 이 복제/개수 전제였으며 실패 run의 계정도 정리했다. 정책/grant를 완화해 통과시킨 것은 아니다.

## 12. Storage regression

**TASK-059 actual74 checks PASS**, 최종0009 primary에서 own/foreign/anon upload/read/sign/list/delete/path/integrity를 확인했다. 새로운 consume_storage_admission trigger의 definer·고정 search_path·직접 EXECUTE 차단을 명시적으로 검사했다. 이전0008의 test-only trusted intent 계약은 유지되고 새 issuer의 단일 upload 소비는060 runtime에서 추가 검증했다.

## 13. Migration

0009 하나 추가,0001~0008 변경0. Fresh0001~0009 PASS. 최초0008→0009 upgrade snapshot·Object bytes 보존에 이어, HIGH 수정 재검증에서는 보존된0009 로컬 볼륨에 최종 reserve/settle/expire 함수 본문을 재적용하고 기존7-table rows/Object/intent/policies 및 Object bytes 보존을 다시 확인했다. Fresh clone에는 수정된0009 전체를 실행했다. bucket recreate/Object 이동·삭제/기존 Asset 변환0. managed table owner 유지. 신규 private ledger와 좁은 definer RPC/trigger의 ACL을 검사했다. 운영 config row와 remote migration 적용0.

## 14. Regression

공식 전체 **1476/1476 tests PASS**, fail0/skip0. typegen/typecheck/lint/build PASS, diff-check/secret/client bundle scan PASS. Auth client bundle57 modules/590630 bytes/serverModules0/secretMarkers0. 기존 원본4개·fixture patch3개 hash 보존. 기존 feature 회귀는 admission mock을 쓰며 실제 보안/동시성 증거와 구분한다. 실제 AI·production 이미지·전체 browser Export 재검증0.

## 15. Security findings

- BLOCKER:061 인증 UX/진입점 표현,062 Export grant/JWT 전파,063~065 통합·운영 release gate 미완료.
- HIGH FIXED: abandoned upload의 영구 slot/bytes 점유를 absence proof + write serialization + on-demand reclaim으로 수정하고 ABUSE-01~06을 실제 DB/Storage에서 검증했다. 첫 추가 테스트 실행은 DB-only race fixture의 직접 Storage row 삭제가 platform 보호에 거부되어 실패했으며, Storage API 정리로 수정 후37개 전체가 통과했다. 실패 run 계정/fixture도 정리했다.
- HIGH 운영 gate: quota/model/provider cap·secret provisioning은 배포 전에 확정해야 한다. 설정 없는 upload/AI는 닫힌다.
- MEDIUM: 실제 Object/Asset이 남아 있거나 DB 확인이 불명확한 용량은 유지되어 운영 reconciliation이 필요하다. 테이블 write lock으로 인한 부하와 대규모 cleanup 성능, 모든 constraint/timing 존재 추론을 해결한 것은 아니다. signed bearer URL의 TTL 위험은 그대로다.
- LOW: 이번 범위에서 별도 미해결 LOW 없음.

## 16. Mutation

Remote DB0 / Remote Auth0 / Remote Storage0 / actual external AI/provider0. Local fixture/DDL만 변경했다. TASK-058/059/060 전용 primary의 테스트 Auth/Project/Object/intent/admission 잔여0. 전용 스택만 backup 유지 방식으로 종료하며 증거 DB/Storage volumes를 보존했다. 다른 프로젝트를 대상으로 stop/delete를 실행하지 않았다. namespace 보안 기록은 유지한다.

## 17. Remaining Public SaaS blockers

TASK-061 Login/Signup/Logout/protected UX,062 Export authorization,063 cross-user Security E2E,064 own-user full workflow,065 release/운영 config·rollout/secure rollback. **Public SaaS deployment remains BLOCKED**.

## 18. Git

Branch feat/user-scoped-service-role-migration, HEAD/main001b7efe3634c1785e19c9f9f5e148006f1308ec 유지. cached origin/main8906c0cee85b01281f2ddfa557469482cb58a981은 시작 상태 그대로이며 fetch/push0. 시작 tree clean. 작업 파일은 미스테이징 상태로 남긴다. stage/commit/merge/tag0, reset/restore/clean 미사용.

## 19. Next

**TASK-061 — Auth UX / protected routes.** 현재 verified principal/user-data contract에 로그인·회원가입·로그아웃·보호 화면을 연결한다. Export를 admin fallback으로 우회하지 않으며062의 별도 JWT/grant 전달 계약을 구현해야 한다.

재현: Docker Desktop와 local CLI/PostgreSQL 도구 준비 후 아래 실행. .env.local을 로드하지 않으며 모든 네트워크는 고정 loopback이다.

```powershell
node scripts/admission-local-stack.mjs start
node --conditions=react-server --import ./tests/register.mjs tests/admission-runtime.supabase.mjs
node scripts/admission-local-stack.mjs stop
node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs
npx.cmd next typegen
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
node tests/auth-browser-bundle.mjs
git diff --check
```

058/059는 각 기존 stack wrapper를 사용하며 이번 회귀는 primary에0008/0009를 적용한 상태였다. 증거: ignored artifacts/TASK-060의 runtime.json,rls-runtime.json,storage-runtime.json,inventory.json,final-state.json,audit.json 및 로그. Fresh clone은 platform-only schema에서 해당 migration chain을 다시 검증한다.

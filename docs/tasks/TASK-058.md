# TASK-058 — User-scoped Database RLS Security Boundary

2026-09-24 · `C:\Projects\detailforge` · `feat/database-rls` · package 0.2.1 유지.

## 1. Status

**TASK-058 COMPLETE. Public SaaS deployment remains BLOCKED.**

7-table DB authorization, owner/parent/PK/path 불변성, 실제 A/B session JWT·anon PostgREST 검증, fresh/upgrade 무손실 적용, 전체 앱 회귀와 secret 검사를 완료했다. 사용자 RLS 판정에 service_role을 사용하지 않았다. 원격 적용은 하지 않았다. [DB security contract](../V0_3_DATABASE_RLS_SECURITY.md)에 실제 inventory, 전체 policy/grant matrix, 보안 한계와 운영 전제를 기록했다.

## 2. Files

신규:

- `supabase/migrations/0007_enforce_database_ownership.sql`: 원자적 preflight/NOT NULL/복합 FK/path 제약/불변 trigger/28 RLS policies/CRUD grants.
- `tests/rls-runtime.supabase.mjs`: 실제 Local Auth/PostgREST security + fresh/upgrade assertions.
- `tests/helpers/rls-local.mjs`: loopback 전용 연결·catalog inventory, env/출력 분리.
- `scripts/rls-local-stack.mjs`: 별도 cache project 시작/종료, credential 출력 차단, volume 보존.
- `docs/V0_3_DATABASE_RLS_SECURITY.md`, `docs/tasks/TASK-058.md`.

수정:

- `src/lib/supabase/database.types.ts`: 실제 CLI 생성 결과의 owner 필수/non-null, Asset composite relationship. 기존 metadata hint 유지.
- `src/features/projects/legacy.ts`: owner 없는 legacy create를 DB 요청 전 차단. TASK-060/061 연결 필요.
- `tests/project-ownership.test.mjs`: finalized owner type 및 ownerless bridge 차단을 검증.
- `tests/ownership-runtime.supabase.mjs`: 과거 0001~0006 타입 비교는 TASK-057 commit의 Stage A 기준으로 고정. 현재 스키마 비교는 새 058 runtime 담당.
- `README.md`, `docs/03_DATABASE.md`, `docs/RELEASE_BACKLOG.md`, `docs/V0_3_OWNERSHIP_CONTRACT.md`, `docs/V0_3_PUBLIC_SAAS_ARCHITECTURE.md`, `docs/V0_3_THREAT_MODEL.md`, `docs/tasks/README.md`: 최신 상태/전환 제약/다음 TASK 반영.

기존 0001~0006 migration, package/lock version/dependency, 원본/Derived 이미지, fixture bytes를 변경하지 않았다. ignored artifacts는 Git 대상이 아니다.

## 3. Database security

Source와 실제 catalog를 구현 전에 조사했다. 최초 7개 모두 RLS ENABLED지만 사용자 정책 0개, anon/authenticated grant 0개였고 service_role ALL이었다. `detail_pages`에 product_id는 없고 `sections`에는 detail_page_id만 있다. Asset만 두 parent scope를 갖는다.

| Table | RLS | SELECT | INSERT | UPDATE | DELETE | Ownership chain |
| --- | --- | --- | --- | --- | --- | --- |
| projects | ENABLED | own | own new owner | old/new own + immutable owner | own | owner_id = auth.uid() |
| products | ENABLED | own | own parent | old/new own + immutable FK | own | Product → Project |
| product_facts | ENABLED | own | own parent | old/new own + immutable FK | own | Fact → Product → Project |
| assets | ENABLED | own, same Project | own, same Project/Product | old/new own + immutable FKs/path | own | Asset → Product + Project consistency |
| detail_pages | ENABLED | own | own parent | old/new own + immutable FK | own | Page → Project |
| sections | ENABLED | own | own parent | old/new own + immutable FK | own | Section → Page → Project |
| product_options | ENABLED | own | own parent | old/new own + immutable FK | own | Option → Product → Project |

모든 테이블의 grants는 anon/PUBLIC 없음, authenticated CRUD만, service_role 기존 ALL 유지다. 각 CRUD policy를 분리했고 UPDATE는 USING/WITH CHECK 양쪽을 검사한다. 별도 권한 상승 ownership helper는 없다. 7개 invoker trigger는 owner/PK/parent/path 재지정을 같은 owner 범위에서도 막는다. Asset에는 복합 FK와 엄격한 path CHECK/UNIQUE를 추가했다. 실제 함수 owner/proconfig/execute 및 role/catalog는 산출물에 기록했다.

## 4. Runtime security test

실제 Supabase PostgreSQL 17.6 + GoTrue + PostgREST, API `127.0.0.1:57321`, DB `127.0.0.1:57322`, 전용 project `detailforge-task058`를 사용했다. A/B는 각각 실제 signInWithPassword의 session/access token을 얻고 getUser로 검증했다. SDK 데이터 client에는 public anon key와 각 session을 사용했고, anon은 같은 key에 session이 없다. mock JWT/SET ROLE/관리자 client 결과로 사용자 RLS PASS를 대체하지 않았다.

**최종 runtime: 143 checks PASS, 0 FAIL.** 최종 실행은 `--write-types` 없이 현재 source와 실제 재생성 타입을 독립 비교했다. 최초 생성은 같은 runner의 `--write-types`를 사용했다. DB type helper의 포맷 변화도 actual generator 결과다.

| Matrix | 결과 | 실제 검증 |
| --- | --- | --- |
| RLS-01 | PASS | A/B own Project list/read, 양방향 foreign SELECT 0 rows |
| RLS-02 | PASS | owner_id=B Project INSERT 42501 |
| RLS-03 | PASS | A→B owner UPDATE 23514 |
| RLS-04 | PASS | own delete 성공, foreign delete 0 rows, B row 보존 |
| RLS-05 | PASS | foreign Product exact read/update/delete 차단, insert/upsert 거부 |
| RLS-06 | PASS | foreign Facts exact read/write 및 parent insert/upsert 거부 |
| RLS-07 | PASS | A Project+B Product/역방향/같은 owner 다른 Project INSERT/UPDATE 거부 |
| RLS-08 | PASS | 실제 Page Project scope 차단; product_id 없음 확인, dual-scope 세부 CASE N/A |
| RLS-09 | PASS | foreign Page의 Section read/insert/update/delete/upsert 차단 |
| RLS-10 | PASS | foreign Product Option CRUD/upsert 차단 |
| RLS-11 | PASS | 7개 테이블 anon SELECT 42501 |
| RLS-12 | PASS | 7개 테이블 anon INSERT/UPDATE/DELETE 42501 |
| RLS-13 | PASS | A/B 양방향 7-table foreign exact UUID 및 missing UUID의 read/update/delete 모두 동일 0 rows |
| RLS-14 | PASS | 모든 실제 child FK foreign/same-owner reassignment 및 Asset project_id 변경 거부 |
| RLS-15 | PASS | A/B 둘 다 7-table INSERT/SELECT/UPDATE/DELETE 성공, A2 graph 추가 |
| RLS-16 | PASS | effective table/column grants, anon privilege0, authenticated CRUD만, service_role 유지 |
| RLS-17 | PASS | 정확히 28 policies, role/operation/USING/WITH CHECK 확인 |
| RLS-18 | PASS | 7-table RLS enabled, 사용자 role bypass/owner/CREATE 없음 |
| RLS-19 | PASS | 빈 app DB에서 0001~0007 원문 적용, final catalog 검증 |
| RLS-20 | PASS | Stage C existing fixture에 0007 적용, 7-table 모든 column/ID/owner/timestamp exact 보존 |

추가로 PK/path 불변성, foreign Project ID를 own owner로 claim하는 UPSERT, foreign Asset UPSERT, 정상 same-parent UPSERT, ownerless insert, parent delete cascade, 나쁜 legacy graph/path/NULL gate, raw migration repeat, invoker function ACL을 검증했다. 관리자 composite FK sanity는 별도 부가 검사로 표시했고 RLS acceptance의 대체물이 아니다.

재현 명령(Windows, 설치된 Docker Desktop·Supabase CLI·psql/pg_dump 필요):

```powershell
Set-Location C:\Projects\detailforge
node scripts/rls-local-stack.mjs start
node tests/rls-runtime.supabase.mjs
node scripts/rls-local-stack.mjs stop
```

새 cache workdir이면 wrapper가 CLI init 후 project ID, ports 5732x, seed=false를 설정한다. repository migration을 CLI start에 자동 복사하지 않는다. runner가 직접 격리 DB에 적용하며 linked project/.env.local을 쓰지 않는다. PG_BIN은 필요시 psql/pg_dump binary directory만 지정한다. CLI raw stdout에는 credential이 있을 수 있어 wrapper/runner가 메모리로만 캡처한다. 현재 타입을 재생성할 때만 별도로 `--write-types`를 사용한다.

산출물: `artifacts/TASK-058/runtime.json`, `inventory-before.json`, `catalog-{before,after,fresh,upgrade}.json`, `database.types.ts.txt`, 검사별 log, `browser-result.json`, `cleanup.json`, `docker-{before,after}.json`, `audit.json`.

완료한 두 runtime 실행에서 각각 REST fixture graph 3개를 owner client로 삭제하고 Auth 사용자 2명을 local admin으로 정리했다. 초기 catalog 표시 assertion 실패가 남긴 사용자 2명도 해당 전용 stack에서 Project 없는 synthetic ID만 별도 삭제했다. 총 local Auth 생성6/삭제6, REST Project 잔여0. Fresh/upgrade clone DB는 테스트 volume에 보존했다. 최종 TASK-058 전용 컨테이너0, 기존 family-archive/TASK-057A volume 보존, 새 TASK-058 volume 보존. 마지막 inventory에 다른 작업의 family-archive 컨테이너7개가 새로 관찰됐으며 변경/중지하지 않았다. Stack lifecycle wrapper도 실제 시작/종료를 확인했다.

## 5. Migration

신규 `0007_enforce_database_ownership.sql` 하나이며 기존 SQL 수정0. 요청의 NOT NULL 전제와 달리 source0006은 nullable Stage A다. 기존057A에서 Stage C SQL을 별도로 검증했으므로 0007은 backfill 조건을 재검사하고 NOT NULL을 확정한다. Fresh는 빈 Project에서 자동 성공, existing NULL은 fail-closed 후 명시된 운영 backfill이 필요하다.

한 transaction 안에서 NULL/불일치/중복·invalid path/기존 policy를 검사한다. fixture upgrade에서 실패 시 데이터 자동 보정/삭제0, grants 미개방을 확인했다. 완료된 Stage C에서 재적용 NOT NULL은 안전하고 기존 모든 row가 그대로 보존됐다. raw migration 재실행은 policy가 이미 있으므로 명확히 거부하며 상태는 보존된다. Migration ledger 기준 한 번 적용한다.

새 dependency0. 기존 JS/SSR/Next 및 CLI/PostgreSQL 도구만 사용했다. Remote migration/backfill/ledger mutation0. 실제 운영 데이터의 remote preflight와 배포 rehearsal은 별도 release gate다.

## 6. Regression

| Command / 검사 | 실제 결과 |
| --- | --- |
| `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs` | **1465 tests / 1465 PASS / 0 FAIL / 0 SKIP** |
| `node tests/rls-runtime.supabase.mjs` | **143 checks PASS** |
| `npx.cmd next typegen` | PASS |
| `npx.cmd tsc --noEmit` | PASS |
| `npm.cmd run lint` | PASS, warning0 |
| `npm.cmd run build` | PASS, package0.2.1 |
| `git diff --check` + 신규 파일 whitespace/conflict/link 검사 | PASS |
| source/artifacts/generated JS exact secret + marker scan | PASS, secret 값은 출력하지 않음 |
| `node tests/auth-browser-bundle.mjs` | PASS, web modules57, bytes590630, serverModules0, secretMarkers0 |
| `.next/static` production bundle secret/server marker 검사 | PASS |
| 보호 원본4/fixture patch3 SHA-256 | 일치 |

전체 harness는 기존1465개를 유지하고 ownership 기대값2개를 새 계약에 맞췄다. 실제143 checks는 별도 opt-in runtime이며 합산해 unit test 수로 보고하지 않는다. 기존057A의34 SQL rehearsal을 이번에 재실행한 것으로 세지 않는다. 새143에 fresh/upgrade 검증을 포함한다. 이미지·AI·Export의 실제 브라우저 재검증은 이번 DB TASK 범위가 아니다.

## 7. Security findings

TASK-058에서 검증한 DB row authorization 범위의 미해결 BLOCKER/HIGH는 없다. 공개 서비스 기준으로는 다음 위험을 유지한다.

- **BLOCKER:** 기존 service-role 요청이 RLS를 우회하고 일부 진입점의 Auth enforcement가 남아 있다. TASK-060/061 필요.
- **BLOCKER:** Storage object isolation/예약, Export authorization, 전체 cross-user 및 own-user E2E가 미완료다. TASK-059/062~065 필요.
- **HIGH:** 직접 API의 비용/용량/동시성 제어와 JSON 참조 scope 검증은 후속 service-role migration/ledger에서 완료해야 한다.
- **MEDIUM:** DB unique/FK 오류와 timing의 존재 추론 가능성을 완전히 제거하지 않는다. exact foreign/missing read/update/delete는 같은 0-row semantics로 최소화했다. 대량 workload 부하 측정은 미실행이다.

**명시적 전환 제약:** legacy ownerless Project create는 이제 실패한다. source 타입만 속여 빈 owner를 저장하거나 임의 계정을 default로 지정하지 않았다. 검증 principal 기반 생성 서비스를 기존 Action에 연결하는 작업은 TASK-060/061이다. 따라서 build/test PASS가 기존 UI 전체 workflow의 공개 운영 가능성을 뜻하지 않는다.

## 8. Mutation

Remote DB mutation **0**, Remote Auth mutation **0**, Remote Storage mutation **0**. 유료 AI 호출0. 허용된 변경은 workspace source/docs 및 전용 Local Supabase fixture/DDL/Auth뿐이다. 기존 Docker volume과 사용자 원본 데이터를 초기화하지 않았다.

## 9. Remaining Public SaaS blockers

| TASK | 남은 gate |
| --- | --- |
| TASK-059 | Storage ownership/object isolation |
| TASK-060 | service-role migration, 분산 quota/lease/upload reservation, JSON 참조·요청 scope |
| TASK-061 | Auth UX/protected routes, legacy create의 verified principal 연결 |
| TASK-062 | Export authorization/actor/nonce |
| TASK-063 | cross-user Security E2E |
| TASK-064 | full own-user workflow regression |
| TASK-065 | release validation/remote rollout preflight/운영·rollback gate |

**Public SaaS deployment remains BLOCKED.**

## 10. Git

현재 branch `feat/database-rls`. 시작 시 clean, HEAD/main/origin/main 모두 `8906c0cee85b01281f2ddfa557469482cb58a981`. 완료 시 같은 refs 유지, staged0, commit0, merge0, tag0. Working tree에는 이 TASK의 신규6/수정11 파일만 남긴다. reset/restore/clean을 실행하지 않았다. 사용자가 diff를 검토할 상태이며 Git 작업은 수행하지 않았다.

## 11. Next task

**TASK-059 — Storage ownership/object isolation.** 이번 DB Asset chain/path 불변성을 기반으로 실제 Storage API의 read/write/sign/delete 경계를 검증한다. TASK-060의 reservation gate 준비 전 public upload를 열지 않는 기존 architecture 계약을 유지한다.

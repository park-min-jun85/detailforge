# v0.3.0 Database RLS Security Boundary

2026-09-24 · TASK-058 · DB 경계 구현, 실제 Local Supabase 검증. **Public SaaS deployment remains BLOCKED**.

[최종 결과·재현 절차](tasks/TASK-058.md), [Ownership/backfill 계약](V0_3_OWNERSHIP_CONTRACT.md), [전체 architecture](V0_3_PUBLIC_SAAS_ARCHITECTURE.md), [Threat model](V0_3_THREAT_MODEL.md).

## Scope와 신뢰 경계

7개 public table의 직접 PostgREST 요청을 보호한다. 공격자는 정상 User A 계정과 User B의 정확한 모든 UUID를 알고 있으며, UI/API validation 없이 직접 SELECT/INSERT/UPDATE/DELETE/UPSERT한다. owner spoof/transfer, child IDOR, parent reassignment, mixed Project/Product 및 anon 접근을 DB에서 거부한다. 기존 31개 service-role factory 호출 전체 이전, Storage Object 권한, Auth UX, Export, 비용/예약 ledger는 이번 범위 밖이다.

SQL source는 `supabase/migrations/0001`~`0007`, 실제 catalog 증거는 ignored `artifacts/TASK-058/{inventory-before,catalog-before,catalog-after,catalog-fresh,catalog-upgrade}.json`이다. 추정한 컬럼을 정책에 사용하지 않는다. GRANT는 작업 권한, RLS는 row 범위이며 둘을 별도로 검증한다. [PostgreSQL 17 RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 실제 schema inventory와 ownership chain

모든 테이블 PK는 `id uuid`, 모든 parent FK는 NOT NULL이다. `projects.owner_id`만 0006에서 nullable이며 0007에서 NOT NULL로 확정한다. 최초 catalog에서 RLS는 7개 모두 ENABLED, 정책은 0개, anon/authenticated table privilege는 0개였다. service_role은 기존 ALL을 갖고 있었다.

| Table | 실제 FK와 cardinality | Ownership chain | 기존 조회 index |
| --- | --- | --- | --- |
| projects | owner_id → auth.users.id, ON DELETE RESTRICT | owner_id = auth.uid() | id PK, owner_id B-tree |
| products | project_id → projects.id, UNIQUE, CASCADE | Product → Project → owner | id PK, project_id UNIQUE |
| product_facts | product_id → products.id, UNIQUE, CASCADE | Facts → Product → Project → owner | id PK, product_id UNIQUE |
| assets | project_id → projects.id + product_id → products.id, 각 CASCADE | Asset의 두 FK가 같은 Product/Project여야 함 | id PK, project_id index, product_id index |
| detail_pages | project_id → projects.id, UNIQUE, CASCADE | Page → Project → owner | id PK, project_id UNIQUE |
| sections | detail_page_id → detail_pages.id, CASCADE | Section → Page → Project → owner | id PK, (detail_page_id, sort_order) index |
| product_options | product_id → products.id, UNIQUE, CASCADE | Options → Product → Project → owner | id PK, product_id UNIQUE |

`detail_pages.product_id`, `sections.project_id`, `sections.product_id`는 존재하지 않는다. 상세 column/PK/FK/CHECK/index 정의는 위 catalog JSON에 저장했다. 추가 index는 `products(id,project_id)` UNIQUE 및 `assets(storage_path)` UNIQUE이다. 기존 parent lookup index를 재사용한다. 대량 production 분포의 부하/latency 검증은 수행하지 않았다.

## Policy matrix

각 테이블에 `{table}_owner_select/insert/update/delete` 4개, 합계 28개를 명시적으로 선언한다. role은 authenticated만이며 모든 정책은 Project-root owner equality로 귀결된다. RLS는 계속 ENABLED이다.

| Table | SELECT USING | INSERT WITH CHECK | UPDATE USING + WITH CHECK | DELETE USING |
| --- | --- | --- | --- | --- |
| projects | 자기 owner | 새 owner = auth.uid() | 기존/신규 owner 모두 자기 자신 | 자기 owner |
| products | 자기 Project | 새 Project 소유 | 기존/신규 Project 소유 | 자기 Project |
| product_facts | 자기 Product의 Project | 새 Product의 Project 소유 | 기존/신규 Product chain 소유 | 자기 Product chain |
| assets | 동일 Project/Product + 자기 owner | 두 FK 동일 Project + 자기 owner | 기존/신규 두 FK 동일 Project + 자기 owner | 동일 Project/Product + 자기 owner |
| detail_pages | 자기 Project | 새 Project 소유 | 기존/신규 Project 소유 | 자기 Project |
| sections | 자기 Page의 Project | 새 Page의 Project 소유 | 기존/신규 Page chain 소유 | 자기 Page chain |
| product_options | 자기 Product의 Project | 새 Product의 Project 소유 | 기존/신규 Product chain 소유 | 자기 Product chain |

Parent 판정은 schema-qualified 명시적 EXISTS이고 `(select auth.uid())`를 사용한다. child → parent → root 단방향으로만 참조하므로 순환 policy가 없다. ownership SECURITY DEFINER helper/RPC는 추가하지 않는다. 사용자 JWT의 role/sub는 실제 Auth getUser로 검증한 session에서 오며 body의 owner hint를 신뢰하지 않는다.

## Grant matrix

| 대상 7개 테이블 모두 | SELECT | INSERT | UPDATE | DELETE | 기타 |
| --- | --- | --- | --- | --- | --- |
| anon 및 PUBLIC | 없음 | 없음 | 없음 | 없음 | ALL revoke |
| authenticated | 허용 + RLS | 허용 + RLS | 허용 + RLS | 허용 + RLS | TRUNCATE/REFERENCES/TRIGGER/MAINTAIN 없음 |
| service_role | 기존 유지 | 기존 유지 | 기존 유지 | 기존 유지 | 기존 ALL 유지, RLS bypass |

실제 `has_table_privilege`와 `has_column_privilege`를 사용해 inherited/effective grant와 잔여 anon column grant를 확인한다. anon/authenticated는 superuser/BYPASSRLS/table owner가 아니며 public schema CREATE도 없다. service-role 테스트를 사용자 RLS PASS로 세지 않는다. DB 관리자/BYPASSRLS 자격 유출은 이 경계의 보호 대상이 아니므로 TASK-060에서 일반 web 환경에서 제거해야 한다.

## DB 불변성과 mixed scope

`enforce_ownership_immutability()`는 SECURITY INVOKER, `search_path=''`, OLD/NEW의 고정 필드 비교만 수행한다. 동적 SQL, 테이블 조회, 권한 상승, UID 입력 인자는 없다. PUBLIC/anon/authenticated/service_role 직접 EXECUTE를 모두 revoke했다. trigger는 함수의 직접 EXECUTE grant 없이 실행하며 실제 사용자 UPDATE로 확인했다. 함수 owner와 proconfig/prosecdef/execute privilege는 runtime 결과에 기록한다.

| Table | UPDATE에서 불변인 필드 |
| --- | --- |
| projects | id, owner_id |
| products, detail_pages | id, project_id |
| product_facts, product_options | id, product_id |
| assets | id, project_id, product_id, storage_path |
| sections | id, detail_page_id |

다른 owner뿐 아니라 같은 owner의 다른 Project로 이동하는 것도 금지한다. 동일 값의 정상 UPSERT는 허용한다. 거부 오류는 입력 값이나 foreign row를 포함하지 않는 고정 23514이다. 이 불변성은 service_role 정상 DML에도 적용된다. 기존 upsert/update가 같은 PK/FK를 보내는 동작은 계속 가능하다.

Asset의 `products(id,project_id)` UNIQUE 참조 복합 FK는 privileged 쓰기에도 두 ID의 결합을 보장한다. 기존 단일 FK는 API 관계 호환을 위해 유지한다. RLS WITH CHECK도 같은 관계를 요구하므로 A Project+B Product, 역방향, 같은 owner의 서로 다른 Project 조합을 모두 차단한다. FK만으로 RLS를 대신하지 않는다.

Storage path는 `projects/{projectId}/products/{productId}/{assetId}.(jpg|png|webp)`의 정확한 일치, UNIQUE, 불변성을 보장한다. 파일/경로를 이동하거나 bytes를 재가공하지 않는다. 이것은 DB Asset metadata의 무결성이며 Storage API/object authorization은 TASK-059에 남는다.

## IDOR와 공개 한계

A/B 양방향으로 foreign UUID와 존재하지 않는 UUID의 SELECT/UPDATE/DELETE가 오류 없이 동일한 0 rows를 반환하는 것을 검증한다. RLS INSERT/UPSERT 범위 위반은 42501, 불변 필드 변경은 23514로 거부된다. anon은 테이블 권한 자체가 없어 42501이다. 별도 서비스 계층은 foreign/missing을 동일 404로 매핑한다.

RLS가 모든 existence/timing side channel을 없앤다고 주장하지 않는다. PostgreSQL unique/FK 무결성 검사는 RLS를 우회하므로, 알려진 PK를 충돌시키는 INSERT의 제약 오류로 존재를 추측할 여지는 남는다. UUID 생성/오류 최소화/요청 제한과 전체 API 검증은 TASK-060/063에서 함께 다룬다. 이는 foreign row payload/read/write가 허용된다는 뜻은 아니다. JSON 내부의 Asset ID, metadata, AI 출력은 권한 증거가 아니며 TASK-060에서 실제 참조마다 scope를 검증해야 한다.

## Migration과 기존 데이터

0007은 BEGIN/COMMIT으로 원자적으로 실행한다. 7개 테이블을 고정 순서로 ACCESS EXCLUSIVE lock하고 lock timeout 5초/statement timeout 60초를 둔다. NULL owner, Asset Project 불일치, 중복/잘못된 path, 기존 사용자 policy가 하나라도 있으면 변경 없이 중단한다. 데이터 삭제/재귀속/자동 복구/첫 사용자 owner default가 없다. NOT NULL, constraints, trigger, grants/policies가 모두 성공해야 commit한다.

Fresh DB는 0001~0007을 그대로 적용한다. Existing DB는 0006 후 explicit backfill을 완료해야 한다. 이미 operations/finalize-project-owner.sql의 Stage C를 적용한 상태도 지원한다. 0007은 Stage C와 동일한 선행조건을 다시 확인하고 NOT NULL을 반복 확정한다. 적용 실패는 ingress를 닫은 상태로 원인을 검토하며 RLS disable/grant-all로 우회하지 않는다.

기존 migration 파일은 수정하지 않았다. 0007 raw SQL 재실행은 기존 policy 검사에서 명시적으로 거부되고 기존 데이터/catalog가 그대로 유지된다. 일반 배포는 migration ledger로 한 번만 적용하며, 새 로컬 fixture DB는 psql로 정확한 SQL을 실행한다. 이번에는 remote migration ledger에 접근하지 않았다.

Actual CLI 생성 타입에서 owner Row는 string, Insert는 필수 string이고 Asset 복합 relationship이 추가됐다. 기존 PostgREST metadata hint 14.5는 유지했다. 넓은 generated Update 타입이 owner 변경 허용을 의미하지 않는다. 이전 057A runtime은 Stage A 비교 기준을 당시 commit `8906c0c`로 고정했으며, 현재 타입은 058 runtime에서 독립 비교한다.

**전환 제약:** owner 없는 `createLegacyInternalProject`는 DB 요청 전에 실패하도록 닫았다. 임의 owner나 type cast로 NOT NULL을 피하지 않는다. 이 old Action의 Project 생성은 TASK-060/061에서 검증 principal 기반 createProject로 연결하기 전까지 사용할 수 없다. 나머지 service-role 호출은 이번에 전부 이전하지 않았다. 현재 브랜치를 공개하거나 기존 운영 환경에 부분 적용하지 않는다.

## Actual runtime evidence

`tests/rls-runtime.supabase.mjs`는 `.env.local`을 읽지 않는다. `detailforge-task058` 전용 config와 API `127.0.0.1:57321`, PostgreSQL `127.0.0.1:57322`를 고정 검증한다. HTTP origin/redirect를 제한하고 PG 환경을 제거한 뒤 명시적 loopback connection만 사용한다. 실제 GoTrue 사용자 두 명을 fixture admin API로 만든 뒤 각각 signInWithPassword/getUser를 거친다. 데이터 접근은 public anon key + 각 실제 session JWT, anon은 같은 public key + session 없음이다.

Genuine local platform bootstrap을 별도 fresh/upgrade DB에 복제한다. Auth hash/dump/JWT/password/service key는 메모리에만 둔다. 관리자 SQL은 migration, fixture seed, catalog, 데이터 보존 비교, 제약 sanity에만 쓰고 사용자 접근 판정은 PostgREST로 수행한다. Fresh/upgrade catalog, 전후 모든 row의 모든 column/ID/owner/timestamp 비교, 실패 시 무수정, raw migration repeat 거부를 assertion으로 확인한다.

최종 command·정확한 check 수·RLS-01~20 결과·정리 상태는 [TASK-058 보고](tasks/TASK-058.md)에 기록한다. 실행 산출물은 artifacts/TASK-058에만 저장하고 Git에서 제외한다. 테스트에서 만든 REST graph는 해당 owner가 삭제하고 Auth fixture는 local admin이 정리한다. migration clone DB와 Docker volume은 재현 증거로 보존하고 테스트 stack만 중지한다.

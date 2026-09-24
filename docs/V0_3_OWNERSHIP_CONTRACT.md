# v0.3.0 Project Ownership & Backfill Contract

2026-09-24 · TASK-057/057A · **구현 및 local SQL runtime 검증 완료 · Public SaaS BLOCKED**.

TASK-057A에서 별도 local Supabase PostgreSQL17.6/GoTrue API로 fresh/upgrade/backfill/idempotency/FK/index/NULL gate/NOT NULL/actual generated types34 checks를 검증했다. migration/운영 SQL은 그대로이며 원격 적용0이다. 기존 Docker daemon이 정상임을 확인하고 host initdb의 postgres.bki 누락 경로를 피했다. TASK-057의 미검증 상태는 해소됐다. [46항목 후속 결과·재현 절차](tasks/TASK-057A.md).

Migration0006과 offline backfill/finalize 절차, principal 기반 Project CRUD를 작성하고 local SQL rehearsal을 완료했다. 원격 schema/data/Auth 변경은0이며 운영 적용은 별도 승인된 maintenance 단계다. [최초76항목 보고와 후속 판정](tasks/TASK-057.md), [Auth contract](V0_3_AUTH_CONTRACT.md), [전체 architecture](V0_3_PUBLIC_SAAS_ARCHITECTURE.md).

## Schema와 적용 단계

실제 기존 마지막 migration은 `0005_add_product_options.sql`이다. `0006_add_project_owner.sql`은 `public.projects.owner_id uuid NULL`, `auth.users(id)` FK `ON DELETE RESTRICT`, 단일 B-tree `projects(owner_id)` index만 추가한다. default owner, profile table, child owner 복제, RLS/grant/Storage 변경은 없다. 기존0001/0005에서 RLS는 이미 ENABLED지만 사용자 policy/grant가 없으며 service role은 bypass한다. 이번 작업은 이를 활성화하거나 비활성화하지 않는다.

계정 삭제가 Project와 제품/이미지를 암묵적으로 cascade 삭제하지 않도록 TASK-055의 RESTRICT를 유지한다. owner list/filter를 위한 단일 index를 먼저 사용하고 owner+status/updated_at 복합 index는 실제 query plan·분포 측정 후 검토한다. `updated_at DESC,id DESC`,20개 pagination, 정확한 count 계약은 유지한다. [PostgreSQL 제약](https://www.postgresql.org/docs/18/ddl-constraints.html), [Supabase Auth user 참조](https://supabase.com/docs/guides/auth/managing-user-data).

| 단계 | 파일 / 실행 경계 | 실제 state |
| --- | --- | --- |
| A | migrations/0006_add_project_owner.sql | nullable, legacy internal create 호환, public closed |
| B | scripts/backfill-project-owner.mjs → operations/backfill-project-owner.sql | 명시한 실제 Auth user와 Project allowlist, 기본 dry-run |
| C | operations/finalize-project-owner.sql, apply=true 별도 운영 실행 | NULL0/Asset chain/path 검사 후 NOT NULL, 기존 legacy create 차단 |
| 다음058 | 다음 번호0007은 아직 만들지 않음 | Stage C 조건을 다시 검사/NOT NULL 적용하고 DB 불변성·복합 FK·RLS/grants 구현 |

**Stage C를 automatic migration directory에 넣지 않았다.** 일반 migration 일괄 적용 사이에 사용자 입력이 필요한 상태를 숨기지 않기 위해서다. fresh DB는0006 이후 빈 상태에서 C가 가능하다. existing DB는 반드시 B를 먼저 완료한다. CI는0001~0006까지만 자동 적용하고, 격리한 Auth user/Project fixture로 B→C rehearsal을 별도로 수행한다. TASK-058은 fresh/이미 C를 적용한 DB 모두에서 같은 최종 제약으로 수렴해야 한다.

현재 database.types.ts는 **자동 migration 끝인 Stage A**에 맞춰 Row owner_id:string|null, Insert/Update owner_id?:string|null이다. 최초 수동 변경을057A의 actual CLI generation과 대조했고7개 public table Row/Insert/Update/Relationships가 모두 일치했다. auth.users는 이 파일의 public schema 밖이므로 public users 관계를 꾸며 넣지 않았다. Stage C의 actual 생성본도 owner:string/Insert required로 확인했다.058의 최종 schema rollout에서 source 타입을 전환한다. CLI db-url 생성본에 없는 기존 PostgREST metadata hint는 유지했고 schema diff와 구분했다. 넓은 generated Update 타입은 owner 변경 권한을 뜻하지 않는다.

## Domain과 adoption 경계

`Project.ownerId:string`은 owned domain의 필수 값이다. `ownedProjectRowSchema`는 NULL/누락/잘못된 UUID를 거부하고 DB owner_id를 camelCase로 매핑한다. `ProjectSummary=Omit<Project,'ownerId'>`와 `toProjectSummary`는 UI에 owner를 노출하지 않는 read model이다. 기존 `projectRowSchema`는 이 legacy/UI projection이며 소유권 검사로 사용하면 안 된다. offline/admin 전용 `legacyProjectOwnershipSchema`는 owner가 없으면 명시적으로 null을 반환한다.

`src/features/projects/service.ts`:

| 함수 | 계약 |
| --- | --- |
| createProject(principal,input,client?) | strict name만 입력, status=draft/owner_id=principal.userId 서버 결정 |
| listOwnedProjects(principal,page,client?) | count와 list 모두 owner filter, NULL rows 제외, 기존 정렬/page size 유지 |
| getOwnedProject(principal,id,client?) | id와 owner를 같은 query에 적용, foreign/missing/NULL 동일404 |
| updateOwnedProject(principal,id,input,client?) | strict name/status만, UPDATE 자체에 id+owner 조건, owner/id/createdAt 변경 불가 |
| deleteOwnedProject(principal,id,client?) | DELETE 자체에 id+owner 조건,0row는404; DB child cascade, **Storage cleanup 없음** |

함수는 server-only이고 새 HTTP endpoint/Server Action이 아니다. 동일한 TASK-056 AuthenticatedPrincipal 타입을 재사용한다. principal의 UUID 모양 검사는 인증이 아니므로 **caller는 getCurrentUser/requireCurrentUser의 검증된 principal만 전달**해야 한다. 기본 DB client는 사용자 session client다. optional client는 신뢰된 서버 코드의 테스트/향후 통합 지점이며 HTTP body에서 주입하지 않는다. error는 unauthenticated401/invalid_input400/not_found404/unavailable503으로 제한하고 DB 원문/cause를 숨긴다. ProjectSummary로 변환한 응답도 caller가 private/no-store를 유지해야 한다.

public grants/RLS가 아직 없으므로 현재 authenticated DB client로 이 함수를 호출해 실제 사용자 CRUD가 가능하다고 주장하지 않는다. test는 실제 SDK+mock PostgREST transport다. user principal+owner filter는 애플리케이션 방어이며 DB의 최종 보안 증거가 아니다. Storage Object 정리·보존 설계 전에는 delete 함수를 UI/API에 노출하지 않는다.

기존 createProjectAction은 명시적 `createLegacyInternalProject`를 통해 기존 name/status INSERT를 유지한다. fake/default/env/첫 Auth user owner는 없다. form boundary도 strict 검증하며 ownerId/owner_id/userId/알 수 없는 필드/중복 name을 거부한다. Next의 `$ACTION_` transport metadata만 제외한다. 기존 getProjects/getProjectDashboard와 Product read는 **internal 전환 경로**로 남고 owner-aware API로 위장하지 않는다. Stage C 후 이 legacy insert는 DB에서 실패하므로 maintenance 상태에서 TASK-060/061 adoption과 함께 교체한다. 그 전에도 public ingress는 열지 않는다.

## 실제 ownership chain

| Table | 실제 FK / root 경로 | 검증 |
| --- | --- | --- |
| projects | owner_id → auth.users.id | root owner equality |
| products | project_id → projects.id, UNIQUE | Product→Project |
| product_facts | product_id → products.id, UNIQUE | Facts→Product→Project |
| assets | project_id → projects.id 및 product_id → products.id | 두 Project ID가 반드시 같아야 함 |
| detail_pages | project_id → projects.id, UNIQUE | Page→Project; product_id 없음 |
| sections | detail_page_id → detail_pages.id | Section→Page→Project |
| product_options | product_id → products.id, UNIQUE | Options→Product→Project |

`requireOwnedResource(principal,{kind,id},client)`는 실제 row FK를 따라가서 owner-aware Project read를 수행하고 최소 projectId/ownerId만 반환한다. metadata/URL의 Project hint를 신뢰하지 않는다. Asset의 두 부모가 다르면 같은 owner의 두 Project라도 거부한다. 반환값은 현재 요청의 확인 결과이며 재사용 가능한 capability가 아니다. 뒤따르는 write도 relation predicate/RLS가 필요하다.

기존 NOT NULL FK는 orphan을 막지만 **Asset product_id/project_id는 독립 FK라 mixed-project 조합이 DB에서 가능**하다. child parent 재지정과 storage_path 중복/변경도 아직 최종 DB 불변성으로 막지 않는다. 이번에는 resolver와 offline preflight가 불일치/중복/path mismatch를 차단한다. `products(id,project_id)` UNIQUE + Asset 복합 FK, parent/path 불변성은 기존 데이터 audit 후 TASK-058의 명시 gate다. 자동 보정·삭제·다른 owner 추측 귀속은 하지 않는다.

## Backfill 운영 절차 — 이번에 실행하지 않음

SQL/psql 변수 방식은 기존 FK와 transaction/lock을 그대로 사용할 수 있다. Supabase admin REST만으로는 다중 row backfill·coverage 검사를 하나의 DB transaction으로 보장하기 어렵고 새 privileged RPC를 열어야 하므로 선택하지 않았다. Node CLI는 입력 검증/psql 실행/안전한 count 출력만 담당하며 새 dependency가 없다. 일반 web graph에서 import하지 않고 앱 시작 시 실행하지 않는다. [psql 변수·ON_ERROR_STOP](https://www.postgresql.org/docs/18/app-psql.html).

1. 별도 승인된 운영 창에서 ingress/기존 writes를 닫고 DB snapshot, row/PK/content hash, 원본·Derived Object inventory/hash를 보관한다. 원격 실행은 이번 TASK 승인 범위 밖이다.
2. 같은 환경의 실제 bootstrap Auth user가 존재하며 의도한 계정인지 운영자가 확인한다. SQL preflight는 auth.users 존재 및 key-share lock을 검사하며 이메일 확인/계정 목적을 대신 검증하지 않는다.
3. `0006`을 먼저 적용한다. trusted psql connection service를 로컬 `PGSERVICEFILE` 등에 준비한다. 연결 host/ref는 운영자가 별도로 확인하고 password/DB URL을 명령·Git·일반 로그에 넣지 않는다. `.env.local`/SUPABASE_SERVICE_ROLE_KEY를 CLI가 자동 로드하지 않는다.
4. 선택할 모든 NULL Project ID를 배열로 작성한 비공개 JSON 파일을 준비한다. 실제 UUID 파일은 Git에 넣지 않는다. 최대1MiB/10000개, UUID 형식/중복 검사. bootstrap user ID도 **one-time argument**이며 영구 env/default로 저장하지 않는다.
5. dry-run을 실행하고 counts/대상을 검토한다. 이 도구는 단일 bootstrap owner를 위한 명시 allowlist다. 여러 owner로 나누어야 하는 NULL 데이터가 있으면 도구를 실행하지 말고 별도 per-project mapping 계약을 준비한다. 이미 owner가 있는 다른 row는 allowlist 밖에서 그대로 보존한다.
6. 검토한 입력 그대로 `--apply`로 실행한다. repeat 실행은 같은 owner mapping에서 updated0이다. 예기치 않은 NULL row/unknown ID/중복/다른 owner 충돌/Auth user 부재/Asset chain·path 오류이면 transaction 전체 중단이다.
7. ownership audit로 total/owned/null/distinct owner 및 chain/path 오류 count를 확인하고 최초 백업과 비교한다. Stage C는 NULL0 및 오류0, writer maintenance, owner-aware adoption 준비 후에만 실행한다.

```powershell
# 실제 값은 로컬 변수와 비공개 파일에만 둔다. 아래 명령은 실행 예시다.
node scripts/backfill-project-owner.mjs --user-id $bootstrapUserId --project-ids-file $privateAllowlistPath --service detailforge_maintenance --dry-run
node scripts/backfill-project-owner.mjs --user-id $bootstrapUserId --project-ids-file $privateAllowlistPath --service detailforge_maintenance --apply
psql -X -w 'service=detailforge_maintenance' -v ON_ERROR_STOP=1 -f supabase/operations/audit-project-owner.sql
# 먼저 apply 없이 prerequisite 확인. 다음 줄만 Stage C schema mutation이다.
psql -X -w 'service=detailforge_maintenance' -f supabase/operations/finalize-project-owner.sql
psql -X -w 'service=detailforge_maintenance' -v apply=true -f supabase/operations/finalize-project-owner.sql
```

Backfill은 Project writes를 막는 SHARE ROW EXCLUSIVE lock, Product/Asset SHARE lock을 transaction 안에서 획득한다.5초 lock timeout/30초 statement timeout/CLI40초 제한이다. 확인 후 NULL+allowlist rows만 변경하며 concurrent write가 검증과 mutation 사이에 끼어들지 못하게 한다. timeout/접속 실패/DB 오류는 CLI에서 고정 문구만 출력한다. 영속 audit table/RPC/새 grants는 없다. 정상 출력은 applied/updated/totalProjects/ownedProjects/nullOwnerProjects/distinctOwners/eligibleProjects만 포함한다.

기존 `projects_set_updated_at` trigger는 그대로다. 실제 owner가 NULL→UUID로 바뀐 Project만 updated_at이 갱신될 수 있어 최근 목록 순서도 달라질 수 있다. 이 운영상 timestamp 변화는 명시적으로 허용한다. 이미 owned row는 UPDATE하지 않으므로 timestamp도 유지한다. name/status/createdAt/child content/Facts version/fingerprint/Storage path·bytes는 변경하지 않는다. trigger disable나 timestamp 되돌리기로 우회하지 않는다.

## 검증과 rollout 제한

OWN application tests는 principal A/B, forged body/FormData, owner immutable input, owner-filtered CRUD/count, NULL/legacy, child chain, DB error privacy를 검증한다. CLI는 mock executor로 입력/기본 dry-run/출력/error privacy를 검증하고 SQL은 staged/lock/NULL predicate/FK/index 계약을 정적으로 검사한다. 이것은 PostgreSQL execution proof가 아니다.

`tests/project-ownership.postgres.mjs`는 완전한 PostgreSQL 설치가 있을 때 새 격리 cluster/loopback port를 생성해 기존0001~0005→legacy graph→0006→dry-run/backfill/repeat/보존→NOT NULL과 fresh DB를 검증하도록 준비했다. 기존 DB/원격 URL을 입력받지 않으며 PG 연결 env를 제거한다. 최소 auth.users/storage.buckets fixture이며 Supabase GoTrue/Auth API/RLS E2E가 아니다. 실행 후 자체 cluster를 정지한다.

TASK-057 당시 host PostgreSQL18의 `share/postgres.bki` 누락으로 OWN-19/20은 NOT_RUN이었다. TASK-057A에서 docker.exe의 PATH 부재와 Docker daemon 부재를 구분해 정상 Docker Desktop을 확인했고, 별도 unlinked Supabase stack에서 actual SQL/Auth fixture를 검증했다. 최신 runner는 tests/ownership-runtime.supabase.mjs, 결과는 artifacts/TASK-057A/runtime.json이다. fresh/upgrade 및 제약·보존·반복·타입은 PASS다. query plan/사용자 RLS·Auth UI E2E는 이 결과에 포함하지 않는다. 기존 host-only runner/NOT_RUN artifact는 당시 기록으로 남긴다.

공개 gate는 NULL owner0만이 아니다. RLS/Asset 복합 FK·불변성/Storage ownership/일반 service-role 제거/Export 인증/Auth UI·local integration/abuse control 및 own-user 회귀가 모두 필요하다. 현재 공개 배포는 BLOCKED다. 운영 rollback은 ingress와 writes 정지→snapshot/mapping 보존→호환 앱 또는 forward-fix. owner 귀속 후 column drop을 정상 rollback으로 사용하지 않는다. 미귀속 disposable dev DB의 Stage A rollback만 별도 검토할 수 있다. 공개 전환 후 RLS disable/public bucket/service-role 공개 앱 복귀는 금지한다.

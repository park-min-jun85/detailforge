# TASK-057 — v0.3.0 Project Ownership Schema Migration & Existing-data Backfill Foundation

2026-09-24 · **TASK-057A 후속 runtime PASS로 최종 COMPLETE · Public SaaS BLOCKED**.

후속 [TASK-057A](TASK-057A.md)에서 실제 local Supabase/Auth API를 사용한 fresh/upgrade/backfill/FK/index/NOT NULL·type 비교34 checks와 전체1465 tests가 통과했다. host PostgreSQL의 share 파일 누락을 Docker runtime으로 해결했으며 migration/운영 SQL 수정0, 원격 mutation0이다. 아래76개 항목의 NOT_RUN/PARTIAL은 TASK-057 최초 완료 시점의 기록이며 후속 결과로 해소됐다.

요청한 migration/domain/service/명시 backfill 기반을 작성했다. 운영 DB에 적용하지 않았으며 로컬 PostgreSQL 설치 누락으로 실제 SQL 실행 검증도 미완료다. [Ownership contract](../V0_3_OWNERSHIP_CONTRACT.md)에 명령·deployment order·rollback·검증 한계를 기록했다.

1. **TASK 목적**: TASK-056 principal.userId를 Project-root owner로 연결할 schema, explicit bootstrap, owner-aware CRUD/child chain 기반을 준비한다. RLS/Storage/전체 service-role 이전은 후속이다.
2. **Branch**: `feat/project-ownership-foundation` 확인. HEAD/main/캐시 origin/main은 `e55094634658e6f95d01e795527cb32b25445673`. 시작부터 next.config.ts/package.json/package-lock.json에 TASK-056 변경이 있었으며 그대로 보존했다. fetch/stage/commit/merge/tag/reset/restore/clean0.
3. **Current projects schema**: 기존0001의 id UUID PK/name/status/created_at/updated_at, owner 없음. 마지막 기존 migration0005. 기존7개 table의 RLS는 ENABLED, 일반 사용자 grants/policy 없음, service role은 bypass한다. 원격 catalog는 조회하지 않았다.
4. **Chosen ownership model**: projects.owner_id가 유일한 root source of truth. child table에 owner 복제0, profile/team/share 도입0.
5. **owner_id SQL shape**:0006에서 `owner_id uuid NULL references auth.users(id) on delete restrict`. default owner 없음. NULL은 internal migration 상태만 허용한다.
6. **FK delete semantics**: RESTRICT. Auth user 삭제로 제품/Project/이미지를 암묵 cascade 삭제하지 않는다. 계정 삭제·보존 정책은 후속이며 SQL 실행 검증은 아직 없다.
7. **Index**: projects_owner_id_idx, 단일 B-tree(owner_id). count/list/lookup predicate에 맞췄다. 복합 owner+status/updated_at은 실제 query plan 근거 없이 추가하지 않았다. EXPLAIN 미실행.
8. **NOT NULL strategy**: Stage A nullable→Stage B explicit backfill→Stage C 별도 finalize SQL. NULL0·Asset chain/path audit 통과 및 legacy writer 중단 뒤 NOT NULL. 다음058에서 같은 최종 제약을 재확인한다.
9. **Migration numbering**: 신규 `0006_add_project_owner.sql` 한 개.0001~0005 수정0,0007 미생성.
10. **Migration decomposition**: 자동 migration directory는 Stage A까지만. 운영 입력이 필요한 B/C는 supabase/operations 및 offline CLI에 분리했다. fresh CI의 migration batch가 bootstrap input을 기다리지 않게 했다.
11. **Existing-data strategy**: row 삭제/reset/copy/추측 owner 귀속 금지. 명시 allowlist의 NULL rows만 변경. 이미 owned row 보존. Product/Facts/Asset/Section/Storage bytes를 수정하지 않는다. 변경된 Project의 updated_at은 기존 trigger 때문에 갱신될 수 있다.
12. **Bootstrap mechanism**: Node CLI가 explicit user UUID+비공개 Project ID JSON allowlist+psql connection service를 받아 transaction SQL을 실행한다. 기본 dry-run. 단일 bootstrap owner용이며 다중 owner 분배 데이터는 별도 mapping 계약이 필요하다.
13. **Hardcoded UUID 여부**: production SQL/code/default/env에 실제 사용자 UUID0. A/B UUID는 테스트 전용이다. 첫 Auth user/current login user를 자동 owner로 선택하지 않는다.
14. **Backfill idempotency**: UPDATE는 owner_id IS NULL AND id=ANY(allowlist). 동일 mapping 반복 시0row, 다른 기존 owner는 중단하도록 작성했다. 이 predicate 계약은 정적 테스트 PASS, PostgreSQL 실제 재실행은 NOT RUN이다.
15. **Auth user existence validation**: auth.users 조회와 FOR KEY SHARE, 없으면 고정 오류. FK도 유지한다. 계정 verification/대상 환경의 적절성은 운영자가 별도 확인한다. 실제 Auth 계정 생성/조회는 하지 않았다.
16. **Ownership audit**: totalProjects/ownedProjects/nullOwnerProjects/distinctOwners 및 Asset chain mismatch/Storage path duplicate·관계 mismatch counts. 이름/owner UUID/URL은 출력하지 않는다.
17. **Null-owner gate**: 공개 배포 및058 적용 전 NULL0 필수. owner0만으로 public-ready가 아니며 RLS/Storage/Export/비용 gate가 별도로 필요하다.
18. **Domain ownerId**: Project.ownerId:string required. ProjectSummary는 UI용 owner 제외 타입. legacy admin inspection은 ownerId:string|null을 명시한다.
19. **DB mapping**: ownedProjectRowSchema가 owner_id→ownerId로 변환하고 NULL/missing/invalid UUID는 거부한다. 기존 projectRowSchema는 legacy/UI projection으로 남으며 authorization에 사용하지 않는다.
20. **Create principal contract**: createProject(principal,input,client?)는 서버 verified principal.userId로 owner를 설정한다. default client는 authenticated server client이며 별도 admin fallback이 없다. principal shape validation 자체가 인증은 아니다.
21. **Forged owner input**: create/update strict schema, FormData boundary에서 ownerId/owner_id/userId/unknown/duplicate field 거부. Next $ACTION_ transport metadata만 제외. client hidden owner field0.
22. **Owner immutability**: create 후 app update는 name/status만 허용, owner/id/createdAt 입력 불가. 실제 DB owner/parent 불변성은058에서 강제하며 현재 direct privileged SQL까지 막았다고 주장하지 않는다.
23. **List behavior**: count/list 모두 owner filter,20개/page, updated_at DESC,id DESC 유지. A/B 및 NULL rows 분리. 기존 internal list/dashboard는 명시적으로 legacy 경로다.
24. **Read behavior**: 같은 query에 id+owner 조건. foreign/missing/NULL은 동일 not_found404. raw owner/DB 오류를 사용자에게 설명하지 않는다.
25. **Update behavior**: UPDATE 자체에 id+owner 조건, read-then-unscoped-write 아님. name/status 외 변경 금지,0row는404,기존 owner 유지.
26. **Delete behavior**: DELETE 자체에 id+owner 조건,0row는404. SQL child cascade는 기존 schema 의미다. Storage Object cleanup은 제공하지 않으므로 UI/API에 연결하지 않았다.
27. **Error privacy**: unauthenticated401/invalid_input400/not_found404/unavailable503. DB/provider 원문/cause/연결정보 숨김. CLI도 고정 실패 문구와 count-only 성공 DTO만 출력한다.
28. **Child ownership chain inventory**: products→projects; facts/options→products→projects; assets는 project 및 product.project 일치; pages→projects; sections→pages→projects. detail_pages.product_id/sections.project_id 같은 없는 column을 가정하지 않는다. requireOwnedResource helper 구현.
29. **Cross-project consistency**: 기존 Asset 두 FK는 독립적이라 DB-level mixed-project hole이 남는다. resolver는 같은 owner의 두 Project라도 mismatch404. backfill/finalizer도 mismatch/path duplicate·관계 오류 중단. 최소 복합 FK/parent·path immutable 제약은058에 남겼다.
30. **Legacy null behavior**: owned flow는 fail-closed, migration reader는 NULL 노출. createLegacyInternalProject를 통해 기존 internal action 유지. Stage C 이후 이 legacy insert는 NOT NULL로 실패하므로 maintenance/adoption과 함께 전환한다.
31. **CLI/script**: scripts/backfill-project-owner.mjs. --user-id/--project-ids-file/--service 필수, shell 문자열 조립 없이 execFileSync로 psql 실행. 새 npm dependency 없음. 일반 app route/startup 연결0.
32. **Dry-run**: default 및 --dry-run은 application row mutation0. explicit --apply만 UPDATE. --apply와 --dry-run 동시 입력/중복·unknown arg 거부. finalize도 apply 없으면 prerequisite 확인만 한다.
33. **Mutation safety**: transaction+Project write lock+Product/Asset read lock,5초 lock/30초 statement/40초 CLI timeout. coverage/user/conflict/chain/path를 먼저 검사하고 NULL만 갱신. 자동실행/owner overwrite/trigger disable0. 실제 SQL 원자성 검증은 local rehearsal에서 남았다.
34. **OWN-01**: PASS(정적). nullable owner column, default/RLS/grant 변경 없음.
35. **OWN-02**: PASS(정적). auth.users FK RESTRICT와 owner index 확인. 실제 FK/index catalog 검증 NOT RUN.
36. **OWN-03**: PASS. owned mapping 및 owner를 제외한 UI DTO.
37. **OWN-04**: PASS(SDK/mock). A/B create에 각각 principal owner, missing/invalid principal은 network 전 거부.
38. **OWN-05**: PASS. forged owner/user/상태/ID와 FormData unknown/중복 필드 거부.
39. **OWN-06**: PASS. update strict contract, owner/id/createdAt 보존.
40. **OWN-07**: PASS(SDK/mock). A list/count는 A만.
41. **OWN-08**: PASS(SDK/mock). B list/count는 B만.
42. **OWN-09**: PASS(SDK/mock). A read/update B·NULL·missing은 같은404, B row 보존.
43. **OWN-10**: PASS(SDK/mock). A delete B 거부, own delete 성공, DELETE에 owner predicate 확인.
44. **OWN-11**: PASS. missing/null legacy read를 명시 분리하고 owner 없는 internal create의 과도기 의미 확인.
45. **OWN-12**: PASS(CLI mock/SQL contract), 실제 DB NOT RUN. explicit bootstrap/allowlist/default dry-run/count DTO/Auth user preflight 확인.
46. **OWN-13**: PASS(정적), 실제 DB NOT RUN. NULL-only UPDATE/apply 분기/lock/coverage 검증. repeat no-op은 SQL rehearsal 준비 상태다.
47. **OWN-14**: PASS(정적), 실제 DB NOT RUN. 다른 owner 충돌/unknown/duplicate/incomplete allowlist 거부와 임의 삭제 없음.
48. **OWN-15**: PASS(CLI validation/정적). invalid UUID/잘못된 인자 실행 전 거부, nonexistent auth.users SQL preflight 존재. 실제 DB user 부재 테스트 NOT RUN.
49. **OWN-16**: PASS(CLI/mock/정적). 빈 allowlist 가능, apply opt-in, DB 오류 비공개. actual zero-row SQL NOT RUN.
50. **OWN-17**: PASS. 전체1465개 suite, 기존1444 포함. Import/Extraction/Manual Crop/AI/Planner/Sections/Editor/Export 회귀 테스트 통과. 실제 상품 Browser/remote AI QA는 재실행하지 않았다.
51. **OWN-18**: PASS(정적/typecheck). Stage A nullable Row/Insert/Update와 맞춤. local generated types 재생성 NOT RUN.
52. **OWN-19**: 실제 fresh DB migration **NOT RUN**. automatic0006에 bootstrap identity가 없고 C의 NOT NULL DDL이 있는 SQL 계약만 PASS. runnable isolated PostgreSQL harness 준비.
53. **OWN-20**: 실제 existing DB upgrade/backfill/finalize **NOT RUN**. NULL/chain/path gate 순서 정적 PASS. full child graph 보존·idempotency·FK/NOT NULL 검사 harness를 작성했으나 실행 증거로 간주하지 않는다.
54. **Local Supabase migration**: Supabase Local config/Docker 없음. PostgreSQL18 bin을 찾아 initdb 시도, sandbox 밖 재시도에도 share/postgres.bki가 없어 초기화 실패. postgres.json 상태 NOT_RUN. 실제 SQL PASS라고 표시하지 않는다.
55. **Local auth fixture**: harness에 최소 auth.users(id PK) fixture와 비개인 A/B UUID 준비, 실제 생성0. GoTrue/session/메일 검증을 대체하지 않는다.
56. **Remote DB mutation**:0. remote migration/backfill/catalog 조회 없음. 운영 실행은 별도 승인된 작업이다.
57. **Remote Auth mutation**:0. bootstrap 계정 생성·로그인·삭제 없음.
58. **database.types update**: projects owner_id nullable Row/optional nullable Insert·Update 수동 반영. Stage C 이후058에서 actual schema generation 필요. public schema 밖 auth.users를 가짜 public 관계로 추가하지 않았다.
59. **Generated files**: 신규14개. Ownership contract/이 보고서2, Project service/ownership/ownership-chain/legacy4,0006 migration1, operations backfill/finalize/audit SQL3, offline CLI1, ownership test/helper/PostgreSQL harness3.
60. **Modified files**: 이번16개. README; docs/02_ARCHITECTURE,03_DATABASE,07_DECISIONS,V0_3_PUBLIC_SAAS_ARCHITECTURE,V0_3_THREAT_MODEL,RELEASE_BACKLOG,tasks/README; projects actions/schemas/queries/components/project-list; products/queries; database.types; domain; projects.test. 시작 전 변경3개는 별도 보존했다.
61. **Migration files**: supabase/migrations/0006_add_project_owner.sql 하나. operations/*.sql은 자동 migration이 아닌 명시 운영 절차다. 기존 migration 수정0/RLS policy SQL0/Storage policy SQL0.
62. **Dependency changes**: 이번 추가0. 시작 시 있던 @supabase/ssr0.12.7+cookie1.1.1 diff는 TASK-056 잔여이며 그대로 보존했다. psql 실행 파일은 운영 전제이고 npm dependency가 아니다.
63. **Package version**: package.json/package-lock.json 모두0.2.1 유지.
64. **Tests**: 전체 Node suite PASS, 새 ownership21개. 별도 PostgreSQL harness는 NOT_RUN이며1465 통과 수에 포함하지 않는다. artifacts/TASK-057/tests.log,postgres.json.
65. **Total tests**:1465/1465 PASS, fail/cancelled/skipped/todo0,68657.622ms. 실제 DB SQL rehearsal을 skipped0에 숨기지 않고 별도 NOT_RUN으로 기록한다.
66. **Typegen**: npx.cmd next typegen PASS. artifacts/TASK-057/typegen.log.
67. **Typecheck**: npx.cmd tsc --noEmit PASS. artifacts/TASK-057/typecheck.log.
68. **Lint**: npm.cmd run lint PASS, error0/warning0. artifacts/TASK-057/lint.log.
69. **Build**: npm.cmd run build PASS. 기존 route/Proxy inventory 유지, Auth/ownership UI나 endpoint 추가0.
70. **Diff check**: git diff --check PASS. 신규 파일 whitespace/conflict marker·문서 local links 별도 확인. artifacts/TASK-057/audit.json.
71. **Secret scan**: tracked/untracked 텍스트, 현재 .next/static, TASK-057 evidence에서 설정된 실제 secret 및 credential 패턴 누출0. 값 자체를 출력하지 않는다. 신규 owner service/chain graph에 admin import0.
72. **Client bundle secret scan**: 실제 .next/static에 server secret 값/privileged marker0. 기존 Browser Auth 별도 web-target bundle 검사도 PASS. CLI/운영 SQL은 browser import graph 밖이며 Project UI type 변경은 runtime owner 전달을 추가하지 않는다.
73. **Public SaaS readiness**: **BLOCKED**. Authentication/ownership foundation 구현 상태와 실제 운영·SQL·public security gate 완료는 별개다.
74. **Remaining blockers**: 완전한 local DB에서 migration/upgrade/backfill/constraints/typegen 검증, owner NULL0 및 Asset 복합 FK/불변성/RLS, Storage 격리, 일반 service-role 제거, safe Export, Auth UI·local Auth E2E·abuse/cost control.
75. **Next recommended TASK**: TASK-058 — DB RLS & Ownership Enforcement. 먼저 local SQL rehearsal을 가능하게 하고0006/B/C의 실제 동작을 확인한 후 RLS/grants/관계·불변 제약을 적용한다.
76. **Git diff summary**: 이번 신규14개/수정16개, 선행 수정3개 포함 working tree33개. package/lock/next.config의 시작 hash 보존, staged0, commit/main merge/tag0. 상세 line count와 보호 원본/fixture hash 결과는 artifacts/TASK-057/audit.json에 기록했다.

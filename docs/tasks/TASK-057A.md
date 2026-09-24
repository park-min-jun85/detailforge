# TASK-057A — v0.3.0 Ownership Migration Runtime Validation

2026-09-24 · **SQL runtime PASS · TASK-057 최종 완료 · Public SaaS BLOCKED**.

로컬 Supabase PostgreSQL17.6 및 실제 GoTrue API에서 검증했다. TASK-057의 migration/운영 SQL과 production code는 수정하지 않았다. 검증 전용 stack은 정지했고 DB volume은 보존했다. [Ownership contract](../V0_3_OWNERSHIP_CONTRACT.md), [TASK-057 원래 보고 및 후속 판정](TASK-057.md).

1. **TASK 목적**: TASK-057에서 미실행했던 fresh migration, v0.2.1 upgrade, 실제 Auth bootstrap/backfill/final constraint를 local runtime으로 검증한다.
2. **Branch**: `feat/project-ownership-foundation`. HEAD/main/캐시 origin/main은 `e55094634658e6f95d01e795527cb32b25445673`. 시작 시 TASK-056/057 변경33개를 기록·보존했다. reset/restore/clean/stage/commit/merge/tag0.
3. **postgres.bki root cause**: `C:/Program Files/PostgreSQL/18` 설치 기록에는 Command Line Tools가 있으며 bin/lib는 있으나 share/postgres.bki가 없다. TASK-057의 host initdb가 이 경로를 server runtime으로 사용해 실패했다. sandbox 밖에서도 같은 누락이 확인되므로 SQL 문제가 아니다. Docker 이미지의 bki 누락이 아니었다.
4. **Affected runtime**: 호스트 PostgreSQL18.6로 만들려던 임시 test cluster. 기존 Supabase Docker PostgreSQL이 손상됐다는 근거는 없었다. sandbox의 restricted-token 오류와 실제 share 파일 누락을 구분했다.
5. **Supabase CLI 상태**: 설치본2.116.0 유지. 최초 sandbox 실행은 사용자 telemetry 파일 EPERM으로 실패하여 sandbox 밖에서 version/status를 조회했다. 원래 프로젝트 DB 컨테이너는 없었고 supabase/config.toml 및 기존 Local/CI workflow도 없었다. 기존 linked-project 정보를 새 환경에 복사하지 않았다.
6. **Docker 상태**: `docker ps/images`는 docker.exe PATH 부재로 실행 불가였지만 Docker Desktop WSL/daemon은 정상이다. named pipe 읽기 전용 API로 Engine29.8.0 linux/amd64, 시작 전 컨테이너0, Supabase 이미지와 기존 family-archive DB volume1개를 확인했다. PATH 부재를 daemon 부재로 취급하지 않았다.
7. **Recovery action**: host 재설치 대신 `node_modules/.cache/task057a/local`에 unlinked 프로젝트 `detailforge-task057a`를 init/start했다. CLI가 필요한 Docker 이미지를 준비했다. PostgreSQL image17.6.1.165, 실제 server17.6, GoTrue2.196.0, PostgREST16.1, postgres-meta0.98.0 사용. host psql/pg_dump18.6은 client로만 사용했다.
8. **Destructive action 여부**: db reset, prune, volume 삭제, factory reset, 기존 DB/schema/data 삭제0. 검증 끝에 해당 stack만 stop(backup=true)했다. 테스트의 Auth user DELETE는 FK 거부를 확인하는 실패 요청이며 row를 삭제하지 않았다.
9. **Local data preservation**: 기존 supabase_db_family-archive volume을 mount/변경/삭제하지 않았다. 별도 supabase_db_detailforge-task057a에 고유 이름의 검증 DB를 만들었다. 기존 프로젝트 파일·0001~0006 및 운영 SQL hash 보존. 원본4개/patch3개 hash도 보존했다.
10. **Baseline migration**: 실제 Supabase bootstrap schema를 새 DB에 복제하고0001~0005를 저장소 순서대로 적용 PASS. app schema가 없는 baseline임을 선행 검사했다. 최소 fake auth.users table로 대체하지 않았다.
11. **Fresh DB migration**: 새 DB에0001~0006 적용 PASS. owner UUID/FK/index 존재, NULL legacy row0, default owner 없음. 이후 Stage C 적용 PASS.
12. **Upgrade fixture**:0001~0005 상태에서 owner 없이 Project3개 및 Product/Facts/Options/Asset/Page/Section full graph 생성→0006 적용 후 Project3개 모두 NULL로 보존. 기존-owned B fixture1개를 설정하고 나머지2개를 backfill 대상으로 검증했다.
13. **Local Auth fixture**: 실제 loopback GoTrue Admin API createUser로 `user-a-<run>@example.test`, `user-b-<run>@example.test` 생성, email_confirm=true. password는 실행마다 생성한 local fixture 값이며 출력·저장하지 않았다. 이메일 delivery/UI/session E2E 검증은 범위 밖이다.
14. **Bootstrap user**: Auth API가 반환한 실제 UUID를 explicit argument로 사용했다. 첫 사용자 자동 선택/실제 개인 이메일/production UUID 하드코딩0. 최종 run2개, 초기 환경 권한 진단·추가 타입 검증을 포함한3회 실행에서 local Auth fixture는 총6개 생성됐다. 원격 생성0.
15. **Actual backfill**: 저장소 `supabase/operations/backfill-project-owner.sql`을 psql에서 그대로 실행 PASS. explicit user+allowlist, default dry-run과 apply=true를 분리했다. UPDATE2개이며 다른 owner overwrite0.
16. **Null rows before**: migration 직후3개, 이미-owned B1개를 준비한 backfill 시작 시2개. dry-run과 모든 실패 case 후에도2개 유지.
17. **Null rows after**:0. 최종 total3/owned3/distinctOwners2, Asset chain mismatch0/duplicate path0/path mismatch0.
18. **Idempotent rerun**: 같은 bootstrap/allowlist 재실행 updated0, 기존 owned row와 timestamp 동일 PASS.
19. **Invalid UUID**: 실제 SQL의 uuid cast가 거부. mutation 없음 PASS.
20. **Nonexistent user**: auth.users preflight에서 Bootstrap auth user not found로 중단. mutation 없음 PASS.
21. **Existing owner protection**: 다른 owner의 row를 allowlist에 넣으면 transaction 중단. 정상 run 후 기존 B row 전체 JSON/timestamp 정확히 동일 PASS. unknown/duplicate/incomplete allowlist도 거부했다.
22. **Zero-row behavior**: 유효 local Auth user+빈 allowlist, NULL row0일 때 apply=true updated0 PASS.
23. **Final constraint**: fresh0row 및 upgrade backfill 완료 후 finalize apply=true로 실제 NOT NULL 적용 PASS. repeat finalize PASS. owner 없는 신규 INSERT는 SQLSTATE23502로 거부한다.
24. **Fail-closed gate**: NULL2개 상태의 finalization은 Ownership backfill incomplete로 실패하고 column은 nullable로 유지됐다. prerequisite 확인만 하는 apply 없는 fresh finalize도 schema를 바꾸지 않았다.
25. **FK**: 존재하지 않는 auth user의 owner INSERT는23503, API로 만든 유효 user는 allow. catalog에서 auth.users FK의 RESTRICT 의미를 확인했다.
26. **Delete semantics**: Project가 있는 Auth user DELETE는23503으로 거부되고 Project row 수1 유지 PASS. cascade loss 없음.
27. **Index**: 실제 projects index는 PK+projects_owner_id_idx 총2개. owner_id 단일 index definition 확인 PASS. 불필요한 추가 index0; 성능 EXPLAIN 검증은 이번 범위 밖이다.
28. **database.types**: actual Stage A schema에서 CLI gen types 수행 후7개 public table의 Row/Insert/Update/Relationships를 AST로 비교, 모두 일치. production file 수정0. Stage C도 실제 생성하여 owner_id:string/Insert required 변화를 확인했다. 저장소는 자동 migration 끝인 Stage A(nullable)에 맞게 유지한다. CLI db-url 생성본에 기존 __InternalSupabase.PostgrestVersion14.5 hint가 없는 metadata 차이는 schema 불일치가 아니며 로컬 PostgREST 버전으로 운영 hint를 덮어쓰지 않았다.
29. **Migration 수정 여부**:0. migration0001~0006 및 backfill/finalize/audit SQL 모두 TASK-057A 시작 hash와 일치한다.
30. **Migration 수정 내용**:없음. 첫 runtime 시도에서 Supabase 일반 postgres role로 시스템 schema를 복제하다 log_min_messages 설정 권한42501에 막혔다. test harness의 local administrator만 supabase_admin으로 바꿔 재실행했다. SQL 환경 권한과 application migration bug를 구분했다.
31. **Remote DB mutation**:0. main linked project의 migration/backfill/reset/DDL/DML/원격 catalog 조회 없음. DB 주소는127.0.0.1:56322를 강제한다.
32. **Remote Auth mutation**:0. Auth 요청은127.0.0.1:56321 origin만 허용하며 redirect를 거부한다. key/token/DB URL/password는 출력하지 않았다.
33. **Tests**: actual Supabase runtime34 checks PASS. 정적 SQL 검사와 구분되는 real DB assertions이며 generated type 비교도 포함한다. 기존 전체 Node suite도 재실행 PASS. artifacts/TASK-057A/runtime.json 및 tests.log.
34. **Total tests**: Node suite1465/1465, fail/cancelled/skipped/todo0,67274.1114ms. 별도 runtime34/34 PASS. Node suite count를1499로 바꾸지 않는다.
35. **Typegen**: npx.cmd next typegen PASS.
36. **Typecheck**: npx.cmd tsc --noEmit PASS.
37. **Lint**: npm.cmd run lint PASS, error0/warning0.
38. **Build**: npm.cmd run build PASS. routes/Proxy 및 기존 application behavior 변경0.
39. **Diff check**: git diff --check와 신규 파일 whitespace/conflict/link 검사 PASS. TASK-057A audit에 기존 변경 보존도 기록했다.
40. **Secret scan**: repository 텍스트/실제 .next/static/TASK-057A evidence/검증 helper에서 실제 설정된 secret 및 credential 패턴 누출0. Auth schema/data dump는 process memory로만 전달하고 artifact에 저장하지 않았다. generated types에는 데이터가 없다.
41. **Client bundle scan**: 실제 .next/static secret/privileged marker0. browser auth web bundle57 modules, server module0/secret marker0 PASS. runtime harness는 app/browser graph 밖이다.
42. **TASK-057 final verdict**: **COMPLETE**. fresh/upgrade/local Auth/backfill/idempotency/NULL gate/FK/index/final constraint/types/전체 회귀가 모두 PASS다. 운영 schema rollout을 실행했다는 뜻은 아니다.
43. **Public SaaS readiness**: **BLOCKED**. ownership data correctness를 검증했으며 cross-user DB RLS security를 검증한 것은 아니다.
44. **Remaining blockers**: 사용자 RLS/DB owner·parent 불변성/Asset 복합 FK, Storage isolation, 일반 service-role migration, Export auth, Auth UI·실제 사용자 flows·비용/abuse control·public rollout 검증.
45. **Next recommended TASK**: TASK-058 — DB RLS & Ownership Enforcement. 실제 local runtime 기반에서 A/B/anon SQL/SDK 우회와 관계 제약을 검증한다.
46. **Git diff summary**: TASK-057A 신규2개(이 보고서, tests/ownership-runtime.supabase.mjs), 기존 문서 후속 기록만 수정. production/SQL/package/dependency 변경0, version0.2.1. 시작 전33개 변경은 보존했다. 세부 파일/line count는 artifacts/TASK-057A/audit.json. Git commit/main merge/tag0.

## 재현 환경과 증거

검증 harness는 app env나 remote project ref를 읽지 않는다. `node_modules/.cache/task057a/local/supabase/config.toml`의 project_id가 detailforge-task057a인지 확인하고 status의 API/DB 주소를 loopback56321/56322로 강제한다. 매 run마다 새 DB 이름을 생성하고 기존 DB를 reset/drop하지 않는다. actual Auth API로 만든 users/identities와 Supabase의 진짜 bootstrap schema를 memory dump로 새 DB에 복제한다. 따라서 child schema/FK는 실제 Supabase schema를 참조하며 test-only fake auth.users 정의를 사용하지 않는다.

새 환경 재현은 cache workdir에 `supabase init` 후 project_id를 detailforge-task057a, API/DB 포트를56321/56322, shadow56320, major_version17, seed disabled로 설정한다. 다른 프로젝트의 config/temp/env를 복사하지 않는다. CLI start에서 realtime/storage-api/imgproxy/studio/edge-runtime/logflare/vector/supavisor를 제외했다. 제외 서비스의 bootstrap SQL 준비 때문에 일부 Docker 이미지도 내려받을 수 있다. CLI start/status의 원본 key 출력은 로그로 남기지 않고 필요한 값만 프로세스 메모리에서 사용한다.

```powershell
# 검증 전용 config가 준비된 상태에서만 실행한다.
node tests/ownership-runtime.supabase.mjs
# 검증 후 해당 stack만 정지, 기본 backup으로 volume은 보존한다.
npx.cmd --no-install supabase stop --workdir node_modules/.cache/task057a/local
```

증거: artifacts/TASK-057A/{docker-before,docker-after,runtime,audit}.json, database.stage-a.types.ts.txt, database.stage-c.types.ts.txt, tests/typegen/typecheck/lint/build/browser logs. runtime-attempt-1.json은 환경 복제 role 오류, runtime-attempt-2.json은 최초33 checks PASS, runtime.json은 최종34 checks PASS다. 기존 TASK-057의 postgres.json NOT_RUN은 당시 기록으로 보존했다. [Supabase local 설정](https://supabase.com/docs/guides/local-development/cli/config), [CLI start reference](https://supabase.com/docs/reference/cli/supabase-start).

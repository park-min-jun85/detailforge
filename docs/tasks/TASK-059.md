# TASK-059 — Storage Ownership / Object Isolation

2026-09-24 · C:\Projects\detailforge · package0.2.1.

## 1. Status

**TASK-059 COMPLETE. Public SaaS deployment remains BLOCKED.**

private bucket hardening, 실제 root ownership 정책, Storage-first 승인 경로, 실제 A/B/anon Storage API와 migration/회귀 검증을 완료했다. 사용자 upload/read/sign/delete 판정은 public anon-key client+실제 JWT로 수행했다. 관리자 권한은 fixture/승인 준비, migration/catalog, 정리에만 사용했다. [상세 보안 계약](../V0_3_STORAGE_SECURITY.md).

## 2. Inventory

실제 bucket `product-assets`, 기존0001에서 private으로 생성, owner/owner_id NULL. 최초 MIME/size cap 없음, objects/buckets RLS enabled, policy0.0008 후 private/JPEG·PNG·WebP/10MiB 제한을 유지한다.

경로는 `projects/{project_id}/products/{product_id}/{asset_id}.{jpg|png|webp}` 그대로다. JPEG 입력의 .jpeg 파일명은 저장 시 .jpg로 매핑한다. Storage upload 후 DB Asset INSERT, 실패 시 remove, 정상 삭제는 remove 후 Asset DELETE다.

Storage SDK **8 call-sites/5 files**: assets/service의 upload/remove/batch sign, asset-analysis/service의 single sign, detail-extraction/source의 single sign+fetch download, detail-extraction/service의 Derived upload/remove, visual-assets/inspection의 batch sign. 모두 기존 service-role 경로다. [정확한 파일·줄·TTL·060 이전 목록](../V0_3_STORAGE_SECURITY.md#실제-inventory).

Storage SDK list/download/update/move/copy의 production 호출은0이다. DB listAssets와 signed URL fetch를 구분했다. Editor/Final/Export는 signed image URL을 이용하고 Product analysis는 DB metadata evidence를 이용한다. Tile은 메모리 data URL, manual crop은 새 Derived Object이다.

## 3. Files

신규7개:

- `supabase/migrations/0008_enforce_storage_ownership.sql`
- `scripts/storage-local-stack.mjs`
- `tests/helpers/storage-local.mjs`
- `tests/storage-local-guard.test.mjs`
- `tests/storage-runtime.supabase.mjs`
- `docs/V0_3_STORAGE_SECURITY.md`
- `docs/tasks/TASK-059.md`

수정8개: `README.md`, `docs/03_DATABASE.md`, `docs/RELEASE_BACKLOG.md`, `docs/V0_3_PUBLIC_SAAS_ARCHITECTURE.md`, `docs/V0_3_THREAT_MODEL.md`, `docs/V0_3_DATABASE_RLS_SECURITY.md`, `docs/tasks/README.md`, `docs/tasks/TASK-058.md`.

Production application 파일/기존0001~0007/package·lock/dependency 변경0. Public7-table row 타입은 변하지 않았으며 private schema를 REST 노출 schema에 추가하지 않았다.

## 4. Storage security

| 대상/operation | 구현 |
| --- | --- |
| bucket | private, MIME3종,10MiB, in-place update, 사용자 config mutation restrictive deny |
| SELECT | authenticated + bucket + strict path + 실제 Product→Project→owner equality |
| INSERT | SELECT scope + standard `object.upload` + 정확한 미만료·미소진 서버 승인 path |
| UPDATE | false; own/foreign overwrite/upsert/move 모두 거부 |
| DELETE | root ownership; Asset row 없는 실패 upload도 cleanup 가능 |
| anon | 허용 Object policy 없음; read/sign/list/write 차단 |

Ownership는 projects.owner_id이다. Object owner_id/user_metadata는 권한 근거가 아니다. strict shape 후 UUID cast하므로 malformed path는 false다. Asset row를 위조해도 업로드 승인이 생성되지 않는다. private intent issuer의 실제 owner/parent/UUID 관계와 Asset finalization을 DB trigger로 검증한다.

기존 managed schema owner/테이블 정의는 유지한다. 기본 CRUD grants는 RLS로 제한하며 TRUNCATE/REFERENCES/TRIGGER는 anon/authenticated/PUBLIC에서 제거한다. service_role 권한은060 전까지 유지된다. 함수 ACL/search_path/definer 여부와 role bypass 여부는 실제 catalog로 검증했다.

## 5. Runtime

`detailforge-task059`, API `http://127.0.0.1:58321`, DB127.0.0.1:58322. Storage API v1.70.3/PostgreSQL17.6/GoTrue가 실행되는 전용 Local Supabase다. 실제 사용자A/B를 만들고 anon key→signInWithPassword→getUser→authenticated JWT를 사용했다. anon은 session 없는 별도 client다. `.env.local`/remote credential 비사용, linked project 거부, guarded fetch/redirect:error/timeout, PG env 제거 및 host/port 고정을 적용했다.

최초 fresh/upgrade/negative gate 포함 **73 checks PASS**. 최종 확장 실행 **74 checks PASS**,0 FAIL. 최종에는 모든 거부가4xx인지 확인하고 signed URL expiry/metadata 위조/same-owner 혼합 공격을 추가했다. 이미0008인 primary의 migration negative2개는 반복하지 않았으며 첫73개 증거를 별도로 보존했다. 두 실행 수를 합산하지 않는다.

| Matrix | 결과 | 증거 |
| --- | --- | --- |
| STG-01 bucket | PASS | 실제 private 설정/MIME/10MiB 및 managed owner 유지 |
| STG-02 A own upload | PASS | Asset row 없는 승인 path에 A JWT standard upload |
| STG-03 B own upload | PASS | B JWT 대칭 upload |
| STG-04 own download | PASS | A/B 서로 다른 tiny PNG bytes exact 비교 |
| STG-05 exact foreign download | PASS | A↔B exact/missing path 모두 거부 |
| STG-06 anon download | PASS | private download 및 public URL 거부 |
| STG-07 foreign upload | PASS | A↔B namespace 거부 |
| STG-08 foreign upsert | PASS | A↔B exact path upsert:true 거부 |
| STG-09 foreign update | PASS | Storage update API 양방향 거부 |
| STG-10 foreign delete | PASS | empty-result 또는 deny, 상대 bytes/metadata 보존 |
| STG-11 anon write | PASS | upload/upsert/update/delete 무효 |
| STG-12 own signed URL | PASS | own60초 URL bytes, path 변조 deny,1초 URL 만료 deny |
| STG-13 foreign signed URL | PASS | single/batch foreign URL 발급 없음 |
| STG-14 anon signed URL | PASS | single/batch URL 발급 없음 |
| STG-15 own list | PASS | 자기 object leaf 확인 |
| STG-16 foreign/anon list | PASS | root/projects/상대 Project/Product metadata 노출 없음 |
| STG-17 mixed scope | PASS | A Project+B Product, 역방향, B Asset UUID, same-owner 혼합 |
| STG-18 fabricated path | PASS | missing Project/Product/unapproved Asset/malformed/traversal/extension 거부 |
| STG-19 own delete | PASS | A/B 실제 remove 후 download 불가 |
| STG-20 integrity | PASS | 모든 공격 후 B bytes/SHA-256 및 Object 전체 metadata exact 일치 |
| STG-21 DB/Object consistency | PASS | Asset path 일치, 승인 소진, mismatch rollback, DB path mutation 차단 |
| STG-22 policy catalog | PASS | Object4 + restrictive bucket1, roles/conditions 확인 |
| STG-23 unexpected policy | PASS | 예상 밖 policy preflight 실패, 정책 OR 우회 없음 |
| STG-24 actual sessions | PASS | GoTrue 사용자2명, signed JWT/getUser, 실제 anon |
| STG-25 local-only guard | PASS | host/port/URL credential/redirect 검사, remote fetch 전 거부 |

추가: own overwrite/move/copy 및 승인 path의 signed-upload 거부, 만료 intent 거부, metadata owner 위조 무효, pre-row cleanup, JPEG/WebP 지원, invalid MIME/oversize 거부, bucket public 전환 거부, finalized intent replay 거부. 현재 app이 overwrite를 쓰지 않으므로 own overwrite 허용 CASE는 요구하지 않고 명시적 deny를 검증했다.

재현(Windows, Docker Desktop와 설치된 Supabase CLI·psql/pg_dump 필요):

```powershell
Set-Location C:\Projects\detailforge
node scripts/storage-local-stack.mjs start
node tests/storage-runtime.supabase.mjs
node scripts/storage-local-stack.mjs stop
```

새 workdir은 wrapper가 CLI init/전용 project/5832x ports/seed=false로 준비한다. Storage API를 제외하지 않는다. runner는 빈 public DB에0001~0007을 적용하고 별도 fresh DB에0001~0008을 검증한다. raw CLI credential 출력은 캡처만 하고 저장하지 않는다. PG_BIN은 psql/pg_dump executable directory override다. Migration baseline schema-only DDL은 ignored cache에 보관하고 Auth row/hash/JWT/비밀키는 artifact에 쓰지 않는다.

산출물: `artifacts/TASK-059/runtime-first-upgrade.json`, `runtime.json`, `inventory-before.json`, `catalog-fresh.json`, `catalog-after.json`, `final-state.json`, `docker-{before,after}.json`, 검사 log, `browser-result.json`, `audit.json`.

두 실행이 만든 Auth 사용자4명과 Storage fixture/Object/Project/intent를 정리했다. 최종 primary 잔여 Auth fixture0/Object0/Project0/intent0을 SQL로 확인했다. 테스트 stack은 backup 유지 방식으로 중지하며 DB·Storage evidence volumes와 기존 다른 프로젝트 볼륨을 보존한다.

## 6. Signed URL

Own single/batch sign은 동작하고 foreign/anon은 URL을 얻을 수 없다. 정당한 signed download URL은 bearer이므로 별도 session 없이도 TTL까지 읽힌다. 유효 URL 자체의 재공유나 logout 즉시 회수까지 차단한다고 주장하지 않는다. 실제 token/path 변조 및 만료 거부를 확인했다. 기존 앱60/300초 TTL을 바꾸지 않았고 URL/token을 로그·Git에 저장하지 않았다.

## 7. Migration

신규0008. Fresh chain PASS, 실제 Object/Asset가 있는 local primary upgrade PASS. Object bytes와 metadata/public7-table 모든 row를 보존했다. malformed 기존 Object, permissive policy drift, raw 재실행은 fail-closed이며 자동 삭제·이동·수정 없이 중단한다. bucket destructive recreate0, managed table owner 변경0, 신규 dependency0.

서버 승인 intent는 Storage-first를 유지하기 위한 최소 구조다. full quota/분산 ledger와 발급 endpoint는060 범위다. fixture setup에서 만든 승인이 user API의 권한 검사를 bypass하지 않음을 실제 JWT 요청으로 확인했다. 운영 환경 적용은 실행하지 않았으며065에서 remote preflight와 snapshot/rehearsal이 필요하다.

## 8. Regression

| 검사 | 결과 |
| --- | --- |
| `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs` | **1470/1470 PASS**, fail0/skip0; 기존1465+guard5 |
| actual Local Storage | 최초73 / 최종74 checks 각각 PASS |
| `npx.cmd next typegen` | PASS |
| `npx.cmd tsc --noEmit` | PASS |
| `npm.cmd run lint` | PASS, warning0 |
| `npm.cmd run build` | PASS |
| `git diff --check` + 신규파일 whitespace/conflict/link | PASS |
| secret scan | PASS, 원격 configured secret exact 값 및 token markers 미검출 |
| Auth client web bundle | PASS,57 modules/590630 bytes, serverModules0/secretMarkers0 |
| production `.next/static` bundle | secret/server marker0 |
| 원본4/fixture patch3 SHA-256 | 변경 없음 |

기존 import/long image/extraction/Derived/manual crop/AI analysis/editor/Final/Export의 전체 mock 회귀는 통과했다. production application은 변경하지 않았다. 실제 새 AI 호출/실제 production 이미지 처리/browser export를 다시 실행한 것으로 보고하지 않는다. 기존 service-role 동작 유지와 user-scoped app adoption 미완료를 구분한다.

## 9. Security findings

- **BLOCKER:** 일반 Storage8개/전체31개 service-role factory 호출과 사용자 진입점 통합 미완료. Storage RLS를 이 경로가 bypass하므로060/061 전 공개 금지.
- **BLOCKER:** Export authorization, 전체 cross-user/own-user/release gate 미완료(062~065).
- **HIGH:** intent 발급의 verified actor·atomic quota/bytes/slot·rate/concurrency 및 모든 신규 upload bounded decode는060과 후속 검증이 필요하다. 현재 intent 구조 자체를 비용 제어 완료로 보지 않는다.
- **MEDIUM:** 유효 signed bearer URL은 TTL 동안 공유 가능하다. Project를 DB에서 먼저 삭제하면 Object cleanup이 별도 필요하며 현재 전체 workflow에서는 아직 검증하지 않았다. 제약 오류/타이밍의 모든 존재 추론과 대규모 listing 성능까지 해결한 것은 아니다.
- **LOW:** 이번 검증 범위에서 별도 미해결 LOW 발견 없음. 완전한 무위험 보증은 아니다.

검증한 Storage row/object 격리 범위의 미해결 BLOCKER/HIGH는 없다. 위 항목은 Public SaaS 전체의 남은 gate다.

## 10. Mutation

Remote DB0 / Remote Auth0 / Remote Storage0. 유료 AI0. 기존 원본/Derived bytes 변경0. 허용된 변경은 workspace 구현·문서와 전용 Local Supabase synthetic fixture/DDL/Auth/Storage뿐이다.

## 11. Remaining Public SaaS blockers

TASK-060 service-role/cost-abuse controls 및 intent issuance, TASK-061 Login/Signup/Logout/protected UX, TASK-062 Export authorization, TASK-063 cross-user Security E2E, TASK-064 own-user full workflow, TASK-065 v0.3.0 release validation.

**Public SaaS deployment remains BLOCKED.**

## 12. Git

Branch `feat/storage-ownership`, HEAD/main `c1f845e2ad0ac1e6b59707680bbb900e9df5631b` 유지. cached origin/main은 시작부터 `8906c0cee85b01281f2ddfa557469482cb58a981`였으며 fetch/push하지 않았다. 시작 working tree clean, 최종 신규7/수정8만 남긴다. stage0/commit0/merge0/tag0. reset/restore/clean 미실행.

## 13. Next

**TASK-060 — service-role migration / cost-abuse controls.** Storage-first 승인 발급을 verified actor 및 atomic quota와 연결하고8개 Storage SDK 경로와31개 factory 호출을 사용자 client로 이전한다. Export/전체 E2E와 release 완료 전까지 공개하지 않는다.

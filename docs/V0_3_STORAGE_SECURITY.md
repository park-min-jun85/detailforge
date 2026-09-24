# v0.3.0 Storage Ownership / Object Isolation

2026-09-24 · TASK-059 · **구현 및 실제 Local Storage 검증 완료. Public SaaS deployment remains BLOCKED.**

[TASK-059 결과·재현](tasks/TASK-059.md), [DB RLS](V0_3_DATABASE_RLS_SECURITY.md), [전체 architecture](V0_3_PUBLIC_SAAS_ARCHITECTURE.md), [Threat model](V0_3_THREAT_MODEL.md).

## 실제 inventory

Source 전체 검색과 Local Supabase catalog를 조사했다. 사용자 bucket은 **product-assets 하나**이며0001 SQL이 생성한다. 최초 bucket은 private, owner/owner_id=NULL, file_size_limit/allowed_mime_types=NULL이었다. storage.objects/buckets는 managed owner `supabase_storage_admin`, RLS enabled, policy0이었다. 기본 anon/authenticated/service_role grants에는 CRUD 외 TRUNCATE/REFERENCES/TRIGGER도 있었다. 원격 catalog는 조회·변경하지 않았다.

현재 Storage SDK 호출식은 **8개/5파일**, 모두 server-only의 service-role client 또는 그 client를 전달받는 helper다. Browser Auth client는 Storage를 호출하지 않는다. `createSupabaseServerClient`는 admin factory의 명시적 호환 alias이며 user session client가 아니다.

| Source | SDK 호출 / TTL | 실제 사용과 TASK-060 이전 대상 |
| --- | --- | --- |
| src/features/assets/service.ts:58 | createSignedUrls, 300초 | DB Asset list → 미리보기, Editor, Final Renderer, extraction review |
| src/features/assets/service.ts:68 | remove | upload 실패 보상, 명시적 Asset 삭제 |
| src/features/assets/service.ts:97 | upload, upsert:false | 수동 이미지 및 wholesale-import/service.ts의 uploadAsset 재사용 |
| src/features/asset-analysis/service.ts:92 | createSignedUrl, 300초 | AI 이미지 분석 provider 입력 |
| src/features/detail-extraction/source.ts:37 | createSignedUrl, 60초 | fetch로 원본 bytes 다운로드; configured origin/path/redirect/10MiB 제한 |
| src/features/detail-extraction/service.ts:126 | remove | Derived 저장 실패 보상 |
| src/features/detail-extraction/service.ts:138 | upload, upsert:false | 자동 추출·manual crop의 새 Derived UUID Object |
| src/features/visual-assets/inspection.ts:15 | createSignedUrls, 60초 | Planner 가용성/해상도 검사; 필요하면 loadSource 재사용 |

앱에 Storage SDK `download/list/update/move/copy` 직접 호출은 없다. `listAssets`는 public.assets DB query 후 batch sign이며 Storage list API와 다르다. signed URL은 브라우저 image/Export Chromium 및 server fetch로 읽는다. Product analysis는 DB의 Facts/Asset 분석 metadata를 evidence로 사용하며 별도 Asset URL fetch를 하지 않는다. Tile은 메모리의 JPEG data URL이고 독립 Storage Object가 아니다. Derived/manual crop은 새 UUID/path를 만들며 기존 Object를 overwrite하지 않는다. encodeCrop도 MAX_FILE_BYTES를 검사하므로 bucket cap과 일치한다.

## Path와 format 계약

`assets/schemas.ts`의 storagePath/parseId와0007 DB CHECK가 기준이다.

```text
projects/{project UUID}/products/{product UUID}/{asset UUID}.{jpg|png|webp}
```

UUID는 canonical 소문자, 정확히5개 path segment, 확장자는 jpg/png/webp이다. MIME은 image/jpeg,image/png,image/webp이고 입력 JPEG 파일명의 `.jpeg`는 허용하되 저장 경로는 `.jpg`로 만든다. 기존 path/bytes/provenance를 이동·변환하지 않는다. 크기는 **10MiB = 10,485,760 bytes**. bucket cap/MIME는 새 업로드를 제한하며 기존 Object를 지우지 않는다. MIME 선언만으로 실제 image decode의 안전성을 증명하지 않는다.

## Ownership와 정책

Canonical owner는 `public.projects.owner_id`다. Storage owner_id/user_metadata 또는 문자열 prefix만으로 허용하지 않는다. `app_private.owns_asset_object(name)`은 strict path 검사를 먼저 수행하고, UUID cast 후 실제 Product→Project 관계 및 auth.uid()를 확인한다. malformed UUID/path는 cast exception이 아닌 false이다. SECURITY INVOKER, fixed empty search_path, authenticated EXECUTE만 있으며 public DB RLS를 우회하지 않는다.

| storage.objects policy | Role | 조건 |
| --- | --- | --- |
| product_assets_owner_select | authenticated | bucket 일치 + strict path + 실제 Product/Project + root owner |
| product_assets_approved_insert | authenticated | 위 소유권 + `object.upload` operation + 정확한 유효 미소진 서버 승인 path |
| product_assets_no_update | authenticated | USING false, WITH CHECK false |
| product_assets_owner_delete | authenticated | SELECT와 같은 root ownership, Asset row 존재 불필요 |

anon용 허용 policy가 없으므로 download/list/sign/write가 차단된다. managed table의 CRUD grants는 유지하고 RLS를 적용한다. RLS로 보호할 수 없는 TRUNCATE 등 불필요한 TRUNCATE/REFERENCES/TRIGGER는 PUBLIC/anon/authenticated에서 revoke했다. 이는 managed tables에 대한 capability 축소이며 다른 bucket의 Object/정책/설정을 바꾸지 않는다. service_role 기존 권한은 유지된다.

`storage.buckets`에는 product-assets config를 사용자에게 열지 않는 restrictive guard를 추가했다. bucket public=false, MIME3종,10MiB를 update-in-place하며 table 소유자/정의는 바꾸지 않는다. A/anon의 bucket 생성·삭제·public 전환도 실제 API에서 실패했다. 실제 grants/roles/policies는 ignored `artifacts/TASK-059/{inventory-before,catalog-after,final-state}.json`에 기록했다.

[Supabase access control](https://supabase.com/docs/guides/storage/security/access-control)의 INSERT/UPDATE 권한 구분과 [operation helpers](https://supabase.com/docs/guides/storage/schema/helper-functions)를 따른다. Local Storage v1.70.3의 [operation 목록](https://github.com/supabase/storage/blob/v1.70.3/src/http/routes/operations.ts)을 확인해 standard upload만 허용했다. 해당 helper가 없는 환경에는 migration이 fail-closed하며 임의로 넓은 INSERT를 허용하지 않는다.

## Storage-first staged upload

현재 정상 순서는 **Storage upload → Asset INSERT**이며 실패 시 Storage remove, 일반 삭제는 Storage remove → Asset DELETE다. INSERT/cleanup에 Asset row 존재를 강제하지 않는다.

이번 사용자 요청의 실제 own upload PASS와 fabricated Asset namespace 거부를 함께 만족하도록, 이전055의 “060 전 INSERT 전체 deny” 계획을 최소한의 **서버 승인 경로**로 구체화했다. 새 `app_private.asset_upload_intents`는 quota ledger 전체가 아니다. 발급 HTTP/RPC/UX도 추가하지 않는다. trusted server/offline issuer만 INSERT할 수 있고 사용자에는 own intent SELECT만 허용한다. Supabase REST 노출 schema에도 추가하지 않았다.

1. 신뢰된 issuer가 새 Asset UUID, 실제 owner/Project/Product, 정확한 path, 최대15분의 expiry를 승인한다. FK/shape/owner 및 기존 Asset UUID 충돌을 DB에서 검사한다. 승인 identity/expiry는 불변이다.
2. 사용자는 실제 session JWT로 정확한 path에 standard upload, upsert:false를 요청한다. 유효 intent가 없거나 만료/소진됐으면 거부한다. Asset row만 임의 생성해서 승인을 대체할 수 없다.
3. 같은 Asset의 DB INSERT는 `finalize_asset_upload_intent` trigger로 path/parents/owner를 재확인하고 finalized_at을 같은 transaction에서 설정한다. 불일치하면 Asset INSERT 전체가 rollback된다.
4. Asset INSERT 전에 실패한 Object는 root owner가 정리할 수 있다. 만료된 intent라도 cleanup delete는 허용한다. 미완료 intent는 유효 기간 동안 같은 경로의 삭제 후 재시도를 허용하지만 기존 Object overwrite는 허용하지 않는다.
5. 최종 Asset이 생성되면 intent는 소진된다. 이후 Object와 Asset row를 모두 삭제해도 기존 승인으로 재업로드할 수 없다. Project 삭제 시 intent는 cascade되며 Object 자체는 Storage API로 먼저 정리해야 한다.

Finalizer만 narrow SECURITY DEFINER trigger이다. fixed search_path, 완전한 schema-qualified SQL, 동적 SQL 없음, 직접 EXECUTE를 PUBLIC/anon/authenticated/service_role 모두 revoke, RPC 없음이다. NEW.id에 해당하는 승인 row를 lock한 뒤 관계를 확인하고 finalized_at만 변경한다. 승인 발급·owner 변경·Storage bytes 접근 기능은 없다. 함수 owner/ACL은 catalog assertion으로 기록했다. 읽기 소유권 helper에는 definer를 사용하지 않는다.

기존 admin 업로드에는 intent가 없을 수 있으며 기존 Storage-first 흐름을 유지한다. **실제 runtime의 own upload는 fixture admin이 승인만 준비하고, 업로드 판정은 A/B public-key+JWT로 수행했다.** 이것을 일반 web 요청의 service-role 이전 완료로 해석하지 않는다. TASK-060은 verified actor+atomic quota/bytes/slot 예약과 intent 발급을 묶고 일반 service-role 호출을 제거해야 한다. 현재 앱에 신규 public upload 권한 발급 endpoint는 없다.

## Read/sign/list, replace와 cleanup

직접 private download와 single/batch sign은 Storage SELECT RLS로 소유권을 검사한다. A/B own download는 서로 다른 tiny fixture bytes와 일치하고 foreign exact path와 anon 요청은 거부된다. batch sign은 own 항목만 URL이 있고 foreign에는 URL이 없다. root/projects/foreign Project/foreign Product list에서도 foreign metadata가 보이지 않는다. Storage remove가 foreign 요청에 성공 status+empty array를 반환할 수 있어, 오류 여부뿐 아니라 Object metadata/hash 보존으로 판정했다.

발급된 signed download URL은 **bearer capability**다. 권한 없는 사용자가 경로만 아는 것과 유효 URL 전체를 전달받는 것은 다르다. 유효 URL은 로그인 없이도 TTL까지 읽히며 logout이 즉시 회수하지 않는다. 실제 테스트에서 own URL의 token 없는 추가 인증 없이 bytes를 읽고, path 변조와 만료 후 요청은 거부됨을 확인했다. 기존 앱 TTL60/300초와 no-store/로그 미노출 계약을 유지한다. [Signed downloads](https://supabase.com/docs/guides/storage/serving/downloads).

own update/replace/overwrite는 제품 동작에 필요하지 않으므로 모두 차단한다. foreign 및 own move/copy도 거부하고, 승인된 own destination에 대해서도 signed-upload URL 발급을 거부한다. INSERT의 operation 조건은 copy/signed-upload/TUS/S3 등의 다른 route를 허용하지 않는다. user_metadata의 owner/Project/Asset hint를 위조해도 다른 사용자의 read 권한이 생기지 않는다.

사용자가 Project를 DB에서 먼저 삭제하면 Object가 orphan으로 남을 수 있으며 root가 사라져 user cleanup 권한도 없어진다. 임의 fallback service role을 공개하지 않는다. TASK-060의 scoped cleanup/admin reconciliation 및064 전체 삭제 workflow에서 다룬다. 현재 raw DB ownership 권한 자체가 Storage와 atomic transaction을 제공하지 않는다.

## Migration safety

신규0008 하나이며 기존0001~0007은 그대로다. 한 transaction에서 public root/product/asset 및 managed bucket/object write를 잠그고, bucket 존재/name, managed RLS, helper 버전, 기존 path→Product→owned Project 관계 및 Asset UUID/path 불일치를 확인한다. 예상 밖 objects/buckets policy가 하나라도 있으면 명시적으로 중단한다. 다른 bucket에 합법적인 policy가 있더라도 무관하다고 추측하지 않으므로 운영자가 별도 검토한 migration을 준비해야 한다.

기존 Object/Asset를 삭제·이동·자동 복구하거나 bucket을 recreate하지 않는다. 실제 service fixture Object가 있는 primary local DB에0008을 적용해 public7-table rows와 storage.objects 전체 metadata가 전후 같음을 확인했고, 이후 B client로 기존 bytes를 확인했다. malformed Object와 permissive policy를 넣은 negative fixture에서는 migration이 변경 없이 실패했다. raw SQL 반복은 policy drift gate에서 거부되며 재실행을 성공한 no-op이라고 보고하지 않는다.

Fresh는 genuine platform schema를 별도 DB에 복제하고0001~0008을 적용했다. managed schema owner/ACL도 보존했다. private schema 추가와 Asset trigger만 있으므로 public DB row/insert/update 타입은 바뀌지 않는다. 새 dependency0, remote mutation0. 실제 운영 데이터에 대한 remote preflight·원본 Object snapshot은065 rollout 전 별도 gate다.

## Runtime와 회귀 범위

`detailforge-task059`, API127.0.0.1:58321, DB127.0.0.1:58322로 격리한다. linked project 거부, env의 PG 설정 제거, `.env.local` 비사용, URL host/port/credential 검사, guarded fetch/redirect:error/timeout을 유지한다. 실제 Local GoTrue 사용자2명→anon-key client signInWithPassword→getUser→authenticated JWT, anon은 session 없음이다. role superuser/BYPASSRLS 여부를 catalog에서 별도 검사한다.

최초 upgrade 포함 **73 checks PASS**, 추가 expiry/metadata/same-owner 공격과4xx 확인을 포함한 최종 **74 checks PASS**다. 재실행은 primary에0008이 이미 있어 upgrade negative2개를 반복하지 않고 원본 첫 실행 증거를 보존한다. 최종 fresh chain은 다시 확인했다. 두 실행 수를 합쳐 하나의 test count로 보고하지 않는다. [STG-01~25 및 정확한 명령](tasks/TASK-059.md).

공식 harness **1470 tests PASS**는 기존1465+network guard5개다. 기존 image import/extraction/Derived/manual crop/analysis/editor/renderer/export의 mock 회귀를 포함한다. 실제 새로운 AI 호출이나 production image·browser export를 실행한 증거와 혼동하지 않는다. 이번 production application 파일 변경0이고 기존8개 Storage SDK 경로의 user-scoped 이전은060이다.

**남은 공개 gate:**060 service-role 제거·분산 비용/승인 발급,061 Auth UX/protected routes,062 Export,063 cross-user Security E2E,064 own workflow,065 release/rollout. **Public SaaS deployment remains BLOCKED.**

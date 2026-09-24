# TASK-055 — v0.3.0 Public SaaS Foundation Architecture & Security Plan

2026-09-23 · **설계 완료, 구현 전** · `plan/v0.3.0` · 기준 `cf77916`. 현재 release/package는 v0.2.1 Local/Internal MVP다. 품질 backlog 0/0/0/0은 그대로이며 public 보안 gate는 미구현이다. 이 TASK는 다음 구현 TASK를 자동 실행하거나 공개 배포를 승인하지 않는다.

상세 근거: [Architecture / 실제 code inventory](../V0_3_PUBLIC_SAAS_ARCHITECTURE.md), [Threat model / 검증 matrix](../V0_3_THREAT_MODEL.md). 이번에 원격 Auth/DB/Storage 설정을 변경하지 않았고 실제 RLS 보안 integration을 실행한 것으로 보고하지 않는다.

## 요청한 93개 완료 보고 항목

1. **TASK 목적:** v0.2.1 기능을 보존하면서 다중 사용자가 자기 데이터만 사용하는 공개 기반의 architecture/security 계획 확정. 문서만 변경했다.
2. **branch:** `git branch --show-current` 및 `git status`로 `plan/v0.3.0`, 시작 clean 확인. HEAD/로컬 main/캐시 origin/main/v0.2.1 commit은 `cf77916dfa9e2dc67c4af981b6a9b2633e76e9c9`로 동일. fetch는 하지 않았으며 원격 실시간 상태 주장은 하지 않는다.
3. **current auth state:** Auth/browser client/SSR session/proxy 없음. src의 `.auth.*` 호출 0. Next 16.3.4 App Router, supabase-js 설치2.115.0, @supabase/ssr 미설치.
4. **current service-role architecture:** server-only factory가 URL+service key로 session 없는 client 생성. autoRefreshToken/detectSessionInUrl/persistSession false. 서버 실행 자체는 사용자 격리를 보장하지 않는다.
5. **service-role call-site count:** production factory 호출식31/21파일, SDK constructor1, DB `.from`76, Storage `.from`8/5파일. secret 직접 읽기2곳(factory 및 candidate HMAC). runtime 요청 횟수가 아닌 source 호출식 수이며 Array.from/Buffer.from 제외.
6. **service-role A/B/C classification:** factory31은 전부 A(일반 요청), production B0/C0. 별도 candidate HMAC도 A. mock helper 및 opt-in options browser fixture는 C로 별도 기록. privileged production job 필요성은 발견하지 못했다.
7. **current DB tables:** projects/products/product_facts/assets/detail_pages/sections/product_options, 모두 UUID PK. 실제 parent FK/Project chain/unique/권한을 architecture §3에 table별 기록했다.
8. **current RLS state:** 7개 모두 ENABLE RLS, anon/authenticated ALL revoke, service_role ALL grant, 사용자 policy/owner column 없음. 원격 catalog drift는 미확인.
9. **current Storage structure:** private product-assets, `projects/P/products/Q/A.ext`; 원본/Imported/Derived 동일 규칙. Object→Asset 순서 업로드, sign60/300초, cleanup/remove 위치 확인. Export output Storage write 없음.
10. **Public blocker confirmation:** Auth/owner/RLS/Storage isolation 및 service-role 제거/안전한 Export/분산 abuse control/통합 검증 미구현. 품질 backlog0과 별개로 공개 배포 차단 유지.
11. **Auth candidates:** Email+Password, Magic Link/OTP, OAuth, SMS를 native 지원·복잡도·UX·계정 복구·테스트·비용 측면으로 비교했다. 특정 provider 가격 추정 없음.
12. **recommended Auth:** Email+Password 하나. 익숙한 UX와 A/B 자동화, native 복구 경로를 선택 근거로 했다.
13. **Auth scope:** signup/login/verification/logout/reset Must. SMTP/인증 abuse 대응 포함. OAuth/SMS/team/org/invitation/admin 제외.
14. **session architecture:** Next16 proxy.ts/await cookies/@supabase/ssr, Proxy refresh·초기 redirect와 DAL identity 확인 분리. request/response cookie 갱신·no-store·user JWT RLS. 일반 SSR cookie를 전부 HttpOnly라 주장하지 않는다.
15. **browser client:** public publishable 또는 legacy anon key+user session, Auth UI/상태 이벤트용. secret/service key 금지. 직접 Data API 호출도 가능한 공격면으로 검증.
16. **authenticated server client:** 요청 단위 검증된 user/client AuthContext, RSC/Action/Route/DAL 및 하위 helper로 전파. getSession user JSON을 권한으로 사용하지 않는다.
17. **privileged client:** offline bootstrap 및 격리 fixture 관리만. 일반 web import graph/env에서 service key 제거, user 요청 실패 시 admin fallback 없음.
18. **route protection:** `/`, `/projects`, `/projects/**`, `/api/projects/**`, Project/Product Server Actions 포함. settings/templates는 현재 placeholder이나 보호 Shell에 포함. URL matcher가 DB/RLS를 대신하지 않는다.
19. **ownership candidates:** all-table owner, Project-root, hybrid 비교. 중복 identity drift·backfill·join/index 비용·미래 sharing을 검토했다.
20. **recommended ownership model:** Project-root owner. 실제 7-table graph로 판정, memberships 선제 구현 없음. 한 사용자는 여러 Project 소유 가능.
21. **projects.owner_id design:** 최종 NOT NULL UUID/Auth user FK ON DELETE RESTRICT/생성 후 불변. owner+updated_at+id index 계획. create는 name만 받고 서버 identity/DB CHECK로 owner 결정.
22. **ownership transfer:** v0.3.0 미지원. owner/PK/parent FK/path 불변을 DB에서도 강제; 같은 user 내 reparent도 금지.
23. **existing data backfill:** nullable 도입→명시 owner mapping→hash/관계 검증→NOT NULL. archive/reset/삭제를 기본 해법으로 사용하지 않는다.
24. **bootstrap strategy:** maintenance에서 동일 환경 Auth user를 사전 준비, 프로젝트별 mapping manifest/dry-run/idempotent transaction. 임의 UUID 하드코딩/첫 signup 자동 claim 금지.
25. **estimated migrations:** ownership 준비, enforcement+DB RLS, Storage isolation, private control ledger의 4단계. offline backfill 실행은 migration SQL과 분리.
26. **projects RLS:** own owner SELECT/DELETE USING, INSERT WITH CHECK owner=auth.uid, UPDATE old/new 검사+owner 불변; anon deny.
27. **products RLS:** project_id→projects.owner. CRUD old/new scope 및 parent 불변, foreign Project child 생성 불가.
28. **facts RLS:** product_id→products.project_id→projects.owner. SELECT/INSERT/UPDATE/DELETE 모두 적용, foreign Product insert/upsert 거부.
29. **assets RLS:** own Project+해당 Product 일치, 복합 FK/path 정합·유일·불변 보강. row/path 조합 위조 불가.
30. **detail_pages RLS:** project_id→projects.owner. 실제 schema에 product_id가 없음을 반영.
31. **sections RLS:** detail_page_id→detail_pages.project_id→projects.owner. foreign page/section 및 reparent 차단.
32. **options RLS:** product_id→products.project_id→projects.owner. version CAS와 함께 CRUD/UPsert 양 경로 검증.
33. **INSERT/WITH CHECK:** INSERT는 new CHECK, UPDATE는 old USING+new CHECK, DELETE는 old USING. select-only policy로 완료하지 않으며 grants도 최소 권한으로 함께 전환.
34. **delete/cascade:** 기존 child CASCADE 유지하되 혼합 graph/parent 이동 차단. FK 동작이 RLS를 우회할 수 있음을 반영. DB cascade는 Object 삭제가 아니며 orphan은 deny+제한된 offline 정리.
35. **RLS indexes:** 기존 PK/parent UNIQUE/Assets FK/Sections page+sort index 재사용. Project owner index, Asset composite FK 참조 UNIQUE/path UNIQUE 계획; 실제 EXPLAIN으로 비용 검증.
36. **Storage path candidates:** 새 user prefix와 기존 path+관계 lookup 비교. 문자열 이름 자체는 authorization 아님.
37. **recommended Storage model:** 기존 `projects/P/products/Q/A.ext` 유지, root owner와 Product/Project 관계를 정책에서 확인.
38. **existing object migration:** 대량 copy/move/rename 불필요. 기존 path/bytes/provenance 보존, 불일치 audit·owner backfill 후 접근.
39. **Storage policies:** bucket 한정 SELECT/INSERT/DELETE, UPDATE/upsert/overwrite/move 불허. pre-row upload/cleanup을 고려해 Asset row 존재를 필수로 두지 않고 INSERT는 정확한 path reservation 추가.
40. **signed URL authorization:** user client/RLS→Asset scope→Storage policy→짧은 sign. 유효 URL은 bearer이고 logout 즉시 회수 불가; 경로만 안 B의 발급/직접 download는 거부.
41. **upload authorization:** 기존 MIME/signature/10MiB/30개·source/Derived 제한 유지, bounded pixel decode를 공개 전 보완. bucket bounds+user/global slot/bytes 예약으로 직접 Storage 우회도 제한.
42. **export authorization candidates:** bounded cookie(A), short token(B), signed one-time endpoint(C), origin+service(D) 비교. A refresh token/rotation 위험, B 단독 identity 부족, D 금지.
43. **recommended export strategy:** C, 90초 이하 one-time scoped grant+initiator access JWT/RLS. 정확한 navigation1건 header, refresh token 전달0, private nonce atomic consume, 전후 fingerprint/cleanup.
44. **service-role minimization:** 31곳·client 전달 helper·재조회/보상/sign/export 전부 user-scoped. candidate HMAC 전용키로 분리. 일반 web env에서 service role 제거가 완료 조건.
45. **AI security:** provider/API key/model/prompt 서버 전용, raw request override 불가. Product Facts/grounding/schema·관찰과 사실 분리·원본 보존을 유지.
46. **cost abuse analysis:** 현재 process lock/CAS/lease/journal/checkpoint는 충돌·재시도 완화이며 per-user/day·multi-instance 비용 상한이 아님. regeneration은 provider 중 process lock만 존재.
47. **minimum abuse controls:** verified user, per-user/IP throttle, 원자적 user/global lease·일일 reserve, bounded tile/token/input, provider cap/kill switch Must. 불명확 비용 보수 정산; server-proof 제한 RPC, billing 별도.
48. **CSRF/same-origin:** 현재 helper는 요청 Host로 target host를 덮어써 public trusted-origin 경계로 불충분. 서버 origin allowlist/proxy trust, null/missing Origin 거부, cookie/Action auth, GET mutation 분리 계획.
49. **IDOR threat model:** A/B/anon으로 모든 Project/Product/Asset/Page/Section/candidate ID 교체·nested 혼합·read/write/delete/sign/export/AI를 테스트한다. UI와 직접 API/DB 양쪽 검증.
50. **Storage IDOR:** 실제 Storage에서 B의 A path list/read/sign/delete/overwrite/copy/move deny 및 bytes 불변. 전달받은 유효 signed URL의 잔여 위험은 별도 명시.
51. **API identity source:** 서버에서 검증한 session, DB auth.uid. body/query userId/ownerId/metadata role 무시·거부. Project create 입력은 name만.
52. **error privacy:** 미인증 API401, foreign/missing404, CSRF403, own revision409, quota429, 설정/서비스 unavailable503. SQL/FK/provider stack·owner identity 미노출.
53. **login routes:** /login, /signup, /forgot-password, /auth/confirm 및 recovery-session 전용 /reset-password. UI 구현은 이번 범위 밖.
54. **logout:** same-origin POST signOut·cookie/cache/draft 제거·full navigation. 다중 탭 Auth 이벤트/focus/pageshow 재검증, 계정 전환 데이터 잔류 차단. 발급 JWT/URL의 TTL 한계 명시.
55. **redirect behavior:** 검증한 앱 내부 relative path만 next 허용, 외부/스킴/이중 slash/backslash/인코딩 우회 거부. 복귀 시 fresh RLS, 보호 API에 login HTML redirect 없음.
56. **email verification:** 공개 signup Must, SMTP/redirect/Auth 설정 포함. local도 명시 활성화하고 확인 전 보호 데이터 접근을 테스트.
57. **password reset:** Email+Password의 Public MVP Must. 만료/재사용/recovery identity·일반 오류·비밀번호 로그 미저장.
58. **local development:** existing CLI+local Supabase/Postgres/Auth/Storage/mail inbox 우선, 별도 remote dev 대안. production을 약화시키는 dev auth bypass 없음.
59. **test user strategy:** A/B run별 example.invalid 주소와 실행 중 생성 비밀번호, 개인 이메일 없음. admin seed/teardown과 실제 user test client 분리.
60. **RLS integration tests:** 실제 migrations/Postgres/PostgREST로 7-table CRUD/UPsert/immutable FK/anon/cascade/grants/EXPLAIN. A allow+B deny+anon deny 동시 성공, mock만으로 통과 불가.
61. **Storage integration tests:** real API에서 own upload/read/sign/delete, foreign/anon/forged path/legacy/pre-row cleanup/upsert/copy/move/reservation 검증. 다른 bucket 영향0.
62. **Export security tests:** own PNG/JPG 성공, foreign/anon deny, token 변조/expiry/replay/2-instance consume, JWT actor mismatch·header 외부 누출0·changed fingerprint 실패·cleanup.
63. **AI cross-user tests:** real DB/Auth+mock provider counter로 foreign 호출 provider0/quota차감0/canonical변경0. negative test에 실제 유료 API 사용하지 않음.
64. **existing workflow regression:** 두 사용자 격리된 own graph에서 Import/Options/Extraction/retry/manual crop/AI/Planner/Editor/Renderer/Export, 기존 860px·grounding·content-loss 우선 계약 유지.
65. **existing data migration test:** v0.2.1 full graph/legacy·manual Derived→backfill/upgrade, ID/count/content/path/bytes hash 비교. wrong mapping/NULL/mixed FK/중복 path는 삭제 없이 중단.
66. **rollout order:** staging rehearsal→maintenance/write stop→schema/backfill/RLS/Storage/ledger→user-scoped code/key 전환→A/B/anon+own gates→public open. UI 인증만 먼저 공개 금지.
67. **fail-closed behavior:** missing/invalid/NULL owner, identity/key/policy/ledger 불확실 시 deny. admin fallback/public bucket/grant-all/첫 사용자 자동 claim 없음.
68. **rollback strategy:** ingress·유료 작업 중지, RLS/Storage 유지, 보안 schema 호환 앱 또는 forward-fix. v0.2.1 admin 앱 공개 복귀/RLS disable 금지; 격리 복원 후 다시 gate.
69. **Must Have:** Auth/verify/reset/session, ownership/backfill/RLS/Storage, service-role 제거, protected routes/Actions·privacy/CSRF/cache, 분산 비용/업로드 제한, 안전한 Export, real isolation/upgrade/regression/rollout.
70. **Should Have:** basic account page, quota 잔여 UX/상세 운영 지표, 이메일·접근성 polish, 추가 대량 데이터 성능 최적화. 필수 abuse 제한은 Should에서 제외.
71. **Out of Scope:** billing/subscription/credits 판매, Teams/org/membership/invitation/share/transfer, OAuth/SMS, admin portal, marketplace 자동등록, 신규 AI/이미지 기능.
72. **TASK decomposition:** 056 session, 057 owner/bootstrap, 058 RLS/types, 059 Storage, 060 user data access+분산 control ledger, 061 Auth UX, 062 Export, 063 security E2E, 064 own regression, 065 release.
73. **TASK sequence:** 055→056→057→058→059→060→061→062→063→064→065. 각 단계에서 integration 먼저 수행. 060 세분화 가능하나 비용 gate를 공개 이후로 미루지 않음.
74. **migration estimate:** 현재 마지막0005 재확인, 예상0006~0009 총4개. 0008 신규 upload는 reservation ledger 연결 전 deny; 0009에서 원자적으로 연결. 실제 필요 시 단계 추가, SQL0.
75. **dependency changes expected:** @supabase/ssr 추가 예상1. 현재 SDK로 직접 Auth HTTP는 가능하지만 cookie chunk/PKCE/refresh adapter 재구현을 피하기 위해 공식 helper 채택; 구현 시 호환 버전 확인/고정. 이번 install0.
76. **env changes expected:** public Supabase URL+publishable 또는 legacy anon mode, trusted APP_ORIGIN, 전용 candidate/export/operation signing secrets, quota 설정/SMTP/Auth 운영 설정. 현재 public key 변수 없음; service key는 legacy JWT role=service_role 형식(로컬 decode만), 원격 key 모델 미확인.
77. **생성 문서:** docs/V0_3_PUBLIC_SAAS_ARCHITECTURE.md, docs/V0_3_THREAT_MODEL.md, 이 TASK-055.md, 총3개.
78. **수정 문서:** docs/02_ARCHITECTURE.md, 03_DATABASE.md, 05_UI_UX.md, 07_DECISIONS.md(ADR-016), RELEASE_BACKLOG.md, tasks/README.md, 총6개. 기존 역사 기록은 보존.
79. **production code changes:** 0. src/**/Next config/tests/fixtures 변경 없음. inventory·audit helper와 실행 log는 ignored local evidence만.
80. **migration changes:** 0. 0001~0005 그대로, 새 SQL/remote migration 실행 없음.
81. **dependency changes:** 0. package.json/package-lock.json과 설치 dependency 정의 그대로. @supabase/ssr 설치하지 않음.
82. **package version:** 0.2.1 유지. 0.3.0으로 올리지 않음.
83. **tests:** `node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs` PASS. 이번 새 보안 기능이 구현되었다는 검증이 아니라 기존 기준 회귀다.
84. **total tests:** 1417/1417 PASS, fail/cancelled/skipped/todo0. 약63.3초. 미래 real RLS/Auth/Storage E2E는 미실행.
85. **typegen:** `npx.cmd next typegen` PASS, route types 생성 성공.
86. **typecheck:** `npx.cmd tsc --noEmit` PASS, 오류0.
87. **lint:** `npm.cmd run lint` PASS, 오류0.
88. **build:** `npm.cmd run build` PASS, Next16.3.4 production compilation 및 page generation 성공.
89. **diff check:** PASS. `git diff --check`, 새 문서 whitespace/conflict marker/상대 링크/93항목 연속성 및 docs-only scope 감사 통과.
90. **secret scan:** PASS, findings0. 알려진 local secret3개 값 및 credential pattern을 출력 없이 tracked/untracked 문서·source/test·browser build·TASK-055 evidence/helper 대상으로 검사했다. 원격 secret store 검증은 아님.
91. **main security risks:** 남은 구현 전체 public gate, service-role 잔존/혼합 FK, bearer URL/JWT TTL·XSS/cache, 분산 quota/직접 API 우회, 일회 Export 권한 전파, owner backfill/drift, DB/Object 비원자성. 알려진 한계를 성공으로 숨기지 않는다.
92. **recommended next TASK:** **TASK-056 Auth client/session foundation**. 이번에는 계획만 완료했으며 다음 TASK production 구현을 시작하지 않았다.
93. **git diff summary:** 신규3+수정6, 전부 docs. stage/commit/main merge/tag0, branch/기준 ref 유지. 최종 line count 및 scope audit은 아래 기록.

## 최종 검증 기록

Baseline log와 inventory/audit evidence는 ignored `artifacts/TASK-055/`에 보관한다. 전체1417 tests, typegen/typecheck/lint/build, diff check, 문서 상대 링크와93항목 연속성 검증 **PASS**. 새 RLS/Auth/Storage 통합 검증은 후속 TASK에서 수행한다.

Secret scan은 알려진 configured secret3개의 exact value 및 credential/signed URL pattern을 검사하여 **findings0**이다. 전체 tracked/untracked text와 `.next/static`, TASK-055 evidence/helper를 포함하며 로컬 env 원문/값은 출력하지 않는다. 외부 secret store나 아직 없는 v0.3.0 번들에 대한 보장을 뜻하지 않는다.

기존 보호 원본4개 및 실제 frame patch3개 SHA-256 불변. production/tests/fixtures/migrations/package/lock 변경0, 원격 DB·Storage·Auth mutation0, 실제 유료 AI/도매 API 호출0. 신규3+수정6의9개 문서만 변경했고 기존 tracked 문서 diff는 +50/-0이다. HEAD/main/캐시 origin/main/v0.2.1 ref 불변, staged0, commit/merge/tag 없음. 초기 baseline 이후 code 변경이 없어 전체 tests를 중복 실행하지 않았다.

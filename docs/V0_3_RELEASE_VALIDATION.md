# v0.3.0 Release Validation

2026-10-01 · TASK-065 · C:/Projects/detailforge

**CODE/LOCAL validation COMPLETE. Local Release Candidate PASS. Production rollout BLOCKED / OPERATOR ACTION REQUIRED.**

v0.3.0 release candidate is locally validated. Production rollout remains pending operator-controlled deployment steps. No production migration/deployment/configuration/data mutation or Git release operation occurred.

## Baseline and source inventory

Branch release/v0.3.0-validation,HEAD 4c341999176682cf1a73b5023f5306bdb3eb129d,started clean. Local main matches HEAD and is7 ahead/0 behind cached origin/main 8906c0cee85b01281f2ddfa557469482cb58a981. No fetch: not a claim about the current remote server state. Production change is exactly one user-facing error message for REL-B1 below;Next config,migrations,package/lock unchanged. Package remains0.2.1/private:true;target release naming does not silently bump metadata.

Source inventory:56 page/action/method entries,17 direct env names,2 privileged factory callers. Next16.3.4/React19.2.8;server-only OpenAI/wholesale/Sharp/Playwright operations;user-scoped data and Storage. No Dockerfile,hosting-provider config or release CI workflow found in inspected repository. No production target selected or inspected.

## Migration evidence

MIG-01–10 PASS on actual Local Supabase PostgreSQL 17.6. Fresh0001→0010;upgrade uses genuine v0.2.1 Git blobs0001–0005,legacy seven-table graph/Object metadata,0006,explicit owner allowlist backfill,then0007–0010.0007 rejects incomplete backfill atomically. Git historical0001–0005 unchanged;all10 unchanged from task HEAD. Windows checkout CRLF is not treated as migration drift.

Full pg_dump schema-only output of **public + app_private + storage** matches exactly after removing ONLY the random restrict/unrestrict nonce. Tables,columns/types/defaults,PK/FK/checks,indexes,triggers,policies,RLS flags,functions/signatures/bodies/search_path,owners and grants/revokes are compared. No object/function differences ignored. Bucket configuration matches excluding only created_at/updated_at timestamps. **Schema drift0.** Legacy business content/Object metadata unchanged. Scratch DBs removed. Minimal Auth row is a migration fixture; actual GoTrue JWT and physical legacy Storage-byte acceptance is separately rerun in058–064,including059.

pgcrypto is installed into extensions;managed Supabase Auth/Storage roles/schemas are prerequisites. Seven public tables have RLS enabled and28 CRUD policies. FORCE RLS=false is explicitly recorded: owners/service_role remain privileged;anon/authenticated are not owners and have no BYPASSRLS. Private control tables are RLS-enabled with revoked user CRUD. Storage managed owners preserved;5 policies;private product-assets bucket,10MiB,JPEG/PNG/WebP;false UPDATE policy blocks move/upsert. Complete DDL/catalog/hash evidence:artifacts/TASK-065/schema-{fresh,upgrade}.sql and migration-runtime.json.

## Environment contract

Configured flags below refer only to existing LOCAL .env presence,not production readiness. Values/hashes/fragments are never serialized. Runtime workers use separate explicit disposable Local configuration and disable .env loading.

| Name | Classification | Local configured | Source |
| --- | --- | --- | --- |
| DETAILFORGE_APP_ORIGIN | DEPLOYMENT_CONTROL | true | src/features/detail-export/config.ts, src/lib/auth/origin.ts |
| DETAILFORGE_EXPORT_BROWSER_CHANNEL | DEPLOYMENT_CONTROL | false | src/features/detail-export/browser.ts |
| DETAILFORGE_TICKET_SECRET | SERVER_SECRET | false | src/features/section-regeneration/candidate.ts |
| DOMEGGOOK_API_KEY | SERVER_SECRET | true | src/features/wholesale-import/domeme-api/client.ts |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | PUBLIC | false | src/lib/auth/config.ts |
| NEXT_PUBLIC_SUPABASE_URL | PUBLIC | false | src/features/detail-extraction/source.ts, src/lib/auth/config.ts |
| NODE_ENV | DEPLOYMENT_CONTROL | false | src/features/detail-export/config.ts, src/lib/auth/config.ts |
| OPENAI_API_KEY | SERVER_SECRET | true | src/features/asset-analysis/config.ts, src/features/detail-extraction/provider.ts, src/features/fact-validation/config.ts, src/features/page-planner/config.ts, src/features/product-analysis/config.ts, src/features/section-engine/config.ts, src/features/section-regeneration/config.ts |
| OPENAI_ASSET_MODEL | OPTIONAL_PROVIDER | true | src/features/asset-analysis/config.ts |
| OPENAI_DETAIL_EXTRACTION_MODEL | OPTIONAL_PROVIDER | false | src/features/detail-extraction/provider.ts |
| OPENAI_PLANNER_MODEL | OPTIONAL_PROVIDER | false | src/features/page-planner/config.ts |
| OPENAI_PRODUCT_MODEL | OPTIONAL_PROVIDER | false | src/features/product-analysis/config.ts |
| OPENAI_SECTION_MODEL | OPTIONAL_PROVIDER | false | src/features/section-engine/config.ts |
| OPENAI_SECTION_REGEN_MODEL | OPTIONAL_PROVIDER | false | src/features/section-regeneration/config.ts |
| OPENAI_VALIDATION_MODEL | OPTIONAL_PROVIDER | false | src/features/fact-validation/config.ts |
| SUPABASE_SERVICE_ROLE_KEY | SERVER_SECRET | true | src/lib/supabase/admin.ts |
| SUPABASE_URL | DEPLOYMENT_CONTROL | true | src/features/detail-extraction/source.ts, src/features/visual-assets/inspection.ts, src/lib/auth/session.ts, src/lib/supabase/admin.ts |

Library deployment control:PLAYWRIGHT_BROWSERS_PATH must match browser install/runtime cache. TEST_ONLY:DETAILFORGE_OPTIONS_BROWSER, OWN_EVENTS, PG_BIN, RELEASE_EVENTS, TASK022_ARTIFACT_DIR, TASK022_ORIGIN, XUSER_EVENTS. PG_BIN/event/artifact controls are not SaaS requirements.

Public build-time pair must be same-project HTTPS origin + sb_publishable_ key;changes require rebuilding Next. Legacy JWT/secret key formats reject. SUPABASE_URL must match public origin. Service role,OpenAI and Domeggook keys stay server-only. AI key is required for AI features;Domeggook key is required only for official integration,not login. Model defaults:asset/extraction gpt-5.6-luna;product/validation/planner/sections/regeneration gpt-5.6-terra. Actual model access/budget is an operator gate,no paid calls made.

DETAILFORGE_TICKET_SECRET signs Section candidates,not Export. Source checks minimum32 characters,which does not establish entropy. Operator must use at least32 cryptographically random bytes from a secret manager,no fixture/repeated/low-entropy value,no service-key fallback,same value across compatible workers. Rotation invalidates outstanding10-minute Section candidates. Export independently generates256-bit token+worker capabilities and stores hashes with90-second TTL.

ENV14 executes actual production functions without provider I/O:missing public pair permits compatibility startup but required protected runtime fails closed;secret-shaped public key,missing/invalid server URL/key,mixed projects,missing/nonlocal-HTTP origin and missing/short candidate root reject without secret reflection. Random dedicated root signs/verifies. Production Secure/SameSite=Lax/path=/ cookies are intentionally HttpOnly=false for shared Supabase browser/SSR sessions. Source allows loopback HTTP for Local testing;production deployment requires HTTPS.

## Origins,Auth,headers and caching

All9 loopback references reviewed:URL-validation allowlists,SSRF blocks,a comment,and development-only Export fallback. Production missing trusted origin throws;no fixed Local destination is selected in production. Actual Auth routes:/auth/signin,/auth/signup,/auth/signout,/auth/session,/auth/callback;UI /login,/signup. Earlier064 table labels corrected. getUser verifies principal before RSC/prefetch/Action/API;POST signout uses local-session scope,not account-wide logout.

Production Auth operator requirements:exact HTTPS Site URL/callback allowlist,email confirmation enabled,working SMTP/templates,password policy≥8,JWT/session refresh/getUser behavior,rate limits and safe return paths. No remote configuration was inspected;MFA/social support is not claimed. Auth20 covers actual signup/confirmation callback/login/stale+malformed sessions/protected surfaces/redirects/logout.

Proxy responses:private,no-store,Pragma:no-cache,Expires:0,no-referrer. Export/image/options add nosniff. Export capture CSP restricts external connections,frames,objects,forms and embedding;explicit inline scripts/styles support Next. No app-wide CSP/X-Frame-Options/nosniff/HSTS configuration in next.config. Protected/capability caches are safe in local evidence;global hardening and CDN behavior require actual staged ingress tests. No unsupported global-header PASS claim.

## Privileged surface

| File/function | Purpose / why privileged | Scope and secret surface |
| --- | --- | --- |
| src/lib/supabase/admin.ts:createSupabaseAdminClient | server-only factory | reads env;errors name invalid fields only;no ordinary user callsite |
| src/lib/abuse/privileged.ts:admissionRpc | reserve/settle private global quota ledger unavailable to users | principal+owned Project/Product+operation fingerprint;SQL rechecks;no generic client/CRUD returned |
| src/features/detail-export/authorization.ts:rpc | issue/use/close private ticket/snapshot lifecycle | user-RLS graph/assets first;random capabilities,hash persistence;no arbitrary signed URL or user credentials in Chromium |

Exactly2 production factory callers. Maintenance expiry SQL is not a generic browser RPC. OWN/Cross-user verify ordinary service-role DB CRUD0 and Storage0. Fixture administration is separate from measured application requests.

## Admission and Export

0009 creates NO admission_limits row. Without explicit operator budgets,paid/upload reservations fail closed;no production default is invented. Constraints:

| Field | Range |
| --- | --- |
| upload_user_slots / upload_global_slots | 1–1000 / 1–10000 |
| user_bytes / global_bytes | 10MiB–1TiB / 10MiB–10TiB |
| uploads_per_hour,user | 1–10000 |
| ai_user_concurrency / ai_global_concurrency | 1–10 / 1–100 |
| ai_user_hour / ai_global_hour | 1–10000 / 1–100000 |
| ai_user_day / ai_global_day | 1–100000 / 1–1000000 |

TTL10minutes;each path charges full10MiB bucket cap,not declared/actual tiny bytes;Product asset cap30. Single locked limits row serializes budgets. Hour/day counts retain attempted/dispatched history. Expired slots stop active concurrency;actual/uncertain footprint remains charged. Safe expired upload refund requires Object absent AND Asset id/path absent;delete only unfinalized intent,set released. READ COMMITTED + conflicting Storage/Asset locks serialize insert/finalization;unclear outcomes fail closed. ABUSE6 and upload12→3/AI8→2 pass. No production limit modified.

Export27 proves90-second one-time consume,8 concurrent consumes→1 winner,worker capability,snapshot cleanup and no session/admin credentials in Chromium. Sandboxed capture blocks external requests,redirects and WebSockets;only same-origin exact capture/data/static allowed.860px,75-second operation timeout,16000px/16M pixel bounds. One Export per process;aggregate replica capacity is an operator gate.

## Actual final validation

| Runtime | Checks | Result |
| --- | --- | --- |
| TASK-058 RLS | 143 | PASS |
| TASK-059 Storage | 74 | PASS |
| TASK-060 Admission | 37 | PASS |
| TASK-061 Auth | 20 | PASS |
| TASK-062 Export | 27 | PASS |
| TASK-063 Cross-user | 40 + corpus97 | PASS |
| TASK-064 Own-user | 40 | PASS |
| Fresh/upgrade migration | 10 | PASS |
| Production config functions | 14 | PASS |
| npm build/next start smoke | 10 | PASS |

Foreign graph/Storage mutation0;denied provider/capture0;ordinary admin0. OWN includes full actual UI workflow,12 fake AI calls,external0,16 consumed admissions +1 intentionally failed extraction charge expired without refund;no unexplained uncertain/abandoned slots;PNG/JPG860×2318;reload/re-login/integrity/cleanup. Start smoke confirms/login,/signup,anonymous page/API protection,capture404,Chrome login/own page/API/render and missing canonical origin→safe503.

Official command node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs:1487 PASS,fail0,skipped0. next typegen,tsc --noEmit,npm lint,npm build,diff-check PASS. Auth browser-target bundle57 modules/590630 bytes,server modules0,secret markers0;final static and actual browser response scans PASS. Exact final counts in audit.json.

## Dependency,artifact and operational evidence

Manifest/lock/installed direct versions match. npm ci --dry-run --ignore-scripts --offline --cache .npm-cache PASS,without install mutation. No dependency additions/upgrades. Playwright/Sharp are actual production dependencies. Lock marks development ESLint deprecated;fatal install issue0. No registry advisory query:current CVE absence is not claimed;operator must check before rollout.

No tracked .env except empty template;caches/artifacts/screenshots/downloads/logs ignored. Configured secret comparisons memory-only;findings paths/counts only. Protected originals4/patches3 unchanged. No direct console callsites in src;OpenAI SDK logs/retries disabled;Auth transport sanitizes provider error bodies. Actual browser/app logs scanned. No central monitoring/alerting/retention system demonstrated. Configure redacted access/errors,429/5xx,provider spend,admission saturation/uncertain age,Storage/DB growth,Export capacity,backup freshness and on-call owner. Mask auth/cookie headers,x-export-token/worker,callback codes and signed-URL queries;do not collect provider bodies/images/prompts.

## Findings and disposition

| ID/severity | Evidence | Action/retest |
| --- | --- | --- |
| REL-B1 BLOCKER release contract,FIXED | src/features/asset-analysis/errors.ts shared error message placed the literal OPENAI_API_KEY name in3 production JS chunks;configured key value was not leaked | replaced only the user-facing message with administrator guidance;unchanged strict forbidden-marker scan plus rebuild,full1487 tests and058–064 runtimes rerun;inventory/audit assert this exact one-line source delta |
| REL-M1 MEDIUM operational | import tickets/option HMAC keys are process-local;Export busy flag per process | operator must prove affinity/restart behavior/aggregate capacity for chosen topology;single-process Local own/import/Export tests PASS;no arbitrary serverless readiness claim |
| REL-M2 MEDIUM hardening | no global CSP/anti-embedding/nosniff configuration | verify compatible ingress headers in staging;private Auth/Export cache/CSP tests PASS;production gate remains open |
| REL-L1 LOW metadata | package/lock0.2.1,target0.3.0 | align together during separately approved release preparation and rerun checks |
| REL-L2 LOW tooling | lock deprecated flag on dev ESLint | compatible follow-up maintenance;offline install PASS,no broad upgrades |
| REL-L3 LOW docs,FIXED |064 table /auth/login/logout labels | corrected to signin/signout;Auth20,OWN40,start10 PASS |

Remaining code BLOCKER0/HIGH0. REL-B1 is a zero-marker release-contract blocker,not a claim of credential exposure or auth bypass. Medium operational gates were not relabeled verified or fixed by prose. Harness corrections:Git/CRLF comparison,existing bucket,relative redirect,Chrome cookie transport and actual signin path. No security rule weakened.

## Reproduction

Run scripts/release-local-stack.mjs start;tests/release-migrations.runtime.mjs;node --conditions=react-server --import ./tests/register.mjs tests/release-config.runtime.mjs;scripts/release-regressions.mjs;scripts/release-inventory.mjs;tests/release-start.runtime.mjs using node. The start harness runs exact npm.cmd run build and next start with explicit Local env and .env/external guards. Regression runner starts/runs/stops058–064 sequentially and copies fresh reports. Do not parallelize browser builds sharing.next.

Run official full test command above,npx.cmd next typegen,npx.cmd tsc --noEmit,npm.cmd run lint,node tests/auth-browser-bundle.mjs,git diff --check. Collect final-state evidence with node scripts/release-local-stack.mjs inspect;node scripts/release-audit.mjs validates the logs/reports. Stop Local stack with node scripts/release-local-stack.mjs stop. All evidence stays in ignored artifacts/TASK-065.

See [rollout and rollback](V0_3_PRODUCTION_ROLLOUT.md) and [operator checklist](V0_3_RELEASE_CHECKLIST.md). Actual production actions remain **OPERATOR ACTION REQUIRED**.

## Source-enumerated routes/actions

| Method | Route/action | Kind | Source |
| --- | --- | --- | --- |
| POST | /api/projects/[projectId]/assets/[assetId]/analyze | route | src/app/api/projects/[projectId]/assets/[assetId]/analyze/route.ts |
| POST | /api/projects/[projectId]/assets/[assetId]/extract-product-shots/retry | route | src/app/api/projects/[projectId]/assets/[assetId]/extract-product-shots/retry/route.ts |
| POST | /api/projects/[projectId]/assets/[assetId]/extract-product-shots/save | route | src/app/api/projects/[projectId]/assets/[assetId]/extract-product-shots/save/route.ts |
| GET | /api/projects/[projectId]/assets/[assetId]/extract-product-shots | route | src/app/api/projects/[projectId]/assets/[assetId]/extract-product-shots/route.ts |
| POST | /api/projects/[projectId]/assets/[assetId]/extract-product-shots | route | src/app/api/projects/[projectId]/assets/[assetId]/extract-product-shots/route.ts |
| DELETE | /api/projects/[projectId]/assets/[assetId] | route | src/app/api/projects/[projectId]/assets/[assetId]/route.ts |
| GET | /api/projects/[projectId]/assets | route | src/app/api/projects/[projectId]/assets/route.ts |
| POST | /api/projects/[projectId]/assets | route | src/app/api/projects/[projectId]/assets/route.ts |
| GET | /api/projects/[projectId]/editor | route | src/app/api/projects/[projectId]/editor/route.ts |
| POST | /api/projects/[projectId]/export | route | src/app/api/projects/[projectId]/export/route.ts |
| GET | /api/projects/[projectId]/fact-validation | route | src/app/api/projects/[projectId]/fact-validation/route.ts |
| POST | /api/projects/[projectId]/fact-validation | route | src/app/api/projects/[projectId]/fact-validation/route.ts |
| POST | /api/projects/[projectId]/options/import/apply | route | src/app/api/projects/[projectId]/options/import/apply/route.ts |
| POST | /api/projects/[projectId]/options/import | route | src/app/api/projects/[projectId]/options/import/route.ts |
| GET | /api/projects/[projectId]/options | route | src/app/api/projects/[projectId]/options/route.ts |
| PUT | /api/projects/[projectId]/options | route | src/app/api/projects/[projectId]/options/route.ts |
| GET | /api/projects/[projectId]/page-plan | route | src/app/api/projects/[projectId]/page-plan/route.ts |
| POST | /api/projects/[projectId]/page-plan | route | src/app/api/projects/[projectId]/page-plan/route.ts |
| GET | /api/projects/[projectId]/product-analysis | route | src/app/api/projects/[projectId]/product-analysis/route.ts |
| POST | /api/projects/[projectId]/product-analysis | route | src/app/api/projects/[projectId]/product-analysis/route.ts |
| POST | /api/projects/[projectId]/sections/[sectionId]/apply-candidate | route | src/app/api/projects/[projectId]/sections/[sectionId]/apply-candidate/route.ts |
| GET | /api/projects/[projectId]/sections/[sectionId]/options | route | src/app/api/projects/[projectId]/sections/[sectionId]/options/route.ts |
| POST | /api/projects/[projectId]/sections/[sectionId]/options | route | src/app/api/projects/[projectId]/sections/[sectionId]/options/route.ts |
| POST | /api/projects/[projectId]/sections/[sectionId]/regenerate | route | src/app/api/projects/[projectId]/sections/[sectionId]/regenerate/route.ts |
| PATCH | /api/projects/[projectId]/sections/[sectionId] | route | src/app/api/projects/[projectId]/sections/[sectionId]/route.ts |
| POST | /api/projects/[projectId]/sections/generate | route | src/app/api/projects/[projectId]/sections/generate/route.ts |
| PATCH | /api/projects/[projectId]/sections/reorder | route | src/app/api/projects/[projectId]/sections/reorder/route.ts |
| GET | /api/projects/[projectId]/sections | route | src/app/api/projects/[projectId]/sections/route.ts |
| POST | /api/projects/[projectId]/wholesale-import/images | route | src/app/api/projects/[projectId]/wholesale-import/images/route.ts |
| GET | /api/projects/[projectId]/wholesale-import/preview | route | src/app/api/projects/[projectId]/wholesale-import/preview/route.ts |
| POST | /api/projects/[projectId]/wholesale-import/preview | route | src/app/api/projects/[projectId]/wholesale-import/preview/route.ts |
| POST | /api/projects/[projectId]/wholesale-import/save | route | src/app/api/projects/[projectId]/wholesale-import/save/route.ts |
| GET | /auth/callback | route | src/app/auth/callback/route.ts |
| GET | /auth/session | route | src/app/auth/session/route.ts |
| POST | /auth/signin | route | src/app/auth/signin/route.ts |
| POST | /auth/signout | route | src/app/auth/signout/route.ts |
| POST | /auth/signup | route | src/app/auth/signup/route.ts |
| POST | /export-capture/data | route | src/app/export-capture/data/route.ts |
| GET | /export-capture | page | src/app/export-capture/page.tsx |
| GET | / | page | src/app/page.tsx |
| GET | /login | page | src/app/login/page.tsx |
| GET | /projects/[projectId]/analysis | page | src/app/projects/[projectId]/analysis/page.tsx |
| GET | /projects/[projectId]/editor | page | src/app/projects/[projectId]/editor/page.tsx |
| GET | /projects/[projectId]/images | page | src/app/projects/[projectId]/images/page.tsx |
| GET | /projects/[projectId]/planner | page | src/app/projects/[projectId]/planner/page.tsx |
| GET | /projects/[projectId]/render | page | src/app/projects/[projectId]/render/page.tsx |
| GET | /projects/[projectId]/sections | page | src/app/projects/[projectId]/sections/page.tsx |
| GET | /projects/[projectId]/validation | page | src/app/projects/[projectId]/validation/page.tsx |
| GET | /projects/[projectId] | page | src/app/projects/[projectId]/page.tsx |
| GET | /projects/new | page | src/app/projects/new/page.tsx |
| GET | /projects | page | src/app/projects/page.tsx |
| GET | /settings | page | src/app/settings/page.tsx |
| GET | /signup | page | src/app/signup/page.tsx |
| GET | /templates | page | src/app/templates/page.tsx |
| POST | createProjectAction | action | src/features/projects/actions.ts |
| POST | saveProductAction | action | src/features/products/actions.ts |

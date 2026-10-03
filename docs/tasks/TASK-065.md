# TASK-065 — v0.3.0 Public SaaS Release Validation / Release Gate

2026-10-01 · CODE/LOCAL acceptance

## 1. Status

TASK-065 CODE/LOCAL validation **COMPLETE**,Local Release Candidate **PASS**. Production rollout **BLOCKED / OPERATOR ACTION REQUIRED**. [Detailed evidence](../V0_3_RELEASE_VALIDATION.md).

## 2. Baseline

release/v0.3.0-validation;HEAD 4c341999176682cf1a73b5023f5306bdb3eb129d;started clean. Local main matches HEAD;7 ahead/0 behind cached origin/main 8906c0cee85b01281f2ddfa557469482cb58a981. No fetch/push;remote server state not inferred.

## 3. Files

Added release inventory/audit/regression/stack scripts,config/migration/start runtimes,Local/preload helpers and4 release documents. Updated README/backlog/architecture/task index and064 Auth route labels. Deleted0,production code1(one error-message line for REL-B1),migrations0,dependencies0. Exact changed paths in audit.json.

## 4. Release inventory

56 page/action/method entries,17 direct env names;package/lock,Next proxy,Auth,user/admin clients,Storage,providers,Export,process-local/server-only operations and deployment gaps reviewed from source.

## 5. Migration validation

Fresh0001–0010 and v0.2.1 upgrade PASS,10 checks. Missing owner blocks0007;explicit allowlist backfill verified. Full public/app_private/storage DDL and bucket configuration drift0;legacy graph/Object metadata preserved. Historical migrations unchanged;no remote apply.

## 6. Environment contract

PUBLIC2,server secrets,optional models,deployment controls and test-only names inventoried without values. Local configured flags do not prove production config.14 actual config-function checks PASS. Candidate root requires cryptographic entropy beyond source length check.

## 7. Auth production requirements

HTTPS Site URL/exact callback,email confirmation+SMTP,password≥8,session refresh/getUser,Secure/Lax shared browser/SSR cookies,POST local-scope signout. Production configuration remains operator verification.

## 8. RLS

143 PASS.7 public tables/28 policies,immutable ownership/parent chain,anon/foreign denied and same-owner valid. RLS enabled;FORCE=false recorded with managed owner/service-role privilege boundary.

## 9. Storage

74 PASS. Private product-assets,10MiB JPEG/PNG/WebP,canonical path/admission,owner reads;foreign/anon read/write/list/copy/move denied.5 policies,managed owners preserved.

## 10. Privileged/service-role surface

Exactly2 production callers:admissionRpc reserve/settle and Export rpc issue/use/close. User-RLS graph/assets first;ordinary admin DB/Storage0. Expiry maintenance SQL is not a generic browser RPC.

## 11. Admission/abuse

37 PASS including ABUSE6;upload12→3 and AI8→2. Expired slots separated from charged footprint;refund requires Object+Asset absence under locks. Migration seeds no production limits;operator budgets required.

## 12. Export

27 PASS;90-second one-time ticket,8 concurrent consume→1 winner,worker capability,snapshot cleanup,no user JWT/cookie/admin key in Chromium. Capture isolation and860px PNG/JPG PASS.

## 13. Cross-user

XUSER40 PASS plus exact-ID corpus97;foreign graph/Storage mutation0,provider/capture dispatch0,ordinary admin fallback0,secret/network leak0.

## 14. Own-user

OWN40 PASS through actual Local GoTrue/DB/Storage/Next production/Chrome creation,AI fixtures/retry/crop,editor/export,reload/re-login,integrity/cleanup.12 fake AI calls,real external0.

## 15. Full regression

Official1487 tests PASS,fail0,skipped0. next typegen,tsc --noEmit,npm lint,npm build,git diff --check PASS. Actual logs in artifacts/TASK-065.

## 16. Production build/start smoke

Exact npm.cmd run build plus next start;10 checks for public pages,anonymous protection,Chrome login/owned page/API/render,capture denial and missing canonical origin safe503.

## 17. Client bundle

Browser target57 modules/590630 bytes,server modules0,secret markers0. Production .next/static and actual delivered browser responses checked;final counts in audit.json.

## 18. Secret scan

Tracked/new source/docs and generated evidence checked against configured secret literals in memory and credential patterns;findings0. No raw secret or hash fragment emitted.

## 19. External network/provider

Real external AI/Domeggook0;Local harness blocks remote targets. Dependency sanity offline;no registry advisory/current-CVE claim and no remote configuration inspection.

## 20. Artifact hygiene

No tracked runtime caches/logs/screenshots/downloads/credentials or.env except template. Evidence ignored. Scratch DBs/accounts/Objects cleaned;namespace history/volumes preserved.

## 21. Dependency sanity

Manifest/lock/installed direct versions match;offline npm ci --dry-run --ignore-scripts PASS. No dependency upgrade. Existing package0.2.1 metadata and deprecated development ESLint are LOW follow-ups.

## 22. Release findings

Remaining code BLOCKER0/HIGH0. REL-B1 zero-marker release-contract blocker FIXED with one message change;strict full-bundle audit and all security/full regressions rerun. MEDIUM2 operational gates:process-local import/Export deployment topology and global security headers. LOW2 open:release metadata and tooling;LOW1 documentation FIXED. Evidence/actions/retests documented;no production rule weakened.

## 23. Production rollout checklist

Locally verified gates separated from unverified production target/domain/env/Auth/Storage/migrations/backups/limits/runtime/headers/monitoring/smoke. [Checklist](../V0_3_RELEASE_CHECKLIST.md). OPERATOR ACTION REQUIRED.

## 24. Migration rollout plan

Backup→actual ledger/catalog→maintenance/approved owner mapping→missing-only migration chain with0006 backfill before0007→schema/Auth/Storage/limits verification→app deploy→own+cross-account smoke→ingress decision. No remote apply.

## 25. Rollback

Separate security-compatible application/deployment rollback,env restore and DB forward-fix. No destructive security down migration or public rollback to legacy admin MVP. Exposure requires controlled credential rotation and sanitized evidence.

## 26. Post-deploy smoke

Operator verifies anon denial,signup/login,own create/upload/preview,one separately approved paid AI operation,renderer/PNG/JPG,logout,B→A denial,logs/5xx and explicit fixture cleanup. Not executed in production.

## 27. Remote mutations

DB0/Auth0/Storage0/deployment0/real provider0. No linked target configuration or production migration changed.

## 28. Git

Branch release/v0.3.0-validation;HEAD4c34199 unchanged. Stage0,commit0,merge0,tag0,push0,GitHub release0. All task changes remain unstaged.

## 29. Final gate

**Local RC PASS. Production rollout BLOCKED / OPERATOR ACTION REQUIRED.** Local success does not establish production configuration/deployment. No deployed/ready claim.

## 30. Next operator actions

Review unstaged evidence;select/verify targets,resolve operational gates and release metadata,approve backup/ownership/budget plan,then separately authorize rollout. [Runbook](../V0_3_PRODUCTION_ROLLOUT.md).

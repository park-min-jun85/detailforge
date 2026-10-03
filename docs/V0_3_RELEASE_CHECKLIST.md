# v0.3.0 Release Checklist

2026-10-01 · TASK-065

**Local Release Candidate PASS. Production rollout BLOCKED / OPERATOR ACTION REQUIRED.**

## Verified locally

| Gate | Evidence | Status |
| --- | --- | --- |
| Baseline/source inventory | expected branch/base,56 routes,source-derived env/callsites | PASS |
| Migration fresh/upgrade |10 checks,full public/app_private/storage DDL,bucket config | PASS / drift0 |
| RLS/Storage/Admission/Auth/Export/Cross-user/Own-user |143/74/37/20/27/40/40,corpus97 | PASS |
| Config/build/start |14 actual config boundaries,10 production smoke checks | PASS |
| Official full tests |1487 passed,fail0,skipped0 | PASS |
| Typegen/TypeScript/lint/build/diff | actual command logs | PASS |
| Client/repository secrets | runtime memory,static,configured-literal scans | PASS |
| Dependency/artifact hygiene | offline dry-run,lock consistency,ignored artifacts | PASS |
| Cleanup | scratch DBs/owned fixtures removed,namespace/volumes preserved | PASS |

## Production gates — OPERATOR ACTION REQUIRED

Every production row below is unverified. Local success did not check them off.

| Gate | Required acceptance evidence | Status |
| --- | --- | --- |
| Deployment project | approved provider/project/runtime/rollback target | OPERATOR ACTION REQUIRED |
| Domain/HTTPS | canonical origin,TLS,Host/cookie/proxy behavior | OPERATOR ACTION REQUIRED |
| Supabase target | project/database/region/current migration ledger | OPERATOR ACTION REQUIRED |
| Backups | restorable DB snapshot + Storage bytes,restore rehearsal | OPERATOR ACTION REQUIRED |
| Secrets/env | required names,random candidate root,no public secret/fixture value | OPERATOR ACTION REQUIRED |
| Migration | current-version audit,approved owner mapping,missing-only plan,catalog verification | OPERATOR ACTION REQUIRED |
| Auth | Site URL,exact redirects,SMTP/confirmation,password/session/rate policies | OPERATOR ACTION REQUIRED |
| Storage/RLS | private bucket,expected policies/grants,owner/foreign smoke | OPERATOR ACTION REQUIRED |
| Admission | explicit finite limits,quota alerts,reconciliation ownership | OPERATOR ACTION REQUIRED |
| Runtime/topology | Sharp,sandboxed Chrome,time budgets,import affinity,aggregate Export cap | OPERATOR ACTION REQUIRED |
| Headers/CDN | private dynamic caches,global anti-embedding/CSP/nosniff/HTTPS tested | OPERATOR ACTION REQUIRED |
| Monitoring | log redaction,5xx/429/cost/capacity alerts,on-call/retention | OPERATOR ACTION REQUIRED |
| Dependency/metadata | current advisory review,approved version alignment,final checks | OPERATOR ACTION REQUIRED |
| Post-deploy | own workflow,PNG/JPG,logout,B→A denial,fixture cleanup | OPERATOR ACTION REQUIRED |
| Public ingress | recorded acceptance and explicit deployment authorization | BLOCKED |

See [rollout/rollback/post-deploy runbook](V0_3_PRODUCTION_ROLLOUT.md) and [validation evidence](V0_3_RELEASE_VALIDATION.md). Commit/merge/tag/push/GitHub release remain separately authorized steps;none occurred here.

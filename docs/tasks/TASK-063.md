# TASK-063 — Cross-user Security E2E

2026-09-29 · C:\Projects\detailforge · test/cross-user-security-e2e · baseline 4d8b9b6

## 1. Status

**COMPLETE. Public SaaS deployment remains BLOCKED.** XUSER40 and exact-ID corpus97 PASS in actual Local GoTrue/PostgreSQL/Storage + Next production + Playwright Chromium 153.0.8010.53. [Detailed contract, inventory and corpus](../V0_3_CROSS_USER_SECURITY_E2E.md).

## 2. Attack surface

Source enumeration: 16 pages, 38 route/method entries, 2 Server Actions =56. Project app surface:8 pages +32 API methods. Also actual JWT CRUD on7 DB tables, Storage SDK methods,8 AI entry points, admission and Export ticket/capture. Proxy covers every protected page/API; Auth/capability routes retain separate contracts.

## 3. Test principals

A/B real Local GoTrue sessions, anonymous browser, A2 same-owner other Project. Each graph contains Project/Product/Facts/Options/Asset+PNG/Page/Section. Foreign exact UUID/path corpus is recorded in artifacts/TASK-063/runtime.json; no credentials are persisted.

## 4. Files

Production fix: src/features/detail-editor/option-application.ts. Regression: tests/options-section.test.mjs (+2).

New harness: scripts/cross-user-local-stack.mjs, scripts/cross-user-audit.mjs, tests/cross-user-runtime.browser.mjs, tests/helpers/cross-user-app.cjs, tests/helpers/cross-user-corpus.mjs, tests/helpers/cross-user-local.mjs. New docs: this file and V0_3_CROSS_USER_SECURITY_E2E.md. Current-state notices updated in README, architecture, threat model, release backlog, task index and related security contracts. Deleted0, migrations0, package/lock/dependencies0.

## 5. Cross-user matrix

| Case | Actual assertion | Result |
| --- | --- | --- |
| XUSER-01 | A own Project | PASS |
| XUSER-02 | B own Project | PASS |
| XUSER-03 | A list excludes B | PASS |
| XUSER-04 | B list excludes A | PASS |
| XUSER-05 | A exact B page denied | PASS |
| XUSER-06 | B exact A page denied | PASS |
| XUSER-07 | foreign Product denied | PASS |
| XUSER-08 | foreign Facts denied | PASS |
| XUSER-09 | foreign Options denied | PASS |
| XUSER-10 | foreign Asset metadata denied | PASS |
| XUSER-11 | foreign signed/read denied | PASS |
| XUSER-12 | foreign Asset write/delete denied | PASS |
| XUSER-13 | foreign Detail Page denied | PASS |
| XUSER-14 | foreign Section read denied | PASS |
| XUSER-15 | foreign Section write denied | PASS |
| XUSER-16 | mixed-scope denied | PASS |
| XUSER-17 | foreign upload admission before RPC | PASS |
| XUSER-18 | 8 AI entry points before provider | PASS |
| XUSER-19 | extraction/retry before provider | PASS |
| XUSER-20 | foreign Export before ticket/capture | PASS |
| XUSER-21 | all anon protected routes | PASS |
| XUSER-22 | anon Server Actions | PASS |
| XUSER-23 | malformed/revoked refresh + invalid access | PASS |
| XUSER-24 | logout direct/API/Action | PASS |
| XUSER-25 | same-context A→B switch | PASS |
| XUSER-26 | RSC foreign body | PASS |
| XUSER-27 | prefetch absent-equivalent tree | PASS |
| XUSER-28 | foreign/absent safe errors | PASS |
| XUSER-29 | Storage bytes/full metadata | PASS |
| XUSER-30 | B seven-table graph unchanged | PASS |
| XUSER-31 | A seven-table graph unchanged | PASS |
| XUSER-32 | ordinary admin DB zero | PASS |
| XUSER-33 | ordinary admin Storage zero | PASS |
| XUSER-34 | denied/quota provider zero | PASS |
| XUSER-35 | foreign capture zero | PASS |
| XUSER-36 | response/static/log secret scan | PASS |
| XUSER-37 | browser external zero | PASS |
| XUSER-38 | Chromium external zero | PASS |
| XUSER-39 | cache separation | PASS |
| XUSER-40 | complete exact-ID corpus | PASS |

## 6. Route corpus

97 recorded attacks:41 A→B +41 B→A +15 mixed scope. [Route/method statuses and injection fields](../V0_3_CROSS_USER_SECURITY_E2E.md#route-corpus-results). Actual identifiers and per-row results are in runtime.json. All leaks0/mutations0; JSON foreign and random-absent status/body equal. Signed candidate/import ticket, strict create Action, child Asset injection, DB/Storage and RSC attacks add coverage beyond these97.

## 7. DB integrity

A and B each preserve exact SHA-256 of projects/products/product_facts/product_options/assets/detail_pages/sections. A2 also unchanged through all mixed attacks; its explicit own Product Action control runs afterward. before/after per-table hashes are in runtime.json.integrity. No denied attack mutates either graph.

## 8. Storage integrity

Actual PNG bytes/size/SHA-256 and entire storage.objects row hash unchanged for A/B/A2. sign/download/upload/upsert/update/delete/list/copy/move plus fabricated/mixed paths denied under A/B/anon. Full before/after hashes are in runtime.json.integrity.

## 9. AI/provider

Actual own analyzeAsset + fake provider dispatch1. Eight foreign/anon service entry points ×3 principal directions =24 denials; denied factory/dispatch0, quota-denied dispatch0, foreign data passed to fake provider0. Own-user workflow completeness remains064.

## 10. Export

A→B/B→A route denied404; issued tickets0, foreign snapshots0, Chromium capture0. Own positive PNG:1 ticket,1 Chromium launch,width860. All TASK-062 EXPORT-01~25 plus migration/access checks rerun (27). Capability replay8 attempts:1 success/7 denied; forged/actor/project/page/Asset substitution and actual arbitrary-network/redirect probes pass.

## 11. Session/cache

Anon/malformed/stale+revoked-refresh/invalid-signature deny. Logout blocks URL/API/Action. Same-context A→logout→B reveals no A DOM/RSC/asset data. Access JWT lifetime is not confused with refresh revocation. RSC denies; prefetch may return only the absent-equivalent static route tree. private/no-store projections and Export headers pass.

## 12. Secret/network

Actual local credentials checked in memory against 854 collected responses/console entries, complete attack bodies, logs and 29 production static files;0 findings. Client bundle57 modules/590630 bytes,0 server modules/secret markers. Offline configured-secret/artifact scan in audit.json. Browser/Chromium external0, app remote0; actual blocked network/redirect proof in062 regression.

## 13. Previous regressions

TASK-058 RLS143 PASS;059 Storage74 PASS;060 Admission37 PASS (ABUSE01–06, upload12→3, AI8→2);061 Auth UX20 PASS;062 Export27 PASS. Evidence copied to artifacts/TASK-063/*-runtime.json from this run. Local Docker stacks are stopped with volumes preserved.

## 14. Full regression

Official harness1487/1487 PASS, failures0/skips0. next typegen, tsc --noEmit, npm lint, npm build, git diff --check, offline secret scan and browser/client bundle scan PASS. Raw logs and audit.json remain local ignored artifacts. Existing original product images and frame fixture hashes unchanged.

## 15. Security findings

BLOCKER0/HIGH0/MEDIUM0. LOW1 fixed: invisible Project in Section option compare/apply returned503 rather than404. Only the exact404 error is translated; other failures stay closed. Two targeted unit tests and actual symmetric route tests pass. No RLS/Auth/admission/Export weakening.

## 16. Mutation

Remote DB0/Auth0/Storage0; external provider0. Only dedicated local test fixtures/configuration changed. Cleanup restores no business graphs/objects/auth fixtures/intents/admissions/tickets; namespace ownership history and Docker volumes retained.

## 17. Remaining Public SaaS blockers

TASK-064 own-user complete workflow, TASK-065 production operational limits/secrets/rollout/release validation. This security result is not deployment approval.

## 18. Git

Branch test/cross-user-security-e2e, HEAD4d8b9b6. Existing files not reset. Stage0/commit0/merge0/tag0; requested changes remain unstaged. Exact file list is in audit.json and git status.

## 19. Next

TASK-064 — own-user full workflow E2E, keeping058–063 security regressions intact.

# TASK-064 — Full Own-user Workflow Regression

2026-09-30 · C:/Projects/detailforge · test/own-user-full-workflow · baseline05300c6

## 1. Status

**COMPLETE. Public SaaS deployment remains BLOCKED.** OWN40 actual Local Supabase/Next production/Chrome PASS. [Contract and complete evidence](../V0_3_OWN_USER_WORKFLOW_REGRESSION.md).

## 2. Workflow inventory

56 source-enumerated page/action/method entries. The contract maps UI/API/service/data/Storage/provider/next-state boundaries, including optional import and service-only deletion.

## 3. Golden path

Login → create/open Project → Product/Facts/Options → upload/preview/analysis → extraction/retry/crop/derived save → Product analysis → validation → planner →4 sections → regeneration/apply/reorder/edit →860px render →PNG/JPG →reload/logout/re-login. All PASS.

## 4. Files

New: scripts/own-user-local-stack.mjs, scripts/own-user-audit.mjs, tests/own-user-runtime.browser.mjs, tests/helpers/own-user-{local.mjs,app.cjs,provider.mjs,integrity.mjs}, this task and workflow contract. Modified: README.md, docs/RELEASE_BACKLOG.md, docs/V0_3_PUBLIC_SAAS_ARCHITECTURE.md, docs/tasks/README.md. Production source0, deleted0, migration0, dependencies0.

## 5. OWN-01 ~ OWN-40

| ID | Assertion | Result |
| --- | --- | --- |
| OWN-01 | Login | PASS |
| OWN-02 | Project create | PASS |
| OWN-03 | Project list/read | PASS |
| OWN-04 | Product create/update | PASS |
| OWN-05 | Product Facts | PASS |
| OWN-06 | Product Options + imported options | PASS |
| OWN-07 | Asset upload admission | PASS |
| OWN-08 | Asset Storage upload | PASS |
| OWN-09 | Asset DB finalize | PASS |
| OWN-10 | Asset signed preview | PASS |
| OWN-11 | Asset AI Analysis | PASS |
| OWN-12 | Wholesale preview/save | PASS |
| OWN-13 | Wholesale image import | PASS |
| OWN-14 | Long-detail extraction | PASS |
| OWN-15 | Extraction retry | PASS |
| OWN-16 | Derived Asset save/reuse | PASS |
| OWN-17 | Manual Crop | PASS |
| OWN-18 | Product AI Analysis | PASS |
| OWN-19 | Fact Validation | PASS |
| OWN-20 | Page Planner | PASS |
| OWN-21 | Section Generate | PASS |
| OWN-22 | Section count/order/schema | PASS |
| OWN-23 | Section Regenerate | PASS |
| OWN-24 | Signed Candidate Apply | PASS |
| OWN-25 | Section Reorder | PASS |
| OWN-26 | Detail Editor save | PASS |
| OWN-27 | Renderer ready | PASS |
| OWN-28 | PNG Export | PASS |
| OWN-29 | JPG Export | PASS |
| OWN-30 | Reload persistence | PASS |
| OWN-31 | Logout/protected route | PASS |
| OWN-32 | Re-login persistence | PASS |
| OWN-33 | Ordinary admin DB CRUD = 0 | PASS |
| OWN-34 | Ordinary admin Storage = 0 | PASS |
| OWN-35 | Exact fake provider calls | PASS |
| OWN-36 | Admission/ticket health | PASS |
| OWN-37 | Browser errors = 0 | PASS |
| OWN-38 | Unexpected external network = 0 | PASS |
| OWN-39 | Secrets absent | PASS |
| OWN-40 | Separate cleanup fixture | PASS |

## 6. Browser execution

Actual Playwright Chrome 153.0.8010.53; desktop1440×1000, mobile390×844 projects/images/editor/session smoke PASS. Console/pageerrors0, external network0. Actual screenshots retained.

## 7. Product/Data

Owner Project created by UI, product create/update and source-backed Facts re-read. Facts version1 remains valid under existing manual persistence contract. Manual confirmed options and separate official-option import/apply/CAS succeed.

## 8. Assets

Original PNG2, derived PNG2 in golden graph; optional imported PNG1 on cleanup fixture.5 upload admissions consumed. Original upload hashes match, canonical Storage path/metadata/finalized intent valid, signed previews load;4 AI analyses complete.

## 9. Extraction / Derived / Crop

600×3000 source,2 tiles; second intentionally invalid output persists retryable failure, only failed tile retried. Selection survives. Manual inward left10 crop exact bytes/provenance,2 derived saves, duplicate reuse without extra row/object.

## 10. AI workflow

Actual production services/SDK schemas/grounding with only local transport substitution: Product analysis1, Fact validation1, Planner1, Section generation1, regeneration1.4 roles hero/gallery/specification/option. Signed candidate10-minute TTL, base fingerprint and correct Section; apply succeeds.

## 11. Editor / Renderer

Reorder to hero/specification/gallery/option, sort_order0..3; manual subheadline persisted.860px renderer4 sections,3 used images, missing0; UI and service fingerprints agree. Manual copy review warning is expected.

## 12. Export

PNG: 860×2318, 28696 bytes. JPEG: 860×2318, 63612 bytes. Actual browser downloads, magic/MIME/extension/private-no-store PASS;2 Chromium launches; terminal tickets and cleared snapshots.

## 13. Persistence

Seven-table graph hash stable after reload and logout/re-login. UI product/options/render and production analysis/validation/planner/render service reads agree; no new AI calls.

## 14. Integrity

Project1/Product1/Facts1/Options1/Asset4/Page1/Section4. Orphan rows0, wrong-project0, duplicate IDs0, invalid/missing paths0, orphan Objects0. Owner can download every object. Separate cleanup fixture removes children/objects/intents and preserves namespace tombstone. Final test teardown removes owned fixtures/ledgers; retained namespace history/volumes are intentional.

## 15. Privileged path

Ordinary admin DB CRUD0; ordinary admin Storage0. Only finite reserve/settle and issue/use/close Export RPC, with exact counters in runtime.json. Fixture setup/clock control/cleanup are separately scoped to Local administrative verification.

## 16. Provider

| Fake operation | Calls |
| --- | --- |
| asset_visual_analysis | 4 |
| detail_image_regions | 3 |
| product_strategy_analysis | 1 |
| fact_validation | 1 |
| detail_page_plan | 1 |
| detail_page_sections | 1 |
| section_regeneration | 1 |

12 fake AI calls; external0. Intentional schema failure1 remains charged through uncertain→expired after local expiry-clock advance.16 successful admissions consumed, deliberately expired AI charge1, active/reserved0, uncertain0, unfinalized intents0, stale ticket snapshots0.

## 17. Security regressions

| Task | Runtime | Checks | Result |
| --- | --- | --- | --- |
| TASK-058 | rls | 143 | PASS |
| TASK-059 | storage | 74 | PASS |
| TASK-060 | admission | 37 | PASS |
| TASK-061 | auth | 20 | PASS |
| TASK-062 | export | 27 | PASS |
| TASK-063 | cross-user | 40 | PASS |

Admission ABUSE6 and upload12→3/AI8→2 PASS; cross-user exact-ID corpus97 PASS.

## 18. Regression

Official tests1487/1487, failed0/skipped0. typegen/typecheck/lint/npm build/diff-check/secret scan/client bundle scan PASS. Exact commands, logs and scan counts in artifacts/TASK-064 and audit.json.

## 19. Security/Product findings

BLOCKER0/HIGH0/MEDIUM0/LOW0 production regression found. Only harness input/locator/await corrections; no production policy changes. Deterministic synthetic images/provider do not certify live-model quality.

## 20. Mutation

Remote DB0, Auth0, Storage0; real external provider0. Only isolated Local fixtures changed.

## 21. Remaining Public SaaS blocker

TASK-065 release validation/release preparation remains required. **Public SaaS deployment remains BLOCKED.**

## 22. Git

Branch test/own-user-full-workflow; HEAD05300c6 unchanged. Stage0/commit0/merge0/tag0. Only the listed harness/docs changes remain unstaged; no reset/restore/clean.

## 23. Next

TASK-065: final release validation and preparation, with explicit deployment decision in that task. No release, tag, merge or remote rollout performed here.

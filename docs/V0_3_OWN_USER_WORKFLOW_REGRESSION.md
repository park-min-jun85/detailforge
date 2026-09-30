# v0.3 Own-user Workflow Regression

2026-09-30 · TASK-064 · baseline 05300c6 · branch test/own-user-full-workflow

**COMPLETE. Public SaaS deployment remains BLOCKED.** TASK-065 release validation is still required. This validates the existing Local/Internal MVP with deterministic provider output, not real-provider quality or production deployment.

## Runtime and reproduction

Local project detailforge-task064; Supabase API 127.0.0.1:58821, PostgreSQL 58822, Next production 3064, isolated fake Responses transport 58825. Playwright uses installed Chrome 153.0.8010.53, desktop 1440×1000 and mobile 390×844. All migrations 0001–0010 applied locally. No migration, dependency, production source, RLS or quota-policy changes.

Run from C:/Projects/detailforge with Docker, installed Chrome and the existing PostgreSQL CLI:

1. node scripts/own-user-local-stack.mjs start
2. node --conditions=react-server --import ./tests/register.mjs tests/own-user-runtime.browser.mjs
3. node tests/auth-browser-bundle.mjs
4. node scripts/own-user-audit.mjs (after the documented regression evidence is populated)
5. node scripts/own-user-local-stack.mjs stop

The default runtime builds production Next before launching it. --reuse-build is only a debugging convenience and refuses changed src digests; do not use it after another task has overwritten .next. Golden Project/Product/Facts/Options/Assets/Page/Sections are created through actual UI and production APIs. Admin is restricted to fixture Auth creation, local limit configuration, direct state verification and teardown. No business-row seeding replaces the golden path.

## Workflow inventory

The source-enumerated full app inventory contains 56 page/action/method entries. The workflow map below records supported user transitions; raw enumeration follows later.

| Stage/UI | Action/API suffix | Production boundary | Data/Storage | Provider | Next state |
| --- | --- | --- | --- | --- | --- |
| /login | /auth/login | Auth handlers, GoTrue | session cookie | none | /projects |
| /projects/new | createProjectAction | projects/service | projects owner_id | none | list/open own Project |
| /projects/[projectId] | saveProductAction | products/persistence | products + product_facts/source_snapshot | none | product ready |
| Product options | /options PUT | product-options/persistence | product_options version/CAS | none | confirmed white/black |
| Optional wholesale service | /wholesale-import/preview, save, images | wholesale-import/service + adapter + assets/service | products/facts/source + asset/object | injected HTML/PNG fetch | imported Project |
| Optional option import service | /options/import, /import/apply + PUT | import-service + persistence | product_options provenance/CAS | injected diagnose response | confirmed imported values |
| /images | /assets POST, GET | assets/service + admission | intents/admissions, assets, Storage | none | canonical paths + signed previews |
| /images | /assets/analyze | asset-analysis/service | assets.metadata.aiAnalysis | local Responses transport | 4 complete analyses |
| /images extraction panel | /extract-product-shots | detail-extraction/service | source metadata/checkpoint | local Responses transport | one complete, one retryable failed tile |
| Extraction retry | /extract-product-shots/retry | detail-extraction/retry | same source revision/checkpoint | one local call | two completed tiles |
| Crop dialog and candidate save | /extract-product-shots/save | crop domain + persistCrop | 2 derived assets/objects/provenance | none | original + manual crop saved/reused |
| /analysis | /product-analysis | product-analysis/service | products.ai_analysis + evidence | local Responses transport | persisted strategy |
| /validation | /fact-validation | fact-validation/service | product_facts.validation | local Responses transport | supported facts, evidence/coverage |
| /planner | /page-plan | page-planner/service | detail_pages.plan | local Responses transport | ready current 4-section plan |
| /sections | /sections/generate | section-engine/service | sections + generation metadata | local Responses transport | hero/gallery/specification/option |
| /editor | /sections/[sectionId]/regenerate, apply-candidate | section-regeneration + detail-editor | signed candidate, CAS update | one local call | fresh candidate applied |
| /editor | /sections/reorder PATCH | section-reorder/service | sort_order 0..3, page lease | none | hero/specification/gallery/option |
| /editor | /sections/[sectionId] PATCH | detail-editor/service | manual content/provenance | none | saved subheadline |
| /render | GET | detail-renderer/service | user-scoped graph + signed images | none | ready 860px surface |
| /render | /export POST | detail-export + finite capability RPC | user snapshot, ephemeral ticket | actual isolated Chromium | PNG and JPG download |
| Logout/re-login | /auth/logout, /auth/login | Auth handlers + proxy | session revocation/new session | none | same saved graph |
| Separate cleanup Project | deleteAsset then deleteOwnedProject service | assets/service, projects/service | Storage delete before DB cascade | none | rows/objects/intents0, namespace tombstone1 |

Project deletion has no UI/API: projects/service explicitly documents that SQL cascade does not delete Storage. OWN-40 therefore exercises the supported primitives in safe order on a separate fixture. It does not claim a product-level delete UI exists.

## Golden path and browser/service split

Browser performs OWN-01–11,14–32: login, create/open, create/update product, confirmed options, original uploads, previews/analysis, two-tile extraction/retry, selection retention, crop, two derived saves, analysis of derived images, Product AI, validation, planning, generation, regeneration/signature/TTL/apply, reorder, edit, renderer, both downloads, reload, logout/re-login. The duplicate save is a same-session browser fetch to the real API because saved candidates are disabled in the UI.

OWN-12/13, official option import and OWN-40 use production services with actual user JWT/RLS; only external HTML/PNG/diagnosis fetch dependencies are replaced. The fixture public URL is data in an injected response; no HTTP/DNS request to that host occurs. Signed image loading and all saved image bytes use actual local Storage. OWN-33–39 inspect real subprocess instrumentation, browser output and DB ledgers.

## Own-user matrix

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

No cases are N/A. Mobile smoke covers projects, images, editor and session shell; all remain within the viewport with no horizontal page overflow. Screenshots renderer.png and mobile-editor.png were inspected; the colored rectangles are intentional synthetic test pixels, not missing product images or an assessment of model visual quality.

## Provider fixture and admission semantics

Only the SDK Responses transport is replaced before an external socket/DNS dispatch. Production prompt building, SDK parsing, schemas, grounding, user authorization, reserve/settle, CAS and persistence run normally. The subprocess refuses real credentials and forwards only JSON to the fixed local fixture server. Other external fetches are rejected. HTML/image/official-option integrations use their existing dependency injection points.

| Operation | Exact fake calls |
| --- | --- |
| asset_visual_analysis | 4 |
| detail_image_regions | 3 |
| product_strategy_analysis | 1 |
| fact_validation | 1 |
| detail_page_plan | 1 |
| detail_page_sections | 1 |
| section_regeneration | 1 |

12 fake AI calls total, real external AI/provider0. The second extraction response intentionally violates the output schema; the SDK/provider rejects it and persists a retryable checkpoint. That dispatch correctly becomes uncertain and is NOT refunded. The local test advances only that row's expires_at and executes production expire_admissions(), yielding one **expired, still charged** history row. The failed tile is then retried once; the successful first tile is not dispatched again. All 11 successful AI calls and all 5 upload admissions are consumed (16 consumed + 1 deliberately expired AI charge). At final verification reserved0, uncertain0, unfinalized upload intents0 and export nonterminal/snapshot0. This clock fixture does not change production expiry policy or pretend the failure was consumed.

The manual crop uses left inset10 and other insets0, verifies inward dimensions, parent/candidate/sourceRect/adjustment provenance, actual Storage bytes and exact PNG hash against Sharp extraction of the original. Repeating the same manual save reuses the Asset; total golden assets remains4.

## State checkpoints

The artifact includes real project/product IDs, bounded counts and persisted status at each stage; no tokens, credentials or full provider prompts are persisted.

| Stage | Products | Facts | Options | Assets | Sections | Project status |
| --- | --- | --- | --- | --- | --- | --- |
| afterProject | 0 | 0 | 0 | 0 | 0 | draft |
| afterProduct | 1 | 1 | 0 | 0 | 0 | draft |
| afterAsset | 1 | 1 | 1 | 2 | 0 | draft |
| afterAnalysis | 1 | 1 | 1 | 2 | 0 | draft |
| afterExtraction | 1 | 1 | 1 | 4 | 0 | draft |
| afterPlanner | 1 | 1 | 1 | 4 | 0 | draft |
| afterSections | 1 | 1 | 1 | 4 | 4 | draft |
| afterEditor | 1 | 1 | 1 | 4 | 4 | draft |
| afterExport | 1 | 1 | 1 | 4 | 4 | draft |

The existing Project status remains draft; it is not automatically promoted by section generation/export. Detail readiness is separately verified by production render/planner views. After reload and after re-login the complete seven-table graph hash is identical, actual UI reads product/options/rendered edit, and production service reads confirm fresh analysis, validation, plan and renderer fingerprint without new provider calls.

## Final DB/Storage integrity and cleanup

Golden graph: Project1, Product1, Facts1, Options1, Asset4, DetailPage1, Section4. Actual SQL outer joins verify orphan rows0; Asset/Product project mismatch0. Section foreign-key closure and every content Asset ID stay in this Project; duplicate critical IDs0; sort_order exactly0..3. Each of4 canonical Storage paths exists, owner downloads nonempty bytes, original and manually cropped hashes match expectations, and orphan Objects0.

The optional-import Project is separately cleaned through production deleteAsset followed by deleteOwnedProject: Project/product/facts/options/assets/pages/intents/tickets/objects0 and namespace tombstone1. Consumed admission history is retained by the production primitives; final test teardown explicitly removes test-owned ledgers/accounts. Final-state artifact verifies business rows/objects/intents/admissions/tickets/test users0, with namespace history and Docker volumes preserved.

## Privileged, browser, network and secret evidence

Ordinary service-role DB CRUD0 and Storage0 in both Next and direct-service paths. Next permits only reserve_admission, settle_admission, issue_export_ticket, use_export_ticket and close_export_ticket; direct imports permit only reserve/settle. Exact category counts are in runtime.json. Export uses2 actual Chromium launches and no external Chromium requests. User tokens/cookies are not passed into capture. Browser console/pageerrors0; unexpected external requests0; remote target/mutation0. Browser response bodies, request URLs, subprocess logs and static JS are scanned in memory against actual runtime secrets; offline configured-secret/static/bundle scans add coverage. No raw export capability is written to artifacts.

## Actual export files

| Format | Dimensions | Bytes | SHA-256 |
| --- | --- | --- | --- |
| png | 860 × 2318 | 28696 | 387e60d643e460afc9480a6805815e8c4dc150b5633852b4535872a16b9d2e57 |
| jpeg | 860 × 2318 | 63612 | 6892e5438cbf2ed72aef6ed6d474645fa770387620010687e4ce7d1691679074 |

Both downloads use actual UI format selection and capture workers. Sharp verifies file magic, width860 and nonzero height; MIME image/png or image/jpeg; private,no-store cache header; expected filename extension. Export service validates the browser fingerprint and rereads saved state; final service/browser fingerprints match. Tickets are terminal and snapshots cleared.

## Security and full regressions

| Task | Runtime | Checks | Result |
| --- | --- | --- | --- |
| TASK-058 | rls | 143 | PASS |
| TASK-059 | storage | 74 | PASS |
| TASK-060 | admission | 37 | PASS |
| TASK-061 | auth | 20 | PASS |
| TASK-062 | export | 27 | PASS |
| TASK-063 | cross-user | 40 | PASS |

TASK-060 includes ABUSE-01–06 and concurrent upload12→3/AI8→2. TASK-063 retains exact-ID corpus97. Official command node --conditions=react-server --import ./tests/register.mjs --test tests/*.test.mjs:1487 passed,0 failed/skipped. next typegen, tsc --noEmit, npm run lint, npm run build, git diff --check, secret scan and browser-target bundle scan PASS. Evidence logs reside in artifacts/TASK-064; audit.json reports exact scan counts. No security policy was weakened.

## Findings and limits

No production BLOCKER/HIGH/MEDIUM/LOW regression found in this bounded deterministic workflow. Harness corrections were incorrect UI labels/format selection, asynchronous save waiting, a mistaken Facts version increment assumption, blocked .example fixture hostname and nonretryable invalid-rectangle fault. Corrected fixtures follow existing contracts; no production guard was relaxed. Explicit failure charge expiry is test clock control, not a product fix. Live provider quality, deployment configuration and public SaaS release readiness remain outside TASK-064 and blocked on TASK-065.

## Source-enumerated route/action inventory

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

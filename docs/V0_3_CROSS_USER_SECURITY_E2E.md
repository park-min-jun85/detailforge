# v0.3.0 Cross-user Security E2E

2026-09-29 · TASK-063 · baseline 4d8b9b6 · Next 16.3.4 · Local only

**TASK-063 COMPLETE. Public SaaS deployment remains BLOCKED (TASK-064/065).**

## Contract and scope

Exact foreign UUID/path knowledge is not authorization. The real Browser → Next Proxy/Route/Action → production service → verified user client → PostgreSQL/Storage RLS chain must reject cross-user reads and mutations. Export additionally uses a one-time ticket and isolated Chromium. No test authentication bypass or production test endpoint exists. Admin client is fixture setup/cleanup only; application admin fetches are counted separately. Runtime DI supplies a fake AI provider while GoTrue/DB/Storage and services remain real.

Sources are enumerated on every run: 16 pages, 38 route/method combinations (32 project API methods, 5 Auth methods, 1 capture POST), 2 Server Actions = 56 entries. Project-scoped corpus includes 8 pages + 32 API methods and the Product Action in each direction, plus 15 mixed-scope attacks = 97 recorded rows. Additional signed-candidate, import-ticket, Action owner spoof, Storage, raw JWT, RSC/prefetch and session probes are outside that 97 count. Routes do not expose standalone Project update/delete or Section create/delete: those CRUD operations are tested through actual user-JWT PostgREST; Section generation and product mutation use the existing app entry points.

## Principals and protected graphs

Local GoTrue password sessions A, B and anonymous browser contexts. A2 is a separate same-owner project, used for mixed-scope checks and legitimate positive controls. Each graph has distinct Project, Product, Facts, Options, Asset/actual PNG, Detail Page and hero Section. Exact IDs/path are given to the opposite principal. Per-run identifiers are in artifacts/TASK-063/runtime.json (principals and corpus). Secrets/passwords/cookie jars are never written.

All seven tables are hashed individually before attacks. After the two directions, every row hash is identical. Storage download length/SHA-256 and the **entire** storage.objects row hash (including metadata) are identical. A2 also passes the unchanged check before its explicit own Product Action positive control. Only fixture setup, the A2 own AI/Action control and the own Export are legitimate own-user changes. Cleanup deletes only test-owned graphs/accounts/objects/ledger rows; namespace ownership history and Docker volumes remain.

## Source-derived surface inventory

Public login/signup/Auth endpoints expose no project graph. All other normal pages and project API methods require verified getUser before execution; export-capture uses its own capability. Route parameters remain untrusted even after Proxy. Body IDs include productId, detailPageId, rowId, orderedSectionIds/expectedSections, assetIds, candidate scope and revision/token identifiers where applicable. The generated corpus substitutes these through strict valid request shapes; signature/expired-ticket failures are supplemented by correctly signed candidate and valid process-local import-ticket probes. No endpoint is exempted merely because it validates input before ownership.

| Kind | Method | Route/action | Path/action parameters | Authentication | Ownership boundary |
| --- | --- | --- | --- | --- | --- |
| route | POST | `/api/projects/[projectId]/assets/[assetId]/analyze` | projectId, assetId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/assets/[assetId]/extract-product-shots/retry` | projectId, assetId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/assets/[assetId]/extract-product-shots/save` | projectId, assetId | verified user | owned project, scoped child query + RLS |
| route | GET | `/api/projects/[projectId]/assets/[assetId]/extract-product-shots` | projectId, assetId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/assets/[assetId]/extract-product-shots` | projectId, assetId | verified user | owned project, scoped child query + RLS |
| route | DELETE | `/api/projects/[projectId]/assets/[assetId]` | projectId, assetId | verified user | owned project, scoped child query + RLS |
| route | GET | `/api/projects/[projectId]/assets` | projectId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/assets` | projectId | verified user | owned project, scoped child query + RLS |
| route | GET | `/api/projects/[projectId]/editor` | projectId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/export` | projectId | verified user | owned project, scoped child query + RLS |
| route | GET | `/api/projects/[projectId]/fact-validation` | projectId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/fact-validation` | projectId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/options/import/apply` | projectId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/options/import` | projectId | verified user | owned project, scoped child query + RLS |
| route | GET | `/api/projects/[projectId]/options` | projectId | verified user | owned project, scoped child query + RLS |
| route | PUT | `/api/projects/[projectId]/options` | projectId | verified user | owned project, scoped child query + RLS |
| route | GET | `/api/projects/[projectId]/page-plan` | projectId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/page-plan` | projectId | verified user | owned project, scoped child query + RLS |
| route | GET | `/api/projects/[projectId]/product-analysis` | projectId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/product-analysis` | projectId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/sections/[sectionId]/apply-candidate` | projectId, sectionId | verified user | owned project, scoped child query + RLS |
| route | GET | `/api/projects/[projectId]/sections/[sectionId]/options` | projectId, sectionId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/sections/[sectionId]/options` | projectId, sectionId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/sections/[sectionId]/regenerate` | projectId, sectionId | verified user | owned project, scoped child query + RLS |
| route | PATCH | `/api/projects/[projectId]/sections/[sectionId]` | projectId, sectionId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/sections/generate` | projectId | verified user | owned project, scoped child query + RLS |
| route | PATCH | `/api/projects/[projectId]/sections/reorder` | projectId | verified user | owned project, scoped child query + RLS |
| route | GET | `/api/projects/[projectId]/sections` | projectId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/wholesale-import/images` | projectId | verified user | owned project, scoped child query + RLS |
| route | GET | `/api/projects/[projectId]/wholesale-import/preview` | projectId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/wholesale-import/preview` | projectId | verified user | owned project, scoped child query + RLS |
| route | POST | `/api/projects/[projectId]/wholesale-import/save` | projectId | verified user | owned project, scoped child query + RLS |
| route | GET | `/auth/callback` | — | public/auth flow | public/auth flow |
| route | GET | `/auth/session` | — | public/auth flow | public/auth flow |
| route | POST | `/auth/signin` | — | public/auth flow | public/auth flow |
| route | POST | `/auth/signout` | — | public/auth flow | public/auth flow |
| route | POST | `/auth/signup` | — | public/auth flow | public/auth flow |
| route | POST | `/export-capture/data` | — | one-time capability | one-time capability |
| page | GET | `/export-capture` | — | one-time capability | one-time capability |
| page | GET | `/` | — | verified user | verified user |
| page | GET | `/login` | — | public/auth flow | public/auth flow |
| page | GET | `/projects/[projectId]/analysis` | projectId | verified user | owned project, scoped child query + RLS |
| page | GET | `/projects/[projectId]/editor` | projectId | verified user | owned project, scoped child query + RLS |
| page | GET | `/projects/[projectId]/images` | projectId | verified user | owned project, scoped child query + RLS |
| page | GET | `/projects/[projectId]/planner` | projectId | verified user | owned project, scoped child query + RLS |
| page | GET | `/projects/[projectId]/render` | projectId | verified user | owned project, scoped child query + RLS |
| page | GET | `/projects/[projectId]/sections` | projectId | verified user | owned project, scoped child query + RLS |
| page | GET | `/projects/[projectId]/validation` | projectId | verified user | owned project, scoped child query + RLS |
| page | GET | `/projects/[projectId]` | projectId | verified user | owned project, scoped child query + RLS |
| page | GET | `/projects/new` | — | verified user | verified user |
| page | GET | `/projects` | — | verified user | verified user |
| page | GET | `/settings` | — | verified user | verified user |
| page | GET | `/signup` | — | public/auth flow | public/auth flow |
| page | GET | `/templates` | — | verified user | verified user |
| action | POST | `createProjectAction` | _previousState, formData | verified user | verified principal + owned project/RLS |
| action | POST | `saveProductAction` | projectId, _previous, formData | verified user | verified principal + owned project/RLS |

## Service and privileged boundaries

- Project CRUD: verified principal + explicit owner filter; Product Action: saveProductInformation checks Project before Product/facts CAS.
- Assets: getAssetContext → scoped Product/Asset → user Storage, including upload/delete/analyze/extraction/retry/save. Foreign issueUpload fails before reserve RPC; arbitrary path/asset identity is server-generated. Replay/expiry/quota/reclaim/race are exercised by TASK-060 ABUSE-01~06 regression.
- Options: get/saveProductOptions, previewImportedOptions and prepareImportedOptions bind both Project/Product and row revision. A foreign option row cannot be applied across Projects.
- Analysis/validation/planner/section generation/regeneration: verified scoped context before provider. Eight production entry points × A→B/B→A/anon = 24 denied service calls, factory/dispatch count 0. Own analyzeAsset calls a fake provider once using real user JWT/Storage/admission. Quota denial dispatch 0. This is a security boundary positive control, not a claim that all eight own-user workflows were completed (TASK-064).
- Editor/options apply/reorder/candidate: project/page/section scope, revision and referenced Asset scope remain mandatory. Correctly signed foreign candidate is still denied. Forged capability checks are separate from authorization checks.
- Wholesale: preview scope before fetch, imported Product mutation still checks user Project; a valid stolen process-local ticket cannot cause foreign persistence/image fetch. External fetch counter 0.
- Export: foreign app requests issue 0 tickets, capture 0, snapshot 0. The normal own PNG export positively verifies the exact app instrumentation (1 issued ticket, 1 Chromium launch, 860px output). TASK-062 supplies all forged/replay/actor/project/page/Asset/network probes again.
- Ordinary service-role DB CRUD and Storage calls 0 in both direct production-service and actual Next process instrumentation. Only finite admission/export RPCs are privileged. No production boundary was expanded.

## Route corpus results

Each row below runs twice with exact opposite IDs. JSON status/body matches random absent IDs; pages are 404 or the actual RSC not-found boundary. All 15 mixed Project/child attacks reject (including same owner different Project). Additional own-section/foreign-Asset PATCHes reject with no writes.

| Route/action | Method | Injected identifiers | A→B status | B→A status | Leak | Mutation |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/projects/[projectId]/assets/[assetId]/analyze` | POST | projectId, assetId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/assets/[assetId]/extract-product-shots/retry` | POST | projectId, assetId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/assets/[assetId]/extract-product-shots/save` | POST | projectId, assetId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/assets/[assetId]/extract-product-shots` | GET | projectId, assetId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/assets/[assetId]/extract-product-shots` | POST | projectId, assetId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/assets/[assetId]` | DELETE | projectId, assetId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/assets` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/assets` | POST | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/editor` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/export` | POST | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/fact-validation` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/fact-validation` | POST | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/options/import/apply` | POST | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/options/import` | POST | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/options` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/options` | PUT | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/page-plan` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/page-plan` | POST | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/product-analysis` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/product-analysis` | POST | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/sections/[sectionId]/apply-candidate` | POST | projectId, sectionId; 관련 body ID | 400 | 400 | 0 | 0 |
| `/api/projects/[projectId]/sections/[sectionId]/options` | GET | projectId, sectionId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/sections/[sectionId]/options` | POST | projectId, sectionId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/sections/[sectionId]/regenerate` | POST | projectId, sectionId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/sections/[sectionId]` | PATCH | projectId, sectionId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/sections/generate` | POST | projectId; 관련 body ID | 409 | 409 | 0 | 0 |
| `/api/projects/[projectId]/sections/reorder` | PATCH | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/sections` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/api/projects/[projectId]/wholesale-import/images` | POST | projectId; 관련 body ID | 410 | 410 | 0 | 0 |
| `/api/projects/[projectId]/wholesale-import/preview` | GET | projectId; 관련 body ID | 400 | 400 | 0 | 0 |
| `/api/projects/[projectId]/wholesale-import/preview` | POST | projectId; 관련 body ID | 400 | 400 | 0 | 0 |
| `/api/projects/[projectId]/wholesale-import/save` | POST | projectId; 관련 body ID | 410 | 410 | 0 | 0 |
| `/projects/[projectId]/analysis` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/projects/[projectId]/editor` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/projects/[projectId]/images` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/projects/[projectId]/planner` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/projects/[projectId]/render` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/projects/[projectId]/sections` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/projects/[projectId]/validation` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `/projects/[projectId]` | GET | projectId; 관련 body ID | 404 | 404 | 0 | 0 |
| `saveProductAction` | POST | projectId; 관련 body ID | 200 | 200 | 0 | 0 |

The full 97-row record includes actual UUID/path, status, absent status, direction, leak and mutation in artifacts/TASK-063/runtime.json. For createProjectAction, owner_id/id spoof is rejected by the strict form schema. A real own saveProductAction persists successfully, proving foreign Action replays reached a valid action transport rather than a protocol parse error.

## Session, cache and RSC interpretation

Malformed cookies and actually revoked refresh sessions with invalid access signatures deny page/API/Action. A previously issued valid access JWT can remain valid until its TTL; this suite does not claim immediate JWT revocation. Logout clears browser access; direct page, API and Action then deny. In the same BrowserContext, A's own page is loaded, A logs out, B logs in, and A DOM/RSC/API data remains absent. B's own assets are readable and private/no-store.

Normal foreign RSC exposes no content. Next prefetch may return HTTP 200 containing only a route tree with the request's ID. When this occurs, replacing the requested ID makes the entire body byte-equal to the random nonexistent Project response; no stored resource data is returned. This is not an authorization success. Full RSC/direct navigation still reaches the not-found boundary. Existence comparisons exclude timing.

## Secret and network evidence

Runtime checks complete attack response bodies, completed browser HTML/RSC/JSON/JS, console and app logs against actual local passwords/access/refresh/server/ticket secrets held only in memory. Static scan checks secret values and server credential access; a public error message mentioning the literal variable name OPENAI_API_KEY is not a secret value. Completed-response collection avoids hanging on intentionally cancelled prefetches. 29 static files and 854 collected response/console entries were checked. Separate browser-target bundle: 57 modules, 590630 bytes, server modules 0, secret markers 0.

All test connections are fixed loopback (app 3063, Supabase 58721, PostgreSQL 58722, mail 58724). Browser routing blocks outside origins; app fetch guard blocks remote targets. Chromium production interception and actual forbidden network/redirect probes are also rerun in TASK-062. Normal browser/Chromium external attempts 0, app remote target 0, remote DB/Auth/Storage mutation 0, external provider calls 0. Artifacts contain counts/hashes/IDs, not raw session or signed download credentials.

## Finding and fix

LOW: Section option compare/apply propagated the invisible Project's AssetError as generic 503. Both foreign and absent were equal and no data leaked, but this misreported authorization denial as a server failure. The shared target now maps only AssetError 404 to EditorError not_found. Database/other failures remain fail-closed. Two regression tests require no child access or mutation, and the real A/B route corpus now returns 404. BLOCKER/HIGH/MEDIUM findings: 0. No migrations, dependency changes or policy relaxation.

## Reproduction and evidence

Run from C:\Projects\detailforge, with Docker, local Supabase CLI, PostgreSQL client and installed Chrome:

```powershell
node scripts/cross-user-local-stack.mjs start
node --conditions=react-server --import ./tests/register.mjs tests/cross-user-runtime.browser.mjs
node scripts/cross-user-local-stack.mjs stop
```

The harness builds/starts production Next, never loads repository env files, cleans its own fixtures in finally and preserves volumes. Previous security runtimes use their existing dedicated stacks. Final audit is node scripts/cross-user-audit.mjs after regression logs and documentation exist. Results: [TASK-063](tasks/TASK-063.md). Full gates remain TASK-064 own-user full workflow and TASK-065 production/release validation.

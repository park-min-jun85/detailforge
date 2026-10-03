# v0.3.0 Production Rollout and Recovery

2026-10-01 · TASK-065

**Local Release Candidate PASS. Production rollout BLOCKED / OPERATOR ACTION REQUIRED.**

This runbook is not deployment authorization. No remote target was selected or inspected. Every production item remains OPERATOR ACTION REQUIRED. [Local evidence](V0_3_RELEASE_VALIDATION.md).

## Preflight and stop conditions

Record approved deployment provider/project,canonical domain/TLS,Supabase project ref/region/database identity,current deployed SHA and migration ledger. Match the intended target before any mutation. Do not infer production schema from local main or assume0007–0010 are the only missing files.

Select a long-lived Node runtime compatible with installed Next/native Sharp,installed Playwright Chromium or chrome channel,sandbox support,sufficient memory/disk and request budget beyond75-second Export. No --no-sandbox workaround. Capture origin must be reachable from the worker,with static assets and correct HTTPS. No readiness claim for an unspecified serverless host.

Wholesale/option handles and signing keys are process-local:preview/apply/save must reach the same live process. Prove sticky routing if using multiple workers and safe fresh-preview behavior after restart. A single live worker is the tested Local acceptance topology;availability/load is not certified. Bound aggregate Export capacity across replicas because its busy flag is per process. DB AI/upload quotas do not establish an Export global limit. If chosen topology cannot satisfy this,keep ingress closed and obtain a reviewed fix.

Review current dependency advisories/platform support;offline install sanity is not a CVE audit. Align package/lock version with the approved release version during authorized preparation and rerun checks. No broad upgrade or version change occurred here.

## Environment and Auth

Use the chosen provider's secret store,never copy local.env/fixtures. Public build-time pair:NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from the same selected production project. Server SUPABASE_URL must match;SUPABASE_SERVICE_ROLE_KEY stays server-only. Rebuild after public env changes and verify all instances consistently without logging values.

Generate DETAILFORGE_TICKET_SECRET with at least32 cryptographically random bytes;store separately from Supabase credentials. Source minimum32-character validation is not an entropy test. Reject known fixtures/repeated low-entropy strings. Same root across compatible workers;rotation invalidates outstanding Section candidates. Export uses separate random per-ticket capabilities. Never record secret values,hashes or fragments in audit evidence.

Set OPENAI_API_KEY and approved model access/budget for AI;DOMEGGOOK_API_KEY only for official integration. Set NODE_ENV=production and exact DETAILFORGE_APP_ORIGIN=https://approved-domain with no path/query/credentials/hash. Match browser cache/channel to the production image. Local PG_BIN/event/artifact env is not required in production.

Supabase Auth:exact HTTPS Site URL and approved/auth/callback redirects;email confirmation enabled;working SMTP/templates;password policy at least8;JWT/session/refresh settings and login/email rate limits reviewed. App uses verified getUser,PKCE callback and local-scope POST signout. Browser/SSR cookies are Secure/SameSite=Lax and intentionally not HttpOnly. Verify forwarded HTTPS/Host and redirects;do not wildcard redirect origins.

Private product-assets bucket,expected MIME/10MiB cap and RLS must stay enabled. Never make the bucket public,disable RLS or add service-role CRUD fallback to repair a failed smoke. Verify private cache directives through the actual CDN,including RSC/prefetch/callback/capture. Staged global CSP/anti-embedding/nosniff/HTTPS policy must preserve the existing capture-specific CSP and app functionality.

## Migration rollout sequence

1. Keep public writes closed/maintenance enabled. Take a restorable DB snapshot plus Storage byte backup/inventory;record timestamp,retention,recovery owner and restore rehearsal. DB metadata alone is not image-byte backup.
2. Read actual migration ledger/catalog and compare applied history to approved source. Confirm managed Auth/Storage roles/owners/extensions. Investigate drift/unexpected policies;never overwrite blindly.
3. Audit owners,child relationships,canonical paths,duplicate paths and orphan Objects. Record an approved Project→Auth-user mapping. Never guess owners or automatically assign all legacy data to the deployer.
4. Apply only missing migrations in numeric order. If starting before0006,apply necessary earlier files then0006. For null legacy owners,use existing ownership audit/backfill dry-run with explicit existing Auth UUID and complete approved Project allowlist;review then apply. The bootstrap tool supports a single-owner manifest. For mixed owners,STOP and obtain an approved mapping procedure;do not assign everything to one user for convenience. Preserve existing assigned owners. Only zero unresolved ownership/path/relationship findings permits0007,then0008–0010 as needed.
5. Respect transactional preflights/lock timeouts. On partial chain failure,inspect ledger/catalog and resume only after the last confirmed file;avoid replaying non-idempotent raw policy creation. Record ledger accurately through the chosen migration mechanism.
6. Verify7 public RLS tables/28 policies,private control grants,5 Storage policies,immutable owner/parent/PK constraints,composite FK/canonical paths,namespace tombstones,finite privileged functions and ticket TTL. Confirm private bucket and approved legacy data preservation without exporting customer data.
7. Explicitly configure the single admission_limits row after budget review. No production default exists. Record approved user/global slots,10MiB-per-path user/global bytes,upload/hour,AI concurrency/hour/day. Do not copy relaxed Local test limits. Verify expiry/reclaim retains actual/ambiguous footprint;never bulk-release or delete Objects to clear alerts.
8. Verify Auth/Storage/env/header/logging configuration;deploy approved security-compatible application while ingress remains controlled;run own-user smoke.
9. Use two controlled accounts for cross-account denial before public access. Observe authentication,429/5xx,quota,Storage and capture health.
10. If security,data-preservation,signed preview or own workflow fails,keep/return ingress to maintenance and recover. Open public access only after explicit operator acceptance of all gates.

No production step was executed by TASK-065.

## Rollback and recovery

- Application/deployment:restore a known security-compatible build for the current schema and user-scoped clients. Do not publicly roll back to pre-RLS/service-role MVP code. If none exists,close ingress and forward-fix.
- Environment:restore approved config consistently;rebuild for public variables. Recheck redirects/origin/signed previews/capture. Never restore leaked keys. Process restart may invalidate import tickets;require a fresh preview rather than trusting client payload reconstruction.
- Database:retain ownership,NOT NULL,RLS,private bucket and namespace controls. No automatic destructive down migration. Diagnose and use reviewed forward migrations. Snapshot restore requires explicit recovery approval,handling post-backup writes,matching Storage recovery and rechecking ownership/policies before ingress.
- Provider failures:retain uncertain charges and existing Object/Asset footprint. Reconcile actual outcomes before administrative adjustment;do not bulk-refund.
- Exposure suspected:close affected ingress,rotate relevant Supabase/provider/candidate keys,invalidate affected sessions/capabilities,preserve sanitized incident evidence and verify rebuilt client/static output. Rotate all affected workers consistently;never put raw tokens/capabilities in tickets.

## Post-deploy smoke — operator controlled,not run here

1. Anonymous/projects redirects to/login;protected API and forged capture deny with private/no-store and no foreign data.
2. Create controlled A/B accounts,confirm email,login,verify callback/return path and refresh. Record fixture identifiers only,never credentials.
3. As A:create Project/Product/Facts/Options,upload a harmless approved image,verify canonical private Object/signed preview and owner reads.
4. After separately approved real provider spend:one bounded representative AI operation with schema/evidence/admission persistence;record call count/cost without prompts/images/secrets.
5. Build a small allowed renderable fixture,verify860px renderer and actual PNG/JPG downloads,headers,terminal ticket/snapshot cleanup and no credentials in Chromium/logs.
6. Reload/logout/re-login and confirm persistence;protected routes deny after logout.
7. As B:use exact A Project/Asset IDs to verify DB/API/Storage/Export denial without provider/capture dispatch;confirm B's own fixture works.
8. Check redacted logs,unexpected5xx,Auth failures,quota/capture latency and alerts reaching the responsible operator.
9. Clean only explicit smoke fixture IDs:delete known Storage assets through owner-safe primitives first,then child/Project data via approved administrative/service workflow (no Project delete UI exists). Confirm rows/Objects/intents removed or correctly terminal. Preserve namespace tombstones and legitimate charged history. Remove controlled users after FK-safe cleanup;leave unrelated customer data untouched.

## Operations

No central deployed monitoring system was demonstrated. Before ingress,configure redacted availability/error/429/provider-cost/Storage-growth/DB-capacity/Export memory+latency alerts,on-call owner,backup/restore cadence and log retention. Redact Authorization,Cookie,Set-Cookie,x-export-token,x-export-worker,callback code and signed URL token queries. Do not collect provider/request bodies by default. Verify actual staged header/cache behavior rather than only configuration checkboxes.

Production remains **BLOCKED / OPERATOR ACTION REQUIRED** pending target,credentials,backup,migrations,Auth/Storage,limits,topology,headers,monitoring,smoke and explicit rollout authorization.

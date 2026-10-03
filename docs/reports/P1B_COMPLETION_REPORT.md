# OriginMetric — P1b Completion Report

**Date:** 2026-10-01  
**Phase:** P1b — Tracker + ingestion + end-to-end proof  
**Status:** **TECHNICALLY COMPLETE / AWAITING USER REVIEW**  
**Implementation branch:** `codex/originmetric-p1b-vertical-slice`  
**Base main:** `a7969c09c525cf57bcd25d9970e2e52240d6b6b3`  
**Final technical code head:** `9ce12b7672141d2d42f43992c5a766f3609f59c7`  
**Final technical CI:** run #38 — PASS  
https://github.com/brsctncnbrk5/originmetric/actions/runs/36911778514

## Objective result

P1b's technical objective is met: the first non-throwaway local end-to-end OriginMetric slice now works from a consent-aware browser visit through trusted server identity and revenue to materialized attribution.

Proven chain:

```text
test page
→ required-consent tracker
→ visitor/session + Google campaign stored
→ server identify (secret key)
→ trusted visitor/customer link
→ Revenue API payment
→ customer attribution = google / attributed
→ token-protected internal result
```

## Completed

### Tracker v0

- Automatic `pageview` only; browser identify/custom events are not implemented.
- Initial load plus SPA `pushState` / `replaceState` / `popstate` capture.
- Same-URL 1-second dedup.
- Random browser `visitor_id` and `session_id`.
- 30-minute inactivity boundary and immediate campaign-key split.
- UTM source/medium/campaign/content/term capture capped at 200 chars.
- Click-ID **presence** hints only; values are never sent.
- Referrer host only; page path never includes query/hash.
- Cookie-first first-party storage with localStorage fallback.
- `originmetric.getVisitorId()`.
- `data-consent="required"`: no OriginMetric storage and no ingestion request before consent.
- `originmetric("consent", true|false)`; withdrawal clears `om_*` browser state and disables sending.
- GPC honoured by default; explicit `data-gpc="ignore"` escape hatch.
- `sendBeacon` with keepalive `fetch` fallback.
- Failure isolation: tracker/network/storage failure does not break the host page.
- IIFE / ES2017 / zero runtime dependencies.
- Built asset: `/js/v1/om.js` with one-hour cache + stale-while-revalidate.
- Final gzip: **2491 bytes / 2560-byte hard budget**.

### Public browser ingestion

- `POST /api/v1/e`.
- Public `pk_...` site-key project resolution.
- Allowed `Origin`, with `Referer` fallback.
- Wrong origins and malformed/unknown events return the same quick `202` drop path.
- 8 KB hard body limit.
- Strict Zod schema; unknown fields rejected.
- `pageview` only.
- `(project_id, event_id)` dedup.
- Session creation and existing-session pageview update.
- Session ID reuse by a different visitor is dropped.
- Source normalization uses the already locked P1a rule set.
- New pre-acquisition sessions trigger bounded recomputation for customers already trusted-linked to that visitor.
- Browser endpoint has no customer creation or trusted-link path.
- Logs keep safe project/outcome/error-class facts only.

### Local proof surfaces

- Fixture pages for basic, required-consent, GPC, CSP, storage-disabled and blocked-endpoint scenarios.
- Fixture helper script.
- `/internal/projects/[id]`, disabled when `INTERNAL_TOKEN` is absent and returning 404 without the exact Bearer token.
- `npm run demo` for the complete local slice.

### Defect found and fixed during P1b

The new ingestion regression suite exposed a real existing-session bug: the second pageview could fall into the ingestion endpoint's fail-closed `dropped_internal` path. The update used raw SQL fragments for `last_seen_at` / `pageviews`.

The fix keeps the existing `FOR UPDATE` row lock, reads the current counter/time values, computes the next values in application code, and performs an ordinary parameterized Drizzle update. The regression now passes and session entry-source fields remain immutable.

## Verification

| Check | Result |
|---|---|
| GitHub Actions run #38 | **PASS** |
| gitleaks full-history scan | **PASS** |
| ESLint / Prettier | **PASS** |
| TypeScript strict typecheck | **PASS** |
| PostgreSQL migrations apply/check/no schema drift | **PASS** |
| Vitest | **333/333 PASS** across 20 files |
| P1b real-DB ingestion tests | **7/7 PASS** |
| Tracker-core unit tests | **9/9 PASS** |
| Internal-token unit tests | **3/3 PASS** |
| Tracker gzip gate | **2491 / 2560 B PASS** |
| Next.js production build | **PASS** |
| Playwright full suite | **10/10 PASS** |
| Required-consent zero-storage/zero-network test | **PASS** |
| Consent withdrawal clearing/stopping test | **PASS** |
| GPC default / ignore override | **PASS** |
| Storage-disabled failure isolation | **PASS** |
| Blocked-endpoint failure isolation | **PASS** |
| Strict CSP fixture | **PASS** |
| Browser identify/link-poisoning prevention | **PASS** |
| SPA direct continuation / new-campaign split | **PASS** |
| Complete vertical-slice Playwright proof | **PASS** |
| Exact `npm run demo` command in CI | **PASS** |

## Remaining before P1b can be ACCEPTED

1. **Barış user review:** run/watch `npm run demo` and confirm that the practical attribution flow looks correct. This is required by the locked P1b phase.
2. After that confirmation, record P1b as **COMPLETE / ACCEPTED** and fast-forward the P1b branch into `main`.
3. **Do not start P2 before acceptance.**

## Remaining after P1b (planned future work, not P1b defects)

P2 remains **NOT STARTED**. Its scope includes real VPS/domain/Cloudflare dogfood deployment and gate G1: in-process browser-ingestion rate limits, process-wide abuse ceiling, per-project daily hard cap, Cloudflare's single rate-limit rule, firewall, production compose/Caddy, deploy/rollback, off-VPS encrypted backup + restore test, monitoring, and a consent-aware real-site dogfood test.

Later phases still contain accounts/tenancy UI, onboarding, dashboard, quotas/bot heuristics, billing and public launch work.

## Known warnings / guardrails

- The tracker is **2491 B gzip**, leaving only **69 B** under the 2.5 KB locked limit. Any tracker growth must be deliberate.
- The repository is currently **PUBLIC**. This does not invalidate local P1b, but changing it to Private is recommended before real external/user data is introduced.
- The known `drizzle-kit` → old `esbuild` moderate development-only audit advisories remain unchanged from P0/P1a.
- Stored session sources are normalized facts. Future historical re-normalization needs an explicit migration/rebuild strategy.
- `test:true` revenue still participates in acquisition semantics under the locked model; future test-data purge must not leave stale live attribution.
- P2 rate limiting / abuse ceiling are intentionally not present yet and must be in place before uncontrolled public real traffic.

## Final P1b disposition

**Technical implementation:** PASS  
**Automated verification:** PASS  
**Local vertical slice:** PROVEN  
**User acceptance:** PENDING  
**Merged to main:** NO  
**P2 started:** NO

# OriginMetric — Master Development Plan v1

STATUS: **READY FOR USER REVIEW** (not approved, not locked)
PHASE: PLAN-0 (Master Planning / Architecture only)
OWNER / FINAL APPROVER: Barış
DOCUMENT ROLE: Primary source of truth for product, architecture, roadmap, and decisions until superseded by v2+.

> This document is the canonical planning artifact for OriginMetric. A fresh Claude Code session, after `/clear`, should be able to read this file (plus `docs/STATUS.md`) and reconstruct enough context to continue work without re-deriving the whole product from scratch.

---

## 0. Core Promise & Product Loop

**"Know where your revenue comes from."**

```
Install tracker
   → Capture visitor
   → Determine traffic source / campaign
   → Identify conversion / customer
   → Receive revenue event
   → Attribute revenue to acquisition source
   → Display results in dashboard
```

OriginMetric is a narrow, deterministic revenue-attribution product for solo/small SaaS founders — **not** a general web analytics platform.

---

## 1. Architecture Overview

```
Customer Website
      ↓
Tracker (tracker.js, small, async, fail-silent)
      ↓
Public Ingestion Endpoint  (POST /api/events)   ← public, browser-facing
      ↓
Validation / Identity / Session Resolution      ← internal
      ↓
PostgreSQL (events, visitors, sessions)
      ↓
Revenue API (POST /api/revenue)                 ← server-to-server, API-key authenticated
      ↓
Attribution Logic (deterministic, runs at write time + read time)
      ↓
Analytics Queries / Aggregation (materialized/rollup tables)
      ↓
OriginMetric Dashboard                          ← authenticated user-facing
```

### Trust boundaries

| Boundary | Exposure | Auth | Notes |
|---|---|---|---|
| `POST /api/events` (tracker ingest) | Public, browser-facing | Project ID (public, non-secret) + origin/referrer checks + rate limiting | Must tolerate hostile/garbage input; never trusts client-reported identity beyond visitor/session IDs it issued |
| `POST /api/revenue` | Server-to-server | Secret API key (per-project) | Never callable from a browser; treat as a webhook-style endpoint |
| `/api/identify` (optional, P4+) | Public, browser-facing or server | Project ID + rate limit | Links anonymous visitor → known customer |
| Dashboard app routes | Authenticated user-facing | Session auth (org/project scoped) | Standard authenticated web app |
| Internal aggregation jobs | Internal only | N/A (not network-exposed) | Cron/worker inside the same deployment |

No component other than the Revenue API and the dashboard requires strong authentication; the tracker ingest endpoint is deliberately public but rate-limited and validated.

### Background workers

Not required for MVP correctness. A single lightweight scheduled job (cron via `pg_cron`, OS cron, or a simple Node scheduler) is justified for **rollup aggregation** (turning raw events into per-day/per-source metrics) so dashboard queries stay cheap. This is not a queue system — see §14.

---

## 2. Domain Model (MVP)

Entities (names not fully locked, but boundaries are):

- **user** — a human login (email + password or magic link).
- **organization** — billing/ownership boundary; a user belongs to one or more orgs.
- **project** — one tracked website/product inside an org. Holds the public `project_id` (tracker) and secret `revenue_api_key`.
- **visitor** — anonymous identity, created client-side (cookie/localStorage ID) on first hit, tied to a project.
- **session** — a bounded window of activity for a visitor (see §3 for session-boundary rules).
- **event** — raw tracked occurrence (`pageview`, `identify`, custom event later). Append-only.
- **customer** — a known/identified entity inside a project (usually maps to the founder's own end-customer). Linked to one or more visitors.
- **revenue_event** — an append-only record of money received (charge, renewal, refund) submitted via the Revenue API.
- **attribution** — derived, not separately stored as a mutable table; computed from `visitor`'s first/last touch session data and materialized onto `customer`/`revenue_event` at write time for query performance (see §3).

### Multi-tenancy & isolation

- Every row below `organization` carries `project_id`, and every `project` carries `organization_id`.
- All application queries are scoped by `project_id` server-side from the authenticated session/API key — never trust a client-supplied `project_id` for authenticated write paths beyond the public tracker ingest, which is inherently keyed by the public, low-privilege `project_id`.
- Tenant isolation is enforced at the query layer (explicit `WHERE project_id = $1` in every query via the ORM/query builder) plus **Postgres Row-Level Security (RLS)** as defense-in-depth once the schema is implemented in P0/P1. RLS policy design is deferred to implementation but must be present before public launch (P10 gate).

### Identity linking

- Anonymous `visitor` gets a durable client-side ID on first tracker load (localStorage preferred over cookies — see §5).
- `identify` event (explicit call from the customer's site, e.g. on signup) links `visitor_id → customer_id`.
- Revenue API calls carry `customer_id` (required) and optionally `visitor_id` (if the founder's backend has it); if `visitor_id` is omitted, OriginMetric resolves it via the most recent `identify` event for that `customer_id` within the project.
- Identity linking is **many visitors → one customer** (a person may browse from multiple devices before converting); first `identify` per visitor wins for attribution purposes (see §3).

### Money representation

- Store amounts as **integer minor units** (cents), never floats. Column: `amount_minor_units BIGINT`, `currency CHAR(3)` (ISO 4217).
- No automatic currency conversion in MVP. Dashboard reports **per-currency totals** grouped by `currency`, and clearly labels mixed-currency projects rather than fabricating a blended total. A single "primary reporting currency" per project is a possible fast-follow, not MVP.

### Timestamps

- All storage in UTC (`timestamptz`), always.
- Each `project` has a `reporting_timezone` (IANA tz name, default UTC) used only to bucket dashboard rollups (daily/weekly grouping) for display. Session-boundary logic (§3) uses UTC + a fixed inactivity window, not the reporting timezone, to avoid DST edge cases in session math.

### Deletion / retention

- `revenue_event` and `event` rows are **append-only, immutable** — corrections happen via new rows (e.g., a refund is a new negative `revenue_event` referencing the original, never an UPDATE/DELETE of history). This preserves auditability and is required for correct MRR-over-time reporting.
- Soft-delete (`deleted_at`) for `project` and `organization` (grace period before hard purge) to support "restore my project" and GDPR/KVKK export windows.
- Hard delete on user request after the grace period, cascading per §17/§44.

---

## 3. Attribution Engine (MVP model)

**Recommended MVP model: Session-based Last Non-Direct Touch, with First Touch retained per visitor for future reporting.**

### Why this model

- **Last non-direct touch** is the industry-standard, easiest-to-explain model for solo founders ("the campaign that most recently, meaningfully brought this person back before they paid" gets the credit). It matches what founders already intuitively expect from tools like Plausible/Fathom + manual guesswork.
- It correctly handles the common case: a visitor arrives from Google, browses, returns later **directly** (typing the URL / bookmark) to convert — direct traffic does **not** overwrite the earned attribution.
- **First touch is stored, not discarded** (`visitor.first_touch_source`, `first_touch_campaign`, captured at visitor creation) so the plan can add a First Touch view or multi-touch model later **without re-collecting data** — only a query/report change, not a schema rewrite.

### Explicit semantics

| Situation | Rule |
|---|---|
| First ever visit | `visitor.first_touch_*` = referrer/UTM of that session. `visitor.last_touch_*` = same. |
| Subsequent visit with a real referrer or UTM params | `visitor.last_touch_*` is **updated** to the new source/campaign. |
| Subsequent visit that is **direct** (no referrer, no UTM) | `visitor.last_touch_*` is **NOT overwritten** — direct visits never clobber a previously earned non-direct touch. Internally this is modeled as: direct traffic updates a separate `last_seen_at`, but only a non-direct (or first-ever) touch updates `last_touch_source`. |
| Visitor has never had a non-direct touch and is always direct | `last_touch_source = "Direct"`. This is a legitimate, correctly-labeled outcome, not an error. |
| `revenue_event` arrives | Attribution snapshot (`source`, `medium`, `campaign`) is **copied onto the `revenue_event` row at insert time** from the linked customer's current `visitor.last_touch_*`. This makes revenue-event attribution immutable/historical even if the visitor's touch data changes later (e.g. they revisit from a different source after paying). |
| Session boundary | New session starts after **30 minutes of inactivity** (industry-standard default) or on a UTM-parameter change mid-visit (a fresh campaign link counts as a new session even if under 30 min). Session ID stored client-side (see §5), session row created server-side on first event of a session. |
| Returning visitor (same browser, no cookie clear) | Same `visitor_id` reused indefinitely (subject to retention window, §44); a new `session_id` is created per session per the boundary rule above. |
| Anonymous → identified transition | On `identify`, `customer.first_visitor_id` is set once (immutable) if not already set. If a `customer_id` is identified again from a **different** `visitor_id` later, the new visitor is linked but does not change which visitor's touch data drives attribution — the **original identifying visitor's** last-touch data is authoritative unless the founder explicitly re-identifies (edge case, documented as a known limitation, not solved in MVP). |
| Duplicate revenue events | Idempotency key required on every Revenue API call (§4). Duplicate key within the dedup window is a no-op (200 OK, not double-counted). |
| Refunds | Submitted as a distinct `revenue_event` with `type = "refund"` and a negative `amount_minor_units`, referencing `original_revenue_event_id`. Net revenue/MRR = SUM over all revenue_events, so refunds naturally net out without mutating history. |
| Subscription renewals | Each renewal is its own `revenue_event` with `type = "renewal"`, same `customer_id`. Attribution snapshot is taken from the **original acquiring touch** (first non-direct touch ever recorded for that customer's originating visitor), not re-attributed to whatever the visitor's last touch happens to be at renewal time — renewals should credit the channel that acquired the customer, not whatever channel they happened to click last. **This is the one place first-touch-at-acquisition, not last-touch, is used** — it is pinned onto `customer.acquisition_source` at the moment of the **first** revenue_event for that customer, and all subsequent renewals inherit it. |
| MRR interpretation | MRR is computed from **active subscription-type revenue_events**, not a stored mutable "current MRR" field, to keep everything derivable/auditable from the append-only log. Exact MRR computation rules (proration, cancellation handling) are implementation detail for P6, not re-litigated here. |

### Known limitations (documented, not solved in MVP)

- No cross-device identity resolution without an explicit `identify` call (no fingerprinting — by design, §7/§17).
- Multi-touch/weighted attribution is not supported; only single-channel credit per revenue event.
- If a founder's backend never calls `/identify` and only calls the Revenue API with a `customer_id` OriginMetric has never seen, that revenue event is recorded as **unattributed** ("Unknown source") rather than guessed. This is correct behavior, not a bug — it should be visible on the dashboard as its own bucket so founders know to fix their `identify` integration.
- Re-identification of a customer from a new visitor overwriting acquisition source is not supported in MVP (documented above).

### Future extensibility

Because `first_touch_*` is retained per visitor and every revenue_event stores its own attribution snapshot at write time, adding **First Touch** or a **linear/multi-touch** report later is a new read-query against existing data — it does not require backfilling or re-architecting ingestion.

---

## 4. Revenue API (MVP contract, draft — not locked)

```
POST /api/v1/revenue
Authorization: Bearer <project_secret_api_key>
Content-Type: application/json
Idempotency-Key: <founder-supplied unique string>

{
  "customer_id": "cus_123",           // required, founder's own ID for their customer
  "visitor_id": "visitor_abc",         // optional; resolved via last identify() if omitted
  "type": "subscription" | "one_time" | "renewal" | "refund",
  "amount_minor_units": 2900,          // required, integer, in currency's minor unit
  "currency": "USD",                   // required, ISO 4217
  "occurred_at": "2026-09-28T12:00:00Z", // optional, defaults to receipt time; must not be in the future beyond a small clock-skew allowance
  "original_revenue_event_id": null,   // required for type=refund, references the event being refunded
  "metadata": { }                      // optional, opaque, size-capped, never used in attribution logic
}
```

### Requirements

- **Authentication**: per-project secret API key (`revenue_api_key`), bearer token, rotatable, revocable. Never derived from or equal to the public tracker `project_id`.
- **Authorization / tenant isolation**: the API key alone determines `project_id` server-side; the request body can never override which project the event belongs to.
- **Idempotency**: `Idempotency-Key` header required; combination of `(project_id, idempotency_key)` is unique-indexed. Replays within a rolling retention window (recommend 30–90 days) return the original response with `200` and a flag indicating it was a duplicate, not re-processed.
- **Replay protection**: idempotency key covers accidental retries; this endpoint is server-to-server over HTTPS with a bearer secret, so replay-by-attacker is mitigated by TLS + secret possession, not nonces/timest-signing in MVP (revisit if a customer specifically needs HMAC request signing — not required for MVP).
- **Validation**: strict schema validation (reject unknown `type`, non-integer amounts, missing currency, invalid ISO 4217 codes, `refund` without `original_revenue_event_id`, negative amounts on non-refund types).
- **Versioning**: URL-path versioning (`/api/v1/...`) from day one; breaking changes get a new version path rather than in-place contract changes.
- **Failure handling**: 4xx for validation errors with a machine-readable error code + human message; 401/403 for auth failures; 429 for rate-limit; 5xx reserved for genuine server faults and should be rare/alerted-on. The API should be safe for the founder's backend to call synchronously in their own payment webhook handler with a short timeout and treat any non-2xx as "log and move on" (never block their own payment flow on OriginMetric's availability — document this explicitly in integration docs, P9).

**Not required for MVP**: native Stripe/Paddle/etc. connectors. The generic API is the MVP; native integrations are P8+/post-validation fast-follows, explicitly called out as a differentiator but not built until the generic path is proven.

---

## 5. Tracker Requirements

- **Loading**: single `<script async src=".../tracker.js" data-project="...">` tag. Async by default; must never block page render.
- **Size budget**: target **< 5 KB gzipped** for the core script (pageview + UTM + identify). This is a hard-ish constraint that shapes implementation (no heavy framework, vanilla JS, minimal dependencies).
- **Failure isolation**: every tracker operation wrapped so a thrown error, blocked network request, or missing global **never** throws into the host page. Principle from the brief: *"Tracker failure must never break or materially degrade the customer's website."* Enforced via try/catch at every public entry point and a hard timeout on network calls.
- **Transport**: `navigator.sendBeacon` where available (survives page unload, e.g. bounces), falling back to `fetch` with `keepalive: true`. No synchronous XHR.
- **Retry**: no client-side retry queue in MVP (adds complexity/localStorage risk for marginal gain); a dropped beacon is an acceptable, documented data-loss edge case at this stage. Revisit only if real usage shows meaningful loss.
- **Batching**: not required for MVP — pageview + occasional identify events are low-frequency enough that one request per event is fine. Revisit if a "custom events" feature increases volume.
- **Identifiers**: `visitor_id` generated client-side (UUID v4) on first load, persisted in **localStorage** (survives longer than typical cookie defaults, avoids some cookie-consent classification issues, but is still disclosed in the privacy policy). Fallback to an in-memory/session-only ID if storage is blocked (private browsing, blockers) — tracker still functions, just without cross-session memory, and this is treated as expected degradation, not a bug. `session_id` generated client-side, refreshed per the 30-minute inactivity / UTM-change rule (§3), also localStorage-backed with a `last_active_at` timestamp checked on each hit.
- **Consent**: OriginMetric does not fingerprint and does not set third-party cookies, which materially simplifies (but does not eliminate) consent obligations — see §17. The tracker ships **no built-in consent-banner UI**; that remains the site owner's responsibility. Documentation must clearly state what data is collected so founders can represent it accurately in their own privacy policy/consent flow.
- **Ad blockers**: expect a meaningful fraction of requests to be blocked (uBlock/Privacy Badger commonly block generic analytics-shaped requests). Mitigation path (not MVP-blocking, but architecturally keep open): allow serving the script from the customer's **own domain** via a documented reverse-proxy/CNAME pattern later (a common approach used by Plausible/Fathom-style tools). Document as a known limitation for MVP.
- **CDN/cache**: `tracker.js` served with a short-ish cache lifetime + versioned filename or cache-busting query param strategy so fixes roll out without a forced hard-refresh wait; exact mechanism decided in P2.
- **Versioning/back-compat**: the on-page `data-project` attribute contract must remain stable; any breaking change to the wire protocol between tracker and ingestion API requires the tracker to keep talking to old API versions until sites update — plan for `/api/v1/events` alongside the revenue API's versioning approach.
- **CSP**: document the `script-src`/`connect-src` CSP directives founders need to allow the tracker domain, published in onboarding docs (P9).
- **Testability**: tracker logic (ID generation, session-boundary logic, referrer/UTM parsing) built as pure, unit-testable functions separate from the thin DOM/network glue, so behavior is verifiable without a browser in CI (browser-level smoke tests are a separate, smaller suite — see §9).

---

## 6. Security & Privacy

### Security controls (MVP-gating unless marked deferred)

- HTTPS everywhere (enforced at the reverse proxy/Cloudflare level).
- Auth: hashed+salted passwords (or magic-link only — open decision, §11) via a vetted library, never homegrown crypto.
- Authorization: every authenticated route checks org/project membership server-side; no client-trusted role claims.
- Tenant isolation: query-layer scoping + Postgres RLS (§2) before public launch.
- API key security: revenue API keys shown once at creation (or re-revealable if stored encrypted-at-rest — decide in P1), rotatable, revocable, never logged in full (log last 4 chars only).
- Secret storage: `.env` files, never committed; production secrets in the VPS's environment/secret store, not in the repo, not in CI logs.
- Rate limiting: on `/api/events` (public) and `/api/revenue` (keyed) — per-project and per-IP limits to blunt abuse/cost blowout.
- CSRF: standard same-site cookie + CSRF token protections on the authenticated dashboard app (framework-provided, e.g. Next.js conventions).
- XSS: standard output-encoding discipline in the dashboard; no `dangerouslySetInnerHTML` on user-influenced data.
- SQL injection: parameterized queries only, via the chosen query layer/ORM — never string-concatenated SQL.
- Input validation: strict schema validation at both public endpoints (tracker ingest, revenue API) — this is also an abuse-prevention control, not just correctness.
- Audit logging: record API-key usage (which key, which project, timestamp, outcome) and sensitive account actions (login, key rotation, project/org deletion) at minimum; full activity audit trail is a nice-to-have, not MVP-gating beyond these.
- Backups: see §16.
- Account/project deletion + data export: user-initiated deletion supported (soft-delete grace period, then hard purge per §44); basic data export (CSV/JSON dump of a project's events/revenue) required before charging users (see §12 cut line), not necessarily before first real user.

### Privacy posture

- **Deliberately not collected**: no cross-site tracking cookies, no device fingerprinting (canvas/audio/font fingerprinting), no IP-based precise geolocation beyond coarse country-level (if even that — country-level via a free/self-hosted IP→country lookup is acceptable and low-risk; nothing more granular in MVP), no scraping of page content, no keystroke/mouse tracking, no session replay, no cross-project data sharing.
- **Collected, minimally**: visitor ID (self-generated, not derived from PII), session ID, page path, referrer, UTM parameters, coarse device/browser category (for basic segmentation only, not fingerprinting purposes), timestamps.
- **Cookies/consent**: primary identifiers live in localStorage, not cookies, which for many jurisdictions reduces (does not eliminate) "cookie banner" obligations, but **localStorage-based tracking is still personal-data processing under GDPR/KVKK** if it can identify a person over time — founders using OriginMetric on EU/Turkey-facing sites still need an appropriate legal basis/notice. OriginMetric's own docs (P9) must say this plainly rather than implying "no consent needed."
- **GDPR/KVKK**: OriginMetric acts as a data processor for its customers' visitor/customer data. Needs: a published privacy policy, a DPA-style terms addendum available before charging users, data export, and deletion on request. Full DPA tooling is not MVP-gating for a free/beta product but **must exist before charging EU/Turkey-based customers** (§12 cut line).
- **Log redaction**: application logs must not contain raw API keys, full visitor PII combinations, or revenue API payloads verbatim in plaintext long-term logs — redact secrets, keep structured metadata only.

---

## 7. Testing Strategy

| Layer | Tooling (candidate) | Runs | Blocks merge |
|---|---|---|---|
| Unit (attribution logic, tracker pure functions, money/currency math) | Vitest/Jest | Local + CI | Yes |
| Integration (API routes against a real test Postgres) | Vitest/Jest + testcontainers or a CI Postgres service | CI (optional locally) | Yes |
| DB/migration tests (migrations apply cleanly up/down, schema constraints hold) | migration tool's own test runner + a CI job that runs all migrations against a fresh DB | CI | Yes |
| Auth/authorization tests (can't read another org's/project's data) | Integration tests hitting real routes with two seeded tenants | CI | Yes |
| Tenant isolation tests | Same as above, explicit "cross-tenant access must 403/404" test suite | CI | Yes |
| Tracker unit tests (ID gen, session boundary, UTM parsing) | Vitest/Jest, no browser needed | Local + CI | Yes |
| Tracker browser smoke test | Playwright (already available in this environment), one script loaded in a headless page, asserts a beacon/fetch fires | CI (can be slower/nightly if flaky) | Recommended, not necessarily blocking initially |
| E2E vertical slice (§13) | Playwright against a local docker-compose stack | CI (can be a separate, slower job) | Yes once P7 exists |
| Attribution correctness tests | Unit + integration fixtures covering every row of the §3 semantics table (direct-after-referral, renewal-inherits-acquisition, refund-nets-out, duplicate-idempotency) | CI | Yes |
| Revenue API tests (idempotency, duplicate, refund, validation) | Integration | CI | Yes |
| Security regression tests | Added per fixed bug, targeted (e.g., "this specific injection payload must 400") | CI | Yes |

- **Time-sensitive logic** (session boundaries, renewals) tested with an injectable clock/fixed timestamps in fixtures — never `Date.now()` inside logic under test.
- **Fixtures**: a small seed dataset (2 orgs, 2 projects, a handful of visitors/sessions/revenue_events covering each §3 row) checked into the repo under `tests/fixtures/`, reused across integration and E2E tests.
- Regression test required whenever a real (non-typo) bug is fixed — recorded as a rule in `docs/testing/` conventions, not re-explained here.

---

## 8. CI/CD (design only — not implemented in PLAN-0)

- **GitHub Actions is sufficient.** No need for a dedicated CI product.
- Pipeline stages: lint → typecheck → unit tests → migration test → integration tests → build. E2E/Playwright as a separate, possibly non-blocking-at-first job.
- Deployment: manual-trigger or main-branch-push-triggered deploy to the existing VPS via SSH + `docker compose pull && up -d` (or a simple deploy script) — no elaborate pipeline. Rollback = redeploy the previous image tag (tag every build with the git SHA).
- Migration validation: a CI job that spins up a throwaway Postgres and applies all migrations to catch broken migrations before merge.
- Static/security checks: `npm audit`/`pnpm audit` (or equivalent) plus basic secret-scanning (e.g., gitleaks) as a cheap CI step.
- None of this is built during PLAN-0; it is scoped here so P0 has a concrete, small implementation target.

---

## 9. Operations (Backups, Restore, Monitoring)

- **Postgres backups**: `pg_dump` on a daily cron, stored **off-server** (e.g., pushed to an object storage bucket or even a second location on the VPS provider's snapshot system if available) — must not live only on the same disk as the live DB. Retention: e.g. 14 daily + 8 weekly, tunable later, not over-engineered now.
- **Restore testing**: a documented, periodically-run manual (or scripted) drill — restore the latest backup into a scratch DB and run a basic row-count/integrity check. Frequency: at minimum before public launch (P11 gate), then quarterly.
- **Encryption**: backups encrypted at rest if stored on third-party object storage (most providers do this by default; verify, don't assume).
- **App logs**: structured logs (JSON) to stdout, captured by Docker's logging driver with rotation (`max-size`/`max-file` in `docker-compose.yml`) — no separate log shipping product required for MVP.
- **Service restart**: Docker Compose `restart: unless-stopped` policy on all services.
- **Deployment rollback**: redeploy previous image tag; database migrations must be written to be forward-compatible with the previous app version where feasible (avoid destructive migrations in the same deploy as risky app changes) — a full expand/contract migration discipline is documented but not over-built for a pre-launch MVP.
- **Disk usage monitoring**: a simple scheduled check (cron + a one-line script hitting `df` and alerting via email/webhook if above a threshold) is sufficient; no dedicated monitoring product required.
- **Uptime monitoring**: a free-tier external uptime pinger (e.g., UptimeRobot free tier or equivalent) hitting a `/health` endpoint — flagged as a **potentially-paid, likely-free** service, see §10 decision table.
- **Incident/data-loss response**: documented runbook (who to notify, how to restore, how to communicate to affected founders) — written in P11, not now.

---

## 10. Observability (minimum viable)

- Structured application logs (already covered above) are the primary tool.
- Error tracking: a **free-tier self-hosted or free-tier SaaS** error tracker (e.g., a free tier of an error-tracking service) is useful but **not MVP-blocking**; can start with just structured error logs + manual `grep`/log review for a solo founder at low volume. Flagged as a P10/P11 nice-to-have, not a PLAN-0 commitment.
- Key signals to be able to answer, at minimum via logs/simple queries: ingestion error rate, revenue API error rate, auth failure rate, DB connection errors, 5xx rate. No dedicated dashboarding product required pre-launch; a couple of SQL queries or log greps suffice at MVP scale.
- Explicitly avoid building an internal observability platform — this is a discipline reminder for future phases, not a task.

---

## 11. Auth & Email (comparison)

| Option | Security | Dev effort | Maintenance | Multi-tenant orgs | Cost | Recommendation |
|---|---|---|---|---|---|---|
| Self-managed (hand-rolled session + bcrypt/argon2) | Good if done carefully, more surface area to get wrong | Medium | Ongoing (you own every edge case: reset flows, session invalidation) | Straightforward to model yourself | Free | Viable but higher risk for a solo founder |
| **Auth.js (NextAuth) with credentials + email/magic-link provider** | Good, widely used, patterns well-documented | Low–Medium | Low (library maintained upstream) | Requires modeling org/project membership yourself either way — Auth.js only handles identity, not tenancy | Free | **Recommended for MVP** |
| Third-party auth SaaS (Clerk/Auth0/Supabase Auth, etc.) | Good | Lowest | Lowest | Varies | Free tier often available, paid at scale, vendor lock-in risk | Not recommended as default — adds a paid/vendor dependency the brief asks to avoid unless justified; revisit only if Auth.js proves too much overhead |

**Recommendation**: Auth.js (or equivalent, e.g. Lucia) for session/credential handling, self-modeled `organization`/`project`/`membership` tables for tenancy. This is a **significant architecture decision and requires user approval** (flagged in §12).

**Email (transactional — password reset, magic link, invite)**: needed regardless of the auth choice above, at minimum for password reset/magic-link. Recommend a **free-tier transactional email provider** (most have a free tier in the low-thousands-of-emails/month range, sufficient for pre-launch/early-beta volume). Exact provider not locked — pick at P1 implementation time based on current free-tier terms (verify at that time; provider free tiers change). This is a **potentially-paid dependency once volume grows** — documented per §10's cost-disclosure rule in the decision table below.

---

## 12. Background Jobs, Cache, Queues

- **No Redis, no queue system for MVP.** Justification: ingestion write + attribution-snapshot-at-write-time (§3) is cheap enough to do synchronously in the request path. The only recurring background need is periodic rollup aggregation (turning raw events into daily per-source metrics for fast dashboard queries), which is well served by a simple cron-triggered job (`pg_cron` inside Postgres, or an OS-level cron hitting an internal endpoint) — no message broker needed.
- Revisit Redis/queues only if a concrete need appears (e.g., truly high ingest volume needing write buffering, or a feature requiring fan-out). Not anticipated pre-launch.
- Cache: not required for MVP at expected early scale; Postgres with proper indexes on the rollup tables should serve the dashboard fast enough. Revisit if/when query latency becomes a measured problem.

---

## 13. First End-to-End Vertical Slice

**Goal**: prove the core hypothesis — traffic source → revenue → dashboard — as early as possible, before building every subsystem in full.

Minimal slice:
1. One hardcoded/manually-seeded test project.
2. Tracker (even a minimal version) sends a pageview with UTM params to the ingestion endpoint.
3. Visitor + session recorded, `last_touch_source` set.
4. A manual/simple `identify` call links that visitor to a `customer_id`.
5. A `POST /api/revenue` call (via curl/Postman, no UI needed yet) records a revenue event, attribution snapshot captured.
6. A minimal dashboard page queries and displays: source → revenue total (even just a plain table, no charts yet).

This slice does **not** require: full auth UI, billing, onboarding polish, native payment integrations, or the full IA (§ dashboard sections). It requires just enough of P0–P7 to prove the loop end-to-end.

**Roadmap placement**: this slice is the exit criterion for **P7 (initial cut)** but should be attempted in a thin/ugly form as early as the end of **P6**, before P7's full dashboard polish — i.e., prefer reaching a working (if ugly) vertical slice over perfecting any single layer first. This is called out explicitly as a sequencing principle for whoever implements P3–P7: build just enough of each to reach the slice, then come back and harden.

---

## 14. Decision Table

| Decision | Recommended | Alternatives | MVP Cost | Monthly Cost | Complexity | Security Impact | Lock-in | Migration Difficulty | User Approval Required? |
|---|---|---|---|---|---|---|---|---|---|
| Frontend framework | Next.js + TypeScript | Remix, SvelteKit, plain Vite+React | Free | $0 | Low | Neutral | Low | Low–Med | No |
| Backend architecture | Next.js server routes (API routes/Route Handlers) | Separate Express/Fastify service | Free | $0 | Low (one deployable) | Neutral | Low | Med (splitting out later is straightforward if ever needed) | No |
| ORM/query layer | Drizzle ORM or Prisma (pick one; lean Drizzle for lighter runtime + closer-to-SQL control given money/attribution correctness needs) | Raw SQL + a query builder (Kysely) | Free | $0 | Low–Med | Low (parameterized either way) | Low | Med | No |
| Database | PostgreSQL (single instance on existing VPS) | Managed Postgres (Neon/Supabase/RDS) | Free (existing VPS) | $0 now; managed alt ~$0–25/mo free-tier-to-low-paid later | Low | You own backup/HA | Low | Low | No — but flag: revisit managed Postgres before public launch if solo-founder ops burden of self-managed backups/HA becomes a real risk (§9) |
| Auth | Auth.js (or Lucia) + self-modeled org/project tables | Third-party auth SaaS (Clerk/Auth0/Supabase Auth) | Free | $0 | Med | Med (you own more of the flow) | Low | Med | **Yes — significant architecture decision** |
| Tracker build method | Vanilla TS, bundled/minified to a single small file, no framework | Using an existing OSS analytics tracker as a base (e.g. forking Plausible's script) | Free | $0 | Low–Med | Low | Low | Low | No |
| Event ingestion architecture | Synchronous write to Postgres in the request handler | Buffered/batched write via a queue | Free | $0 | Low | Neutral | Low | Med | No |
| Background jobs | Cron-triggered rollup job (`pg_cron` or OS cron hitting an internal route) | Redis + BullMQ | Free | $0 | Low | Low | Low | Low | No |
| Cache | None for MVP | Redis cache layer | Free | $0 | — | — | — | — | No |
| Charts | Recharts | visx, Chart.js, Tremor | Free | $0 | Low | N/A | Low | Low | No |
| Testing stack | Vitest + Playwright | Jest + Cypress | Free | $0 | Low | N/A | Low | Low | No |
| CI | GitHub Actions | Self-hosted CI, CircleCI | Free (public/free-tier minutes) | $0 typically | Low | N/A | Low | Low | No |
| Deployment | Docker Compose on existing VPS, SSH-triggered or Actions-triggered deploy | PaaS (Vercel/Render/Fly.io) | Free (existing VPS) | $0 | Med (you own the box) | Med (you own patching) | Low | Med | No |
| Reverse proxy / edge | Cloudflare (already implied available) in front of the VPS | Caddy/Nginx only | Free (Cloudflare free tier) | $0 | Low | Improves (DDoS/TLS handling) | Low | Low | No |
| Monitoring/uptime | Free-tier external uptime pinger + structured logs | Paid APM (Datadog, etc.) | Free | $0 (free tier) | Low | Low | Low | Low | No |
| Backups | `pg_dump` cron + off-server object storage copy | Managed DB automatic backups | Free–low | ~$0–5/mo depending on storage provider chosen | Low | Med (must actually test restores) | Low | Low | No, but flagged as a real recurring (likely near-zero but non-zero) cost — confirm storage choice at P11 |
| Transactional email | Free-tier provider (choose at P1 implementation time) | Self-hosted SMTP | Free tier | $0 at low volume, small paid tier likely eventually | Low | Low | Low–Med | Low | No — but flagged: will become a real cost once volume grows past free tier; revisit at that point |
| Error tracking | Deferred / logs-only for MVP | Free-tier SaaS error tracker | Free | $0 | Low | Low | Low | Low | No |

---

## 15. User Decisions Required Before Implementation

These are the decisions that materially change architecture or product behavior and should not be silently decided by Claude Code.

1. **Auth approach**: Auth.js/self-modeled tenancy (recommended) vs. a third-party auth SaaS.
   - *Blocks P0/P1?* Yes, directly shapes the schema and P1 scope.
   - *Can be deferred?* No — needed before any authenticated dashboard work begins.

2. **Session boundary window (30 minutes) and "direct doesn't overwrite last touch" rule (§3)**: this is the single most product-defining rule in the whole system (it decides what founders see as "where my revenue came from"). Recommended as specified above, but it is a product semantics decision, not a technical implementation detail.
   - *Blocks P0?* No. *Blocks P5 (Attribution Engine)?* Yes.
   - *Can be deferred?* Should be confirmed before P5 starts, not urgent for PLAN-0 itself.

3. **Retention policy specifics** (§16 below): exact day/week counts for raw event retention, backup retention, and deleted-project purge window.
   - *Blocks P0?* No. *Blocks public launch?* Yes (privacy policy needs real numbers).
   - *Can be deferred?* Yes, until P9/P10.

4. **Pricing tiers / what's free vs. paid** — not addressed in depth in this plan (see §17); needs founder input on positioning, not just engineering.
   - *Blocks P0–P7?* No. *Blocks P8 (Billing)?* Yes.
   - *Can be deferred?* Yes, well past MVP technical work.

5. **Domain/branding specifics** (e.g., is `originmetric.com` actually owned/available, exact tracker subdomain) — operational, not architectural, but needed before P2/P11.
   - *Blocks P0?* No. *Can be deferred?* Yes, until P11 (deployment).

Everything else in this document (stack choices, testing approach, CI approach, background-job approach) is a recommendation Claude Code can proceed on directly once the plan is approved — re-litigating these per-session would waste the limited Claude Code budget (§18).

---

## 16. Data Retention (recommendation, needs final user sign-off before launch)

| Data | Recommended MVP retention | Rationale |
|---|---|---|
| Raw pageview/session events | 13 months rolling (enables year-over-year comparison, caps indefinite growth) | Balances usefulness vs. disk cost/privacy |
| Visitor records (anonymous) | Same as raw events; purge visitor row when its last event ages out and it has no linked customer | Minimizes standing personal-data footprint |
| Customer + revenue_event records | Retained indefinitely while the project is active (financial/audit value); purged on project/account deletion per below | Founders need historical MRR trend indefinitely |
| Aggregated/rollup metrics | Retained indefinitely (small, low-risk, high value) | Cheap to keep, doesn't contain raw PII-adjacent detail |
| Deleted projects | 30-day soft-delete grace period, then hard purge of all associated data | Supports "oops, undo" without indefinite retention |
| Backups | 14 daily + 8 weekly rolling (see §9) | Standard, low-cost, adequate recovery window |

This table is a **recommendation requiring explicit user approval** before being stated as policy in a public privacy policy (§15, item 3).

---

## 17. Pricing & Billing (light-touch for MVP)

- Do not build complex billing before it's needed. First objective is validated usage, not ARPU.
- **Recommended pre-launch stance**: ship free (or "free during beta") with no billing integration at all through private beta. Add a minimal paid tier (single price point, manual or simple Stripe Checkout link — no complex metering/proration logic) only once approaching public launch and only if the founder decides to charge (P8, explicitly gated on user approval, and Stripe itself is a paid/third-party dependency requiring sign-off per §17 rule even if it's the standard choice for OriginMetric's *own* billing, separate from customers' own payment stacks tracked *by* the product).
- Tier structure (Free/Starter/Pro/Agency) is a placeholder from the brief, not designed in detail here — genuine pricing/packaging work belongs closer to P8/P12, with founder input, not engineering-led in PLAN-0.

---

## 18. Risk Register

| Risk | Likelihood | Impact | Mitigation | Detection | Phase Responsible |
|---|---|---|---|---|---|
| Attribution model confuses/misleads founders (doesn't match their mental model) | Medium | High (core value prop) | Clear in-product explanation of the model; document limitations plainly; keep model simple (§3) | User feedback in private beta | P5, P12 |
| Identity-linking errors (wrong visitor↔customer link) | Medium | Medium | Explicit `identify` API, no guessing/fingerprinting-based linking | Attribution test suite (§7); "Unknown source" bucket surfaces gaps | P4, P5 |
| Direct-traffic semantics implemented incorrectly (overwrites earned attribution) | Medium | High | Explicit test-suite row for this exact case (§3, §7) | Automated tests | P5 |
| Duplicate revenue double-counted | Low–Medium | High (trust-breaking) | Mandatory idempotency key, unique constraint | Integration tests | P6 |
| Refunds mishandled (net revenue wrong) | Medium | High | Append-only refund-as-new-row model, tested | Integration tests | P6 |
| Multi-currency totals misrepresented as blended | Medium | Medium | Never auto-convert; show per-currency, label clearly | Manual review, docs | P6, P7 |
| Privacy/consent non-compliance (GDPR/KVKK) | Medium | High (legal) | Minimal data collection by design, clear docs, DPA before charging (§6) | Legal/docs review before public launch | P9, P10 |
| Ingestion endpoint abuse (spam/garbage events) | Medium | Medium | Rate limiting, validation, per-project caps | Monitoring/logs | P3, P10 |
| Multi-tenant data leakage | Low (if RLS + scoped queries done) | Critical | Query-layer scoping + Postgres RLS, cross-tenant test suite | Automated tenant-isolation tests (§7) | P1, P10 |
| Dashboard query performance degrades with data growth | Medium (later) | Medium | Rollup/aggregation tables from the start (§12), not raw-event dashboard queries | Manual load testing before public launch | P7, P11 |
| VPS failure (single point of failure) | Low–Medium | High | Off-server backups (§9), documented restore procedure, consider managed Postgres if this risk grows unacceptable | Uptime monitoring | P11 |
| Backup failure (silent) | Medium (if untested) | Critical | Scheduled restore-drill (§9), not just "backup exists" | Restore-drill logs | P11 |
| Solo-founder operational overload | Medium | High | Aggressive scope discipline (§19), automation over manual process, narrow phases (§18 roadmap) | Self-check at each phase | All phases |
| Claude Code context/credit waste | Medium | Medium (budget is real, ~$100) | This document + `docs/STATUS.md` as durable context, narrow phase objectives, automated tests over manual re-verification (§20) | Track credit usage informally | All phases |
| Dependency churn (chasing new libraries) | Low–Medium | Medium | Stack choices in §14 are meant to be "boring and stable"; avoid mid-project framework swaps without strong justification | Self-discipline, ADR requirement for changes | All phases |
| Scope creep toward general analytics platform | Medium | High | §19 explicit non-goals; PROPOSED SCOPE EXCEPTION process for anything tempting | Self-audit each phase (§21 pattern) | All phases |
| Onboarding too complex, breaks the 10–15 min activation target | Medium | High | UX constraint baked into P9 exit criteria; measure with real beta users | Private beta feedback | P9, P12 |

---

## 19. Assumptions Register

| ID | Assumption | Why Needed | Impact If Wrong | Validation Method | Target Phase | Status |
|---|---|---|---|---|---|---|
| A1 | Existing VPS has adequate capacity for MVP + early growth (CPU/RAM/disk for Postgres + app) | Infra plan assumes no new hosting purchase | Would need a hosting decision + cost | Check actual VPS specs before P11 | P0/P11 | ASSUMPTION |
| A2 | `originmetric.com` (or the intended domain) is owned/available | Tracker examples and docs reference it | Rebranding/domain work needed | Confirm with founder | P11 | OPEN |
| A3 | 30-minute session boundary and "direct doesn't overwrite last touch" match founder expectations | Core attribution semantics | Reports would need reinterpretation/rework | Founder review of §3 + early beta feedback | PLAN-0 review, P12 | ASSUMPTION |
| A4 | Free tiers of chosen email/uptime/error-tracking services remain sufficient through beta | Cost model assumes $0 recurring spend pre-revenue | Small recurring cost appears earlier than planned | Monitor usage vs. free-tier limits | P1, P11 | ASSUMPTION |
| A5 | Single-VPS Postgres is sufficient through private beta and early public launch | Avoids premature managed-DB spend | Would need faster-than-planned migration to managed Postgres | Monitor query latency/DB load at P11/P12 | P7, P11 | ASSUMPTION |
| A6 | Solo founder can realistically execute narrow, sequential Claude Code phases without a team | Roadmap pacing (§18) assumes this working model | Timeline estimates (§20) would be optimistic | Ongoing, self-evident each phase | All | LIKELY |
| A7 | Localstorage-based (non-cookie) identifiers meaningfully reduce (not eliminate) consent-banner burden for founders' sites | Shapes tracker design and privacy messaging | Docs/positioning claim would need softening | Light legal-literature check before P9 docs are finalized | P9 | ASSUMPTION — recommend a real (even informal) legal read before stating this as a selling point in marketing copy |

---

## 20. Roadmap

Rationale for keeping the original phase structure from the brief largely intact: it already follows the natural dependency order (bootstrap → auth/tenancy → tracker → ingestion → identity → attribution → revenue → dashboard → billing → docs → hardening → ops → beta → launch), and splitting further would fragment single-session-sized work unnecessarily. Two changes: (a) explicitly note that a **thin vertical slice** should be pulled forward across P3–P7 rather than each phase being built to "complete" before the next starts (§13); (b) add narrow sub-phase markers where a phase is clearly too large for one controlled session.

### PLAN-0 — Master Planning / Architecture
- **Status at end**: this document, READY FOR USER REVIEW. (Current phase.)

### P0 — Repository & Project Bootstrap
- **Objective**: Next.js + TS app skeleton, Docker Compose (app + Postgres), base lint/format/test tooling, CI skeleton (lint/typecheck/test/build), `.env.example`, base ORM setup with an empty migration.
- **Why now**: nothing else can start without a runnable skeleton and a working CI loop.
- **Scope**: project scaffold, tooling config, empty schema, "hello world" health-check route, CI green.
- **Out of scope**: any real domain tables, auth, tracker code.
- **Dependencies**: none (this plan approved).
- **Deliverables**: runnable `docker compose up`, passing CI on an empty test suite + a trivial smoke test, `docs/STATUS.md` wired up.
- **Automated tests**: smoke test hitting `/health`.
- **Manual/user review**: confirm stack choices from §14 feel right in practice.
- **Security checks**: confirm no secrets committed, `.env.example` only.
- **Exit criteria**: CI green on a fresh clone; app boots locally via Docker Compose.
- **Expected status at end**: TECHNICALLY COMPLETE / AWAITING USER REVIEW.

### P1 — Authentication / Organizations / Projects
- **Objective**: user signup/login (Auth.js per §11, pending approval), `organization`/`project`/`membership` schema + RLS policies, basic project settings page (create project → get `project_id` + `revenue_api_key`).
- **Why now**: every other feature is tenant-scoped.
- **Scope**: auth flows, org/project CRUD, API key generation/rotation, RLS.
- **Out of scope**: tracker, revenue ingestion, dashboard analytics.
- **Dependencies**: P0; **User Decision #1** (auth approach) resolved.
- **Deliverables**: working signup/login, project creation UI, key rotation.
- **Automated tests**: auth tests, tenant-isolation tests (§7).
- **Security checks**: RLS verified with cross-tenant test suite.
- **Exit criteria**: a user can sign up, create an org+project, and retrieve credentials; cross-tenant access is provably blocked by tests.
- **Expected status at end**: TECHNICALLY COMPLETE / AWAITING USER REVIEW.

### P2 — Tracker SDK
- **P2-A**: core tracker (visitor/session ID, UTM/referrer capture, pageview beacon) as pure, unit-tested TS, bundled to the size budget (§5).
- **P2-B**: `identify()` API surface + build/serve pipeline (versioned `tracker.js` endpoint).
- **Why now**: needed before ingestion has real traffic to receive.
- **Dependencies**: P0.
- **Deliverables**: `tracker.js` buildable and servable locally; unit tests for ID/session/UTM logic.
- **Automated tests**: unit tests (§7); one Playwright smoke test loading it in a page.
- **Exit criteria**: tracker loads on a test HTML page without throwing, fires a beacon with correct fields.
- **Expected status at end**: TECHNICALLY COMPLETE / AWAITING USER REVIEW.

### P3 — Event Ingestion
- **Objective**: `POST /api/v1/events` public endpoint — validation, rate limiting, writes `event`/`visitor`/`session` rows.
- **Dependencies**: P1 (schema/tenancy), P2 (tracker shape to ingest).
- **Automated tests**: ingestion validation tests, rate-limit tests, abuse-input tests.
- **Security checks**: input validation, rate limiting verified.
- **Exit criteria**: a real tracker hit from a test page produces correct rows in Postgres.
- **Expected status at end**: TECHNICALLY COMPLETE / AWAITING USER REVIEW.

### P4 — Visitor / Session Identity
- **Objective**: session-boundary logic (§3) implemented server-side, `identify` endpoint linking visitor→customer.
- **Dependencies**: P3.
- **Automated tests**: full §3 session-boundary + identity-linking test matrix.
- **Exit criteria**: all §3 identity rows pass as automated tests.
- **Expected status at end**: TECHNICALLY COMPLETE / AWAITING USER REVIEW.

### P5 — Attribution Engine
- **Objective**: last-non-direct-touch logic (§3), first-touch retention, acquisition-source pinning for renewals.
- **Dependencies**: P4; **User Decision #2** (attribution semantics) confirmed.
- **Automated tests**: full §3 attribution test matrix (the most important test suite in the whole project).
- **Exit criteria**: every §3 table row has a passing automated test; no known-wrong edge case ships silently.
- **Expected status at end**: TECHNICALLY COMPLETE / AWAITING USER REVIEW.

### P6 — Revenue API
- **Objective**: `POST /api/v1/revenue` per §4, idempotency, refunds, renewals, attribution-snapshot-at-write.
- **Dependencies**: P5.
- **Automated tests**: full §4/§7 revenue API test matrix (idempotency, duplicates, refunds, validation).
- **Exit criteria**: the **first end-to-end vertical slice (§13)** is achievable via API calls alone (no UI needed yet) — this is the milestone to actually attempt at the end of this phase.
- **Expected status at end**: TECHNICALLY COMPLETE / AWAITING USER REVIEW.

### P7 — Dashboard & Analytics
- **P7-A**: rollup/aggregation job (§12) + minimal dashboard (source → revenue table, per §13 slice, made visual).
- **P7-B**: fuller IA (§ dashboard sections — Visitors/Traffic, Revenue, Sources, Customers, Settings) and charts (Recharts).
- **Dependencies**: P6.
- **Automated tests**: dashboard query correctness tests against fixtures.
- **Exit criteria**: the full vertical slice (§13) is demonstrable end-to-end through the actual UI, with a real (even if ugly) chart.
- **Expected status at end**: TECHNICALLY COMPLETE / AWAITING USER REVIEW — **this is the recommended point to invite first real test users.**

### P8 — Billing / Subscription
- **Objective**: minimal paid-tier gating if/when the founder decides to charge (§17). Deferred by default.
- **Dependencies**: P7; explicit founder go-ahead (this phase should not auto-start).
- **Expected status at end**: TECHNICALLY COMPLETE / AWAITING USER REVIEW.

### P9 — Onboarding / Documentation
- **Objective**: in-product setup flow (install snippet, verify-first-event UI), public docs (install guide, revenue API guide, CSP guidance, data-collection disclosure for privacy policies), targeting the 10–15 minute activation goal (§ success criterion).
- **Dependencies**: P7.
- **Manual/user review**: time a fresh install end-to-end against the 10–15 minute target.
- **Expected status at end**: TECHNICALLY COMPLETE / AWAITING USER REVIEW.

### P10 — Security / Privacy / Production Hardening
- **Objective**: full RLS review, rate-limit tuning, privacy policy + terms drafted (with real retention numbers per §16, **User Decision #3**), audit logging finalized, dependency/secret scan clean.
- **Dependencies**: P1–P9 substantially complete.
- **Security checks**: this phase *is* the security checklist from §6, verified line by line.
- **Expected status at end**: TECHNICALLY COMPLETE / AWAITING USER REVIEW.

### P11 — Deployment / Monitoring / Backup
- **Objective**: production Docker Compose on the VPS, Cloudflare in front, backup cron + a completed restore drill, uptime monitoring wired up.
- **Dependencies**: P10.
- **Exit criteria**: a real restore drill has been performed and documented; uptime check is live.
- **Expected status at end**: TECHNICALLY COMPLETE / AWAITING USER REVIEW.

### P12 — Private Beta
- **Objective**: a small number of real founders install and use OriginMetric; feedback loop on attribution model clarity and activation time.
- **Dependencies**: P9, P11.
- **Manual/user review**: this whole phase is a review gate — success is qualitative founder feedback plus no critical bugs.
- **Expected status at end**: TECHNICALLY COMPLETE / AWAITING USER REVIEW.

### P13 — Public Launch
- **Objective**: launch hardening (final load/perf check, billing live if decided, launch-channel content per §22 of the brief) and go live.
- **Dependencies**: P12 feedback incorporated.
- **Expected status at end**: TECHNICALLY COMPLETE / AWAITING USER REVIEW.

---

## 21. MVP Cut Line

**Must have before first real user (end of P7):**
- Working tracker, ingestion, identity linking, attribution engine, revenue API, minimal dashboard showing source→revenue.
- Basic auth + single-project setup.
- Core security controls (§6): tenant isolation, input validation, rate limiting, no secrets in repo.

**Must have before private beta (end of P11):**
- Onboarding docs + in-product setup flow.
- Privacy policy + terms (even a simple, honest draft) with real retention numbers.
- Backups + a completed restore drill.
- Basic uptime monitoring.

**Must have before charging users (P8, whenever triggered):**
- Data export capability.
- DPA-style terms addendum for EU/Turkey customers if targeting them commercially.
- At least one working payment path for OriginMetric's own billing (Stripe or similar), clearly separate from the customer-tracked payment systems the product itself analyzes.

**Can wait until after validation:**
- Native Stripe/Paddle/Lemon Squeezy/Polar/iyzico/PayTR integrations (generic Revenue API covers this).
- Multi-touch/first-touch reporting views.
- Error-tracking SaaS, advanced observability.
- Managed Postgres migration.
- Localization (Turkish).
- Tiered pricing complexity beyond a single paid tier.
- Consent-banner tooling built into the product.

---

## 22. Claude Code Efficiency Strategy

To make the ~$100 Claude Code budget go far:

1. **This document + `docs/STATUS.md` are the source of truth.** A new session reads these two files (and, once it exists, the current phase's own scoped doc if one is needed) instead of re-scanning the whole repository.
2. **Narrow phase objectives** (§20): each phase is scoped to be completable in a small number of controlled sessions, with explicit exit criteria — reduces open-ended exploration.
3. **`docs/STATUS.md` is updated at the end of every phase/session** with: current phase, last commit hash, what's done, what's next, any blockers — so `/clear` is safe to use aggressively between phases.
4. **Automated tests replace manual re-verification**: once a behavior has a passing test, future sessions trust the test rather than re-deriving correctness by hand.
5. **ADR-style decision records** (recommend a lightweight `docs/decisions/` log, one short file per significant decision made *during* implementation, not just this planning doc) prevent re-litigating settled choices.
6. **Avoid document fragmentation**: this plan intentionally stays as one authoritative planning document rather than being split into a dozen cross-referencing files, per the brief's own instruction to minimize context cost.
7. **Phase-start checklist for future sessions** (recommended, to be added to `docs/STATUS.md` once P0 begins): read `STATUS.md` → read the relevant roadmap section here → check `git log` for the last few commits → begin.

---

## 23. Documentation Structure (recommended)

Kept deliberately small:

```
/docs
  /planning
    MASTER_DEVELOPMENT_PLAN_v1.md   ← this file, primary source of truth
  STATUS.md                          ← tiny, always-current pointer: phase, last commit, next step
  /decisions                         ← one short ADR-style file per significant decision made during implementation (created starting P0, not now)
README.md                            ← project overview + pointer into /docs
.env.example                         ← created starting P0, when there is something to configure
```

No separate `/architecture`, `/security`, `/operations`, `/reports`, `/research` subfolders for now — their content lives inside this single master plan (§1, §6, §9–10) to avoid the fragmentation the brief explicitly warns against. If a section later grows too large to stay maintainable inside this file (most likely candidates: security/privacy policy text, or the attribution engine once implementation detail accumulates), it can be split out **then**, with this document updated to point to it — not preemptively now.

---

## 24. Timeline Estimate (ranges, assumptions stated)

Assumption: solo founder + Claude Code as primary implementer, sessions paced by the ~$100 budget and realistic part-time-to-full-time founder availability — treat these as rough planning ranges, not commitments.

- **Core technical MVP (through P7, vertical slice working end-to-end)**: roughly **3–5 weeks** of focused work.
- **Private beta readiness (through P11)**: roughly **2–3 additional weeks**.
- **Payment-ready SaaS readiness (P8 done, whenever triggered)**: variable, likely **1–2 weeks** of added work whenever the founder decides to trigger it — not on the critical path to beta.
- **Public-launch hardening (through P13)**: roughly **1–2 additional weeks** after a successful beta, contingent on beta feedback volume.

Total, core-MVP-to-public-launch, assuming beta feedback doesn't force significant rework: roughly **7–12 weeks** elapsed, materially dependent on founder availability between sessions and how much beta feedback reshapes the attribution UX. This is wider than the previous 4–6 week estimate because it now explicitly includes private beta and hardening phases the earlier estimate may not have accounted for in full.

---

## 25. Plan Self-Audit

- **Product scope**: Stayed within revenue attribution; explicitly excluded CRM/ads-manager/session-replay/etc. (§19/§21 cut lines). No scope drift detected.
- **Architecture**: Single VPS + Postgres + Next.js is manageable by one founder; no premature Kubernetes/Kafka/ClickHouse/Redis. Confirmed appropriately minimal (§12, §14).
- **Attribution**: First/last touch and direct-traffic semantics made explicit (§3); renewals/refunds/duplicates explicitly covered. Known limitations documented rather than hidden.
- **Security**: Tenant isolation explicit (query scoping + RLS), API key boundaries explicit (§4/§6), deletion/export addressed (§6/§16/§21).
- **Privacy**: No fingerprinting, minimal data collection stated explicitly (§6); cookie/consent nuance stated honestly rather than oversold as "no consent needed."
- **Cost**: All recurring costs surfaced in §14's decision table with an explicit $0-by-default posture and clear flags for where costs will appear later (email volume, backup storage).
- **Claude efficiency**: `docs/STATUS.md` + this document designed explicitly for `/clear`-safe continuation (§22).
- **Testing**: Attribution correctness — the plan's riskiest area — has the most detailed test-matrix commitment (§7, §20 P5).
- **Operations**: Backup **and** restore-drill both explicitly required, not just backup (§9, §21).
- **Scope aggressiveness**: MVP cut line (§21) is reasonably aggressive — defers billing, native integrations, and localization without blocking core value validation.

**Unresolved issues carried forward**: the five items in §15 (User Decisions Required) remain open and should be resolved (or explicitly deferred with the user's sign-off) before or during P0/P1.

---

## 26. Non-Negotiable Reminder

This document is planning output only. No application code, schema, tracker implementation, deployment, or paid service was created or activated while producing it. Implementation begins only after the user reviews this plan and explicitly moves it to APPROVED / LOCKED.

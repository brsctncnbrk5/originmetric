# OriginMetric — MASTER DEVELOPMENT PLAN v2

| Field | Value |
|---|---|
| Status | **READY FOR USER REVIEW** — not approved, not locked |
| Supersedes | MASTER DEVELOPMENT PLAN v1 (commit `4b24e5c`) — **REJECTED / SUPERSEDED**, not used as input |
| Date | 2026-09-28 |
| Owner | Barış (product owner, final decision maker) |
| Implementation | **NOT STARTED** — nothing in this plan may be implemented before Barış says `APPROVED / LOCKED` |

> This document is a plan, not a specification of finished work. Everything marked **RECOMMENDED** is a proposal. Everything marked **USER APPROVAL REQUIRED** is blocked until Barış decides. Nothing here is legal advice (§8).

---

## Table of contents

0. Executive summary
1. Product frame & design principles
2. Recommended architecture
3. Attribution model
4. Identity model
5. Tracker design
6. Public ingestion security (browser trust boundary)
7. Revenue API & its security (server trust boundary)
8. Privacy (GDPR / ePrivacy / KVKK)
9. Multi-tenancy
10. Money, currency & MRR
11. Time semantics
12. Data model
13. Raw vs derived data, deduplication & idempotency
14. Database (PostgreSQL) plan
15. Background processing
16. Authentication
17. Billing
18. Dashboard
19. Onboarding
20. Security threat model
21. Deletion, export & retention
22. Logging
23. Deployment
24. Backups
25. Observability
26. Test strategy
27. Repository & Claude Code memory model
28. Development roadmap (phases)
29. MVP cut lines
30. Estimates
31. Cost model & paid services
32. Technology decision matrix
33. User decisions required before implementation
34. Assumptions register
35. Risk register
36. Research log
37. GitHub / repository housekeeping
38. Plan self-audit

---

## 0. Executive summary

**Question this plan answers:** How can one founder, with Claude Code and an existing VPS, build the smallest secure and commercially useful version of OriginMetric?

**Answer in one paragraph:** Build one TypeScript Next.js application backed by one PostgreSQL database, run with Docker Compose on the existing VPS behind Caddy and Cloudflare Free. Before any account system exists, prove the full attribution chain end to end in phase **P1**: test page → tracker → session/source → identify → server-side revenue event → attribution → internal result table. Then deploy that slice to the VPS and use it on a real site. After that, productize in small phases: accounts and tenancy, guided onboarding with live integration status, and a single "where did my revenue come from" table. Harden security, privacy and operations before inviting beta users. Add billing only when a real user is ready to pay.

**Core recommendations**

| Topic | Recommendation |
|---|---|
| Architecture | Modular monolith: Next.js 16 + TypeScript + PostgreSQL 18 + Drizzle, Docker Compose on the existing VPS, Caddy (TLS), Cloudflare Free in front. No Redis, queue, worker fleet or ClickHouse. |
| First vertical slice | **P1** (P1a + P1b), directly after the P0 foundation. Needs no auth, UI polish or deployment. |
| Attribution | Customer-level, **last non-direct touch** before acquisition, 90-day lookback. Renewals and refunds inherit the customer's source. "Unattributed" is shown separately from "Direct". |
| Identity | Random first-party visitor ID, `identify(customerId)` from the browser plus an optional `visitor_id` on revenue events. No fingerprinting. Limits stated openly. |
| Browser ingestion | Public site key, Origin allow-list, strict validation, rate limits, bot filter. **Browser data can never create revenue.** |
| Revenue API | Secret per-project keys stored hashed, required `event_id`, idempotent replay (same payload → 200, different payload → 409), integer minor units. |
| Tenancy | Application-level scoping through one tenant-scoped data layer, composite tenant foreign keys, automated cross-tenant attack tests. RLS deferred deliberately. |
| Money | `bigint` minor units + ISO 4217 code. Never sum across currencies. FX deferred. |
| MRR | **Not in the MVP dashboard.** Optional subscription fields are collected from day one so MRR can be added correctly later. |
| Auth | Better Auth (self-hosted, MIT), email + password. USER APPROVAL REQUIRED. |
| Billing | Only at the "first paying user" cut line, through a merchant of record (Paddle or Polar). USER APPROVAL REQUIRED. |
| Privacy | Assume consent may be required for the visitor identifier in the EU/UK and Turkey. Ship a consent-aware tracker mode. Sell privacy-by-design, never "no banner needed". |
| Incremental MVP cost | About $0–5/month before billing (domain aside). True operating cost includes the existing VPS (§31). |

---

## 1. Product frame & design principles

**Promise:** *Know where your revenue comes from.*

**Core loop:** Website → tracker → visitor/session → source/campaign → customer → revenue event → attribution → dashboard.

**Design principles (used to settle every trade-off in this plan)**

1. **Prove the chain first.** Every phase must move the attribution loop forward. Horizontal infrastructure work is allowed only where the next phase needs it.
2. **Revenue truth comes from the server.** Browser data only suggests where a customer came from. Money comes only from authenticated server-to-server calls.
3. **Honest numbers.** Never show a number that looks more certain than the data allows. That rules out cross-currency totals, MRR without subscription data, and quietly putting unknown traffic under "Direct".
4. **Deterministic and recomputable.** Attribution is a pure function of stored raw facts plus a versioned rule set. No AI in the core product.
5. **Payment-provider neutral.** The generic Revenue API is the product. Native integrations come later and only if demand is proven.
6. **Solo-operable.** One process, one database, one host, and scripted operations. Anything that needs a human at 3 a.m. is a defect.
7. **Cheap to continue.** Any `/clear`ed Claude Code session can resume from `CLAUDE.md` → `docs/STATUS.md` → this plan.

**Non-goals** (unchanged from the brief): CRM, email marketing, chatbots/agents, ad manager, social, accounting, GA4 replacement, BI, session replay, heatmaps, advanced cohorts, mobile app, many integrations.

**Scope exceptions proposed:** none. The one area close to the line is the **consent mode** in the tracker (§5, §8). It is not a consent-management platform. It is a small switch that lets founders who need consent use OriginMetric at all, so it counts as core scope.

---

## 2. Recommended architecture

```
                 ┌──────────────── Cloudflare Free (DNS, proxy, TLS edge, WAF rules, cache for /js/*) ─────────────┐
 Founder's site  │                                                                                                  │
 <script om.js> ─┼──► POST /api/v1/e  (public, site key)  ─┐                                                        │
                 │                                          │    VPS (existing)                                      │
 Founder backend─┼──► POST /api/v1/revenue-events (secret)─┼──► Caddy (TLS) ──► app: Next.js (Node, standalone) ──► PostgreSQL 18
                 │                                          │                     │  - route handlers (APIs)         (internal network only,
 Founder browser─┼──► https://app.<domain>  (dashboard)  ───┘                     │  - server-rendered dashboard      volume on disk)
                 └──────────────────────────────────────────────────────────────────┘  - attribution engine (pure TS)
                                                                    host cron ──► `app` image CLI: jobs (retention, backup, restore-check)
                                                                    backups ──► encrypted ──► off-VPS object storage
```

**One deployable** (the `app` image) with internal modules. There are no microservices:

| Module | Responsibility |
|---|---|
| `tracker/` | Browser script. Built separately with esbuild into one file, has no runtime dependencies, and is served as a static asset. |
| `ingest` | Public event endpoint: validate, filter, dedup, upsert the session. |
| `revenue` | Server-to-server revenue API: auth, validation, idempotency, customer upsert. |
| `identity` | Visitor ↔ customer links. |
| `attribution` | Pure function `attribute(touches, rules) → result` plus a materializer. |
| `reporting` | Read-only SQL for the dashboard. |
| `tenancy` | Workspaces, projects, membership, authorization, tenant-scoped data access. |
| `auth` | Better Auth integration. |
| `ops` | CLI jobs: migrate, purge, backup, restore-check, recompute, create-project, create-key. |

**Why a monolith:** one codebase, one deploy, and one set of logs is what a solo founder can run. The traffic in this plan's horizon (§14) is far inside what one Node process and one PostgreSQL instance handle. Module boundaries (especially the pure attribution engine and the separate tracker build) keep a later split possible without rewriting.

**Why Next.js over the alternatives** (full matrix in §32):
- **Next.js 16 (recommended):** one TypeScript codebase for UI and APIs. Claude Code knows it very well, and the `output: "standalone"` build suits Docker. Risks: framework churn and a large surface area. Mitigation: use only App Router + route handlers + server components, avoid edge runtime and experimental features, and never depend on Vercel hosting.
- **Hono/Fastify API + Vite React SPA:** leaner and more explicit, but two builds, hand-built SSR/auth glue and more total code for Claude to write.
- **Laravel / Rails / Django:** excellent for solo SaaS, but a second language next to the TypeScript tracker, and they don't fit Barış's stated candidates.

---

## 3. Attribution model

### 3.1 Options evaluated

| Model | Founder-understandable | Deterministic | Useful for the revenue question | Misinterpretation risk |
|---|---|---|---|---|
| First touch | High | Yes | Good for "how did they discover us" | Long consideration cycles credit something the founder no longer runs. Returning visitors via a campaign get no credit. |
| Last touch (incl. direct) | High | Yes | Poor. Most SaaS conversions happen on a typed-in or bookmarked return, so "Direct" wins everything. | **High.** Hides every campaign. |
| **Last non-direct touch** | High | Yes | Good. Credits the last *real* acquisition source before purchase. | Low, if the rules are shown in the UI. |
| Session-level attribution | Medium | Yes | Answers "which session converted", not "where does revenue come from" | Medium. Easily confused with customer acquisition. |
| Multi-touch (linear / position / data-driven) | Low | Linear yes, data-driven no | Nice-to-have | High for this audience. Deferred. |

### 3.2 Recommendation

**Customer-level acquisition attribution using last non-direct touch, 90-day lookback.** First-touch is computed and stored too, but shown only on the customer detail view in MVP. A dashboard toggle is post-validation (USER DECISION U2).

**Definitions**

- **Touch:** one session (§4.3) with its entry source: referrer host, UTM parameters, landing path.
- **Direct touch:** a session with no UTM parameters and no external referrer, *or* whose referrer is on the project's own domains / self-referral exclusion list.
- **Self-referral exclusion list:** the project's allowed domains plus a built-in list of payment and auth hosts (`checkout.paddle.com`, `*.lemonsqueezy.com`, `polar.sh`, `checkout.stripe.com`, `*.iyzipay.com`, `*.paytr.com`, `accounts.google.com` …). The founder can extend it. Without this list, a buyer returning from a checkout page would be credited to the payment provider.
- **Acquisition moment:** the earlier of (a) the first time a visitor is linked to the customer, and (b) the customer's first `payment` revenue event.
- **Lookback window:** 90 days before the acquisition moment. Touches older than that are ignored.

**Explicit semantics**

| Scenario | Behaviour |
|---|---|
| First visit | A session is created. It stores the raw referrer host, normalized source, UTM source/medium/campaign/content/term and landing path. With no UTM and no external referrer, the source is `Direct`. |
| Returning visit | A new session starts after 30 minutes of inactivity, or immediately when the page is entered with a different campaign (new UTM set or new external referrer). Each session keeps its own source. Earlier sessions are never modified. |
| Direct return | Creates a direct session. **Direct never overwrites a prior non-direct source.** Last non-direct touch skips direct sessions. |
| Conversion (customer becomes known) | A link is created. Credit goes to the **latest non-direct touch** among all sessions of all visitors linked to the customer that started at or before the acquisition moment and within the lookback. If every touch is direct, credit goes to `Direct`. |
| First payment | Its revenue is credited to the customer's acquisition source. |
| Renewal / later payment | **Inherits the customer's acquisition source.** Later visits do not move existing customers' revenue. This keeps the question stable: "Which source acquired the customers who produce this revenue?" |
| Refund | A `refund` revenue event for the same customer, credited to the same source. It shows as refunds and reduces **net** revenue for that source in the period in which the refund *occurred*. The original payment is never mutated. |
| Customer re-identification (later identify from a new visitor) | A new link is recorded. If the new visitor has sessions from **before** the acquisition moment, attribution is recomputed (they are legitimate earlier touches, e.g. a second browser). Sessions *after* the acquisition moment never change attribution. |
| Customer with no linked visitor | **`Unattributed`**, a separate bucket. It usually means a missing identify call, an ad blocker, a different device, or revenue from before installation. The onboarding status (§19) highlights it. |
| Multiple devices | Linked only if the customer is identified on each device (e.g. logs in on both). Otherwise the second device's pre-purchase touches are invisible. **This is a known limitation.** |

**Source normalization (versioned, `rules_version`)**
1. If `utm_source` is present, source = its lowercased, trimmed value, mapped through a small alias table (`fb`, `facebook.com` → `facebook`). Medium and campaign are kept as given (trimmed, lowercased, length-capped).
2. Else, if the referrer host is external, source = a known-host mapping (`www.google.*` → `google`, `t.co` → `twitter`, `news.ycombinator.com` → `hacker news` …), else the registrable host (`example.org`).
3. Else, the source is `direct`.
4. Common click IDs (`gclid`, `fbclid`, `msclkid`) with no UTM set a *hint* (source `google`/`facebook`/`bing`, medium `paid (inferred)`). The click ID value itself is **not stored**.

**Why this is hard to misinterpret:** the dashboard labels the column "Acquired via (last non-direct touch, 90 days)". There is a one-line "How is this calculated?" explainer. Each customer row can be expanded to the exact touches that were considered. Unknowns are never folded into Direct.

**Known limitations, stated in the product:** attribution covers only visitors whose browser ran the tracker and who were identified. Ad blockers, Safari/Firefox storage caps, consent refusals, cross-device journeys and offline sales all reduce coverage. The dashboard shows the **attribution coverage %** (the share of revenue from customers with at least one linked visitor).

---

## 4. Identity model

### 4.1 Entities & how they connect

```
visitor_id (browser, random) ──< sessions (touches)
      │
      └──< customer_visitors >── customer (project-scoped, keyed by founder's external customer_id) ──< revenue_events
```

| Identifier | Created by | Stored where | Trust |
|---|---|---|---|
| `visitor_id` | Tracker (`crypto.randomUUID()`) on first page view with storage permitted | First-party cookie `om_vid` on the founder's configured domain (fallback: `localStorage`) | Untrusted (browser) |
| `session_id` | Tracker, per §4.3 | `sessionStorage`-independent: first-party cookie/localStorage entry `om_ses` = `{id, lastActivity, campaignKey}` | Untrusted |
| `customer_id` (external) | Founder's system (their user or customer ID) | Our `customers.external_id` | Trusted when it arrives via the Revenue API. Untrusted via browser `identify` (see 4.4). |

### 4.2 Why a first-party cookie (with localStorage fallback)
- Founders commonly run a marketing site on `example.com` and the app/signup on `app.example.com`. `localStorage` is per-origin and would split one person into two visitors. A cookie set by JavaScript with `Domain=example.com` spans the subdomains. The tracker takes an optional `data-domain` for this.
- The tracker is loaded from OriginMetric's host but runs in the founder's page, so the cookie and storage are **first-party to the founder's site**. OriginMetric sets **no third-party cookies**, and the identifier is never shared across different founders' projects.
- Cookie attributes: `SameSite=Lax; Secure; Path=/; Max-Age` ≤ 13 months, not extended on each visit (USER DECISION U6). Value: random UUID only.
- **This is not a privacy exemption** (§8). Browser storage of any kind is "storing information on terminal equipment".

### 4.3 Session resolution (in the tracker)
- A new session starts when (a) there is no stored session, (b) more than **30 minutes** have passed since the last activity, measured with the browser clock only as a *delta*, or (c) the page URL carries a UTM set or external referrer whose `campaignKey` differs from the current session's.
- Midnight does **not** split sessions.
- The server trusts the session ID only within a project and visitor. An event whose `session_id` already belongs to a different `visitor_id` is dropped.

### 4.4 Linking visitor → customer
Two supported paths. The founder needs at least one.

1. **Browser `identify` (easiest, the default in onboarding):** on the page after signup or login, `originmetric("identify", "cust_123")`. The tracker sends an `identify` event and creates a `customer_visitors` link.
   - *Risk:* anyone can send identify for any `customer_id` string. *Impact is limited:* it can at most attach an attacker's own sessions to a customer. Mitigations: recommend non-guessable customer IDs (UUIDs, not emails or sequential integers; emails are also rejected by a format heuristic to keep PII out); **acquisition attribution is frozen against links created after the acquisition moment** (§3.2); every link records its method.
   - *Post-validation option:* signed identify (the founder's backend issues `HMAC(secret, customer_id)` for the page). Deferred because it doubles integration effort.
2. **Server-side `visitor_id` on the revenue event (most robust):** the founder reads `originmetric.getVisitorId()` at signup, stores it with their user, and sends it as `visitor_id` in `POST /revenue-events`. Or they pass it through checkout metadata (Paddle `custom_data`, Lemon Squeezy `custom`, Polar `metadata`) into their webhook handler. The link method is `revenue_api`. It is trusted because it came through the secret key.

### 4.5 Edge cases

| Case | Handling |
|---|---|
| Browser storage cleared | New visitor ID. The old visitor's history stays linked only if they were already identified. The next login re-links through identify. |
| Safari ITP / Firefox ETP | Storage written by script may be capped at 7 days (and shorter under some link-decoration conditions). Long consideration cycles on Safari lose early touches. Documented. Mitigated by identify-on-login. |
| Duplicate identities (one visitor → several customers, e.g. shared computer) | Allowed (many-to-many). Each customer's attribution uses the shared visitor's pre-acquisition sessions. This is flagged in the customer view. |
| One customer, many visitors | Allowed. Sessions are unioned (§3.2). |
| Customer logs in on a second device | identify → link → only pre-acquisition sessions on that device can affect attribution. |
| Founder's `customer_id` changes (e.g. merge) | Not supported in MVP. Documented: use a stable ID. |
| Fingerprinting / IP linking | **Never.** IPs are used transiently for rate limiting only and are not stored (§6, §22). |

---

## 5. Tracker design

**Guarantee: tracker failure must never break the founder's website.**

| Aspect | Decision |
|---|---|
| Language/build | TypeScript → esbuild → single IIFE, ES2017 target, zero runtime dependencies. Separate package folder, independently testable. |
| Size budget | **≤ 2.5 KB gzip** hard CI limit (target < 2 KB). |
| Loading | `<script defer src="https://<app-domain>/js/v1/om.js" data-site="pk_…" [data-domain="example.com"] [data-consent="required"]></script>` plus an optional 1-line queue stub, so `originmetric(...)` calls before load are buffered. |
| Execution | Everything wrapped in `try/catch`. No `document.write`, no sync XHR, no `eval`, no global other than `window.originmetric`. Unknown commands are ignored. Errors are swallowed (a debug flag logs them to the console). |
| Events | `pageview` (automatic, including SPA navigation via `history.pushState` / `popstate` hooks, deduped per URL within 1 s) and `identify`. No custom events in MVP. |
| Transport | `navigator.sendBeacon(url, new Blob([json], {type:"text/plain"}))`. Fallback: `fetch(url, {method:"POST", body, keepalive:true, credentials:"omit"})` with a `text/plain` body. `text/plain` avoids a CORS preflight. |
| Unload behaviour | No unload handlers are needed: page views are sent on load or navigation. identify is sent immediately. |
| Batching | Not needed (≈1 request per page view). |
| Retries / offline | Page views: none (a loss is acceptable). `identify`: stored in a small localStorage queue and re-sent on the next page load (max 3 attempts, 24 h expiry), because identify is high-value. |
| Duplicate events | Every event carries a tracker-generated `event_id` (UUID). The server keeps a unique `(project_id, event_id)` and ignores duplicates. |
| UTM capture | Read from `location.search` on session start only: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, each capped at 200 chars. Other query parameters are **not sent**; the path is sent without the query string. |
| Referrer | `document.referrer` host only (no path or query), sent to the server, which normalizes it. |
| Metadata | Screen-width class (`mobile`/`tablet`/`desktop`) only. The server derives nothing else from the User-Agent except a bot flag. No language, timezone or plugin data. |
| Consent mode | `data-consent="required"`: stores nothing and sends nothing until `originmetric("consent", true)`. Campaign info from the landing URL is held in memory so it survives until consent on that page. `consent(false)` clears `om_*` storage. Default mode: `auto` (founder's responsibility, §8). |
| Do Not Track / GPC | Honour `navigator.globalPrivacyControl === true` by default (no storage, no sending). Configurable. **USER DECISION U7.** |
| CSP | Founder adds `script-src https://<app-domain>` and `connect-src https://<app-domain>`. No inline script is required (the stub is optional; with strict CSP they skip it). Documented. |
| Versioning & cache | `/js/v1/om.js`: moving pointer within major v1, `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`. `/js/om-1.2.3.js`: immutable, 1-year cache, with an SRI hash published for founders who pin. |
| CDN | Cloudflare caches `/js/*` (free). No separate CDN. |
| Endpoint origin | MVP: OriginMetric's domain (third-party *host*, first-party *storage*). Post-validation: a documented optional **first-party proxy** (a founder's rewrite of `/om/*` to us) to reduce ad-block loss. |
| Ad blockers | Neutral names (`/js/v1/om.js`, `/api/v1/e`; no "analytics", "track" or "pixel"). The honest expectation is still that some users block it. Revenue is never lost because it is server-side; only its attribution becomes `Unattributed`. |
| Tests | Unit (vitest + jsdom): storage fallback, session rules, UTM parse, referrer, consent, queue. Browser (Playwright): real Chromium on a fixture page, CSP-strict page, storage-disabled page, blocked-endpoint page (the site must keep working). Size check in CI. |

---

## 6. Public ingestion security (browser trust boundary)

**What cannot be trusted from browser JavaScript:** anything at all. The site key is public, the Origin header can be forged by non-browser clients, and every field is attacker-controllable. The design limits the **damage** instead of pretending to authenticate browsers.

| Control | Detail |
|---|---|
| Site key exposure | `pk_<random>` identifies a project. It is not a secret and grants only "submit browser events to this project". It can be rotated. |
| Origin validation | `Origin` (or `Referer` fallback) host must match the project's allowed domains (exact or `*.example.com`). Mismatch → 202 accepted and silently dropped (no oracle), counted in a per-project "rejected origin" metric that onboarding surfaces. Honest limitation: it stops casual cross-site misuse, not scripted forgery. |
| CORS | `Access-Control-Allow-Origin: <echoed allowed origin>`, no credentials, `POST` only. Using `text/plain` means no preflight. |
| Validation | Strict schema (zod). Body ≤ 8 KB. Enumerated event types. UUID formats. Length caps. Unknown fields rejected. URL path normalized. |
| Rate limits | In-process token buckets (single instance, so memory is fine): per IP-hash + site key (e.g. 60 events/min) and per project (e.g. 200 events/s burst). Plus **one Cloudflare rate-limiting rule** on `/api/v1/e` as an outer guard. Numbers are tuned during P6. |
| Bots | Drop known bot UAs (maintained list), `navigator.webdriver` flag from the tracker, and missing/implausible UAs. Record the drop count per project. |
| Quotas | Per-project monthly event counter (soft limit, alert, then drop above a hard cap). Protects the VPS and later maps to plans. |
| Forged events: worst case | An attacker can inflate visitor/session counts or add fake touches to *their own* visitor IDs. They **cannot** create revenue, create customers with revenue, or read anything. Forged identify is covered in §4.4. |
| Server trust boundary | Server-received time is authoritative. Client fields are never used for authz, never rendered unescaped, and never used as SQL identifiers. |
| Not stored | Raw IP and full User-Agent. The IP is hashed with a **daily-rotating secret salt** in memory for rate limiting only; the salt is never persisted. |

---

## 7. Revenue API & its security (server trust boundary)

### 7.1 Endpoint & contract

`POST /api/v1/revenue-events`
`Authorization: Bearer om_sk_<8-char-prefix>_<32-byte-base62-secret>`
`Content-Type: application/json`

```json
{
  "event_id": "inv_2026_000123",
  "type": "payment",
  "customer_id": "c2f1a7e0-…",
  "visitor_id": "optional-visitor-uuid",
  "amount": 2900,
  "currency": "USD",
  "occurred_at": "2026-10-01T12:34:56Z",
  "refund_of": null,
  "billing_interval": "month",
  "subscription_id": "sub_789",
  "test": false
}
```

| Field | Rule |
|---|---|
| `event_id` | **Required.** Founder-side unique ID (invoice ID, payment ID, order ID). 1–128 chars, `[A-Za-z0-9_.:-]`. Unique per project. It is both the dedup key and the idempotency key. |
| `type` | `payment` or `refund`. (Later, if MRR is approved: `subscription_started`, `subscription_changed`, `subscription_cancelled`.) |
| `customer_id` | Required. The founder's stable, non-PII customer ID. Email-looking values are rejected. |
| `visitor_id` | Optional. When present and well-formed, it creates a trusted visitor link. |
| `amount` | Required. **Positive integer in minor units** for the currency (§10), max 10^12. Refunds are also positive; the type gives the sign. |
| `currency` | Required. ISO 4217 alpha-3 from an allow-list. Uppercased. |
| `occurred_at` | Required. RFC 3339 with offset. Rejected if more than 5 minutes in the future or before 2000-01-01. Backfills of past events are allowed. |
| `refund_of` | Optional on refunds: the `event_id` of the original payment. If present, it must exist, match customer and currency, and total refunds must be ≤ the original amount. If absent, the refund is still accepted (some providers don't expose the link). |
| `billing_interval` | Optional: `one_time`, `month`, `year`. Stored for future MRR. |
| `subscription_id` | Optional. Stored for future MRR. |
| `test` | Optional boolean. Test events are stored, excluded from reports, and purgeable with one click. |

**Amount semantics:** "amount received from the customer, excluding tax where the provider reports it separately". The dashboard labels it *Revenue (as reported)*. Fees and taxes are not modelled in MVP.

**Cancellations, upgrades, downgrades:** not revenue events and not supported in MVP (see §10.4).

### 7.2 Responses (error contract)

| Case | Status | Body |
|---|---|---|
| Created | `201` | `{ "id": "…", "event_id": "…", "status": "created", "attribution": {"source": "google", "status": "attributed"} }` |
| Same `event_id`, identical canonical payload | `200` | The same body with `"status": "duplicate"`. **Idempotent replay.** |
| Same `event_id`, different payload | `409` | `{ "error": { "code": "idempotency_conflict", "message": "…" } }` |
| Validation error | `422` | `{ "error": { "code": "invalid_request", "message": "…", "field": "amount" } }` |
| Missing/invalid/revoked key | `401` | `{ "error": { "code": "unauthorized" } }` (identical for all causes) |
| Rate limited | `429` | With `Retry-After` |
| Server error | `500` | Retry-safe, thanks to idempotency |

A 2xx is returned only after the transaction commits (revenue row + customer upsert + link + attribution recompute).

**Batch endpoint:** deferred. **Versioning:** `/api/v1/…` in the path. Additive changes don't bump the version; breaking changes mean `/v2` with ≥ 6 months of overlap.

### 7.3 Key security

| Control | Decision |
|---|---|
| Format | `om_sk_` + public 8-char prefix + 32 bytes of CSPRNG secret. The prefix makes keys greppable by GitHub secret scanning and lets the UI show "om_sk_ab12cd34…" without the secret. |
| Storage | Only `SHA-256(secret)` is stored. A slow hash is unnecessary because the secret has 256 bits of entropy. Lookup by prefix, then constant-time hash compare. |
| Display | Shown **once** at creation. Never logged (§22). |
| Rotation | Several active keys per project are allowed: create new → deploy → revoke old. |
| Revocation | `revoked_at`. Takes effect immediately (no cache). |
| Scope | One scope (`revenue:write`) in MVP. Read or management scopes come only if a public read API is ever built. |
| Tracking | `last_used_at` (updated at most once a minute), shown in the UI to help founders find stale keys. |
| Brute force | Invalid-key attempts are rate-limited per IP-hash. The key space makes guessing infeasible anyway. |
| HMAC request signatures / timestamps | **Not in MVP.** TLS gives transport integrity, the secret gives authentication, and `event_id` idempotency neutralizes replays (a replay is at most a 200 duplicate). Signatures would add integration friction without a matching threat reduction. They are reconsidered if keys are ever used from less trusted environments. |

---

## 8. Privacy (GDPR / ePrivacy / KVKK)

> **Not legal advice.** This section separates technical design decisions from questions that need a qualified professional before charging users.

### 8.1 Facts the design is based on
- **ePrivacy Art. 5(3)** covers *storing or accessing information* on a user's terminal equipment, whatever the technology. The EDPB's Guidelines 2/2023 (adopted final version, October 2024) confirm this includes localStorage and similar mechanisms, and that "information" is broader than personal data. **Switching cookies to localStorage does not remove the consent question.**
- The consent exemption for audience measurement (e.g. **CNIL** "Sheet 16") has cumulative conditions. One of them is **no cross-referencing with other processing such as customer files**. OriginMetric's purpose is to link visitors to customers and revenue, so **it is unlikely to qualify for that exemption** in France, and similar reasoning probably applies elsewhere in the EU. The UK ICO has historically required consent for analytics.
- **KVKK (Turkey):** the KVKK Authority's June 2022 *Çerez Uygulamaları Hakkında Rehber* treats cookies that are not strictly necessary (including analytics/performance in most cases) as needing **explicit consent (açık rıza)**, with narrow exemptions.
- The visitor ID, session data and customer link are **personal data** under GDPR and KVKK once linkable to a customer, even though they are pseudonymous.

### 8.2 Roles
- For founders' website visitors and customers: the founder is the **controller** (veri sorumlusu), OriginMetric the **processor** (veri işleyen). This needs a DPA and a sub-processor list.
- For OriginMetric's own users (founders): OriginMetric is the controller. This needs a privacy policy and a lawful basis for account data.

### 8.3 Technical privacy-by-design decisions (engineering can decide)
1. Store only a random visitor ID, session state and the identify queue on the device. No fingerprinting and no cross-site identifiers.
2. Minimal collection: path without query, referrer host only, UTM fields, screen class. No raw IP, no full UA, no geolocation in MVP.
3. Reject PII-looking `customer_id` values (emails). Document "use opaque IDs".
4. A **consent mode** (`data-consent="required"`) plus a `consent()` API that works with any CMP. GPC honoured by default (U7).
5. Per-project data isolation. The same visitor on two founders' sites gets two unrelated IDs.
6. Retention limits with automated purge (§21).
7. Visitor and customer deletion by ID (API + UI) and CSV export before the first paying user.
8. EU/Turkey hosting location documented. The VPS location decides the data-transfer analysis (A5).
9. No marketing claim like "no cookie banner needed" or "GDPR compliant out of the box". Allowed wording: *"privacy-first design; no fingerprinting; consent mode built in"*.

### 8.4 Legal/compliance questions requiring professional review (before FIRST PAYING USER, cut line D)
1. Is consent required for OriginMetric's identifier in the EU/UK/Turkey, given that visitors are linked to customer records? (Working assumption: yes, it can be required. Founders are told so.)
2. Can revenue events be kept after a customer deletion request if the customer ID is erased (pseudonymized aggregate)?
3. DPA template, sub-processor list, Standard Contractual Clauses (EU) and **KVKK cross-border transfer** rules (Art. 9 as amended in 2024) given the VPS location and the Cloudflare edge.
4. OriginMetric's own obligations as a Turkey-based controller and processor, including VERBIS registration applicability.
5. Terms of Service, privacy policy, and whether processing Turkish visitors' data needs Turkish-language notices.
6. Whether honouring GPC is required in any jurisdiction relevant to early customers (e.g. California).

---

## 9. Multi-tenancy

**Tenant hierarchy:** `workspace` (billing and ownership unit) → `project` (one website/product; **tenant key for all analytics data = `project_id`**). Users reach projects only through `workspace_members`.

### 9.1 Options

| Option | Security | Complexity for a solo dev | Failure modes |
|---|---|---|---|
| App-level scoping only | Depends on every query being correct | Low | One forgotten `WHERE project_id` leaks data |
| PostgreSQL RLS | Enforced by the DB | Medium–high: tenant context via `SET LOCAL app.project_id` inside every transaction; pool connections must never carry stale context; ingestion, attribution and ops jobs run cross-tenant and need a bypass role; policies must be tested and migrated with every table; Drizzle has no first-class tenant-context helper | Bypass role misuse; missing `SET LOCAL` gives empty results (safe) or, with a misconfigured role, full access (unsafe); harder debugging |
| **App-level scoping + structural DB constraints + automated leak tests (recommended)** | High for realistic bugs | Low–medium | Mitigated by one data layer + tests |

### 9.2 Recommended defence in depth (no RLS in MVP)
1. **Single tenant-scoped data layer:** every read/write of tenant data goes through `forProject(ctx)`, which needs an `AuthorizedProjectContext`. The only way to get one is `authorizeProject(user, projectId)` (dashboard) or key/site-key resolution (APIs). No function accepts a bare `projectId` from request input.
2. **Lint/CI guard:** a check (ESLint rule or grep script) fails the build if the raw `db` client is imported outside `src/server/data/**` and `src/server/ops/**`.
3. **Composite tenant foreign keys:** every child table has `project_id`, and FKs are `(project_id, customer_id) → customers(project_id, id)`, etc. A row can never reference another tenant's row, even through an application bug.
4. **Primary lookups always include `project_id`**, and indexes lead with `project_id`.
5. **Automated cross-tenant attack tests (mandatory, CI-blocking):** seed tenants A and B. As a user of A, try every dashboard route, server action and export with B's project/customer/key IDs, and expect 404 (not 403, to avoid existence oracles). The revenue API with A's key must not be able to reference B's customers. The tracker with A's site key and B's allowed origin must be dropped.
6. **Non-guessable IDs** (UUIDv7 internally; public site key and API key prefixes are random).

**Re-evaluate RLS** when a second developer joins, a public read API ships, or any tenant-scoping bug escapes to production. Adding RLS later is additive: `project_id` is on every row already.

---

## 10. Money, currency & MRR

### 10.1 Representation
- `amount_minor BIGINT NOT NULL CHECK (amount_minor > 0)` + `currency CHAR(3) NOT NULL`. No floats anywhere. The API rejects non-integers.
- Minor-unit exponent from an in-repo ISO 4217 table: 2 (USD, EUR, TRY …), **0 (JPY, KRW, CLP, VND …)**, 3 (KWD, BHD, JOD, OMR, TND …). Display formatting uses `Intl.NumberFormat` with the table's exponent.
- Refunds: separate rows, `type='refund'`, positive `amount_minor`. Net = Σ payments − Σ refunds, computed per currency.
- **Gross** (payments), **Refunds**, **Net** are all shown.

### 10.2 Multi-currency behaviour
- Aggregations **always group by currency**. The dashboard shows the project's **primary currency** (set at project creation) first. Other currencies appear as separate rows or tabs with a visible notice: "Revenue in 2 other currencies is not included in this total."
- **No FX conversion in MVP.** It needs a rate source, a rate-date policy (transaction date vs report date) and a caveat UI. Deferred to post-validation, and adding it would be a USER DECISION because a rate API may be paid.

### 10.3 MRR decision
**MRR is removed from the MVP dashboard.** Correct MRR needs to know which subscriptions are active, their normalized monthly value, and when they are cancelled, upgraded or downgraded. Payment events alone can't tell a late renewal from a churned customer, so an MRR figure would be misleading.

What MVP does instead: collects optional `billing_interval` + `subscription_id` on payments at no cost, and shows **"Revenue by acquisition source"** and **"Customers by acquisition source"**.

### 10.4 Designed MRR data contract (post-validation, only if demanded)
Add event types `subscription_started {subscription_id, customer_id, plan_amount_minor, currency, interval}`, `subscription_changed {…new amount/interval, effective_at}` and `subscription_cancelled {subscription_id, effective_at}`. MRR(t) per currency = Σ active subscriptions' normalized monthly amount (annual ÷ 12, using integer arithmetic with an explicit rounding rule). Native payment-provider integrations would feed these events.

---

## 11. Time semantics

| Topic | Rule |
|---|---|
| Storage | Every timestamp is `timestamptz`, and the DB session runs in UTC. |
| Browser events | **Server received time is authoritative** (`received_at`). Client time is never stored as fact; it is used only for relative session timing inside the tracker. |
| Revenue events | `occurred_at` from the founder (their system is the source of truth for when money moved), validated (§7.1), plus `received_at`. Revenue reports use `occurred_at`. |
| Acquisition moment | min(first link `linked_at` (server time), first payment `occurred_at`). |
| Reporting timezone | Per project, an IANA name (default taken from the creator's browser, editable). Date grouping uses `date_trunc('day', ts AT TIME ZONE project_tz)`, so DST is handled by PostgreSQL's tz database (days can be 23 or 25 hours; this is correct). |
| Date ranges | Inclusive start and exclusive end, in the project timezone, converted to UTC bounds for queries. |
| Sessions | 30-minute inactivity boundary (§4.3), not split at midnight. A session belongs to the day of its start. |
| Tests | Injectable `Clock` interface in server code. Fake timers in tracker tests. DST fixtures (e.g. `Europe/Istanbul` has no DST since 2016, so `Europe/Berlin` and `America/New_York` transitions are tested). |

---

## 12. Data model (minimum)

All IDs are `uuid` with PostgreSQL 18 `uuidv7()` defaults unless noted. `project_id` leads every tenant table's keys and indexes.

| Table | Responsibility | Tenant key | Key constraints / indexes | Mutability | Deletion |
|---|---|---|---|---|---|
| Better Auth tables (`user`, `session`, `account`, `verification`) | Identity for founders | n/a | Library-defined, unique email | Mutable | Account deletion cascades |
| `workspaces` | Ownership and billing unit | self | — | name mutable; plan fields added at P9 | Deleted with owner account (grace §21) |
| `workspace_members` | User ↔ workspace (role: `owner` only in MVP) | workspace_id | PK (workspace_id, user_id) | Mutable | Cascade |
| `projects` | One tracked site/product | workspace_id | UNIQUE `site_key`; `allowed_domains text[]`; `timezone`; `primary_currency`; `excluded_referrers text[]`; `deleted_at` | Settings mutable | Soft-delete → purge after 7 days (U5) |
| `api_keys` | Revenue API credentials | project_id | UNIQUE `prefix`; `hash`; `revoked_at`; `last_used_at` | Only `revoked_at`/`last_used_at`/`name` mutable | Cascade with project |
| `events` (raw browser events) | Page views + identify as received | project_id | UNIQUE (project_id, event_id); INDEX (project_id, received_at) | **Immutable** | Retention purge (U4); cascade |
| `sessions` (touches) | One row per session: entry source + counters | project_id | PK (project_id, id); INDEX (project_id, visitor_id, started_at); INDEX (project_id, started_at) | Entry-source fields immutable; `last_seen_at`, `pageviews` mutable | Retention purge; visitor deletion |
| `customers` | Founder's customer, keyed by external ID | project_id | PK (project_id, id); UNIQUE (project_id, external_id) | `external_id` nulled on deletion (tombstone) | Deletion API → tombstone |
| `customer_visitors` | Identity links | project_id | PK (project_id, customer_id, visitor_id); FK (project_id, customer_id); INDEX (project_id, visitor_id) | Immutable (`linked_at`, `method`) | Deleted with customer/visitor |
| `revenue_events` | Source-of-truth money facts | project_id | PK (project_id, id); UNIQUE (project_id, event_id); FK (project_id, customer_id); `refund_of_id` FK (project_id, id); CHECK amount > 0; INDEX (project_id, occurred_at); INDEX (project_id, customer_id) | **Immutable** (`payload_hash` stored for idempotency) | Kept on customer deletion (customer tombstoned, U8/legal); cascade with project |
| `customer_attribution` | **Derived**: credited touch per customer | project_id | PK (project_id, customer_id); INDEX (project_id, credited_source) | Recomputable, overwritten | Recomputed/deleted with customer |
| `job_runs` | Scheduled-job audit | none (ops) | INDEX (job, started_at) | Append | 90-day purge |
| `usage_daily` (added at P6) | Per-project event counts, for quotas | project_id | PK (project_id, day) | Counter | With project |

**Deliberately not created:** a `visitors` table (a visitor is just an ID on sessions and links; first-seen is derivable), a generic `identities` table (`customer_visitors` is enough), `organizations` distinct from workspaces, a `subscriptions` table (§10.4), custom events/goals, teams/invites, audit logs beyond `job_runs`.

`customer_attribution` columns: `rules_version`, `status` (`attributed` / `direct` / `unattributed`), `acquired_at`, `credited_session_id`, `credited_source`, `credited_medium`, `credited_campaign`, `first_touch_session_id`, `first_touch_source`, `computed_at`. Source strings are **copied**, so reports keep working after sessions age out of retention.

---

## 13. Raw vs derived data, deduplication & idempotency

### 13.1 Classification

| RAW / SOURCE (append-only, never rewritten) | DERIVED / RECOMPUTABLE |
|---|---|
| `events` (browser) | `sessions`: materialized from events at ingestion (entry-source fields come straight from the first event, so this is effectively raw-at-entry + derived counters) |
| `customer_visitors` (link facts) | `customer_attribution` |
| `revenue_events` | Dashboard aggregates (computed at query time in MVP) |
| Project settings (with `updated_at`) | `usage_daily` |

### 13.2 Where attribution is computed
**Materialized per customer, recomputed synchronously** in the same transaction whenever an input for that customer changes: a new link, the first payment, or a new pre-acquisition session for an already-linked visitor. That is a bounded query (one customer's visitors' sessions in a 90-day window). A CLI `recompute --project <id> [--all]` rebuilds it when rules change (`rules_version` bump) or after bug fixes.

Why: fast dashboards (joins over materialized rows); auditability (the `credited_session_id` pointer lets the UI show *why*); refunds need no recompute (they inherit the customer row); rule changes are safe (recompute from raw). No queue is needed.

### 13.3 Browser event deduplication (duplicate *detection*)
- `event_id` (tracker UUID) is unique per project: `INSERT … ON CONFLICT (project_id, event_id) DO NOTHING`.
- Session upsert is idempotent (`ON CONFLICT (project_id, id) DO UPDATE SET last_seen_at = greatest(…), pageviews = pageviews + <1 if new event>`).
- A duplicate means "already have it". Silently fine, no client-visible difference.

### 13.4 Revenue idempotency (safe *retry* with conflict detection)
- `event_id` is unique per project. The server computes `payload_hash = SHA-256(canonical JSON of the semantic fields)`.
- Insert → on unique violation, load the existing row → same hash returns **200 duplicate** with the original result; a different hash returns **409 idempotency_conflict**.
- **Difference:** dedup silently discards repeats. Idempotency guarantees that a retried request has the *same effect and the same answer* as the first, and loudly rejects a *different* request reusing the key. That protects founders from double-counting on network retries and from silent overwrites when they reuse IDs by mistake.
- Concurrency: two identical requests at once hit the unique constraint, so one wins and the other takes the duplicate path. This is tested.

---

## 14. Database (PostgreSQL) plan

**Suitability:** assume an early ceiling of about 50 projects, each averaging 50k page views a month. That is about 2.5M `events` rows a month. With 90-day raw retention, the table holds about 7.5M rows, well inside what a single PostgreSQL instance on a small VPS handles with the indexes in §12. Revenue and customer tables are orders of magnitude smaller.

| Topic | Plan |
|---|---|
| Version | PostgreSQL 18 (current major; native `uuidv7()`). Official `postgres:18` image, pinned minor version. |
| Indexes | Only those in §12. Additions need an `EXPLAIN ANALYZE` justification in the PR. |
| JSON | **Avoided** for core fields (everything queryable is a column). No JSONB in MVP. |
| Aggregations | Dashboard queries join `customer_attribution` + `revenue_events` (small) and count sessions by source (indexed by project and time). Target p95 < 500 ms for 90-day ranges. |
| Partitioning | **Not in MVP.** Revisit when `events` exceeds ~50M rows or retention `DELETE`s take > 1 minute. Then monthly range partitions on `received_at` and drop-partition retention. |
| Connection pooling | App-level pool (`postgres`/`pg` driver, max ≈ 10). **No PgBouncer.** One app instance. |
| Migrations | Drizzle Kit generates SQL files. They are **committed and reviewed** (SQL is the source of truth). They are applied by `ops migrate` before the app starts on deploy, forward-only. CI applies all migrations to an empty DB and runs tests. A destructive migration needs an expand/contract two-step. |
| Config | Modest `shared_buffers`, `work_mem` for the VPS size. `log_min_duration_statement = 500ms`. The DB port is **not published** outside the Docker network. |
| Backup | §24. |

**Signals that would justify evaluating ClickHouse (or TimescaleDB) later:** any **two** of: sustained ingestion > 300 events/s; `events` > 200M rows even after partitioning; dashboard p95 > 2 s on common ranges despite indexes and rollup tables; DB disk > 60% of VPS disk because of events alone. First step before a new engine: daily rollup tables in PostgreSQL.

---

## 15. Background processing

**Decision: no Redis, no job queue, no worker process.**

| Need | Mechanism |
|---|---|
| Attribution | Synchronous, in-transaction (§13.2) |
| Retention purge, soft-delete purge, `job_runs` cleanup | **Host cron** → `docker compose run --rm app node dist/ops.js purge` (nightly) |
| Backups | Host cron → `ops backup` (nightly) |
| Restore verification | Host cron → `ops restore-check` (weekly) |
| Disk / health self-check | Host cron → `ops selfcheck` (every 15 min) |

**Cron correctness rules**
- **Concurrency:** every job takes `pg_try_advisory_lock(<job-hash>)`. If it's not acquired, the job exits 0 and logs `skipped_locked`.
- **Idempotency:** jobs are written to be re-runnable. Purges delete by predicate in batches of about 10k rows, and backups use timestamped names.
- **Retries:** no automatic retry loop. The next scheduled run is the retry. Failures alert (below).
- **Failures & observability:** each run writes to `job_runs` (start, end, status, row counts, error class) and pings a **dead-man check** (Healthchecks.io free tier: `/start`, then success or `/fail`). A missed or failed ping emails Barış.
- **Timeouts:** `timeout` wrapper per job.

---

## 16. Authentication

Needs: sign-up, sign-in, secure credential handling, sessions, password recovery, workspace ownership, project access.

| Option | Dev effort | Security burden | Maintenance | Vendor dependency | Email needed | Recurring cost | Migration difficulty |
|---|---|---|---|---|---|---|---|
| **Better Auth (email + password)** | Low–medium | Library handles hashing (scrypt), sessions, CSRF/origin checks, rate limits | Upgrades. Now maintained by the team that also absorbed Auth.js; acquired by Vercel (Jul 2026) but still MIT and framework-agnostic | Low: data lives in our Postgres | For reset/verification | $0 | Low (our tables) |
| Auth.js / NextAuth v5 | Medium (credentials flow is awkward) | Medium | **Maintenance mode** (security patches only) | Low | Magic link needs email | $0 | Low–medium |
| Magic-link only | Low | Low (no passwords) | Low | Low | **Every login needs email.** Deliverability becomes login availability | Email cost scales with logins | Low |
| Clerk / Auth0 / WorkOS | Very low | Vendor handles it | Low | **High** | Vendor | Free tiers, then paid per MAU | High (user export, IDs) |
| Hand-rolled (Lucia-style guide) | Medium–high | **Ours entirely** | Ours | None | For reset | $0 | n/a |

**Recommendation: Better Auth, email + password, self-hosted**, with its organization concepts either ignored or used minimally (our own `workspaces` table is simple enough). Cookie sessions (`HttpOnly`, `Secure`, `SameSite=Lax`) and origin checks on mutations.
- **Social login:** not needed (possible post-validation, e.g. GitHub).
- **2FA:** post-validation (Better Auth plugin available).
- **Email dependency:** P3 (internal) works without email: Barış creates accounts, and reset is by CLI. **Private beta (C) needs password reset email**, and **public launch (E) needs email verification.** → transactional email (§31, U3).
- **USER APPROVAL REQUIRED (U1).**

---

## 17. Billing

**When billing becomes necessary:** only at **cut line D (first paying user)**. Before that: internal → private beta (free, invite-only) → optional "founding member" offer, where a founder's willingness to pay can be tested with a checkout link before any in-app billing exists.

**Recommendation (U9): a merchant of record.** Merchant of record means the provider is the legal seller and handles global VAT/sales tax, which matters a lot for a solo founder selling globally.
- **Paddle:** 5% + $0.50, mature, supports sellers in many countries, including (per its seller-country list) Turkey. Verify at signup (A8).
- **Polar:** developer-oriented merchant of record, lower-profile. Verify country support.
- **Lemon Squeezy:** acquired by Stripe, moving to Stripe Managed Payments, and new-merchant signups reportedly gated in 2026. **Not recommended** as a new dependency.
- **Stripe direct:** likely unavailable to a Turkey-based entity and doesn't handle tax remittance. Not recommended unless the business entity changes.
- **iyzico/PayTR:** Turkey-focused. They don't solve global VAT for global customers.

**Architecture (only this much):** hosted checkout link per plan → provider webhook (`POST /api/billing/webhook`, signature verified, idempotent by provider event ID) → `workspaces.plan`, `plan_status`, `current_period_end`. Enforcement: soft event quota per plan (the `usage_daily` counter already exists). **No usage metering sync to the provider**; flat tiers only.

**Dogfooding:** OriginMetric reports its own revenue to itself through the generic Revenue API from the billing webhook. This validates the integration path founders will use.

---

## 18. Dashboard

**Three levels, each deliberately small**

| Level | Phase | Content |
|---|---|---|
| Internal vertical-slice view | P1 | Token-protected `/internal/projects/:id`: sessions (last 50), customers with credited source + touches considered, a revenue-by-source table (per currency). No styling effort. |
| Beta dashboard | P5 | One page per project: date range (7d / 30d / 90d / custom, project TZ), currency selector (primary first), **the main table**, attribution coverage %, integration-status badge. Customers list → customer detail (touch timeline, which touch got credit and why). |
| Public product dashboard | P10 | Same page, polished: one chart (net revenue by source over time, stacked by top 5 sources + "Other"), CSV export, empty states, docs links. |

**The main table (P5)**

| Source | Visitors | New customers | Gross revenue | Refunds | Net revenue |
|---|---|---|---|---|---|
| google | 850 | 12 | $1,900.00 | $80.00 | $1,820.00 |
| producthunt | 430 | 9 | $1,240.00 | — | $1,240.00 |
| direct | 600 | 4 | $410.00 | — | $410.00 |
| **Unattributed** | — | 3 | $290.00 | — | $290.00 |

- *Visitors* = distinct visitor IDs whose sessions **started** in the range with that source (session-level). *New customers* = customers whose acquisition moment falls in the range, by credited source. *Revenue* = revenue events whose `occurred_at` falls in the range, by the customer's credited source. The column tooltips say exactly this, because the rows mix time-bases.
- A drill-down by medium/campaign (click a source) is included in P5 because campaign-level revenue is part of the core question.
- **Excluded:** MRR, conversion funnels, page reports, geography, device charts, cohorts, dozens of charts.
- **Charts:** none in P5. One in P10 (Recharts, or plain SVG if simpler).

---

## 19. Onboarding (target: 10–15 minutes)

A persistent **integration checklist** per project, with live status from real data. Every step shows ✅ / ⏳ waiting / ⚠️ problem + a hint.

| # | Step | Status signal |
|---|---|---|
| 1 | Create account | — |
| 2 | Create project (name, domain(s), timezone, primary currency) | — |
| 3 | Copy tracker snippet (framework tabs: plain HTML, Next.js, WordPress) | — |
| 4 | Install tracker | — |
| 5 | **Verify first event** | "Waiting for first page view from example.com…" polling (5 s). Shows origin-mismatch drops ("We received events from staging.example.com, which isn't in your domains. Add it?") and bot drops |
| 6 | Add identify call (snippet with the founder's language: JS; server examples for Node/Python/PHP for the `visitor_id` path) | First identify received ✅ |
| 7 | Create revenue API key (shown once) | Key exists |
| 8 | Send test revenue event (a copyable `curl` prefilled with a real visitor ID from their own test visit, `test: true`) | Test event received ✅ + its attribution result |
| 9 | Confirm attribution: "Your test customer was attributed to **utm_source=onboarding-test**" | ✅ |
| 10 | See result → the dashboard (test data hidden; "Delete test data" button) | — |

**Ongoing health:** the project header shows events in the last 24 h, the last revenue event, API errors in the last 24 h (422/409 counts with the latest error message, redacted), and attribution coverage %. Founders should never have to debug blindly.

**Payment-provider recipes (docs, no code integrations):** Paddle, Polar, Lemon Squeezy, Stripe, iyzico, PayTR. Each recipe covers "in your webhook handler, map `transaction.completed` → POST /revenue-events", with field mapping and how to pass the `visitor_id` through checkout custom data. Written in P8 from beta feedback.

---

## 20. Security threat model (lightweight, MVP)

| # | Threat | Likelihood | Impact | Mitigation | Phase |
|---|---|---|---|---|---|
| T1 | Tenant data leakage | Med | **High** | §9: scoped data layer, composite FKs, lint guard, CI attack tests, 404 on foreign IDs | P3 |
| T2 | Stolen revenue API key | Med | Med (fake revenue for one project, no reads) | Hashed storage, show-once, rotation/revocation, `last_used_at`, prefix enables GitHub secret scanning, docs "server-side only" | P1/P3 |
| T3 | Brute force on login | Med | High | Better Auth rate limits + Cloudflare rule on `/api/auth/*`, generic errors | P3/P6 |
| T4 | Tracker endpoint abuse / flood | Med | Med (VPS load, polluted counts) | §6 limits, quotas, Cloudflare rule, 8 KB bodies | P6 |
| T5 | Fake browser events | High | Low–Med | Can't create revenue; bot filter; origin check; per-project anomaly count | P1/P6 |
| T6 | Revenue forgery | Low (needs key) | Med | Server-only key; 409 on reused IDs | P1 |
| T7 | Replay | Med | Low | Idempotency: replay = duplicate 200 | P1 |
| T8 | XSS (stored, via UTM/referrer/customer IDs rendered in the dashboard) | Med | High (session theft) | React escaping, **no `dangerouslySetInnerHTML`**, strict CSP on the app, validation + length caps at ingest, tests with payloads | P1/P6 |
| T9 | CSRF | Low | Med | SameSite=Lax cookies, origin checks on mutations (Better Auth + Next server actions), no GET mutations | P3 |
| T10 | SQL injection | Low | High | Drizzle parameterization only; no string-built SQL (lint/grep rule for `sql.raw`) | P0+ |
| T11 | SSRF | Low | — | No server-side fetching of user URLs in MVP (no favicon or referrer fetching). Webhooks outbound: none | — |
| T12 | Malicious inputs (huge / unicode / control chars) | Med | Low | Body limits, schema, normalization, truncation | P1 |
| T13 | Log leakage | Med | Med | §22 redaction + tests | P6 |
| T14 | Backup leakage | Low | High | Encrypted with `age` before upload; private key offline; bucket private; scoped credentials | P7 |
| T15 | Admin access abuse / compromise | Low | High | No in-app superadmin in MVP (ops via SSH + CLI); SSH keys only; the internal page is disabled in production after P5 | P2/P7 |
| T16 | Secrets in Git | Med | High | `.env` git-ignored, `.env.example` only, gitleaks in CI, GitHub secret scanning | P0 |
| T17 | Public DB exposure | Low | **High** | DB port unpublished, firewall (ufw) allows 22/80/443 only; 80/443 restricted to Cloudflare IP ranges | P2 |
| T18 | Dependency compromise | Med | High | Lockfile, minimal deps, `npm audit` in CI, Renovate/Dependabot in batched weekly PRs | P0/P6 |
| T19 | Origin bypass of Cloudflare | Low | Med | Firewall allows only Cloudflare IPs on 80/443 | P2 |

---

## 21. Deletion, export & retention

### 21.1 Deletion & export (needed before cut line D unless marked)

| Operation | Behaviour | Cut line |
|---|---|---|
| Delete visitor (by `visitor_id`) | Deletes that visitor's events, sessions and links, then recomputes affected customers | C (API) / D (UI) |
| Delete customer (by `external_id`) | Deletes links and the attribution row; **tombstones** the customer (`external_id` → NULL, `deleted_at`); revenue rows remain as unlinked amounts (legal Q2) | C (API) / D (UI) |
| Delete project | Soft delete → invisible immediately → hard purge after **7 days** (U5) | D |
| Delete account | Deletes workspaces the user owns → their projects (same grace) → auth records | D |
| Export | Per-project CSV: customers (external ID, acquired at, credited source/medium/campaign, first-touch source) and revenue events. Raw events export is post-validation | D |
| Backups after deletion | Deleted data persists in encrypted backups until they rotate out (**≤ 90 days**). Stated in the privacy policy. No backup surgery | D |

### 21.2 Retention (defaults; numbers need approval, U4)

| Data | Proposed default | Why |
|---|---|---|
| Raw `events` | **90 days** | Debugging and recompute of recent sessions. Sessions carry the attribution facts |
| `sessions` | **25 months** | Visitor reporting year-over-year. Matches the upper bound in CNIL-style guidance |
| Visitor cookie | ≤ **13 months**, not auto-extended | Common regulatory reference point |
| `customers`, `customer_visitors`, `customer_attribution` | While the project exists (founder can delete) | Core product value |
| `revenue_events` | While the project exists | Financial record owned by the founder |
| App logs | **14 days** (Docker log rotation) | Debugging |
| `job_runs` | 90 days | Ops history |
| Backups | 7 daily + 4 weekly + 2 monthly ≈ **max 90 days** | Recovery vs deletion lag |
| Deleted projects/accounts | 7-day grace, then purge | Mistake recovery |

---

## 22. Logging

- **Structured JSON** (pino) to stdout → Docker json-file driver with rotation (`max-size=20m`, `max-file=5`).
- **Standard fields:** `ts`, `level`, `msg`, `req_id`, `route`, `method`, `status`, `duration_ms`, `project_id` (UUID, fine), `api_key_prefix` (never the key), `event_type`, `error_code`, `job`, `rows`.
- **Never logged:** `Authorization` headers, API secrets, cookies, session tokens, passwords, reset tokens, request/response bodies of `/api/v1/revenue-events`, `/api/auth/*` and `/api/v1/e`, raw IPs, full User-Agents, `customer_id`/`visitor_id` values (log counts or a short HMAC if needed).
- **Enforcement:** pino `redact` paths + a central request logger that never logs bodies + a **unit test** that runs representative requests and asserts no secret, customer ID or IP patterns appear in captured logs.
- **Error reporting:** errors are logged with a stack and error class. User-supplied values in messages are truncated or omitted.

---

## 23. Deployment

**Recommended: Docker Compose on the existing VPS**

| Component | Choice |
|---|---|
| Services | `caddy` (reverse proxy, automatic Let's Encrypt TLS, security headers), `app` (Next.js standalone, Node 22 LTS or later, non-root user), `db` (postgres:18, named volume). Internal network; only Caddy publishes 80/443 |
| Edge | Cloudflare proxied DNS, SSL mode **Full (strict)**, cache rule for `/js/*`, WAF custom rules (≤ 5 on Free), 1 rate-limit rule (`/api/v1/e`), Bot Fight Mode evaluated (it can break legitimate beacons, so test first) |
| Config | `.env` on the server (chmod 600), never in Git. `.env.example` documents keys |
| Build | CI (GitHub Actions) builds and pushes the image to GHCR tagged by git SHA, **or** the image is built on the VPS if the VPS has ≥ 2–4 GB RAM (A3). Decided in P2 from VPS specs |
| Deploy | `scripts/deploy.sh <sha>`: pull image → `ops migrate` → `docker compose up -d app` → health check `/api/health` (DB ping) → roll back to the previous tag if unhealthy |
| Rollback | Keep the last 3 image tags. Migrations are forward-compatible (expand/contract), so an app rollback doesn't need a DB rollback |
| Restarts | `restart: unless-stopped` + Docker healthchecks |
| Host hardening | Unattended security upgrades, ufw, SSH keys only, fail2ban optional, Docker log rotation |
| CI (not over-engineered) | One workflow: install → lint → typecheck → unit + integration tests (Postgres service container) → tracker size check → build → Playwright e2e (P1b+) → gitleaks. Deploy stays **manual** (a script run by Barış) until beta |

---

## 24. Backups

| Aspect | Plan |
|---|---|
| Method | `pg_dump -Fc` nightly (logical, consistent). WAL archiving / PITR is **not** in MVP (RPO ≤ 24 h accepted; U10) |
| Encryption | Streamed through **`age`** with a public key on the VPS. The **private key is stored offline** by Barış (password manager + paper) and never on the VPS |
| Off-VPS copy | Object storage via `rclone`: **Backblaze B2** or **Cloudflare R2** (both have ~10 GB free storage; R2 has no egress fees; either may require a payment method on file). **USER APPROVAL (U11)** |
| Retention | 7 daily, 4 weekly, 2 monthly (§21.2), enforced by the script, plus a bucket lifecycle rule as a backstop |
| Failure detection | The backup job pings its dead-man check; missing or failed pings email Barış. The size of each dump is compared with the previous one (a ±50% jump raises a warning) |
| **BACKUP CREATED** vs **RESTORE VERIFIED** | Weekly `ops restore-check`: download the latest backup → decrypt (a restore-only key kept on the VPS is a trade-off; alternative: a monthly manual restore by Barış with the offline key; **decision in P7**) → restore into a throwaway `postgres:18` container → run sanity queries (row counts within tolerance, latest `revenue_events.received_at` < 26 h old) → record in `job_runs`. Only a passing check counts as "restore verified" |
| Full disaster drill | Before private beta (C) and before first paying user (D): rebuild on a fresh machine from Git + `.env` backup + latest dump. Time it, and record it in `docs/runbooks/restore.md` (created in P7) |
| Secrets backup | `.env` stored encrypted in Barış's password manager (not in the backup bucket) |

---

## 25. Observability (minimum, low cost)

| Signal | Mechanism | Free tier / when it ends |
|---|---|---|
| Availability | External uptime check on `/api/health` and `/js/v1/om.js` (UptimeRobot free: 50 monitors, 5-min interval, for non-commercial/limited use; or Better Stack free) | If the terms change: self-hosted Uptime Kuma on a different host, or a Healthchecks cron from elsewhere |
| HTTP error rates | Per-route 5xx counts in logs; `ops selfcheck` counts 5xx in the last 15 min from the app's in-memory counters exposed at `/api/internal/metrics` (localhost-only) and alerts above a threshold | — |
| Tracker ingestion | `selfcheck`: events in the last hour vs the same hour yesterday (alert on a drop > 80% with baseline > 50); per-project drop counters (origin, bot, invalid) | — |
| Revenue API failures | Counts of 4xx/5xx per project, shown to founders in integration status; 5xx alerts Barış | — |
| DB health | `/api/health` DB ping; `selfcheck`: connections, DB size | — |
| Storage capacity | `selfcheck`: disk use > 80% → alert | — |
| Scheduled jobs & backups | Healthchecks.io free (≈20 checks, email alerts) with start/success/fail pings | If it goes away: self-hosted Healthchecks (open source) or email from cron via the transactional provider |
| App errors | Logs first. Sentry free tier is **optional, post-beta** (U12) | — |
| Alert channel | Email to Barış (and optionally a Telegram bot, free) | — |

---

## 26. Test strategy

**Tooling:** Vitest (unit + integration), a real PostgreSQL 18 in CI (service container) with a fresh schema per test file, Playwright (Chromium, pre-installed) for tracker and e2e, and an **injectable `Clock`** + fake timers everywhere time matters. No mocks of the database for data-layer tests.

| Area | Concrete tests | Phase |
|---|---|---|
| Attribution (pure unit, table-driven) | First visit; UTM visit then direct return → UTM credited; two campaigns → latest non-direct; all direct → `direct`; no link → `unattributed`; touch outside 90 d ignored; touch after acquisition ignored; self-referral (checkout.paddle.com) treated as direct; multiple visitors unioned; late link with earlier session → recomputed; tie on timestamps → deterministic by session id; `rules_version` recorded | P1a |
| Source normalization | UTM case/whitespace, aliases, known referrer map, registrable domain, click-ID hint, length caps, garbage input | P1a |
| Identity | identify creates link; duplicate identify idempotent; visitor → 2 customers; customer → 2 visitors; post-acquisition link doesn't change credit; email-like customer ID rejected | P1a/P1b |
| Session boundaries | 29 min vs 31 min inactivity; new campaign mid-session; midnight no-split; clock skew (client clock jumps) | P1b |
| UTM / referrer (tracker) | Parse, persist on session only, query string not sent, referrer host only | P1b |
| Revenue idempotency | Same payload twice → 201, then 200 duplicate; changed amount same ID → 409; **concurrent identical requests** → exactly one row | P1a |
| Duplicates (browser) | Same `event_id` twice → one row, session pageviews incremented once | P1b |
| Refunds | Refund inherits source; partial refunds; refund > remaining → 422; refund without `refund_of` accepted; net per currency | P1a |
| Renewals | Second payment months later with a new campaign visit → still original source | P1a |
| Currency | JPY (0 dp), KWD (3 dp) formatting; mixed currencies never summed; unknown currency → 422; non-integer → 422 | P1a/P5 |
| Time | Project TZ day grouping; DST transition days (Europe/Berlin, America/New_York); range bounds; future `occurred_at` rejected | P1a/P5 |
| Tenant isolation (**CI-blocking**) | A's user requests every route/action/export with B's IDs → 404; A's key with B's customer ID creates an A customer (never touches B); site key A with origin B → dropped; lint guard on raw DB import | P3 |
| Authorization | Non-member → 404; revoked session; logged-out access redirects | P3 |
| API keys | Create shows once; hash stored only; revoked → 401; wrong prefix/secret → 401 identical; `last_used_at` updates | P1a/P3 |
| Tracker | Size budget; storage disabled; cookie domain; consent mode (no storage before consent); GPC; SPA navigation; endpoint 500/blocked → page JS unaffected (test page asserts its own script still runs); CSP-strict page | P1b/P6 |
| Ingestion integration | Valid → stored; oversized → 413 dropped; invalid schema → dropped; bot UA → dropped; rate limit → dropped; wrong origin → dropped and counted | P1b/P6 |
| DB constraints | Composite FK prevents cross-project references (direct SQL insert attempt); amount > 0 check; unique `event_id` | P1a |
| Migrations | All migrations apply to an empty DB in CI; the schema snapshot diff is clean | P0+ |
| **End-to-end vertical slice** | Playwright: open `fixtures/landing.html?utm_source=e2e&utm_campaign=slice` → navigate → identify `cust_e2e` → POST revenue via HTTP with the test key → internal page shows `e2e / slice` with the amount | P1b (kept green forever) |
| Browser (product) | Sign-up → create project → onboarding checklist turns green with a fixture site → dashboard table | P4/P5 |
| Deletion / export | Delete visitor → sessions gone, attribution recomputed; delete customer → tombstone, revenue retained unlinked; export CSV columns; purge job respects the grace period | P6 |
| Logging redaction | Captured logs contain no key, customer ID or IP patterns | P6 |
| Ops | Advisory lock prevents concurrent job runs; restore-check against a known dump | P7 |

---

## 27. Repository & Claude Code memory model

**Canonical files (keep this set small; don't add more without reason)**

| File | Purpose | Owner | When updated |
|---|---|---|---|
| `CLAUDE.md` | Auto-loaded by Claude Code. Operating rules (no implementation without approval, no paid services, git rules), the reading order, and the commands to run checks. **Short (< 60 lines).** | Barış (Claude proposes edits) | Rarely; when rules or commands change |
| `docs/STATUS.md` | **Current state:** phase, last completed phase + commit, next task, blockers, open decisions. The single "where are we" file | Claude updates at the end of each phase/session; Barış confirms | Every phase exit and every session that changes state |
| `docs/planning/MASTER_DEVELOPMENT_PLAN_v2.md` | The canonical plan (this file) | Barış (revisions R1/R2 via review) | Only via approved revisions. After lock, changes go into DECISIONS.md + a plan revision note |
| `docs/DECISIONS.md` | Append-only log of locked decisions (ID, date, decision, why, alternatives rejected) | Barış decides; Claude records | When a decision is locked or reversed |
| `README.md` | Human entry point: what OriginMetric is, pointers to STATUS and the plan, dev quickstart (from P0) | Claude | When the quickstart changes |

Added later only when needed: `docs/runbooks/*.md` (P7: deploy, restore, incident), `docs/api.md` (P4: public API docs, which also feed the in-app docs).

**A fresh `/clear` session reads:** `CLAUDE.md` (automatic) → `docs/STATUS.md` → the single phase section of this plan named in STATUS. Target: < 15k tokens of context before starting work.

**Credit-saving working rules** (to be copied into CLAUDE.md at P0):
1. One phase (or sub-phase) per session. Stop at exit criteria. Update STATUS. Commit.
2. ChatGPT or Barış prepares a phase brief that quotes the plan section, so Claude doesn't re-research.
3. No repo-wide exploration: STATUS lists the relevant paths per phase.
4. `npm run check` (lint + typecheck + unit) and `npm run test:e2e` are the only verification commands Claude needs.
5. No speculative refactors outside the phase scope.

---

## 28. Development roadmap

Order: foundation → **earliest safe vertical slice** → deploy/dogfood → productize → harden → beta → billing → launch.
Sessions: "S" = one focused Claude Code session (~1–3 h of agent work).

### P0 — Repository & dev foundation
- **Objective:** a runnable skeleton that every later phase builds on without rework.
- **Why now:** the vertical slice needs a DB, test harness and CI. Nothing more.
- **Scope:** Next.js 16 + TS strict; ESLint/Prettier; Drizzle + postgres driver; `docker-compose.dev.yml` (Postgres 18); migration workflow; Vitest with a real-DB test helper; Playwright config; `Clock` abstraction; pino logger skeleton; GitHub Actions CI (check + tests + gitleaks); `CLAUDE.md` rules + `npm run check`; `.env.example`; tracker package skeleton with esbuild + size check.
- **Out of scope:** auth, UI, any domain tables beyond an empty initial migration, deployment.
- **Dependencies:** plan APPROVED / LOCKED; U1/U13 decided (framework/ORM); repo naming (U14) ideally resolved.
- **Deliverables:** skeleton, CI green, README quickstart.
- **Automated tests:** sample unit test, DB connectivity integration test, migration-apply test.
- **Security check:** `.gitignore` covers `.env*`; gitleaks passes; no secrets in the compose files.
- **User review required?** No (unless deviating from locked decisions).
- **Exit criteria:** `npm run check` and the CI workflow pass on a clean clone; `docker compose -f docker-compose.dev.yml up` gives a working DB.
- **Expected status:** `P0 DONE`. **Est. 1 S.**

### P1a — Core domain: schema, attribution engine, Revenue API (headless)
- **Objective:** the money and attribution half of the chain, fully tested without a browser.
- **Why now:** it is the product's core logic and the highest correctness risk. It is pure, cheap to test, and independent of UI.
- **Scope:** migrations for `workspaces`, `projects`, `api_keys`, `events`, `sessions`, `customers`, `customer_visitors`, `revenue_events`, `customer_attribution` (with composite FKs); ISO 4217 table; source normalization; the pure `attribute()` function; materializer; `POST /api/v1/revenue-events` with key auth, validation, idempotency, refund rules; CLI `ops create-project`, `ops create-key`, `ops recompute`.
- **Out of scope:** tracker, dashboard, user accounts.
- **Dependencies:** P0; U2 (attribution model) locked.
- **Deliverables:** working API callable with `curl`; seeded dev project via CLI.
- **Automated tests:** attribution table-driven suite, normalization, idempotency (incl. concurrency), refunds, renewals, currency, DB constraint tests, key tests.
- **Security check:** hashed keys only; 401 uniformity; no bodies in logs; parameterized SQL only.
- **User review required?** No.
- **Exit criteria:** all listed tests green; `curl` walkthrough in STATUS works.
- **Expected status:** `P1a DONE`. **Est. 1–2 S.**

### P1b — Tracker + ingestion + end-to-end proof ⭐ **FIRST END-TO-END VERTICAL SLICE**
- **Objective:** prove the complete chain: test page → tracker → session/source stored → visitor identified → revenue event → attribution → internal result.
- **Why here:** it is the earliest point where every link of the chain can exist *without* waiting for accounts, onboarding or dashboards. Projects and keys come from the CLI, and the result page is protected by an env token. Because `project_id` tenancy and the real schema are used from P1a, **nothing in the slice is throwaway**: auth and UI later wrap it rather than replace it.
- **Scope:** tracker v0 (pageview, identify, sessions, UTM, referrer, cookie/localStorage, sendBeacon, failure isolation, size budget); `POST /api/v1/e` (site key, origin allow-list, schema, dedup, session upsert, link creation, attribution trigger); static fixture pages; internal page `/internal/projects/[id]` behind `INTERNAL_TOKEN` (disabled when unset); Playwright e2e of the whole chain.
- **Out of scope:** consent mode, rate limits, bot filter (P6), accounts (P3), any styling.
- **Dependencies:** P1a.
- **Deliverables:** e2e test green in CI; `npm run demo` script that runs the slice locally.
- **Automated tests:** tracker unit + browser tests, ingestion integration tests, the e2e slice test.
- **Security check:** tracker never throws into the host page (test); ingestion drops wrong origins; internal page is 404 without a token.
- **User review required?** **Yes.** Barış watches the demo and confirms the attribution semantics look right in practice.
- **Exit criteria:** e2e slice green; Barış confirms.
- **Expected status:** `VERTICAL SLICE PROVEN (local)`. **Est. 1–2 S.**

### P2 — Deploy the slice & dogfood on a real site
- **Objective:** the same slice running on the VPS under a real domain with Cloudflare, tracking one real website (Barış's own, or a landing page for OriginMetric itself).
- **Why now:** real browsers, ad blockers, CORS, Cloudflare and ITP behaviour are the next biggest unknowns. It is cheaper to find them now than after building UI.
- **Scope:** production compose (caddy/app/db); Cloudflare setup; firewall; `deploy.sh` with health check + rollback; nightly encrypted backup to off-VPS storage (basic) + **one manual restore test**; uptime monitor; Healthchecks for the backup.
- **Out of scope:** automated restore-check, full alerting (P7), accounts.
- **Dependencies:** P1b; domain (U15); VPS access and specs (A3); backup storage approval (U11).
- **Deliverables:** tracker live on a real site; revenue test events sent from Barış's machine; internal page reachable by token.
- **Automated tests:** CI unchanged; a post-deploy smoke script (health, tracker asset, test event).
- **Security check:** DB not reachable from the internet (external port scan); 80/443 limited to Cloudflare; `.env` perms; TLS Full (strict).
- **User review required?** **Yes** (infrastructure actions are Barış's: DNS, VPS, storage account).
- **Exit criteria:** real visits are attributed on production; one backup restored successfully by hand.
- **Expected status:** `SLICE LIVE (dogfood)`. **Est. 1–2 S** (+ Barış's hands-on time).

### P3 — Accounts, workspaces, projects, keys (tenancy)
- **Objective:** self-serve accounts with strict tenant isolation.
- **Why now:** it is required before any second person's data enters the system.
- **Scope:** Better Auth (email+password; admin-CLI password reset for now); workspace auto-created at sign-up; project CRUD (domains, TZ, primary currency, exclusions); site key display; API key create/rotate/revoke UI; tenant-scoped data layer + lint guard; 404-on-foreign policy.
- **Out of scope:** invites/teams, email flows, billing.
- **Dependencies:** P2 (or P1b if deployment is delayed); U1 (auth).
- **Automated tests:** tenant isolation attack suite (CI-blocking), authz, key UI flows, auth flows.
- **Security check:** cross-tenant tests; session cookie flags; CSRF/origin checks; brute-force limits on sign-in.
- **User review required?** No (U1 is decided before this phase).
- **Exit criteria:** tenant suite green; two accounts can't see each other's anything.
- **Expected status:** `P3 DONE`. **Est. 1–2 S.**

### P4 — Onboarding & live integration status
- **Objective:** a founder integrates in 10–15 minutes without help.
- **Why now:** onboarding friction is the top validation risk after correctness.
- **Scope:** §19 checklist with live polling; snippet generator (HTML / Next.js / WordPress); identify guide; prefilled test `curl`; test-event handling (`test: true`, excluded from reports, deletable); integration health header; API docs page (`docs/api.md` rendered in the app).
- **Out of scope:** payment-provider recipes (P8), dashboard polish.
- **Dependencies:** P3.
- **Automated tests:** Playwright: new user → checklist fully green against a fixture site.
- **Security check:** test events can't pollute live reports; docs show no real keys.
- **User review required?** **Yes.** Barış does a timed onboarding run on a fresh site (target ≤ 15 min).
- **Exit criteria:** timed run ≤ 15 min, or friction points logged and fixed.
- **Expected status:** `P4 DONE`. **Est. 1–2 S.**

### P5 — Beta dashboard ⭐ **FIRST REAL USER (cut line B)**
- **Objective:** answer "where did my revenue come from?" for one founder's real data.
- **Scope:** §18 beta dashboard: main table, campaign drill-down, currency handling, date ranges in project TZ, coverage %, customer list + customer detail with touch timeline and credit explanation. Disable the internal page in production.
- **Out of scope:** charts, MRR, CSV export (P6).
- **Dependencies:** P4.
- **Automated tests:** reporting query tests (time-base semantics, currency grouping, DST), Playwright table rendering, XSS payload rendering test.
- **Security check:** all reporting through the scoped data layer; XSS tests.
- **User review required?** **Yes.** Barış approves inviting the first real user (a friendly founder, hand-held).
- **Exit criteria:** one external founder's real site + real revenue events show up correctly.
- **Expected status:** `FIRST REAL USER LIVE`. **Est. 1–2 S.**

### P6 — Security & privacy hardening
- **Objective:** safe to accept strangers' data.
- **Scope:** rate limiting (in-process + Cloudflare rule), bot filter, `usage_daily` quotas, consent mode + GPC in the tracker, log-redaction tests, security headers and CSP on the app, deletion APIs (visitor, customer) + UI, CSV export, project/account deletion with grace, retention purge job, dependency audit, threat-model walk-through (§20 checklist).
- **Dependencies:** P5; U4 (retention), U5, U7 decided.
- **Automated tests:** §26 rows for ingestion abuse, consent, deletion/export, redaction.
- **Security check:** the full §20 table is reviewed, and each row is marked done or accepted.
- **User review required?** **Yes** (retention numbers, consent defaults).
- **Exit criteria:** all §20 P6 items closed; tests green.
- **Expected status:** `P6 DONE`. **Est. 2 S.**

### P7 — Operations: backups verified, monitoring, email ⭐ **PRIVATE BETA READY (cut line C)**
- **Objective:** can Barış recover from VPS loss and know about failures before users do?
- **Scope:** `ops restore-check` weekly (or the manual monthly alternative), Healthchecks for all cron jobs, `selfcheck` (disk, ingestion drop, 5xx), uptime monitors, **full disaster-recovery drill** on a fresh machine, runbooks (deploy/rollback/restore/incident), transactional email (password reset) via the approved provider (U3).
- **Dependencies:** P6; U3, U10, U11.
- **Automated tests:** advisory-lock concurrency test, restore-check against a fixture dump, email sending mocked at the provider boundary.
- **Security check:** backups encrypted and the private key offline; the bucket credential is scoped to one bucket.
- **User review required?** **Yes** (Barış performs or observes the DR drill).
- **Exit criteria:** `RESTORE VERIFIED` recorded; alerts reach Barış in a test; password reset works.
- **Expected status:** `PRIVATE BETA READY`. **Est. 1–2 S.**

### P8 — Private beta operation (mostly non-coding)
- **Objective:** 5–10 founders (at least 3 not on Stripe) use it on real revenue for ≥ 3–4 weeks.
- **Scope:** invite-only sign-up (invite codes), payment-provider recipes from real integrations, weekly feedback, bug fixes, measured onboarding time, attribution coverage per project, a list of the most requested features (native integrations? MRR? first-touch toggle?).
- **Out of scope:** new major features unless they are a validated blocker (goes through a scope exception).
- **Dependencies:** P7.
- **Exit criteria:** ≥ 3 founders say they'd pay (or pre-pay), or a documented pivot decision.
- **Expected status:** `BETA VALIDATED` or `BETA FINDINGS → REPLAN`. **Est. 1–3 S** of fixes.

### P9 — Billing & legal ⭐ **FIRST PAYING USER (cut line D)**
- **Scope:** merchant-of-record checkout + webhook + plan status + quota enforcement (§17); dogfood revenue into OriginMetric; ToS, privacy policy, DPA + sub-processor list (**professional review**); pricing page.
- **Dependencies:** P8 validation; U9 (billing provider), U16 (pricing); legal review (§8.4).
- **Automated tests:** webhook signature, idempotency by provider event ID, plan transitions, quota enforcement.
- **Security check:** webhook secret handling; no card data touches OriginMetric.
- **User review required?** **Yes.**
- **Exit criteria:** a real payment is processed; legal docs published.
- **Expected status:** `CHARGEABLE MVP`. **Est. 1–2 S.**

### P10 — Public launch ⭐ **(cut line E)**
- **Scope:** landing page, public docs, open sign-up with email verification, abuse monitoring, the dashboard chart + polish, status page (free), launch checklist.
- **Dependencies:** P9.
- **Exit criteria:** launch checklist complete; a second DR drill passes.
- **Expected status:** `PUBLIC`. **Est. 2–3 S.**

**Total implementation estimate: about 14–22 focused Claude Code sessions** (see §30).

---

## 29. MVP cut lines

| Cut line | Includes | Explicitly excludes |
|---|---|---|
| **A. Earliest end-to-end proof** (end of P1b) | CLI-created project and key; tracker v0 (pageview, identify, sessions, UTM, referrer); ingestion with origin check + dedup; Revenue API with idempotency + refunds; attribution engine (last non-direct + first touch stored); internal token-protected result page; e2e test | Accounts, UI polish, deployment, consent mode, rate limits, email, billing |
| **B. First real user** (end of P5, deployed since P2) | A + VPS production + basic encrypted backup + one manual restore; accounts & tenancy with leak tests; onboarding checklist; beta dashboard (source table, campaign drill-down, currency split, customer detail) | Self-serve sign-up for strangers, email, billing, charts, export |
| **C. Private beta** (end of P7) | B + rate limits, bot filter, quotas, consent mode, GPC, deletion APIs/UI, export, retention purge, log redaction, security headers, verified restore + DR drill, monitoring/alerts, password-reset email, invite-only sign-up | Billing, public sign-up, native integrations, MRR, charts |
| **D. First paying user** (end of P9) | C + merchant-of-record billing + plan status + quotas enforced + ToS/Privacy/DPA reviewed by a professional + account/project deletion UI + CSV export + provider recipes | Usage metering, FX, MRR, team seats, native integrations |
| **E. Public launch** (end of P10) | D + landing, public docs, open sign-up with email verification, 1 chart, status page, second DR drill | Everything in F |
| **F. After validation (only on demand)** | Native provider integrations (webhook-direct, ordered by beta demand); MRR (§10.4); first-touch/other-model toggle; FX conversion; team invites; custom conversion events; first-party proxy guide; signed identify; 2FA/social login; Turkish UI; AI summaries (optional premium, never core); daily rollups/partitioning; ClickHouse evaluation per §14 signals | — |

---

## 30. Estimates

**Assumptions:** Barış has about 10–20 hours a week; Claude does most of the coding; ChatGPT prepares phase briefs; there are no major rewrites; VPS access and a domain are available; no legal-review delay counts against engineering time. **These are ranges, not commitments.**

| Milestone | Claude sessions (cumulative) | Calendar from P0 start |
|---|---|---|
| Earliest end-to-end technical proof (A) | 3–5 | **1–2 weeks** |
| First usable founder integration (B) | 7–12 | **3–6 weeks** |
| Private beta (C) | 10–16 | **5–9 weeks** |
| Chargeable MVP (D) | 12–19 | **9–15 weeks** (includes ≥ 3–4 weeks of beta usage + legal review) |
| Public launch (E) | 14–22 | **11–19 weeks** |

**Credit-expensive areas:** (1) tracker + ingestion + Playwright e2e debugging (browser flakiness, CORS); (2) auth integration details; (3) deployment and Cloudflare debugging (Claude can't access the VPS; this needs efficient hand-offs with Barış running commands); (4) dashboard reporting-query semantics; (5) any rework caused by unlocked decisions.

**Where automation saves credit:** one `npm run check` command; a deterministic e2e slice test that catches regressions without manual clicking; seed and demo scripts; CI catching problems instead of Claude re-reading code; STATUS.md handoffs instead of rediscovery.

**Budget view (ASSUMED, A11):** if a disciplined session costs roughly $3–8 of credit, 14–22 sessions come to about $45–175. **$100 probably covers through private beta (C), and may not fully cover public launch.** Mitigations: strict phase briefs, `/clear` between phases, and a cheaper model for routine sub-tasks (docs, copy, simple UI).

---

## 31. Cost model & paid services

### 31.1 Operating cost tables (USD/month, estimates)

**Existing sunk/current costs (paid already, but part of the true cost)**

| Item | Cost | Note |
|---|---|---|
| Existing VPS | **Unknown: Barış to fill in** (typically $5–25) | Shared with other workloads? (A3) |
| Domain (if already owned) | ~$1–2/mo amortized | Registrar-dependent |

**Incremental MVP costs (A–C)**

| Item | Cost | Free-tier limits |
|---|---|---|
| Cloudflare Free | $0 | 5 WAF custom rules, 1 rate-limit rule; caching; no SLA |
| Off-VPS backup storage (B2 or R2) | $0 while < 10 GB | Beyond that ≈ $0.006–0.015/GB-month; payment method may be required |
| Uptime monitor (UptimeRobot/Better Stack free) | $0 | 5-min checks; commercial-use terms to verify |
| Healthchecks.io free | $0 | ~20 checks |
| Transactional email (Resend free) | $0 | 3,000/month, **100/day**; sending pauses at the cap |
| GitHub + Actions (private repo) | $0 | ~2,000 CI minutes/month on Free; keep CI lean |
| New domain (if needed, e.g. originmetric.com) | ~$10–15/yr | Availability unverified (U15) |
| **Incremental total** | **≈ $0–2/month** (+ domain) | |

**Likely after beta (D)**

| Item | Cost |
|---|---|
| Merchant-of-record fees | ~5% + $0.50 per transaction (no monthly fee) |
| Professional legal review (one-off) | **Unknown, can be significant**: get quotes (Turkey + EU) |
| Possible VPS upgrade (more RAM/disk) | +$5–20 |
| Email above free tier | ~$20 (Resend Pro tier) |

**With growth (post-E)**

| Item | Cost |
|---|---|
| Bigger VPS or a separate DB VPS | $20–80 |
| Backup storage growth | $1–5 |
| Error monitoring paid tier (optional) | $0–26 |
| Cloudflare Pro (more rate-limit rules) | $20–25 |

**TRUE MVP operating cost** = existing VPS share + domain + ≈ $0–2 → roughly **$7–30/month**, depending on the VPS price.
**INCREMENTAL MVP cost** = **≈ $0–2/month** (+ one-off domain), rising after billing with transaction-percentage fees and one-off legal costs.

### 31.2 Paid / potentially paid services (each needs Barış's approval)

| Service | Purpose | Free alternative | MVP necessity | Expected cost | Lock-in | Replacement difficulty | Approval |
|---|---|---|---|---|---|---|---|
| Cloudflare | DNS, proxy, WAF, cache | Direct DNS + Caddy only | High (abuse protection, cache) | $0 (Free) | Low | Low | **Yes** (U17) |
| Backblaze B2 / Cloudflare R2 | Off-VPS backups | Second VPS / home NAS via rclone | **Required** before real data | $0 in the free range | Low (rclone) | Low | **Yes** (U11) |
| Resend (or existing SMTP) | Password reset, verification | Existing mailbox SMTP (deliverability risk), Brevo free | Required at C | $0 (free tier) | Low (SMTP-like API) | Low | **Yes** (U3) |
| UptimeRobot / Better Stack | Uptime alerts | Uptime Kuma self-hosted elsewhere | High at C | $0 | Low | Low | **Yes** (U12) |
| Healthchecks.io | Cron dead-man switch | Self-hosted Healthchecks | High at C | $0 | Low | Low | **Yes** (U12) |
| Sentry | Error tracking | Logs | Optional | $0 → $26 | Low–Med | Low | **Yes**, deferred |
| Paddle / Polar | Product billing (merchant of record) | Manual invoicing | Required at D | % per transaction | Medium (subscriptions live there) | Medium | **Yes** (U9) |
| GitHub Actions / GHCR | CI, image registry | Build on VPS; local checks | High | $0 within limits | Low | Low | **Yes** (U18) |
| Domain registrar | Product domain | — | Required at P2 | ~$10–15/yr | Low | Low | **Yes** (U15) |
| FX rate API | Currency conversion | ECB reference rates (free) | **Not MVP** | $0–10 | Low | Low | Later |
| AI API | Optional premium summaries | — | **Not MVP** | Usage-based | Medium | Low | Later |

---

## 32. Technology decision matrix

Ratings: L = low, M = medium, H = high.

| Decision | Recommended | Alternatives | Why | Dev cx | Ops cx | Security | MVP cost | Growth cost | Lock-in | Migration | Approval? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| App framework | **Next.js 16 (App Router, Node runtime, standalone)** | Hono+Vite SPA; SvelteKit; Remix/React Router 7; Laravel | One TS codebase, Claude-fluent, SSR dashboard + APIs, Docker-friendly | M | L | M (keep surface small) | $0 | $0 | L–M | M | **Yes (U13)** |
| API architecture | **REST route handlers, `/api/v1`, JSON, uniform error envelope** | tRPC (internal UI), GraphQL | Public APIs must be plain HTTP for any language; internal UI uses server components / server actions | L | L | H | $0 | $0 | L | L | No |
| DB access / ORM | **Drizzle + committed SQL migrations** | Prisma, Kysely, raw `postgres.js` | SQL-close, typed, light runtime, readable migrations | L | L | H (parameterized) | $0 | $0 | L | L | **Yes (U13)** |
| Database | **PostgreSQL 18 (self-hosted container)** | Managed PG (Neon/Supabase), SQLite | Relational integrity for money + tenancy; free on the VPS | L | M (backups are ours) | H | $0 | $0–VPS | L | L | **Yes (U13)** |
| Authentication | **Better Auth, email+password** | Auth.js v5, magic link, Clerk, hand-rolled | §16 | L–M | L | H | $0 | $0 | L | L | **Yes (U1)** |
| Public tracker ingestion | **In-app route handler, text/plain beacon, in-process limits + Cloudflare rule** | Cloudflare Worker → queue; separate Go service | Simplest; volumes are tiny; can be split later | L | L | M (by design, §6) | $0 | $0 | L | L | No |
| Tracker build | **Vanilla TS + esbuild IIFE, size-checked** | Rollup, hand-written JS | Tiny, fast, typed | L | L | H | $0 | $0 | L | L | No |
| Job processing | **Host cron + CLI + advisory locks + Healthchecks** | pg-boss, BullMQ+Redis, systemd timers | No new infrastructure (§15) | L | L | H | $0 | $0 | L | L | No |
| Caching | **None in the app; Cloudflare for `/js/*`; PG query cache** | Redis | No measured need | L | L | H | $0 | $0 | L | L | No |
| Dashboard charts | **None until P10, then Recharts (or inline SVG)** | Chart.js, uPlot, Tremor | The table is the product; one chart later | L | L | H | $0 | $0 | L | L | No |
| UI components | **Tailwind + a few copied shadcn/ui-style components** | Mantine, plain CSS | Small, owned code | L | L | H | $0 | $0 | L | L | No |
| Transactional email | **Resend free** (or existing SMTP) | Brevo, Postmark, Amazon SES | Simple API, free tier fits beta | L | L | M | $0 | ~$20 | L | L | **Yes (U3)** |
| CI | **GitHub Actions, one workflow** | None (local only), self-hosted runner | Free within limits | L | L | H (gitleaks) | $0 | $0 | L | L | **Yes (U18)** |
| Deployment | **Docker Compose + deploy script + manual trigger** | Coolify/Dokploy, Kamal, bare systemd | Transparent, scriptable, no extra platform | L | M | H | $0 | $0 | L | L | No |
| Reverse proxy | **Caddy** | Nginx + certbot, Traefik | Automatic TLS, tiny config | L | L | H | $0 | $0 | L | L | No |
| Monitoring | **UptimeRobot/Better Stack free + Healthchecks free + selfcheck cron** | Uptime Kuma, Grafana stack | Minimal, free | L | L | M | $0 | $0 | L | L | **Yes (U12)** |
| Backups | **pg_dump + age + rclone → B2/R2, weekly restore-check** | WAL-G/pgBackRest PITR, VPS snapshots only | Simple and verifiable; PITR is overkill for MVP | L | M | H | $0 | $1–5 | L | L | **Yes (U10, U11)** |
| Product billing | **Paddle (or Polar), hosted checkout + webhook** | Lemon Squeezy, Stripe, iyzico, manual invoices | Merchant of record handles global VAT; Turkey seller support (verify) | L | L | H (no card data) | % fees | % fees | M | M | **Yes (U9)** |

---

## 33. User decisions required before implementation

| ID | Decision | Recommendation | Alternatives | Why it matters | Blocks | Can defer? |
|---|---|---|---|---|---|---|
| **U0** | Approve / revise this plan | Review → R1 if needed → `APPROVED / LOCKED` | — | Nothing starts without it | P0 | No |
| **U1** | Authentication approach | Better Auth, email+password, self-hosted | Magic link; Clerk; Auth.js | Security burden, vendor dependency, email dependency | P3 | Until P3 |
| **U2** | Attribution model | Customer-level last non-direct touch, 90-day lookback, first-touch stored; renewals inherit | First touch as the primary model; a user toggle from day one | This is the product's core definition | P1a | No |
| **U3** | Transactional email provider | Resend free tier | Existing SMTP; Brevo; SES | Needed for password reset at C | P7 | Until P7 |
| **U4** | Retention numbers | events 90 d, sessions 25 mo, cookie ≤ 13 mo, logs 14 d, backups ≤ 90 d | Shorter (privacy) / longer (history) | Privacy, cost, product usefulness | P6 | Until P6 |
| **U5** | Deletion grace period | 7 days for project/account | 0 / 30 days | Mistake recovery vs deletion promise | P6 | Until P6 |
| **U6** | Visitor cookie lifetime & scope | ≤ 13 months, not extended; optional parent-domain scope | 12 months; extended on visit | Privacy positioning vs attribution coverage | P1b | Default OK, confirm by P6 |
| **U7** | GPC / consent defaults | Honour GPC by default; consent mode opt-in by the founder | Consent-required by default | Coverage vs privacy posture | P6 | Until P6 |
| **U8** | Revenue retention on customer deletion | Tombstone customer, keep unlinked revenue (pending legal review) | Delete revenue rows too | Founders' financial totals vs erasure scope | P6 | Until P6 |
| **U9** | Billing provider (merchant of record) | Paddle (verify Turkey seller support), Polar as backup | Lemon Squeezy; Stripe (entity-dependent); iyzico | Tax compliance, fees, lock-in | P9 | Until P8 ends |
| **U10** | Backup RPO & restore-check key model | Nightly dumps (RPO ≤ 24 h); weekly automated restore-check with a restore-only key on the VPS **or** a monthly manual restore with the offline key | PITR (WAL archiving) | Data-loss tolerance vs complexity / key exposure | P7 (basic in P2) | Until P7 |
| **U11** | Off-VPS backup storage | Backblaze B2 or Cloudflare R2 free tier | Another VPS; home NAS | Recovery from VPS loss | P2 | No, needed before real data |
| **U12** | Monitoring services | UptimeRobot (or Better Stack) + Healthchecks.io free | Self-hosted | Alerting | P2/P7 | Partly |
| **U13** | Core stack lock (framework, ORM, DB) | Next.js 16 + Drizzle + PostgreSQL 18 | §32 alternatives | Everything builds on it | P0 | No |
| **U14** | Repository rename `Olacak` → `originmetric` | Rename before P0, and fix the GitHub App authorization at the same time | Keep `Olacak` | Clarity for every future session and CI; GitHub redirects old URLs | P0 (soft) | Yes, but cheaper now |
| **U15** | Product domain | Register `originmetric.*` (availability unverified) | Subdomain of an existing domain for the beta | Tracker URL and cookies are hard to change after founders install | P2 | Until P2 |
| **U16** | Pricing & plan limits | Decide after P8 (e.g. flat tiers by events/month) | — | Billing configuration | P9 | Yes |
| **U17** | Use Cloudflare in front of the VPS | Yes (Free plan) | Direct | Abuse protection, TLS edge, caching | P2 | Until P2 |
| **U18** | GitHub Actions for CI (+ GHCR images) | Yes | Local-only checks | Automation vs free-tier minutes | P0 | No |

---

## 34. Assumptions register

| ID | Assumption | Evidence | Impact if wrong | Validation method | Phase | Status |
|---|---|---|---|---|---|---|
| A1 | Founders will add one identify call or pass `visitor_id` | Similar products require this | Most revenue `Unattributed`, product fails | Beta coverage % per project | P5/P8 | ASSUMED |
| A2 | Founders can call a REST endpoint from their payment webhook handler | Target audience are developers | Onboarding too hard; native integrations needed earlier | Timed onboarding; beta | P4/P8 | LIKELY |
| A3 | The existing VPS has enough headroom (≥ 2 GB RAM, ≥ 40 GB disk) and Barış has root | Brief says a VPS exists; specs unknown | Upgrade cost; build strategy changes | Barış provides specs | P2 | OPEN |
| A4 | MVP volume ≤ ~5M events/month total | Early beta size | Earlier partitioning / rollups | `usage_daily` | P8 | LIKELY |
| A5 | VPS location is known and acceptable for EU/TR data transfer analysis | Unknown | Legal work or a move | Barış confirms location | P2 | OPEN |
| A6 | Last non-direct touch is understood by founders without training | Common model in analytics tools | Confusion, mistrust | Beta interviews | P8 | LIKELY |
| A7 | Consent may be required for OriginMetric's identifier in the EU/UK/TR | EDPB 2/2023, CNIL exemption conditions, KVKK guidance | If not required: consent mode is extra but harmless | Professional review | Before D | LIKELY |
| A8 | Barış/the business is Turkey-based, so Stripe direct is unavailable and a merchant of record is needed | Name, KVKK/iyzico/PayTR mentions | Billing options change | Barış confirms | P9 | ASSUMED |
| A9 | Paddle (or Polar) accepts the seller's country/entity | Seller-country lists (verify) | Different provider | Signup attempt | P8 | OPEN |
| A10 | The non-Stripe founder segment is reachable and willing to pay | Brief's thesis | Positioning/pivot | Beta recruitment | P8 | ASSUMED |
| A11 | ~$3–8 credit per disciplined session | Rough experience | Budget exhaustion before launch | Track spend per phase in STATUS | Every phase | ASSUMED |
| A12 | Ad-block / ITP loss stays below ~30% of visitors for the target audience | Varies by audience (developer audiences block more) | Coverage too low → first-party proxy needed earlier | Compare tracker hits vs server logs on dogfood site | P2/P8 | OPEN |
| A13 | Better Auth remains maintained and MIT after the Vercel acquisition | Public statements (Jul 2026) | Migration to another library | Watch releases | P3 | LIKELY |
| A14 | Barış can do infrastructure steps (DNS, VPS, storage accounts) promptly | Solo founder | Phase delays | — | P2 | ASSUMED |
| A15 | Resend free tier (100/day) suffices through beta | Beta scale | Upgrade or switch provider | Sending volume | P7 | LIKELY |

---

## 35. Risk register

| Risk | Likelihood | Impact | Mitigation | Detection | Owner phase |
|---|---|---|---|---|---|
| Attribution correctness bugs | M | H | Pure engine, table-driven tests, credit explanation UI, recompute CLI | Tests; founder reports; customer detail view | P1a |
| Identity failures (missing identify, split visitors) | H | H | Onboarding check for identify; `visitor_id` server path; parent-domain cookie; `Unattributed` bucket + coverage % | Coverage % metric | P1b/P4 |
| Privacy non-compliance | M | H | §8 design, consent mode, legal review before D, careful marketing | Legal review; complaints | P6/P9 |
| Tracker blocking (ad blockers, ITP) | H | M | Neutral paths, server-side revenue, coverage %, first-party proxy later | Coverage %, dogfood comparison | P2/P8 |
| Fake browser traffic | M | L–M | Browser can't create revenue; bot filter; limits; quotas | Drop counters, anomaly alerts | P6 |
| Duplicate revenue | M | H | Required `event_id`, idempotency, 409 on conflicts, concurrency tests | Tests; duplicate counters | P1a |
| Multi-currency misreporting | M | H | Never sum across currencies; per-currency UI; ISO exponent table | Tests | P1a/P5 |
| Tenant leakage | L–M | **H** | §9 defence in depth + CI attack tests | CI; code review | P3 |
| VPS failure | M | H | Off-VPS encrypted backups; DR drill; IaC-lite (compose + scripts in Git) | Uptime alerts | P2/P7 |
| Backup failure / unrestorable | M | H | Dead-man checks, size checks, restore-check, drills | Healthchecks alerts, `job_runs` | P7 |
| Founder operational load | M | M | No extra infrastructure, alerts only on actionable events, runbooks | Barış's time log | P7 |
| GitHub access issue (App authorization) | H (current) | M | Local commits allowed; fix auth + rename before P0 (U14) | Push failures | Before P0 |
| Claude Code credit waste | M | M | Small phases, briefs, `/clear`, STATUS handoffs, one check command | Spend per phase in STATUS | Every phase |
| Scope creep | H | H | Non-goals list, scope-exception protocol, cut lines | Plan review each phase | Every phase |
| Onboarding friction | M | H | Live checklist, prefilled test commands, timed runs | Timed onboarding, beta | P4/P8 |
| Incorrect MRR | — (removed) | H | MRR not shown until the §10.4 contract exists | — | F |
| Integration difficulty (payment providers) | M | M | Provider recipes; `visitor_id` via checkout metadata; native integrations only on demand | Beta feedback | P8 |
| Framework churn (Next.js) | M | L–M | Minimal feature use, pinned versions, LTS track | Upgrade PRs | Ongoing |

---

## 36. Research log (targeted, 2026-09-28)

| Source | Date accessed | Version / plan | Fact verified | Implication |
|---|---|---|---|---|
| nextjs.org/blog, endoflife.date/nextjs, nextjs.org/support-policy | 2026-09-28 | Next.js 16 (Active LTS since Oct 2025; 16.2.x/16.3.x current) | 16 is the current LTS line; 15 is in maintenance until Oct 2026 | Target Next.js 16 and pin the minor |
| better-auth.com/blog/authjs-joins-better-auth; GitHub nextauthjs discussion #13252 | 2026-09-28 | Auth.js → Better Auth team (Sep 2025); Better Auth joined Vercel (Jul 2026) | Auth.js is in maintenance mode (security fixes only); Better Auth is MIT and framework-agnostic | Prefer Better Auth; watch item A13 |
| postgresql.org (PostgreSQL 18 release notes) | 2026-09-28 | PG 18 (GA Sep 2025; 18.6 current as of Aug 2026) | Native `uuidv7()` | Time-ordered UUID PKs without extensions |
| EDPB Guidelines 2/2023 on Technical Scope of Art. 5(3) ePrivacy, v2 adopted Oct 2024 | 2026-09-28 | Final | Art. 5(3) is technology-neutral and covers localStorage and similar; "information" is broader than personal data | No "localStorage avoids consent" claims; consent mode needed |
| CNIL "Sheet n°16: Use analytics on your websites" | 2026-09-28 | Current | Audience-measurement exemption conditions include no cross-referencing with other processing (e.g. customer files), single-publisher scope, 13-month tracker life, 25-month data retention | OriginMetric's visitor→customer linking likely falls outside the exemption; retention defaults align with 13/25 months |
| KVKK "Çerez Uygulamaları Hakkında Rehber" (June 2022) + Turkish law-firm summaries | 2026-09-28 | 2022 guide | Non-essential cookies (analytics generally) need explicit consent, with narrow exemptions | Consent mode relevant for Turkish sites too; legal review item |
| Cloudflare WAF docs + plan comparisons | 2026-09-28 | Free plan | Free: 5 custom rules, 1 rate-limiting rule, Bot Fight Mode, free managed ruleset (not on by default) | Budget WAF rules carefully; in-app limits remain primary |
| resend.com docs/pricing | 2026-09-28 | Free plan | 3,000 emails/month, 100/day cap, 1 domain; sending pauses at the cap | Enough for beta password resets |
| lemonsqueezy.com/blog/2026-update + comparisons | 2026-09-28 | 2026 | Lemon Squeezy is moving to Stripe Managed Payments; new signups reportedly gated; Paddle 5% + $0.50 | Don't build own billing on Lemon Squeezy; Paddle/Polar shortlisted |

Not researched (deliberately deferred to their phases): exact current prices of B2/R2/UptimeRobot terms (verify at P2/P7), Paddle and Polar seller-country eligibility (verify at P8), KVKK cross-border transfer specifics (legal review).

---

## 37. GitHub / repository housekeeping

- **Naming mismatch:** the GitHub repo is `brsctncnbrk5/Olacak`; the canonical product is **OriginMetric**. **Recommendation (U14): rename the repository to `originmetric` before P0.** GitHub redirects the old URL, but CI badges, image names (GHCR), deploy scripts and every future Claude session prompt will use the new name, so renaming later costs more. Barış must do this (Settings → Repository name) and update the Claude Code environment/repo selection afterwards. **Claude will not rename it.**
- **Remote write access:** the GitHub App authorization for pushes is reported as unresolved. Fix this at the same time as the rename, because P0 needs CI on GitHub.
- **History:** commit `4b24e5c` (rejected v1) stays in history. The v1 file is removed from the working tree so no future session follows it. No history rewrite, no force push.

---

## 38. Plan self-audit

| Check | Result | Evidence |
|---|---|---|
| **Scope:** still a focused revenue-attribution product? | ✅ | One table answers the core question (§18); non-goals respected; the only near-exception (consent mode) is justified as core (§1) |
| **Simplicity:** can a solo founder operate it? | ✅ | 3 containers, cron, no queue/Redis; scripted deploy, backup, restore-check (§2, §15, §23) |
| **Vertical slice:** is the hypothesis proven early? | ✅ | Chain proven at P1b (≈ session 3–5, 1–2 weeks), deployed at P2 before any accounts or UI (§28) |
| **Attribution:** semantics explicit? | ✅ | Every scenario in §3.2 defined, including refunds, renewals, re-identification and multi-device |
| **Identity:** limitations acknowledged? | ✅ | §4.5, `Unattributed` bucket, coverage % |
| **Privacy:** cautious claims? | ✅ | §8 separates the engineering decisions from the questions that need legal review; no "no consent needed" claims; EDPB/CNIL/KVKK facts cited |
| **Security:** separate trust boundaries? | ✅ | §6 (browser: damage-limited, no revenue) vs §7 (server: secret keys, idempotency) |
| **Financial correctness:** currency/MRR/refunds safe? | ✅ | Integer minor units, no cross-currency sums, refunds as events, MRR removed with a designed contract (§10) |
| **Multi-tenancy:** leakage actively tested? | ✅ | CI-blocking attack suite + composite FKs + lint guard (§9, §26) |
| **Operations:** VPS failure recoverable? | ✅ | Encrypted off-VPS backups, restore-check, DR drills before C and D (§24) |
| **Cost:** true vs incremental distinguished? | ✅ | §31.1 separates sunk, incremental, post-beta and growth costs; §31.2 lists every approval-gated service |
| **Claude efficiency:** cheap `/clear` continuation? | ✅ | CLAUDE.md → STATUS → one plan section (§27); one-session phases |
| **Launch:** first paying user much smaller than a big analytics product? | ✅ | Cut line D = attribution table + onboarding + hardening + billing; no charts beyond 0–1, no MRR, no integrations, no FX (§29) |

**Revisions made during the self-audit:** (1) moved deployment (P2) *before* accounts so real-browser risks surface early; (2) removed MRR from every pre-F cut line; (3) added the `Unattributed` bucket and coverage % so "Direct" is never inflated; (4) added the self-referral exclusion list for payment-provider domains, without which checkout returns would corrupt attribution; (5) put post-acquisition link freezing into the attribution rules to limit identify forgery.

---

*End of MASTER DEVELOPMENT PLAN v2 — READY FOR USER REVIEW. Do not implement until Barış declares `APPROVED / LOCKED`.*

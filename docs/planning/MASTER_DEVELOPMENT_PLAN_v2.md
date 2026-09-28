# OriginMetric — MASTER DEVELOPMENT PLAN v2 — R1

| Field | Value |
|---|---|
| Plan | **MASTER DEVELOPMENT PLAN v2 — REVISION R1** |
| Status | **READY FOR USER REVIEW** — **NOT APPROVED**, not locked |
| Implementation | **NOT STARTED** — nothing in this plan may be implemented before Barış says `APPROVED / LOCKED` |
| Supersedes | MASTER DEVELOPMENT PLAN v1 (commit `4b24e5c`) — **REJECTED / SUPERSEDED**, not used as input |
| Date | 2026-09-28 (v2), 2026-09-28 (R1) |
| Owner | Barış (product owner, final decision maker) |

> This document is a plan, not a specification of finished work. Everything marked **RECOMMENDED** is a proposal. Decisions are classified in §33 (owner lock / recommended default / deferred). Nothing here is legal advice (§8).

**R1 changes (after ChatGPT technical review; architecture unchanged):**
1. **Privacy/security gate before real traffic:** consent-aware tracker mode, GPC handling and consent withdrawal move into tracker v0 (P1b). Basic rate limits, an abuse ceiling and log redaction move to P2. Two explicit gates: **G1** (before real public traffic) and **G2** (before the first external user) (§28). P6 keeps only the advanced hardening.
2. **Identify trust model:** browser `identify` is **removed** from the MVP tracker. Visitor↔customer links are created **only** through secret-key server calls (new `POST /api/v1/identify`, or `visitor_id` on revenue events). Browser data can no longer change attribution (§4.4, §7.1b).
3. **Cloudflare Free:** exactly **one** rate-limit rule (`/api/v1/e`). Auth brute-force protection is in-app (§6, §20, §23).
4. **P0 dependencies:** only U0 + U13 (+ the pre-P0 transition). Auth (U1) stays at P3.
5. **Decisions triaged:** 3 owner locks, 6 recommended defaults, 10 deferred (§33).
6. **Research fixes:** Resend Free = 3 domains; review-validated facts recorded (§36).
7. **Pre-P0 plan-lock → `main` → P0 workflow** documented (§28), plus rename verification (§37).

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
33. User decisions (triaged: owner / default / deferred)
34. Assumptions register
35. Risk register
36. Research log
37. GitHub / repository housekeeping
38. Plan self-audit

---

## 0. Executive summary

**Question this plan answers:** How can one founder, with Claude Code and an existing VPS, build the smallest secure and commercially useful version of OriginMetric?

**Answer in one paragraph:** Build one TypeScript Next.js application backed by one PostgreSQL database, run with Docker Compose on the existing VPS behind Caddy and Cloudflare Free. Before any account system exists, prove the full attribution chain end to end in phase **P1**: test page → consent-aware tracker → session/source → server-side identify → server-side revenue event → attribution → internal result table. Then, once the minimum real-traffic safety gate (G1) passes, deploy that slice to the VPS and use it on a real site. After that, productize in small phases: accounts and tenancy, guided onboarding with live integration status, and a single "where did my revenue come from" table. Harden security, privacy and operations before inviting beta users. Add billing only when a real user is ready to pay.

**Core recommendations**

| Topic | Recommendation |
|---|---|
| Architecture | Modular monolith: Next.js 16 + TypeScript + PostgreSQL 18 + Drizzle, Docker Compose on the existing VPS, Caddy (TLS), Cloudflare Free in front. No Redis, queue, worker fleet or ClickHouse. |
| First vertical slice | **P1** (P1a + P1b), directly after the P0 foundation. Needs no auth, UI polish or deployment. |
| Attribution | Customer-level, **last non-direct touch** before acquisition, 90-day lookback. Renewals and refunds inherit the customer's source. "Unattributed" is shown separately from "Direct". |
| Identity | Random first-party visitor ID. Visitor↔customer links are created **only** by secret-key server calls: `POST /api/v1/identify` from the founder's signup/login handler, or `visitor_id` on revenue events. No browser `identify` in MVP. No fingerprinting. Limits stated openly. |
| Browser ingestion | Public site key, Origin allow-list, strict validation, dedup, in-app rate limits + abuse ceiling (before real traffic), bot filter (P6). **Browser data can never create revenue or customer links.** |
| Revenue API | Secret per-project keys stored hashed, required `event_id`, idempotent replay (same payload → 200, different payload → 409), integer minor units. |
| Tenancy | Application-level scoping through one tenant-scoped data layer, composite tenant foreign keys, automated cross-tenant attack tests. RLS deferred deliberately. |
| Money | `bigint` minor units + ISO 4217 code. Never sum across currencies. FX deferred. |
| MRR | **Not in the MVP dashboard.** Optional subscription fields are collected from day one so MRR can be added correctly later. |
| Auth | Better Auth (self-hosted, MIT), email + password. Owner decision deferred to P3 (U1). |
| Billing | Only at the "first paying user" cut line, through a merchant of record (Paddle or Polar). Owner decision deferred to P8/P9 (U9). |
| Privacy | Assume consent may be required for the visitor identifier in the EU/UK and Turkey. The consent-aware tracker mode ships in tracker v0 (P1b), **before** any real traffic. Sell privacy-by-design, never "no banner needed". |
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

**Customer-level acquisition attribution using last non-direct touch, 90-day lookback.** First-touch is computed and stored too, but shown only on the customer detail view in MVP. A dashboard toggle is post-validation (part of the U2 owner lock).

**Definitions**

- **Touch:** one session (§4.3) with its entry source: referrer host, UTM parameters, landing path.
- **Direct touch:** a session with no UTM parameters and no external referrer, *or* whose referrer is on the project's own domains / self-referral exclusion list.
- **Self-referral exclusion list:** the project's allowed domains plus a built-in list of payment and auth hosts (`checkout.paddle.com`, `*.lemonsqueezy.com`, `polar.sh`, `checkout.stripe.com`, `*.iyzipay.com`, `*.paytr.com`, `accounts.google.com` …). The founder can extend it. Without this list, a buyer returning from a checkout page would be credited to the payment provider.
- **Trusted link:** a visitor↔customer link created by a secret-key server call (`POST /api/v1/identify` or `visitor_id` on a revenue event, §4.4). It is the only kind of link that exists; browser data cannot create one.
- **Acquisition moment:** the earlier of (a) the first time a visitor is linked to the customer (trusted link), and (b) the customer's first `payment` revenue event.
- **Lookback window:** 90 days before the acquisition moment. Touches older than that are ignored.

**Explicit semantics**

| Scenario | Behaviour |
|---|---|
| First visit | A session is created. It stores the raw referrer host, normalized source, UTM source/medium/campaign/content/term and landing path. With no UTM and no external referrer, the source is `Direct`. |
| Returning visit | A new session starts after 30 minutes of inactivity, or immediately when the page is entered with a different campaign (new UTM set or new external referrer). Each session keeps its own source. Earlier sessions are never modified. |
| Direct return | Creates a direct session. **Direct never overwrites a prior non-direct source.** Last non-direct touch skips direct sessions. |
| Conversion (customer becomes known) | A trusted link is created by the founder's server (§4.4). Credit goes to the **latest non-direct touch** among all sessions of all visitors linked to the customer that started at or before the acquisition moment and within the lookback. If every touch is direct, credit goes to `Direct`. |
| First payment | Its revenue is credited to the customer's acquisition source. |
| Renewal / later payment | **Inherits the customer's acquisition source.** Later visits do not move existing customers' revenue. This keeps the question stable: "Which source acquired the customers who produce this revenue?" |
| Refund | A `refund` revenue event for the same customer, credited to the same source. It shows as refunds and reduces **net** revenue for that source in the period in which the refund *occurred*. The original payment is never mutated. |
| Customer re-identification (later server identify from a new visitor, e.g. login on another browser) | A new trusted link is recorded. If the new visitor has sessions from **before** the acquisition moment, attribution is recomputed (they are legitimate earlier touches, e.g. a second browser). Sessions *after* the acquisition moment never change attribution. |
| Customer with no linked visitor | **`Unattributed`**, a separate bucket. It usually means a missing server identify call, no consent given, an ad blocker, a different device, or revenue from before installation. The onboarding status (§19) highlights it. |
| Multiple devices | Linked only if the founder's server identifies the customer on each device (e.g. the server identify call in the login handler, and the customer logs in on both). Otherwise the second device's pre-purchase touches are invisible. **This is a known limitation.** |

**Source normalization (versioned, `rules_version`)**
1. If `utm_source` is present, source = its lowercased, trimmed value, mapped through a small alias table (`fb`, `facebook.com` → `facebook`). Medium and campaign are kept as given (trimmed, lowercased, length-capped).
2. Else, if the referrer host is external, source = a known-host mapping (`www.google.*` → `google`, `t.co` → `twitter`, `news.ycombinator.com` → `hacker news` …), else the registrable host (`example.org`).
3. Else, the source is `direct`.
4. Common click IDs (`gclid`, `fbclid`, `msclkid`) with no UTM set a *hint* (source `google`/`facebook`/`bing`, medium `paid (inferred)`). The click ID value itself is **not stored**.

**Why this is hard to misinterpret:** the dashboard labels the column "Acquired via (last non-direct touch, 90 days)". There is a one-line "How is this calculated?" explainer. Each customer row can be expanded to the exact touches that were considered. Unknowns are never folded into Direct.

**Known limitations, stated in the product:** attribution covers only visitors whose browser ran the tracker (with consent where required) and who were linked by the founder's server. Ad blockers, Safari/Firefox storage caps, consent refusals, cross-device journeys and offline sales all reduce coverage. The dashboard shows the **attribution coverage %** (the share of revenue from customers with at least one linked visitor).

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
| `visitor_id` | Tracker (`crypto.randomUUID()`) on first page view with storage permitted (after consent in required-consent mode) | First-party cookie `om_vid` on the founder's configured domain (fallback: `localStorage`) | Untrusted (browser). Readable by the founder's backend, which forwards it via the secret-key API |
| `session_id` | Tracker, per §4.3 | `sessionStorage`-independent: first-party cookie/localStorage entry `om_ses` = `{id, lastActivity, campaignKey}` | Untrusted |
| `customer_id` (external) | Founder's system (their user or customer ID) | Our `customers.external_id` | Accepted **only** from secret-key server calls (Revenue API, server identify). Never accepted from the browser (§4.4). |

### 4.2 Why a first-party cookie (with localStorage fallback)
- Founders commonly run a marketing site on `example.com` and the app/signup on `app.example.com`. `localStorage` is per-origin and would split one person into two visitors. A cookie set by JavaScript with `Domain=example.com` spans the subdomains. The tracker takes an optional `data-domain` for this.
- The tracker is loaded from OriginMetric's host but runs in the founder's page, so the cookie and storage are **first-party to the founder's site**. OriginMetric sets **no third-party cookies**, and the identifier is never shared across different founders' projects.
- Cookie attributes: `SameSite=Lax; Secure; Path=/; Max-Age` ≤ 13 months, not extended on each visit (U6, recommended default). Value: random UUID only.
- **This is not a privacy exemption** (§8). Browser storage of any kind is "storing information on terminal equipment".

### 4.3 Session resolution (in the tracker)
- A new session starts when (a) there is no stored session, (b) more than **30 minutes** have passed since the last activity, measured with the browser clock only as a *delta*, or (c) the page URL carries a UTM set or external referrer whose `campaignKey` differs from the current session's.
- Midnight does **not** split sessions.
- The server trusts the session ID only within a project and visitor. An event whose `session_id` already belongs to a different `visitor_id` is dropped.

### 4.4 Linking visitor → customer (trust model, R1)

**Problem (v2):** an unsigned browser `originmetric("identify", customerId)` could be sent by anyone who knows or guesses a customer's external ID. Before that customer's first trusted revenue event, the attacker could create a pre-acquisition link to their own visitor (with forged campaign touches) and **poison the customer's acquisition attribution**. "Use hard-to-guess IDs" does not close this: IDs leak (URLs, support tickets, invoices).

**Options compared**

| Option | Integrity | Founder effort (10–15 min target) | Verdict |
|---|---|---|---|
| A. Server-side `visitor_id` association is the authoritative path | High: only the secret key can link | One server-side call/field; the founder's backend reads the first-party `om_vid` cookie it already receives | **Adopted** (as the only link path) |
| B. Signed browser identify (`HMAC(secret, customer_id)` rendered into the page) | High | Server HMAC + template injection + tracker verification logic; about the same effort as A, more moving parts | Deferred to cut line F as an optional convenience |
| C. Unsigned browser identify as an untrusted hint, promoted only after server validation | High for attribution | Same server step as A is still needed to validate, so the browser hint adds code without adding coverage | Rejected (no benefit over A) |
| D. **Server-confirmed link** = A with a dedicated tiny `POST /api/v1/identify` so founders can link at signup/login without storing anything | High | One ~5-line server call in the signup/login handler, copy-paste snippets for Node/Python/PHP | **Selected** |

**Selected model (D):**

- **Browser identify is not part of the MVP tracker.** `originmetric("identify", …)` is an unknown command and is ignored. The browser can send page views only. **Browser data can never create, change or remove a visitor↔customer link, and can never create a customer.**
- **Trusted links are created only by secret-key server calls**, and a link is trusted from the moment it is created:
  1. **`POST /api/v1/identify` `{customer_id, visitor_id}` (default onboarding path, §7.1b):** called from the founder's signup and login handlers. The `visitor_id` comes from the first-party cookie `om_vid`, which the founder's backend already receives on its own domain (set `data-domain` when the app is on a subdomain), or from `originmetric.getVisitorId()` placed into a hidden signup-form field when the tracker fell back to localStorage. Method `server_identify`. The founder stores nothing.
  2. **`visitor_id` on `POST /api/v1/revenue-events`:** for founders whose checkout carries it (Paddle `custom_data`, Lemon Squeezy `custom`, Polar `metadata`) into their webhook handler. Method `revenue_api`.
- No `om_vid` (consent refused, blocked tracker, GPC) → the founder skips the call (or sends `visitor_id: null`, accepted as a no-op) → the customer is `Unattributed`. That is honest.
- **What can change attribution:** only (a) sessions of visitors that have a trusted link to the customer, started before the acquisition moment and within the lookback; (b) the customer's revenue events (acquisition moment); (c) the versioned rule set. Links created after the acquisition moment never move credit (§3.2).
- Every link records `method` and `linked_at`. `customer_id` values that look like emails are rejected (PII), not for integrity reasons.

**What an attacker can and cannot poison**

| Attacker | Can | Cannot |
|---|---|---|
| Anyone with the public site key (browser or script) | Create fake sessions/page views on their **own** random visitor IDs (bounded by §6 limits) | Create or change any link, create customers or revenue, attach touches to another customer, move an existing customer's credit, read anything |
| Someone who learns a specific victim's `visitor_id` (122-bit random, stored only in the victim's browser) | Inject fake touches onto that visitor before the victim's acquisition | — Mitigation: the ID is never put in URLs, logs or the dashboard in full; docs say "never put `om_vid` in URLs"; a session ID already bound to another visitor is dropped (§4.3) |
| A malicious end user of the founder's product (a real signup) | Tamper with their **own** `om_vid` before signing up, which skews **their own** customer's credited source | Affect any other customer. A paying customer who fakes their own source moves at most their own revenue; this is stated as a known limitation |
| Holder of a stolen secret key | Create links and fake revenue for that one project (T2) | Read data or touch other projects. Mitigated by §7.3 |

**Onboarding implications:** step 7 of §19 becomes "add one server call to your signup/login handler", with snippets and a live check ("first identify received ✅"). The integration is still two server touch-points (identify at signup/login, revenue event in the payment webhook) plus one script tag, which fits the 10–15 minute target for the developer audience (A2). Founders with no backend at signup can use the checkout-metadata path only.

### 4.5 Edge cases

| Case | Handling |
|---|---|
| Browser storage cleared | New visitor ID. The old visitor's history stays linked only if they were already identified. The next login re-links through the server identify call. |
| Safari ITP / Firefox ETP | Storage written by script may be capped at 7 days (and shorter under some link-decoration conditions). Long consideration cycles on Safari lose early touches. Documented. Mitigated by server identify at signup and login. |
| Consent withdrawn | The tracker clears `om_*` storage (§5). Existing links stay (they are the founder's processing); deletion requests go through §21. |
| Duplicate identities (one visitor → several customers, e.g. shared computer) | Allowed (many-to-many). Each customer's attribution uses the shared visitor's pre-acquisition sessions. This is flagged in the customer view. |
| One customer, many visitors | Allowed. Sessions are unioned (§3.2). |
| Customer logs in on a second device | Server identify in the login handler → trusted link → only pre-acquisition sessions on that device can affect attribution. |
| Founder's `customer_id` changes (e.g. merge) | Not supported in MVP. Documented: use a stable ID. |
| Fingerprinting / IP linking | **Never.** IPs are used transiently for rate limiting only and are not stored (§6, §22). |

---

## 5. Tracker design

**Guarantee: tracker failure must never break the founder's website.**

| Aspect | Decision |
|---|---|
| Language/build | TypeScript → esbuild → single IIFE, ES2017 target, zero runtime dependencies. Separate package folder, independently testable. |
| Size budget | **≤ 2.5 KB gzip** hard CI limit (target < 2 KB). |
| Loading | `<script defer src="https://<app-domain>/js/v1/om.js" data-site="pk_…" [data-domain="example.com"] [data-consent="required"] [data-gpc="ignore"]></script>` plus an optional 1-line queue stub, so `originmetric(...)` calls (e.g. `consent`) before load are buffered. |
| Execution | Everything wrapped in `try/catch`. No `document.write`, no sync XHR, no `eval`, no global other than `window.originmetric`. Unknown commands are ignored. Errors are swallowed (a debug flag logs them to the console). |
| Events | `pageview` only (automatic, including SPA navigation via `history.pushState` / `popstate` hooks, deduped per URL within 1 s). **No browser `identify`** (R1, §4.4); linking is server-side. No custom events in MVP. |
| Public API | `originmetric("consent", true \| false)` and `originmetric.getVisitorId()` (returns the visitor ID, or `null` before consent / when storage is unavailable). Nothing else. |
| Transport | `navigator.sendBeacon(url, new Blob([json], {type:"text/plain"}))`. Fallback: `fetch(url, {method:"POST", body, keepalive:true, credentials:"omit"})` with a `text/plain` body. `text/plain` avoids a CORS preflight. |
| Unload behaviour | No unload handlers are needed: page views are sent on load or navigation. |
| Batching | Not needed (≈1 request per page view). |
| Retries / offline | None (a lost page view is acceptable). No retry queue is stored in the browser. |
| Duplicate events | Every event carries a tracker-generated `event_id` (UUID). The server keeps a unique `(project_id, event_id)` and ignores duplicates. |
| UTM capture | Read from `location.search` on session start only: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, each capped at 200 chars. Other query parameters are **not sent**; the path is sent without the query string. |
| Referrer | `document.referrer` host only (no path or query), sent to the server, which normalizes it. |
| Metadata | Screen-width class (`mobile`/`tablet`/`desktop`) only. The server derives nothing else from the User-Agent except a bot flag. No language, timezone or plugin data. |
| Consent mode (**tracker v0, P1b**) | `data-consent="required"`: **zero storage and zero network requests** until `originmetric("consent", true)` (no cookie, no localStorage, no beacon, no fetch). Campaign info from the landing URL is held in memory only, so it survives until consent on that page. `consent(false)` (withdrawal) **deletes all `om_*` cookies (on the configured domain and the current host) and localStorage keys**, stops sending immediately, and keeps the tracker inert until a new `consent(true)`. Consent state itself is **not** stored by OriginMetric; the founder's CMP calls `consent()` on every page load. Default mode when the attribute is absent: `auto` (founder's responsibility, §8); the onboarding default is an owner decision (U7). |
| Do Not Track / GPC | Safe default in tracker v0: `navigator.globalPrivacyControl === true` is treated like consent not given (no storage, no sending), even after `consent(true)`. A founder can opt out with `data-gpc="ignore"`. DNT is ignored (deprecated signal). Final default confirmed by the owner under **U7**. |
| CSP | Founder adds `script-src https://<app-domain>` and `connect-src https://<app-domain>`. No inline script is required (the stub is optional; with strict CSP they skip it). Documented. |
| Versioning & cache | `/js/v1/om.js`: moving pointer within major v1, `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`. `/js/om-1.2.3.js`: immutable, 1-year cache, with an SRI hash published for founders who pin. |
| CDN | Cloudflare caches `/js/*` (free). No separate CDN. |
| Endpoint origin | MVP: OriginMetric's domain (third-party *host*, first-party *storage*). Post-validation: a documented optional **first-party proxy** (a founder's rewrite of `/om/*` to us) to reduce ad-block loss. |
| Ad blockers | Neutral names (`/js/v1/om.js`, `/api/v1/e`; no "analytics", "track" or "pixel"). The honest expectation is still that some users block it. Revenue is never lost because it is server-side; only its attribution becomes `Unattributed`. |
| Tests | Unit (vitest + jsdom): storage fallback, session rules, UTM parse, referrer, consent gating, consent withdrawal, GPC, `identify` ignored. Browser (Playwright): real Chromium on a fixture page, **required-consent page asserting zero cookies/localStorage and zero requests before consent**, withdrawal page asserting `om_*` state is cleared, GPC-on page, CSP-strict page, storage-disabled page, blocked-endpoint page (the site must keep working). Size check in CI. |

---

## 6. Public ingestion security (browser trust boundary)

**What cannot be trusted from browser JavaScript:** anything at all. The site key is public, the Origin header can be forged by non-browser clients, and every field is attacker-controllable. The design limits the **damage** instead of pretending to authenticate browsers.

| Control | Detail |
|---|---|
| Site key exposure | `pk_<random>` identifies a project. It is not a secret and grants only "submit browser events to this project". It can be rotated. |
| Origin validation | `Origin` (or `Referer` fallback) host must match the project's allowed domains (exact or `*.example.com`). Mismatch → 202 accepted and silently dropped (no oracle), counted in a per-project "rejected origin" metric that onboarding surfaces. Honest limitation: it stops casual cross-site misuse, not scripted forgery. |
| CORS | `Access-Control-Allow-Origin: <echoed allowed origin>`, no credentials, `POST` only. Using `text/plain` means no preflight. |
| Validation (P1b) | Strict schema (zod). Body ≤ 8 KB (checked before parsing; larger → dropped). Enumerated event types (`pageview` only). UUID formats. Length caps. Unknown fields rejected. URL path normalized. |
| Failure isolation (P1b) | The endpoint always answers `202` quickly for accepted *or* dropped events, never echoes input, and catches every error. A DB failure drops the event and is logged/counted; it never affects the founder's site (the tracker ignores responses). |
| Rate limits (**P2, before real traffic**) | In-process token buckets (single instance, so memory is fine): per IP-hash + site key (e.g. 60 events/min) and per project (e.g. 200 events/s burst). The client IP is taken from `CF-Connecting-IP`, trusted only because the origin firewall accepts Cloudflare IPs only (T19). Plus **the single Cloudflare Free rate-limiting rule**, reserved for `/api/v1/e` as an outer guard (restricted Free-plan parameters; exact options verified at P2). Numbers are tuned during P6. |
| Abuse ceiling (**P2**) | A process-wide cap on accepted browser events per second (e.g. 500/s) and a simple per-project daily hard cap (e.g. 200k events/day). Above either, events are dropped and counted, and `selfcheck` alerts. This protects the VPS and DB from a flood before quotas exist. |
| Bots (P6) | Drop known bot UAs (maintained list), `navigator.webdriver` flag from the tracker, and missing/implausible UAs. Record the drop count per project. |
| Quotas (P6) | Per-project monthly event counter (`usage_daily`: soft limit, alert, then drop above a hard cap). Replaces the P2 daily cap and later maps to plans. |
| Forged events: worst case | An attacker can inflate visitor/session counts or add fake touches to *their own* visitor IDs. They **cannot** create revenue, create customers, create or change visitor↔customer links, or read anything (§4.4). |
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

### 7.1b Server-side identify (R1)

`POST /api/v1/identify` — same `Authorization: Bearer om_sk_…` key, same auth, error envelope and rate limits as the Revenue API.

```json
{ "customer_id": "c2f1a7e0-…", "visitor_id": "0192f7a4-…" }
```

| Field | Rule |
|---|---|
| `customer_id` | Required. Same rules as §7.1 (non-PII, email-like values rejected). The customer is upserted (no revenue). |
| `visitor_id` | Required key; value is a UUID or `null`. `null` → `200 {"status":"skipped"}` (lets founders call it unconditionally when no cookie exists). |

Responses: `200 {"status":"linked"}` (new trusted link, attribution recomputed in the same transaction) · `200 {"status":"duplicate"}` (link already existed) · `401` / `422` / `429` as in §7.2. Idempotent by nature (the link's primary key). Method recorded: `server_identify`. This endpoint replaces v2's browser `identify` and adds no new infrastructure.

**Batch endpoint:** deferred. **Versioning:** `/api/v1/…` in the path. Additive changes don't bump the version; breaking changes mean `/v2` with ≥ 6 months of overlap.

### 7.3 Key security

| Control | Decision |
|---|---|
| Format | `om_sk_` + public 8-char prefix + 32 bytes of CSPRNG secret. The prefix makes keys greppable by GitHub secret scanning and lets the UI show "om_sk_ab12cd34…" without the secret. |
| Storage | Only `SHA-256(secret)` is stored. A slow hash is unnecessary because the secret has 256 bits of entropy. Lookup by prefix, then constant-time hash compare. |
| Display | Shown **once** at creation. Never logged (§22). |
| Rotation | Several active keys per project are allowed: create new → deploy → revoke old. |
| Revocation | `revoked_at`. Takes effect immediately (no cache). |
| Scope | One scope (`server:write`: revenue events + server identify) in MVP. Read or management scopes come only if a public read API is ever built. |
| Tracking | `last_used_at` (updated at most once a minute), shown in the UI to help founders find stale keys. |
| Brute force | Invalid-key attempts are rate-limited per IP-hash in the app (no Cloudflare rule is used here; the single Free rule is reserved for `/api/v1/e`). The key space makes guessing infeasible anyway. |
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
1. Store only a random visitor ID and session state on the device, and nothing at all before consent in required-consent mode. No fingerprinting and no cross-site identifiers.
2. Minimal collection: path without query, referrer host only, UTM fields, screen class. No raw IP, no full UA, no geolocation in MVP.
3. Reject PII-looking `customer_id` values (emails). Document "use opaque IDs".
4. A **consent mode** (`data-consent="required"`) plus a `consent(true/false)` API that works with any CMP, **shipped in tracker v0 (P1b) before any real traffic**. Withdrawal clears OriginMetric browser state. GPC honoured by default (safe default; owner confirms under U7).
5. Per-project data isolation. The same visitor on two founders' sites gets two unrelated IDs.
6. Retention limits with automated purge (§21).
7. Visitor and customer deletion by ID: via `ops` CLI before the first external user (gate G2), API before private beta, UI and CSV export before the first paying user (§21).
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
- **No FX conversion in MVP.** It needs a rate source, a rate-date policy (transaction date vs report date) and a caveat UI. Deferred to post-validation, and adding it would be an owner decision because a rate API may be paid.

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
| `events` (raw browser events) | Page views as received | project_id | UNIQUE (project_id, event_id); INDEX (project_id, received_at) | **Immutable** | Retention purge (U4); cascade |
| `sessions` (touches) | One row per session: entry source + counters | project_id | PK (project_id, id); INDEX (project_id, visitor_id, started_at); INDEX (project_id, started_at) | Entry-source fields immutable; `last_seen_at`, `pageviews` mutable | Retention purge; visitor deletion |
| `customers` | Founder's customer, keyed by external ID | project_id | PK (project_id, id); UNIQUE (project_id, external_id) | `external_id` nulled on deletion (tombstone) | Deletion API → tombstone |
| `customer_visitors` | Trusted identity links (created only by secret-key calls) | project_id | PK (project_id, customer_id, visitor_id); FK (project_id, customer_id); INDEX (project_id, visitor_id); CHECK `method IN ('server_identify','revenue_api')` | Immutable (`linked_at`, `method`) | Deleted with customer/visitor |
| `revenue_events` | Source-of-truth money facts | project_id | PK (project_id, id); UNIQUE (project_id, event_id); FK (project_id, customer_id); `refund_of_id` FK (project_id, id); CHECK amount > 0; INDEX (project_id, occurred_at); INDEX (project_id, customer_id) | **Immutable** (`payload_hash` stored for idempotency) | Kept on customer deletion (customer tombstoned, U8/legal); cascade with project |
| `customer_attribution` | **Derived**: credited touch per customer | project_id | PK (project_id, customer_id); INDEX (project_id, credited_source) | Recomputable, overwritten | Recomputed/deleted with customer |
| `job_runs` | Scheduled-job audit | none (ops) | INDEX (job, started_at) | Append | 90-day purge |
| `usage_daily` (added at P6) | Per-project event counts, for quotas (the P2 daily hard cap is an in-memory counter, not a table) | project_id | PK (project_id, day) | Counter | With project |

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
**Materialized per customer, recomputed synchronously** in the same transaction whenever an input for that customer changes: a new trusted link (server identify or revenue `visitor_id`), the first payment, or a new pre-acquisition session for an already-linked visitor. That is a bounded query (one customer's visitors' sessions in a 90-day window). A CLI `recompute --project <id> [--all]` rebuilds it when rules change (`rules_version` bump) or after bug fixes.

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
- **Brute-force protection is in the application:** Better Auth's built-in rate limiter on `/api/auth/*` (in-memory storage is fine for one instance), plus the app's per-IP-hash limiter on sign-in and password reset. **No Cloudflare rate-limit rule is used for auth**; the single Free rule is reserved for `/api/v1/e` (§6, §23).
- **Social login:** not needed (possible post-validation, e.g. GitHub).
- **2FA:** post-validation (Better Auth plugin available).
- **Email dependency:** P3 (internal) works without email: Barış creates accounts, and reset is by CLI. **Private beta (C) needs password reset email**, and **public launch (E) needs email verification.** → transactional email (§31, U3).
- **Owner decision, deferred to P3 (U1, §33 C).**

---

## 17. Billing

**When billing becomes necessary:** only at **cut line D (first paying user)**. Before that: internal → private beta (free, invite-only) → optional "founding member" offer, where a founder's willingness to pay can be tested with a checkout link before any in-app billing exists.

**Recommendation (U9): a merchant of record.** Merchant of record means the provider is the legal seller and handles global VAT/sales tax, which matters a lot for a solo founder selling globally.
- **Paddle:** 5% + $0.50 per transaction (standard Checkout), mature. Its general support documentation does not list Turkey among unsupported supplier countries, but **seller onboarding/KYC eligibility must still be verified** (A9) before OriginMetric depends on it. Verify during P8, not earlier.
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
| 3 | Copy tracker snippet (framework tabs: plain HTML, Next.js, WordPress). Choose **consent mode** ("my visitors need consent" → `data-consent="required"` + a one-line `consent()` hook for common CMPs); default per U7 | — |
| 4 | Install tracker | — |
| 5 | **Verify first event** | "Waiting for first page view from example.com…" polling (5 s). Shows origin-mismatch drops ("We received events from staging.example.com, which isn't in your domains. Add it?") and bot drops |
| 6 | Create the server API key (shown once; used for both server identify and revenue events) | Key exists |
| 7 | Add the **server identify call** to the signup/login handler: read the `om_vid` cookie, `POST /api/v1/identify` with the secret key (snippets for Node/Python/PHP; alternative: pass `visitor_id` through checkout metadata) | First server identify received ✅ |
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
| T3 | Brute force on login | Med | High | **In-app only:** Better Auth built-in rate limiter + app per-IP-hash limiter on sign-in/reset, generic errors. No Cloudflare rate-limit rule (Free allows one, reserved for `/api/v1/e`) | P3 |
| T4 | Tracker endpoint abuse / flood | Med | Med (VPS load, polluted counts) | **Before real traffic (G1, P1b/P2):** 8 KB bodies + schema, origin allow-list, dedup, in-app rate limits, abuse ceiling, the single Cloudflare Free rate-limit rule on `/api/v1/e`. **Later (P6):** quotas, bot heuristics, abuse reporting | P1b/P2 (basic), P6 (advanced) |
| T5 | Fake browser events | High | Low–Med | Can't create revenue or links; origin check; rate limits (P2); bot filter and per-project anomaly count (P6) | P1b/P2/P6 |
| T6 | Revenue or link forgery | Low (needs key) | Med | Server-only key; 409 on reused IDs | P1a |
| T7 | Replay | Med | Low | Idempotency: replay = duplicate 200 | P1 |
| T8 | XSS (stored, via UTM/referrer/customer IDs rendered in the dashboard) | Med | High (session theft) | React escaping, **no `dangerouslySetInnerHTML`**, strict CSP on the app, validation + length caps at ingest, tests with payloads | P1/P6 |
| T9 | CSRF | Low | Med | SameSite=Lax cookies, origin checks on mutations (Better Auth + Next server actions), no GET mutations | P3 |
| T10 | SQL injection | Low | High | Drizzle parameterization only; no string-built SQL (lint/grep rule for `sql.raw`) | P0+ |
| T11 | SSRF | Low | — | No server-side fetching of user URLs in MVP (no favicon or referrer fetching). Webhooks outbound: none | — |
| T12 | Malicious inputs (huge / unicode / control chars) | Med | Low | Body limits, schema, normalization, truncation | P1 |
| T13 | Log leakage | Med | Med | §22 redaction + tests (redaction test required by gate G1) | P2 |
| T14 | Backup leakage | Low | High | Encrypted with `age` before upload; private key offline; bucket private; scoped credentials | P7 |
| T15 | Admin access abuse / compromise | Low | High | No in-app superadmin in MVP (ops via SSH + CLI); SSH keys only; the internal page is disabled in production after P5 | P2/P7 |
| T16 | Secrets in Git | Med | High | `.env` git-ignored, `.env.example` only, gitleaks in CI, GitHub secret scanning | P0 |
| T17 | Public DB exposure | Low | **High** | DB port unpublished, firewall (ufw) allows 22/80/443 only; 80/443 restricted to Cloudflare IP ranges | P2 |
| T18 | Dependency compromise | Med | High | Lockfile, minimal deps, `npm audit` in CI, Renovate/Dependabot in batched weekly PRs | P0/P6 |
| T19 | Origin bypass of Cloudflare | Low | Med | Firewall allows only Cloudflare IPs on 80/443 (this is also what makes `CF-Connecting-IP` trustworthy for rate limiting) | P2 |
| T20 | Attribution poisoning via identity links (forged browser identify with a known/guessed customer ID) | Med (v2) → **eliminated (R1)** | High (core data integrity) | Browser identify removed; links only through secret-key server calls; post-acquisition links never move credit; residual risks listed in §4.4 (victim's own `visitor_id` leaked; a customer skewing only their own source) | P1a/P1b |
| T21 | Tracking before consent on a real site | Med | High (privacy/legal) | Required-consent mode with zero storage/sending before `consent(true)`, withdrawal clears state, GPC honoured (P1b); P2 dogfood rule and gates G1/G2 (§28) | P1b/P2 |
| T22 | Cloudflare edge quota misconfiguration (assuming more than one Free rate-limit rule) | Low | Med | Exactly one rule (`/api/v1/e`); every other limit is in-app; custom WAF rules (≤ 5) only for non-rate filtering | P2 |

---

## 21. Deletion, export & retention

### 21.1 Deletion & export (needed before cut line D unless marked)

| Operation | Behaviour | Cut line |
|---|---|---|
| Delete visitor (by `visitor_id`) | Deletes that visitor's events, sessions and links, then recomputes affected customers | B (`ops` CLI, run by Barış; gate G2) / C (API) / D (UI) |
| Delete customer (by `external_id`) | Deletes links and the attribution row; **tombstones** the customer (`external_id` → NULL, `deleted_at`); revenue rows remain as unlinked amounts (legal Q2; interim default until U8) | B (`ops` CLI; gate G2) / C (API) / D (UI) |
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
- **Enforcement:** pino `redact` paths + a central request logger that never logs bodies + a **unit test** that runs representative requests (including `/api/v1/e`, `/api/v1/identify`, `/api/v1/revenue-events`) and asserts no secret, customer ID, visitor ID or IP patterns appear in captured logs. The test is part of gate G1 (P2), before any real traffic.
- **Error reporting:** errors are logged with a stack and error class. User-supplied values in messages are truncated or omitted.

---

## 23. Deployment

**Recommended: Docker Compose on the existing VPS**

| Component | Choice |
|---|---|
| Services | `caddy` (reverse proxy, automatic Let's Encrypt TLS, security headers), `app` (Next.js standalone, Node 22 LTS or later, non-root user), `db` (postgres:18, named volume). Internal network; only Caddy publishes 80/443 |
| Edge | Cloudflare proxied DNS, SSL mode **Full (strict)**, cache rule for `/js/*`. **Rate limiting: exactly one rule on Free, used for `/api/v1/e`**; auth and the server APIs are rate-limited in the app (§7.3, §16). **Custom WAF rules (≤ 5 on Free), non-rate filtering only**, e.g. (1) block `/internal/*` in production, (2) allow only `POST`/`OPTIONS` on `/api/v1/e`. Bot Fight Mode evaluated (it can break legitimate beacons, so test first) |
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
| Off-VPS copy | Object storage via `rclone`: **Backblaze B2** or **Cloudflare R2** (both have ~10 GB free storage; R2 has no egress fees; either may require a payment method on file). **Owner decision at P2 (U11, §33 C)** |
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
| Identity & link trust | Server identify creates a trusted link (`method=server_identify`); duplicate identify → 200 duplicate; `visitor_id: null` → skipped; revenue `visitor_id` creates a `revenue_api` link; visitor → 2 customers; customer → 2 visitors; post-acquisition link doesn't change credit; email-like customer ID rejected | P1a |
| Identity poisoning (**R1, CI-blocking**) | A browser `identify` command sent by the tracker or by a script to `/api/v1/e` creates **no** link, customer or attribution change; an `/api/v1/e` payload with any customer field is rejected by the schema; `/api/v1/identify` without a valid key → 401; forged pre-acquisition touches on the attacker's own visitor never affect a victim customer; site key of project A cannot link in project B | P1a/P1b |
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
| Tracker | Size budget; storage disabled; cookie domain; **required-consent mode: zero cookies/localStorage and zero requests before `consent(true)`**; `consent(false)` clears all `om_*` state and stops sending; GPC on → nothing stored or sent, `data-gpc="ignore"` overrides; `identify` command ignored; SPA navigation; endpoint 500/blocked → page JS unaffected (test page asserts its own script still runs); CSP-strict page | P1b |
| Ingestion integration | Valid → stored; oversized → dropped before parsing; invalid schema → dropped; duplicate `event_id` → one row; wrong origin → dropped and counted; DB error → dropped, 202, no stack in response (P1b). Per-IP/site-key and per-project rate limits → dropped; abuse ceiling and daily cap → dropped and alerted; client IP taken from `CF-Connecting-IP` (P2, gate G1). Bot UA → dropped; quota → dropped (P6) | P1b/P2/P6 |
| DB constraints | Composite FK prevents cross-project references (direct SQL insert attempt); amount > 0 check; unique `event_id` | P1a |
| Migrations | All migrations apply to an empty DB in CI; the schema snapshot diff is clean | P0+ |
| **End-to-end vertical slice** | Playwright: open `fixtures/landing.html?utm_source=e2e&utm_campaign=slice` → `consent(true)` → navigate → read the visitor ID → `POST /api/v1/identify` for `cust_e2e` with the test key → POST revenue via HTTP → internal page shows `e2e / slice` with the amount | P1b (kept green forever) |
| Browser (product) | Sign-up → create project → onboarding checklist turns green with a fixture site → dashboard table | P4/P5 |
| Gates G1 / G2 | A checklist test script (`npm run gate:g1`) runs the consent, ingestion-limit, redaction and origin tests against the deployed build; G2 adds the tenant suite and a deletion CLI smoke test. Results recorded in STATUS | P2/P5 |
| Deletion / export | `ops` delete-visitor / delete-customer: sessions gone, attribution recomputed; tombstone, revenue retained unlinked (P5, gate G2). API + UI, export CSV columns, purge job respects the grace period (P6) | P5/P6 |
| Logging redaction | Captured logs contain no key, customer ID, visitor ID or IP patterns | P2 (gate G1) |
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

### Pre-P0 — PLAN-LOCK → P0 transition (workflow only; not performed yet)

The plan currently lives on the planning branch `claude/originmetric-master-plan-k5c3w5`. Coding must not start from that ambiguous branch. When (and only when) Barış declares `APPROVED / LOCKED`:

```
PLAN APPROVED / LOCKED  (Barış, explicitly)
        ↓
record the locked decisions (A-category + any others Barış locks) in docs/DECISIONS.md
        ↓
update docs/STATUS.md (plan: APPROVED / LOCKED; phase: P0 NOT STARTED; P0 blockers cleared)
        ↓
create the final PLAN-0 lock commit on the planning branch
        ↓
merge / establish the canonical planning state on main (Barış merges or approves the merge; no force push, no history rewrite)
        ↓
verify a clean remote: main contains the lock commit, working tree clean, remote URL correct (after any rename, §37)
        ↓
only then open the P0 implementation branch from main
```

If the repository rename (U14) happens, it is done and verified (§37) before the P0 branch is opened.

### Gates before real traffic (R1)

**G1 — Minimum real-traffic safety gate.** Required before OriginMetric processes any uncontrolled real visitor traffic (P2 go-live). All items are implemented and covered by passing tests:
1. Tracker required-consent mode: zero storage and zero sending before `consent(true)`; `consent(true/false)` API; withdrawal clears all `om_*` browser state (P1b).
2. GPC honoured by default, configurable with `data-gpc="ignore"` (safe behaviour pending U7) (P1b).
3. Ingestion: 8 KB body limit + strict schema, origin allow-list, `event_id` dedup, failure isolation (P1b).
4. In-app rate limits (IP-hash + site key, per project), process-wide abuse ceiling, per-project daily hard cap, the single Cloudflare Free rate-limit rule on `/api/v1/e` (P2).
5. Log-redaction test green (P2).
6. No browser path can create links, customers or revenue (P1a/P1b, identity-poisoning tests).

**P2 dogfood rule:** the dogfood site loads the tracker with `data-consent="required"` wired to a simple consent banner (or a CMP) that calls `consent()`. If that is not in place, P2 tracks only controlled/synthetic traffic (fixture pages, Barış's own visits) until it is. The tracker is never deployed in a mode that stores identifiers or sends analytics before required consent.

**G2 — First external user gate.** Required before any external founder is invited (P5):
1. G1 still green.
2. P3 tenant-isolation suite green (CI-blocking).
3. Onboarding explains and generates the consent-mode snippet; U7 (consent/GPC defaults) decided.
4. Visitor/customer deletion available via `ops` CLI (Barış runs it on request).
5. Barış confirms in writing with the founder that the founder is the controller and will use consent mode where it applies (interim arrangement; professional legal review remains required before cut line D).

Advanced items stay in P6: quotas, bot heuristics, abuse reporting, deletion API/UI, export UI, retention purge, CSP/security headers, broader hardening.

### P0 — Repository & dev foundation
- **Objective:** a runnable skeleton that every later phase builds on without rework.
- **Why now:** the vertical slice needs a DB, test harness and CI. Nothing more.
- **Scope:** Next.js 16 + TS strict; ESLint/Prettier; Drizzle + postgres driver; `docker-compose.dev.yml` (Postgres 18); migration workflow; Vitest with a real-DB test helper; Playwright config; `Clock` abstraction; pino logger skeleton; GitHub Actions CI (check + tests + gitleaks); `CLAUDE.md` rules + `npm run check`; `.env.example`; tracker package skeleton with esbuild + size check.
- **Out of scope:** auth, UI, any domain tables beyond an empty initial migration, deployment.
- **Dependencies:** U0 (plan `APPROVED / LOCKED`); U13 (core stack: Next.js 16 + Drizzle + PostgreSQL 18) locked; the pre-P0 transition completed (P0 branch opened from `main`). Recommended, not blocking: repo rename (U14) done and verified. CI on GitHub Actions is a recommended default (U18). **Auth (U1) is not needed until P3.**
- **Deliverables:** skeleton, CI green, README quickstart.
- **Automated tests:** sample unit test, DB connectivity integration test, migration-apply test.
- **Security check:** `.gitignore` covers `.env*`; gitleaks passes; no secrets in the compose files.
- **User review required?** No (unless deviating from locked decisions).
- **Exit criteria:** `npm run check` and the CI workflow pass on a clean clone; `docker compose -f docker-compose.dev.yml up` gives a working DB.
- **Expected status:** `P0 DONE`. **Est. 1 S.**

### P1a — Core domain: schema, attribution engine, Revenue API (headless)
- **Objective:** the money and attribution half of the chain, fully tested without a browser.
- **Why now:** it is the product's core logic and the highest correctness risk. It is pure, cheap to test, and independent of UI.
- **Scope:** migrations for `workspaces`, `projects`, `api_keys`, `events`, `sessions`, `customers`, `customer_visitors`, `revenue_events`, `customer_attribution` (with composite FKs); ISO 4217 table; source normalization; the pure `attribute()` function; materializer; `POST /api/v1/revenue-events` with key auth, validation, idempotency, refund rules; `POST /api/v1/identify` (server-side trusted link, §7.1b); CLI `ops create-project`, `ops create-key`, `ops recompute`.
- **Out of scope:** tracker, dashboard, user accounts.
- **Dependencies:** P0; U2 (attribution model) locked.
- **Deliverables:** working API callable with `curl`; seeded dev project via CLI.
- **Automated tests:** attribution table-driven suite, normalization, idempotency (incl. concurrency), refunds, renewals, currency, DB constraint tests, key tests, identity & link-trust tests (server identify).
- **Security check:** hashed keys only; 401 uniformity; no bodies in logs; parameterized SQL only.
- **User review required?** No.
- **Exit criteria:** all listed tests green; `curl` walkthrough in STATUS works.
- **Expected status:** `P1a DONE`. **Est. 1–2 S.**

### P1b — Tracker + ingestion + end-to-end proof ⭐ **FIRST END-TO-END VERTICAL SLICE**
- **Objective:** prove the complete chain: test page → consent-aware tracker → session/source stored → visitor linked by server identify → revenue event → attribution → internal result.
- **Why here:** it is the earliest point where every link of the chain can exist *without* waiting for accounts, onboarding or dashboards. Projects and keys come from the CLI, and the result page is protected by an env token. Because `project_id` tenancy and the real schema are used from P1a, **nothing in the slice is throwaway**: auth and UI later wrap it rather than replace it.
- **Scope:** tracker v0 (pageview, sessions, UTM, referrer, cookie/localStorage, `getVisitorId()`, sendBeacon, failure isolation, size budget, **required-consent mode, `consent(true/false)` with withdrawal clearing, GPC default**; no browser identify); `POST /api/v1/e` (site key, origin allow-list, 8 KB + schema, dedup, session upsert, attribution trigger for already-linked visitors, failure isolation; **no link creation**); static fixture pages (incl. required-consent and GPC pages); internal page `/internal/projects/[id]` behind `INTERNAL_TOKEN` (disabled when unset); Playwright e2e of the whole chain.
- **Out of scope:** rate limits and abuse ceiling (P2), bot filter and quotas (P6), accounts (P3), any styling.
- **Dependencies:** P1a.
- **Deliverables:** e2e test green in CI; `npm run demo` script that runs the slice locally.
- **Automated tests:** tracker unit + browser tests (incl. consent, withdrawal, GPC), ingestion integration tests, identity-poisoning tests, the e2e slice test.
- **Security check:** tracker never throws into the host page (test); nothing stored or sent before consent in required mode (test); ingestion drops wrong origins; the browser endpoint cannot create links (test); internal page is 404 without a token.
- **User review required?** **Yes.** Barış watches the demo and confirms the attribution semantics look right in practice.
- **Exit criteria:** e2e slice green; Barış confirms.
- **Expected status:** `VERTICAL SLICE PROVEN (local)`. **Est. 1–2 S.**

### P2 — Deploy the slice & dogfood on a real site
- **Objective:** the same slice running on the VPS under a real domain with Cloudflare, tracking one real website (Barış's own, or a landing page for OriginMetric itself).
- **Why now:** real browsers, ad blockers, CORS, Cloudflare and ITP behaviour are the next biggest unknowns. It is cheaper to find them now than after building UI.
- **Scope:** **minimum public-ingestion safety for G1**: in-app rate limits (IP-hash + site key, per project, `CF-Connecting-IP`), process-wide abuse ceiling, per-project daily hard cap, log-redaction test. Production compose (caddy/app/db); Cloudflare setup (the single Free rate-limit rule on `/api/v1/e`, ≤ 5 custom WAF rules for non-rate filtering); firewall; `deploy.sh` with health check + rollback; nightly encrypted backup to off-VPS storage (basic) + **one manual restore test**; uptime monitor; Healthchecks for the backup. Dogfood site set up per the **P2 dogfood rule** (required-consent mode + consent banner, or controlled traffic only).
- **Out of scope:** quotas, bot heuristics, abuse reporting (P6); automated restore-check, full alerting (P7); accounts.
- **Dependencies:** P1b; domain (U15); VPS access and specs (A3); backup storage (U11); Cloudflare (U17).
- **Deliverables:** gate **G1** passed and recorded in STATUS; tracker live on a real site in consent-aware mode; revenue test events sent from Barış's machine; internal page reachable by token.
- **Automated tests:** rate-limit/abuse-ceiling integration tests, log-redaction test, CI unchanged otherwise; a post-deploy smoke script (health, tracker asset, test event, consent-required page sends nothing before consent).
- **Security check:** G1 checklist; DB not reachable from the internet (external port scan); 80/443 limited to Cloudflare; `.env` perms; TLS Full (strict); exactly one Cloudflare rate-limit rule configured.
- **User review required?** **Yes** (infrastructure actions are Barış's: DNS, VPS, storage account, Cloudflare; Barış confirms the dogfood site's consent setup).
- **Exit criteria:** G1 green **before** the tracker goes live on the public site; real (consented) visits are attributed on production; one backup restored successfully by hand.
- **Expected status:** `SLICE LIVE (dogfood)`. **Est. 1–2 S** (+ Barış's hands-on time).

### P3 — Accounts, workspaces, projects, keys (tenancy)
- **Objective:** self-serve accounts with strict tenant isolation.
- **Why now:** it is required before any second person's data enters the system.
- **Scope:** Better Auth (email+password; admin-CLI password reset for now); workspace auto-created at sign-up; project CRUD (domains, TZ, primary currency, exclusions); site key display; API key create/rotate/revoke UI; tenant-scoped data layer + lint guard; 404-on-foreign policy.
- **Out of scope:** invites/teams, email flows, billing.
- **Dependencies:** P2 (or P1b if deployment is delayed); U1 (auth).
- **Automated tests:** tenant isolation attack suite (CI-blocking), authz, key UI flows, auth flows.
- **Security check:** cross-tenant tests; session cookie flags; CSRF/origin checks; brute-force limits on sign-in **in the app** (Better Auth limiter + per-IP-hash limiter; no Cloudflare rule).
- **User review required?** No (U1 is decided before this phase).
- **Exit criteria:** tenant suite green; two accounts can't see each other's anything.
- **Expected status:** `P3 DONE`. **Est. 1–2 S.**

### P4 — Onboarding & live integration status
- **Objective:** a founder integrates in 10–15 minutes without help.
- **Why now:** onboarding friction is the top validation risk after correctness.
- **Scope:** §19 checklist with live polling; snippet generator (HTML / Next.js / WordPress) with the consent-mode choice (default per U7); server-identify guide (Node/Python/PHP snippets reading `om_vid`); prefilled test `curl`; test-event handling (`test: true`, excluded from reports, deletable); integration health header; API docs page (`docs/api.md` rendered in the app).
- **Out of scope:** payment-provider recipes (P8), dashboard polish.
- **Dependencies:** P3; U7 (consent/GPC defaults) decided.
- **Automated tests:** Playwright: new user → checklist fully green against a fixture site.
- **Security check:** test events can't pollute live reports; docs show no real keys.
- **User review required?** **Yes.** Barış does a timed onboarding run on a fresh site (target ≤ 15 min).
- **Exit criteria:** timed run ≤ 15 min, or friction points logged and fixed.
- **Expected status:** `P4 DONE`. **Est. 1–2 S.**

### P5 — Beta dashboard ⭐ **FIRST REAL USER (cut line B)**
- **Objective:** answer "where did my revenue come from?" for one founder's real data.
- **Scope:** §18 beta dashboard: main table, campaign drill-down, currency handling, date ranges in project TZ, coverage %, customer list + customer detail with touch timeline and credit explanation. Disable the internal page in production. `ops delete-visitor` / `ops delete-customer` CLI (deletion logic moved forward from P6 for gate G2).
- **Out of scope:** charts, MRR, CSV export and deletion API/UI (P6).
- **Dependencies:** P4; gate **G2** passed before the invitation is sent.
- **Automated tests:** reporting query tests (time-base semantics, currency grouping, DST), Playwright table rendering, XSS payload rendering test, deletion CLI tests.
- **Security check:** all reporting through the scoped data layer; XSS tests; G2 checklist.
- **User review required?** **Yes.** Barış confirms G2 and approves inviting the first real user (a friendly founder, hand-held).
- **Exit criteria:** G2 recorded in STATUS; one external founder's real site (consent mode where applicable) + real revenue events show up correctly.
- **Expected status:** `FIRST REAL USER LIVE`. **Est. 1–2 S.**

### P6 — Security & privacy hardening
- **Objective:** safe to accept strangers' data (advanced hardening; the basics shipped in P1b/P2 under G1/G2).
- **Scope:** rate-limit tuning, bot filter, `usage_daily` quotas (replacing the P2 daily cap), abuse reporting (per-project drop/anomaly counters in the UI), security headers and CSP on the app, deletion APIs (visitor, customer) + UI, CSV export, project/account deletion with grace, retention purge job, dependency audit, threat-model walk-through (§20 checklist).
- **Dependencies:** P5; U4 (retention), U8 decided; U5 default applied unless overridden.
- **Automated tests:** §26 rows for bots/quotas, deletion/export, purge.
- **Security check:** the full §20 table is reviewed, and each row is marked done or accepted.
- **User review required?** **Yes** (retention numbers, revenue-on-deletion).
- **Exit criteria:** all §20 P6 items closed; tests green.
- **Expected status:** `P6 DONE`. **Est. 2 S.**

### P7 — Operations: backups verified, monitoring, email ⭐ **PRIVATE BETA READY (cut line C)**
- **Objective:** can Barış recover from VPS loss and know about failures before users do?
- **Scope:** `ops restore-check` weekly (or the manual monthly alternative), Healthchecks for all cron jobs, `selfcheck` (disk, ingestion drop, 5xx), uptime monitors, **full disaster-recovery drill** on a fresh machine, runbooks (deploy/rollback/restore/incident), transactional email (password reset) via the approved provider (U3).
- **Dependencies:** P6; U3 decided; U10 default applied unless overridden.
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
| **A. Earliest end-to-end proof** (end of P1b) | CLI-created project and key; tracker v0 (pageview, sessions, UTM, referrer, **required-consent mode, consent withdrawal, GPC default**); ingestion with 8 KB + schema, origin check, dedup, failure isolation; server identify + Revenue API with idempotency + refunds; attribution engine (last non-direct + first touch stored); internal token-protected result page; e2e test | Accounts, UI polish, deployment, rate limits (P2), browser identify, email, billing |
| **B. First real user** (end of P5, deployed since P2) | A + **gate G1** (in-app rate limits, abuse ceiling, daily cap, single Cloudflare rule, log redaction) + VPS production + basic encrypted backup + one manual restore; accounts & tenancy with leak tests; onboarding checklist with consent-mode snippet; beta dashboard (source table, campaign drill-down, currency split, customer detail); deletion via `ops` CLI; **gate G2** | Self-serve sign-up for strangers, email, billing, charts, export, quotas, bot filter |
| **C. Private beta** (end of P7) | B + rate-limit tuning, bot filter, quotas, abuse reporting, deletion APIs/UI, export, retention purge, security headers, verified restore + DR drill, monitoring/alerts, password-reset email, invite-only sign-up | Billing, public sign-up, native integrations, MRR, charts |
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

### 31.2 Paid / potentially paid services and external accounts

Approval column uses the §33 categories: **A** = owner lock now, **B** = recommended default (Claude proceeds at its phase unless Barış overrides; free tier only, never a paid tier or overage without explicit approval), **C** = deferred owner decision asked when its phase approaches. Any paid step always needs Barış's explicit approval (CLAUDE.md).

| Service | Purpose | Free alternative | MVP necessity | Expected cost | Lock-in | Replacement difficulty | Approval |
|---|---|---|---|---|---|---|---|
| Cloudflare | DNS, proxy, WAF, cache | Direct DNS + Caddy only | High (abuse protection, cache) | $0 (Free) | Low | Low | **C** (U17, at P2) |
| Backblaze B2 / Cloudflare R2 | Off-VPS backups | Second VPS / home NAS via rclone | **Required** before real data | $0 in the free range | Low (rclone) | Low | **C** (U11, at P2) |
| Resend (or existing SMTP) | Password reset, verification | Existing mailbox SMTP (deliverability risk), Brevo free | Required at C | $0 (free tier) | Low (SMTP-like API) | Low | **C** (U3, at P7) |
| UptimeRobot / Better Stack | Uptime alerts | Uptime Kuma self-hosted elsewhere | High at C | $0 | Low | Low | **B** (U12) |
| Healthchecks.io | Cron dead-man switch | Self-hosted Healthchecks | High at C | $0 | Low | Low | **B** (U12) |
| Sentry | Error tracking | Logs | Optional | $0 → $26 | Low–Med | Low | Later (owner, if ever) |
| Paddle / Polar | Product billing (merchant of record) | Manual invoicing | Required at D | % per transaction | Medium (subscriptions live there) | Medium | **C** (U9, end of P8) |
| GitHub Actions / GHCR | CI, image registry | Build on VPS; local checks | High | $0 within included minutes (no paid overage without approval) | Low | Low | **B** (U18) |
| Domain registrar | Product domain | — | Required at P2 | ~$10–15/yr | Low | Low | **C** (U15, at P2; paid) |
| FX rate API | Currency conversion | ECB reference rates (free) | **Not MVP** | $0–10 | Low | Low | Later |
| AI API | Optional premium summaries | — | **Not MVP** | Usage-based | Medium | Low | Later |

---

## 32. Technology decision matrix

Ratings: L = low, M = medium, H = high. Approval: A / B / C as defined in §33; "No" = routine implementation choice inside the locked stack.

| Decision | Recommended | Alternatives | Why | Dev cx | Ops cx | Security | MVP cost | Growth cost | Lock-in | Migration | Approval? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| App framework | **Next.js 16 (App Router, Node runtime, standalone)** | Hono+Vite SPA; SvelteKit; Remix/React Router 7; Laravel | One TS codebase, Claude-fluent, SSR dashboard + APIs, Docker-friendly | M | L | M (keep surface small) | $0 | $0 | L–M | M | **A (U13)** |
| API architecture | **REST route handlers, `/api/v1`, JSON, uniform error envelope** | tRPC (internal UI), GraphQL | Public APIs must be plain HTTP for any language; internal UI uses server components / server actions | L | L | H | $0 | $0 | L | L | No |
| DB access / ORM | **Drizzle + committed SQL migrations** | Prisma, Kysely, raw `postgres.js` | SQL-close, typed, light runtime, readable migrations | L | L | H (parameterized) | $0 | $0 | L | L | **A (U13)** |
| Database | **PostgreSQL 18 (self-hosted container)** | Managed PG (Neon/Supabase), SQLite | Relational integrity for money + tenancy; free on the VPS | L | M (backups are ours) | H | $0 | $0–VPS | L | L | **A (U13)** |
| Authentication | **Better Auth, email+password** | Auth.js v5, magic link, Clerk, hand-rolled | §16 | L–M | L | H | $0 | $0 | L | L | **C (U1, at P3)** |
| Public tracker ingestion | **In-app route handler, text/plain beacon, in-process limits + the single Cloudflare Free rate-limit rule** | Cloudflare Worker → queue; separate Go service | Simplest; volumes are tiny; can be split later | L | L | M (by design, §6) | $0 | $0 | L | L | No |
| Tracker build | **Vanilla TS + esbuild IIFE, size-checked** | Rollup, hand-written JS | Tiny, fast, typed | L | L | H | $0 | $0 | L | L | No |
| Job processing | **Host cron + CLI + advisory locks + Healthchecks** | pg-boss, BullMQ+Redis, systemd timers | No new infrastructure (§15) | L | L | H | $0 | $0 | L | L | No |
| Caching | **None in the app; Cloudflare for `/js/*`; PG query cache** | Redis | No measured need | L | L | H | $0 | $0 | L | L | No |
| Dashboard charts | **None until P10, then Recharts (or inline SVG)** | Chart.js, uPlot, Tremor | The table is the product; one chart later | L | L | H | $0 | $0 | L | L | No |
| UI components | **Tailwind + a few copied shadcn/ui-style components** | Mantine, plain CSS | Small, owned code | L | L | H | $0 | $0 | L | L | No |
| Transactional email | **Resend free** (or existing SMTP) | Brevo, Postmark, Amazon SES | Simple API, free tier fits beta | L | L | M | $0 | ~$20 | L | L | **C (U3, at P7)** |
| CI | **GitHub Actions, one workflow** | None (local only), self-hosted runner | Free within limits | L | L | H (gitleaks) | $0 | $0 | L | L | **B (U18)** |
| Deployment | **Docker Compose + deploy script + manual trigger** | Coolify/Dokploy, Kamal, bare systemd | Transparent, scriptable, no extra platform | L | M | H | $0 | $0 | L | L | No |
| Reverse proxy | **Caddy** | Nginx + certbot, Traefik | Automatic TLS, tiny config | L | L | H | $0 | $0 | L | L | No |
| Monitoring | **UptimeRobot/Better Stack free + Healthchecks free + selfcheck cron** | Uptime Kuma, Grafana stack | Minimal, free | L | L | M | $0 | $0 | L | L | **B (U12)** |
| Backups | **pg_dump + age + rclone → B2/R2, weekly restore-check** | WAL-G/pgBackRest PITR, VPS snapshots only | Simple and verifiable; PITR is overkill for MVP | L | M | H | $0 | $1–5 | L | L | **B (U10), C (U11)** |
| Product billing | **Paddle (or Polar), hosted checkout + webhook** | Lemon Squeezy, Stripe, iyzico, manual invoices | Merchant of record handles global VAT; Turkey seller support (verify) | L | L | H (no card data) | % fees | % fees | M | M | **C (U9)** |

---

## 33. User decisions (triaged in R1)

v2 listed 19 decisions (U0–U18) as if all needed Barış's pre-approval. R1 sorts them into three categories so Barış is asked only about product semantics, core stack, paid services, material privacy, retention, billing and high-lock-in choices. IDs are unchanged.

- **A. OWNER DECISION: lock at plan approval.** Barış must explicitly lock these.
- **B. RECOMMENDED DEFAULT.** Free, easily reversible, low lock-in, no meaningful product semantics. Claude implements the default when its phase arrives unless Barış overrides. It is recorded in STATUS when applied. Never enables a paid tier or overage.
- **C. DEFERRED OWNER DECISION.** Barış decides, but only when the phase approaches. Claude asks at the start of that phase, with the recommendation below.

**Genuine P0 blockers: U0 and U13 only.**

### A. Owner decisions: lock at plan approval (3)

| ID | Decision | Recommendation | Alternatives | Why it matters | Needed before |
|---|---|---|---|---|---|
| **U0** | Approve / revise this plan | Review → R1/R2 if needed → `APPROVED / LOCKED` | — | Nothing starts without it | **P0** |
| **U13** | Core stack lock (framework, ORM, DB) | Next.js 16 + Drizzle + PostgreSQL 18 | §32 alternatives | Everything builds on it; high lock-in | **P0** |
| **U2** | Attribution semantics | Customer-level last non-direct touch, 90-day lookback, first-touch stored, renewals/refunds inherit, Unattributed separate from Direct; **links only via secret-key server calls (§4.4, R1)** | First touch as primary; a user toggle from day one; signed browser identify | This is the product's core definition and data-integrity model | P1a (lock together with U0) |

### B. Recommended defaults: Claude implements at its phase unless Barış overrides (6)

| ID | Default | Phase | Guardrail |
|---|---|---|---|
| **U5** | Deletion grace period: 7 days for project/account | P6 | Barış may change the number before P6 |
| **U6** | Visitor cookie ≤ 13 months, not extended on visit; optional parent-domain scope via `data-domain` | P1b | Conservative privacy default; can be shortened later without harm |
| **U10** | Backups: nightly dumps (RPO ≤ 24 h); restore-check key model chosen at P7 between an automated weekly check (restore-only key on the VPS) and a monthly manual restore with the offline key; default = monthly manual | P2 (basic) / P7 | No PITR; no paid storage beyond the free range |
| **U12** | Monitoring: UptimeRobot (or Better Stack) free + Healthchecks.io free | P2/P7 | Free tiers only; Barış creates the accounts |
| **U14** | Rename repository `Olacak` → `originmetric` before P0 | Pre-P0 | **Barış's action** (Claude does not rename). Not a P0 blocker; if done, verify per §37 |
| **U18** | GitHub Actions for CI (+ GHCR images if the build moves off the VPS) | P0 | Within included free minutes only; no paid overage without Barış's approval |

### C. Deferred owner decisions: ask when the phase approaches (10)

| ID | Decision | Recommendation | Alternatives | Why it matters | Ask before |
|---|---|---|---|---|---|
| **U1** | Authentication approach | Better Auth, email+password, self-hosted | Magic link; Clerk; Auth.js | Security burden, vendor/lock-in, email dependency | P3 |
| **U11** | Off-VPS backup storage | Backblaze B2 or Cloudflare R2 free tier | Another VPS; home NAS | External account, may require a payment method | P2 |
| **U15** | Product domain | Register `originmetric.*` (availability unverified) | Subdomain of an existing domain for the beta | Paid; tracker URL and cookies are hard to change after founders install | P2 |
| **U17** | Cloudflare (Free) in front of the VPS | Yes | Direct | External dependency; abuse protection, TLS edge, caching | P2 |
| **U7** | Consent/GPC defaults (onboarding default mode; GPC default) | Onboarding default `data-consent="required"` for EU/UK/TR audiences; honour GPC by default. The tracker already ships this safe behaviour, so P1b/P2 are not blocked | `auto` default; ignore GPC | Material privacy posture vs coverage | P4 (and gate G2) |
| **U4** | Retention numbers | events 90 d, sessions 25 mo, cookie ≤ 13 mo, logs 14 d, backups ≤ 90 d | Shorter (privacy) / longer (history) | Privacy, cost, product usefulness | P6 |
| **U8** | Revenue retention on customer deletion | Tombstone customer, keep unlinked revenue (pending legal review) | Delete revenue rows too | Founders' financial totals vs erasure scope | P6 |
| **U3** | Transactional email provider | Resend free tier (or existing SMTP) | Brevo; SES | External account; needed for password reset at C | P7 |
| **U9** | Billing provider (merchant of record) | Paddle (verify seller KYC eligibility), Polar as backup | Lemon Squeezy; Stripe (entity-dependent); iyzico | Tax compliance, fees, lock-in | End of P8 |
| **U16** | Pricing & plan limits | Decide after P8 (e.g. flat tiers by events/month) | — | Billing configuration | P9 |

**Count after R1:** 3 owner locks (A) · 6 recommended defaults (B) · 10 deferred owner decisions (C) = 19.

---

## 34. Assumptions register

| ID | Assumption | Evidence | Impact if wrong | Validation method | Phase | Status |
|---|---|---|---|---|---|---|
| A1 | Founders will add one server-side identify call (signup/login handler) or pass `visitor_id` through checkout metadata | Similar products require a comparable step; target audience are developers | Most revenue `Unattributed`, product fails | Beta coverage % per project | P5/P8 | ASSUMED |
| A2 | Founders can call a REST endpoint from their payment webhook handler | Target audience are developers | Onboarding too hard; native integrations needed earlier | Timed onboarding; beta | P4/P8 | LIKELY |
| A3 | The existing VPS has enough headroom (≥ 2 GB RAM, ≥ 40 GB disk) and Barış has root | Brief says a VPS exists; specs unknown | Upgrade cost; build strategy changes | Barış provides specs | P2 | OPEN |
| A4 | MVP volume ≤ ~5M events/month total | Early beta size | Earlier partitioning / rollups | `usage_daily` | P8 | LIKELY |
| A5 | VPS location is known and acceptable for EU/TR data transfer analysis | Unknown | Legal work or a move | Barış confirms location | P2 | OPEN |
| A6 | Last non-direct touch is understood by founders without training | Common model in analytics tools | Confusion, mistrust | Beta interviews | P8 | LIKELY |
| A7 | Consent may be required for OriginMetric's identifier in the EU/UK/TR | EDPB 2/2023, CNIL exemption conditions, KVKK guidance | If not required: consent mode is extra but harmless | Professional review | Before D | LIKELY |
| A8 | Barış/the business is Turkey-based, so Stripe direct is unavailable and a merchant of record is needed | Name, KVKK/iyzico/PayTR mentions | Billing options change | Barış confirms | P9 | ASSUMED |
| A9 | Paddle (or Polar) accepts the seller's country/entity | Paddle's support docs do not list Turkey as unsupported (2026-09-28); seller onboarding/KYC not yet verified | Different provider | Seller onboarding/KYC attempt | P8 | OPEN |
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
| Identity failures (missing server identify, split visitors, consent refusals) | H | H | Onboarding live check for server identify; checkout-metadata `visitor_id` path; parent-domain cookie; `Unattributed` bucket + coverage % | Coverage % metric | P1a/P4 |
| Identity poisoning (forged links corrupting attribution) | L (after R1) | H | No browser identify; links only via secret key; post-acquisition freeze; CI-blocking poisoning tests (§4.4, T20) | Tests; link `method` audit | P1a/P1b |
| Server-identify step raises onboarding friction | M | M | Copy-paste snippets reading `om_vid`, live check, checkout-metadata alternative; signed identify kept as an F option | Timed onboarding run (P4), beta | P4/P8 |
| Privacy non-compliance (incl. tracking real visitors before consent) | M | H | Consent mode in tracker v0; gates G1 (before real traffic) and G2 (before the first external user); P2 dogfood rule; legal review before D; careful marketing | G1/G2 checklists; legal review; complaints | P1b/P2/P5/P9 |
| Tracker blocking (ad blockers, ITP) | H | M | Neutral paths, server-side revenue, coverage %, first-party proxy later | Coverage %, dogfood comparison | P2/P8 |
| Fake browser traffic / flood | M | L–M | Browser can't create revenue or links; in-app limits + abuse ceiling + one Cloudflare rule (P2); bot filter and quotas (P6) | Drop counters, anomaly alerts | P2/P6 |
| Duplicate revenue | M | H | Required `event_id`, idempotency, 409 on conflicts, concurrency tests | Tests; duplicate counters | P1a |
| Multi-currency misreporting | M | H | Never sum across currencies; per-currency UI; ISO exponent table | Tests | P1a/P5 |
| Tenant leakage | L–M | **H** | §9 defence in depth + CI attack tests | CI; code review | P3 |
| VPS failure | M | H | Off-VPS encrypted backups; DR drill; IaC-lite (compose + scripts in Git) | Uptime alerts | P2/P7 |
| Backup failure / unrestorable | M | H | Dead-man checks, size checks, restore-check, drills | Healthchecks alerts, `job_runs` | P7 |
| Founder operational load | M | M | No extra infrastructure, alerts only on actionable events, runbooks | Barış's time log | P7 |
| GitHub access issue (App authorization) | L–M (push worked 2026-09-28) | M | Local commits allowed; re-verify access after rename (U14, §37 checklist) | Push failures | Before P0 |
| Starting code from an ambiguous planning branch | M | M | Pre-P0 transition: lock commit → canonical state on `main` → clean remote → P0 branch (§28) | STATUS check at P0 start | Pre-P0 |
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
| Cloudflare WAF docs + plan comparisons | 2026-09-28 (confirmed by review) | Free plan | Free: 5 custom WAF rules, **1 rate-limiting rule**, Bot Fight Mode, free managed ruleset (not on by default) | The one rate-limit rule is reserved for `/api/v1/e`; auth and server APIs are limited in the app (R1) |
| resend.com docs/pricing | 2026-09-28 (corrected in R1) | Free plan | $0/month, 3,000 emails/month, 100/day cap, **3 domains**; sending pauses at the cap | Enough for beta password resets. Not locked; email stays a P7 decision (U3) |
| lemonsqueezy.com/blog/2026-update + comparisons | 2026-09-28 | 2026 | Lemon Squeezy is moving to Stripe Managed Payments; new signups reportedly gated; Paddle 5% + $0.50 | Don't build own billing on Lemon Squeezy; Paddle/Polar shortlisted |
| ChatGPT independent technical review (R1 input) | 2026-09-28 | — | Confirmed: Next.js 16 is Active LTS; PostgreSQL 18.6 is current in the 18 line and PG 18 has native `uuidv7()`; Cloudflare Free = 5 custom WAF rules + 1 rate-limiting rule; GitHub Free private repos include 2,000 hosted-runner minutes/month; Paddle standard Checkout = 5% + $0.50 per transaction; Paddle support docs do not list Turkey among unsupported supplier countries | No architectural rework. Paid Actions overage stays off without Barış's approval. Paddle seller onboarding/KYC still verified at P8 (A9) |

Not researched (deliberately deferred to their phases): exact current prices of B2/R2/UptimeRobot terms (verify at P2/P7), exact Cloudflare Free rate-limit rule parameters (verify at P2), Paddle seller onboarding/KYC and Polar country eligibility (verify at P8), KVKK cross-border transfer specifics (legal review).

---

## 37. GitHub / repository housekeeping

- **Naming mismatch:** the GitHub repo is `brsctncnbrk5/Olacak`; the canonical product is **OriginMetric**. **Recommendation (U14): rename the repository to `originmetric` before P0.** GitHub redirects the old URL, but CI badges, image names (GHCR), deploy scripts and every future Claude session prompt will use the new name, so renaming later costs more. Barış must do this (Settings → Repository name) and update the Claude Code environment/repo selection afterwards. **Claude will not rename it.**
- **Remote write access:** it was reported as blocked by GitHub App authorization, but a push to `claude/originmetric-master-plan-k5c3w5` succeeded on 2026-09-28. Re-check it after any rename, because P0 needs CI on GitHub.
- **After the rename (Barış's action), verify before opening the P0 branch:**
  1. The new remote URL resolves (`git remote set-url origin …/originmetric.git`, then `git ls-remote origin`).
  2. Claude's GitHub access still works (Claude Code environment/repo selection updated; a test fetch and a push to the planning branch succeed).
  3. Branch refs are intact (`main` and `claude/originmetric-master-plan-k5c3w5` present with the same head SHAs as before the rename).
  4. Future CI and images use the new identity (workflow badges, GHCR image names, deploy scripts reference `originmetric`).
  5. A rename changes only the repository name. It never alters Git history: no rebase, no force push, no re-created repository.
- **History:** commit `4b24e5c` (rejected v1) stays in history. The v1 file is removed from the working tree so no future session follows it. No history rewrite, no force push.

---

## 38. Plan self-audit

| Check | Result | Evidence |
|---|---|---|
| **Scope:** still a focused revenue-attribution product? | ✅ | One table answers the core question (§18); non-goals respected; the only near-exception (consent mode) is justified as core (§1) |
| **Simplicity:** can a solo founder operate it? | ✅ | 3 containers, cron, no queue/Redis; scripted deploy, backup, restore-check (§2, §15, §23) |
| **Vertical slice:** is the hypothesis proven early? | ✅ | Chain proven at P1b (≈ session 3–5, 1–2 weeks), deployed at P2 (after gate G1) before any accounts or UI (§28) |
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

### R1 consistency audit (2026-09-28)

| Check | Result | Evidence |
|---|---|---|
| P2 cannot contradict the privacy assumptions (§8.1) | ✅ | Consent mode, withdrawal and GPC ship in tracker v0 (P1b); G1 and the P2 dogfood rule forbid pre-consent storage/sending on a real site (§5, §28) |
| First external user cannot precede the minimum consent/security support | ✅ | P5 depends on gate G2 (G1 + tenant suite + consent onboarding + U7 + CLI deletion + controller confirmation) (§28, §29 B) |
| Cloudflare uses no more than one Free rate-limit rule | ✅ | Only `/api/v1/e`; auth and server APIs are in-app (§6, §7.3, §16, §20 T3/T22, §23, §32) |
| `identify` trust semantics unambiguous | ✅ | No browser identify; trusted links only via secret key (`server_identify`, `revenue_api`); attacker table (§4.4, §7.1b, §12, T20) |
| P0 does not require U1 (auth) | ✅ | P0 depends on U0 + U13 + the pre-P0 transition only (§28 P0, §33) |
| STATUS lists only actual P0 blockers | ✅ | `docs/STATUS.md` lists U0 and U13 |
| Roadmap, cut lines and decision table agree | ✅ | Consent at A/P1b; limits + G1 at B/P2; G2 at B/P5; advanced items at C/P6; §33 "needed/ask before" phases match the phase dependencies |
| No rejected v1 content restored | ✅ | v1 is referenced only as rejected history (header, §37) |
| No implementation files exist | ✅ | Repository contains documentation only (`README.md`, `CLAUDE.md`, `docs/`) |
| No scope expansion | ✅ | No native integrations, MRR, FX, Redis, queues, ClickHouse, microservices, AI, new dashboard modules. The one new endpoint (`/api/v1/identify`) replaces browser identify and removes the browser retry queue |

---

*End of MASTER DEVELOPMENT PLAN v2 — R1 — READY FOR USER REVIEW — NOT APPROVED — IMPLEMENTATION NOT STARTED. Do not implement until Barış declares `APPROVED / LOCKED`.*

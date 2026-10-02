# OriginMetric — Project Status

> Single source of truth for "where are we". Read after `CLAUDE.md`, before anything else.

| Item | State |
|---|---|
| Current phase | **P2 — Deploy the slice & dogfood**: DOMAIN / HTTPS VERIFIED; G1 PENDING |
| P0 | **COMPLETE / ACCEPTED** (Barış + ChatGPT: APPROVE AS-IS, 2026-09-28) |
| P0-R1 | **COMPLETE / ACCEPTED** (PASS; no further revision) |
| Accepted P0 head | `b99a4a9e4ea56a29f47f29eb1f91916cdcecaaa4` — final CI: GitHub Actions run #4 **success** — https://github.com/brsctncnbrk5/originmetric/actions/runs/36399409364 |
| P1a | **COMPLETE / ACCEPTED** (Barış + ChatGPT technical review: APPROVE AS-IS) |
| P1b | **TECHNICALLY COMPLETE / PROCEEDING AUTHORIZED** (`codex/originmetric-p1b-vertical-slice`) |
| P2 | **DOMAIN / HTTPS VERIFIED — PUBLIC DATA ROUTES CLOSED; ACCEPTANCE PENDING** |
| P2 tested code head | `a8957d872dc2597d6b2d20203e9c62bebee732f4` — [CI run #46: success](https://github.com/brsctncnbrk5/originmetric/actions/runs/36934400786) |
| P1a code commit | `760362f` (CI-verified; the final P1a commit is the STATUS commit on top of it) |
| P1b code head | `9ce12b7672141d2d42f43992c5a766f3609f59c7` — CI run #38 **success** — https://github.com/brsctncnbrk5/originmetric/actions/runs/36911778514 |
| P1a base `main` | `03aaea9e9abf779c704b974909495a20189f6edf` |
| P1a implementation branch | `claude/originmetric-p1a-core` |
| P0 base commit | `1b7b1e2539b590614cf762aca1e7b47db3ac14d0` (`main`) |
| P0 implementation branch | `claude/originmetric-p0-foundation` (accepted; fast-forwarded into `main`) |
| Repository | `brsctncnbrk5/originmetric` (default branch `main`, public) |
| MASTER DEVELOPMENT PLAN v1 | **REJECTED / SUPERSEDED** (commit `4b24e5c`; Git history only; do not use) — D-000 |
| MASTER DEVELOPMENT PLAN v2 R1 | **APPROVED / LOCKED** (2026-09-28) — [`docs/planning/MASTER_DEVELOPMENT_PLAN_v2.md`](planning/MASTER_DEVELOPMENT_PLAN_v2.md) — D-001 |
| PLAN-0 | **COMPLETE** |
| Pre-P0 transition | **COMPLETE** (`main` = `1b7b1e2`, GitHub default branch = `main`, repo renamed and verified) |
| Locked owner decisions | **U0** (D-001) · **U13** core stack (D-002) · **U2** attribution + trusted-link model (D-003) |

## Next step

OriginMetric still runs image `b750a1b5262eb83d04810afc2c71c35678ecfbcc`; app/DB remain unpublished and Caddy stays on `127.0.0.1:8088`. The owner purchased `originmetric.app` and configured proxied apex/www DNS. A dedicated nginx site now serves HTTPS root/static assets, DB health and tracker; www redirects to the HTTPS apex. A Let's Encrypt certificate covers both hosts, expires 2026-12-30, and has a dedicated renewal cron. Existing nginx configuration files and tradebot processes were preserved. See [`P2 VPS installation report`](reports/P2_VPS_INSTALLATION_REPORT.md). Public event ingestion returns 202/drop at nginx; identify/revenue return 503; internal/fixture routes return 404. **G1 remains unpassed.** Owner must confirm Cloudflare Full (strict) and configure the single edge rate-limit rule. Before enabling data routes, replace the synthetic review proxy's fixed CF IP handling with validated real Cloudflare IP forwarding, complete scoped firewall/external IPv4/IPv6 checks, actual-domain consent/dogfood and real off-VPS backup/restore plus monitoring. **P3 must not start.**

GitHub push blocker **RESOLVED** (2026-10-02): the owner completed isolated gh login in `.runtime/github-auth`; authenticated account `brsctncnbrk5` has repository `push=true`. A command-scoped credential helper pushed normally to `codex/originmetric-p2-vps-preparation`; remote SHA matched local `26eac2cd67b200c9b23af6101dc94210272e24a1`, including installation commits `9a5ca4c` and `8e6ef88`. The global account, remote URL and local history were preserved. This documentation update records the resolution; P2 acceptance remains pending and P3 has not started.

**P1a clarification (from the P1a instruction, §3.2):** a late trusted link may reveal sessions from *before* the established acquisition moment; those may recompute attribution. Sessions after the acquisition moment never move acquisition credit.


**Accepted P1a review guardrails:**
- Stored session sources are normalized facts. If source-normalization rules later change and historical sessions must change too, use an explicit migration/rebuild/re-normalization strategy; current `ops recompute` only recomputes attribution from stored session facts.
- `test:true` revenue currently participates in acquisition semantics under the locked model. When test-data deletion/purge is implemented later, tests must prove that deleting test data cannot leave stale live attribution.

## P1b result (2026-10-01)

- Branch: `codex/originmetric-p1b-vertical-slice`, based on canonical `main` `a7969c09c525cf57bcd25d9970e2e52240d6b6b3`.
- Final technical code head: `9ce12b7672141d2d42f43992c5a766f3609f59c7`.
- CI: GitHub Actions run #38 — **success** — https://github.com/brsctncnbrk5/originmetric/actions/runs/36911778514
- Completion report: [`docs/reports/P1B_COMPLETION_REPORT.md`](reports/P1B_COMPLETION_REPORT.md).
- Tracker v0: automatic pageview + SPA navigation, 30-minute/campaign session rules, first-party visitor/session state, UTM/referrer/click-ID hints, `getVisitorId()`, required-consent mode, consent withdrawal clearing, GPC safe default, sendBeacon/fetch failure isolation, no browser identify.
- Public ingestion: `POST /api/v1/e` with public site-key resolution, allowed-origin/Referer fallback, strict 8 KB schema, event dedup, session upsert, already-linked attribution recompute, uniform 202/drop behaviour and no trusted-link creation.
- Fixtures/internal proof: consent/GPC/CSP/storage-disabled/blocked-endpoint fixtures and token-protected `/internal/projects/[id]`.
- Full vertical slice proven: consented Google visit → stored session/source → secret-key server identify → payment → `google / attributed` → internal result page.
- A real ingestion defect discovered by the new regression suite was fixed: an existing session's pageview update now uses the already-`FOR UPDATE`-locked row values rather than raw SQL fragments.

| Check | Result |
|---|---|
| Vitest: **333 passed / 0 failed**, 20 files | PASS |
| P1b ingestion integration tests: 7 | PASS |
| Tracker-core unit tests: 9 | PASS |
| Internal-token unit tests: 3 | PASS |
| Playwright: **10 passed / 0 failed** | PASS |
| Required consent: zero OriginMetric storage/network before consent; withdrawal clears state and stops sending | PASS |
| GPC safe default + explicit `data-gpc="ignore"` | PASS |
| Storage-disabled / blocked-endpoint host-page failure isolation | PASS |
| Strict CSP fixture | PASS |
| Browser identify/link poisoning prevention | PASS |
| SPA direct continuation + campaign split | PASS |
| Complete vertical-slice test | PASS |
| `npm run demo` exact command in CI | PASS |
| Tracker gzip: **2491 B / 2560 B** | PASS |
| lint / Prettier / typecheck / migrations / Next production build / gitleaks | PASS |

**Historical review gate (2026-10-01):** P1b was technically complete and awaiting Barış review; P2 had not started then. D-004 subsequently authorized P2 preparation and installation. This does not claim manual demo viewing or final P2 acceptance.

## P1a result (2026-09-28)

- Branch `claude/originmetric-p1a-core` from `main` `03aaea9e9abf779c704b974909495a20189f6edf`. Code commit `760362f`.
- CI: GitHub Actions run #7 — **success** — https://github.com/brsctncnbrk5/originmetric/actions/runs/36405850470

**Migrations** (forward-only; `0000_foundation.sql` unchanged):
- `0001_p1a_core_domain.sql` (Drizzle-generated): 9 tables `workspaces`, `projects`, `api_keys`, `events`, `sessions`, `customers`, `customer_visitors`, `revenue_events`, `customer_attribution`; `uuidv7()` IDs, `timestamptz`, BIGINT money, `project_id`-leading keys/indexes (only the §12 indexes), composite `(project_id, x_id)` FKs, CHECKs (amount > 0, currency/event_id/prefix/hash formats, link methods, types, statuses).
- `0002_p1a_integrity.sql` (hand-written, not expressible in Drizzle): UPDATE-forbidding triggers on `revenue_events`, `customer_visitors`, `events`; entry-source immutability trigger on `sessions` (only `last_seen_at`/`pageviews` may change); `customer_attribution` session pointers → `sessions(project_id, id)` `ON DELETE SET NULL (<pointer column>)` so copied source strings survive session purge.
- Not created: Better Auth tables, `workspace_members`, `usage_daily`, `job_runs`, billing/subscription/audit tables.
- Verified: empty DB → all apply; P0 DB → 0001/0002 apply (test); `db:check` clean; `drizzle-kit generate` → no changes.

**Implementation**
- ISO 4217: in-repo table (0/2/3/4-decimal exponents), exact decimal formatting via `Intl.NumberFormat` string input, per-currency sums only. No FX, no MRR.
- Source normalization (pure, `rules_version` 1): UTM (trim/lowercase/200-char cap/aliases) → click-ID presence hint (`gclid`/`fbclid`/`msclkid` → google/facebook/bing, `paid (inferred)`, value never an input) → external referrer (known hosts, else registrable domain via `tldts`) → `direct`. Self-referral = project domains and subdomains + built-in payment/auth list + project exclusions.
- Attribution engine `attribute(touches, facts, rules)`: pure; acquisition = min(first link, first payment); eligible = linked visitors' sessions in [acq − 90 d, acq] (inclusive); latest non-direct → `attributed`, all direct → `direct`, none → `unattributed`; ties by (started_at, session UUID). Materializer recomputes one customer inside the fact-changing transaction under a `FOR UPDATE` lock on the customer row.
- Server keys `om_sk_<8 base62>_<43 base62 = 32 CSPRNG bytes>`; stored prefix + SHA-256 hex only; `timingSafeEqual` (dummy compare on unknown prefix); one identical 401 for missing/malformed/unknown/wrong/revoked keys and keys of soft-deleted projects; `last_used_at` at most once per minute; multiple active keys; `revoked_at`.
- `POST /api/v1/identify`: `visitor_id: null` → `skipped` with no writes; else customer upsert + `server_identify` link + recompute in one transaction → `linked` / `duplicate`.
- `POST /api/v1/revenue-events`: strict Zod contract, 16 KB body cap, strict RFC 3339 parser, injected `Clock` bounds; `payload_hash` = SHA-256 of a fixed-shape canonical array of normalized values; unique `(project_id, event_id)` is the race authority (`ON CONFLICT DO NOTHING` → re-read → duplicate/409 with full rollback); refund rules under customer + original-payment row locks; `revenue_api` links.
- Logging: only route, method, status, duration, project_id, api_key_prefix, error_code, outcome; unexpected errors log class + SQLSTATE only. P0 redaction unchanged.
- `ops` CLI (`npm run ops -- …`, esbuild-bundled to `dist/ops.mjs`): `create-project`, `create-key` (secret printed once), `recompute --project <id> (--all | --customer <id>)`.

| Check | Result |
|---|---|
| Vitest: **314 passed / 0 failed**, 17 files (unit 199: engine 25, normalization 60, currency 31, revenue validation/time 52, key format 22, P0 9; real PostgreSQL 18.6 115: constraints 20, identify/401/tenancy 27, revenue/idempotency/refunds/renewals 36, materializer 6, keys 6, ops 10, logging 2, migrations 5, connectivity 3) | PASS |
| Concurrency: 8 identical revenue requests → 1×201 + 7×200, one row, one link; 6 same-`event_id`/different-customer → 1×201 + 5×409, no stray customers; 6 concurrent 300-unit refunds of a 1000 payment → 3×201 + 3×422, total 900 (repeated 6×, stable) | PASS |
| Cross-project DB tests (trusted link, revenue customer, refund_of, attribution row, session pointer, event→session) all fail with FK violations | PASS |
| `npm run check` (lint, format, typecheck, tests, tracker 112 B / 2560 B) | PASS |
| `npm run test:e2e` (Next.js build + Playwright: smoke + server API against the real build) | PASS |
| gitleaks v8.30.1 (full history) | PASS |
| curl walkthrough (below) | PASS |

**curl walkthrough** (live `next start`, key redacted): `ops create-project` → project + `pk_…`; `ops create-key` → `om_sk_5QjOH7Eu_<redacted>` (shown once). identify without key → `401 {"error":{"code":"unauthorized"}}`; identify → `200 linked`; again → `200 duplicate`; `visitor_id:null` → `200 skipped`; revenue `inv_2026_000123` → `201 created, attribution {source:null, status:"unattributed"}` (no tracker yet: correct); retry → `200 duplicate` (same id); amount changed → `409 idempotency_conflict`; email customer → `422 invalid_request field customer_id`; wrong secret → `401`; `ops recompute --all` → `1 customer unattributed`. Server logs contained no key, customer ID or visitor ID. Commands: README "Server API walkthrough".

**New dependencies** (exact pins, runtime): `zod` 4.6.5 (strict API schema validation, anticipated by the plan; already in the lockfile transitively); `tldts` 7.4.16 (+ `tldts-core` 7.4.16; Public Suffix List for registrable domains, zero other deps, bundled list, no network).

**Choices to review / warnings:**
- Session `source` is normalized at ingestion (P1b) and stored; recompute does not re-normalize old sessions, so a later change to project domains/exclusions affects new sessions only.
- Referrer medium is left `null` (plan defines none). Click IDs outrank an external referrer (UTM still wins).
- Self-referral matches the project domain *and all its subdomains*.
- Test payments (`test: true`) count toward the acquisition moment (plan literal); reporting will exclude them later.
- `customer_id` containing `@` is rejected (email-looking PII rule, deliberately broad); IDs are 1–128 printable ASCII without whitespace.
- `occurred_at` fractional seconds beyond milliseconds are truncated (stored precision); two payloads differing only below 1 ms are duplicates.
- Lookback = exactly 90 × 24 h before the acquisition moment, both bounds inclusive.
- Every payment triggers a (bounded, idempotent) recompute; refunds recompute only for a new customer or new link.
- `npm audit`: the 4 known moderate drizzle-kit/esbuild dev-only advisories remain (unchanged from P0).

## P0 result (2026-09-28)

**P0-R1 correction (2026-09-28):** PostgreSQL image `postgres:18.0-alpine` → `postgres:18.6-alpine` (current 18.x patch) in `docker-compose.dev.yml` and CI. Patch-level only: no schema, dependency or architecture change. Full local verification re-run on 18.6: PASS. Tests still assert server major 18 only. Code verified by CI at `9703358` (the final commit is the STATUS commit on top of it): GitHub Actions run #3 — **success** — https://github.com/brsctncnbrk5/originmetric/actions/runs/36399231624

- Code verified by CI at `581979f`; the final P0 commit is the STATUS commit on top of it (see `git log`).
- CI: GitHub Actions run #1 — **success** — https://github.com/brsctncnbrk5/originmetric/actions/runs/36395109290

| Check | Result |
|---|---|
| `npm ci` from lockfile (local clean clone + CI) | PASS |
| ESLint / Prettier check / `tsc --noEmit` (strict) | PASS |
| Vitest: 15 tests, 5 files (unit: clock, logger redaction, tracker budget; db: connectivity, migrations) | PASS |
| PostgreSQL 18 dev container healthcheck | PASS |
| Real-DB connectivity test (asserts server major = 18) | PASS |
| All migrations apply to a clean DB (test + `db:migrate` CLI) + `db:check` + no ungenerated schema diff | PASS |
| Tracker build (IIFE, ES2017) + gzip gate: **112 B** / 2560 B | PASS |
| Next.js production build | PASS |
| Playwright Chromium smoke | PASS |
| `npm run check` / `npm run test:e2e` | PASS |
| gitleaks v8.30.1 (full history, CI + local) | PASS |
| actionlint on the workflow | PASS |

**Pins:** Node 22 (`.nvmrc`; local 22.22.2) · npm 10 · Next.js 16.3.6 · React 19.3.0 · TypeScript 6.0.3 · ESLint 9.39.5 + eslint-config-next 16.3.6 · Prettier 3.9.9 · drizzle-orm 0.45.3 · drizzle-kit 0.31.11 · postgres (postgres.js) 3.4.9 · pino 10.3.1 · Vitest 5.0.2 · @playwright/test 1.63.0 · esbuild 0.28.2 · PostgreSQL 18.6 (image `postgres:18.6-alpine`) · gitleaks v8.30.1 (Docker image).

**Choices to review:**
- Baseline migration `drizzle/0000_foundation.sql` is a no-op (`SELECT 1`): it creates no tables and only proves the migrator records it in `drizzle.__drizzle_migrations`.
- DB tests create and drop a temporary database per test file on the server in `DATABASE_URL` (so the DB user needs `CREATEDB`; the dev/CI users are superusers).
- `.env` is loaded by `drizzle.config.ts` / `vitest.config.ts` with Node's built-in `process.loadEnvFile` (no dotenv dependency).
- TypeScript 6.0.3 instead of 7.x: typescript-eslint 8.70 supports `<6.1`. ESLint 9 instead of 10: eslint-config-next's React/import plugins don't declare ESLint 10 support.
- CI runs on `pull_request`, pushes to `main` and `claude/**`, and manual dispatch. One job, no matrix, no deployment. Public repo: standard runners are free.

**Warnings / limitations:**
- `npm audit`: 4 moderate advisories, all in drizzle-kit's dev-only transitive `@esbuild-kit/*` → old esbuild (GHSA-67mh-4wv8-2f99, esbuild dev-server). Not shipped at runtime and the esbuild dev server is not used. The only "fix" is a breaking drizzle-kit downgrade, so it was left as is. Recheck when drizzle-kit updates.
- Drizzle's postgres-js driver returns timestamps as strings on the raw `sql` client it wraps. P1a should use Drizzle column modes consistently.
- Locally, Playwright used the pre-installed Chromium via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. CI installs its matching Chromium.

## Phase log

| Phase | Status | Commit | Notes |
|---|---|---|---|
| PLAN-0 v1 | REJECTED | `4b24e5c` | Superseded |
| PLAN-0 v2 | SUPERSEDED BY R1 (same file) | `c2e2251` | Clean replan from first principles |
| PLAN-0 v2 R1 | REVIEWED (ChatGPT: PASS, no R2) | `facb60d` | Privacy/ingestion gates G1/G2, server-only identify, one Cloudflare rate-limit rule, P0 deps fixed, decisions triaged 3/6/10, Resend corrected, plan-lock workflow |
| PLAN-0 lock | **COMPLETE — APPROVED / LOCKED** | `cf4f87a` | U0, U13, U2 locked (D-001…D-003) |
| Pre-P0 transition | COMPLETE | `1b7b1e2` | Repo renamed to `originmetric`; `main` established as default branch |
| P0 | **COMPLETE / ACCEPTED** | `581979f` (+ STATUS commit) | CI run #1 green; branch `claude/originmetric-p0-foundation` |
| P0-R1 | **COMPLETE / ACCEPTED** | `9703358` (+ STATUS commit) | PostgreSQL image bumped to `postgres:18.6-alpine` |
| P0 acceptance | COMPLETE | `b99a4a9` (accepted head, CI run #4 green) | Barış + ChatGPT: APPROVE AS-IS; P0-R1 PASS; branch fast-forwarded into `main` |
| P1a | **COMPLETE / ACCEPTED** | `760362f` (+ reviewed STATUS head `4fbe69e`) | ChatGPT technical review: APPROVE AS-IS; final reviewed CI run #8 green |
| P1b | **TECHNICALLY COMPLETE / PROCEEDING AUTHORIZED** | `9ce12b7` | CI run #38 green; vertical slice + exact `npm run demo` green; D-004 authorizes proceeding |

## For a fresh Claude Code session

1. `CLAUDE.md` is loaded automatically. Follow its rules.
2. Read this file.
3. Read only the plan section(s) named in "Next step" (or the phase brief you were given).
4. Current task: **P2 VPS preparation**, authorized by Barış (D-004). Read the P2 preparation report and VPS installation runbook. Do not claim P2 live or start P3 without the required VPS evidence.

# OriginMetric

**Know where your revenue comes from.**

OriginMetric is a revenue-attribution micro-SaaS. It connects website traffic sources and campaigns to real revenue through a small tracker and a payment-provider-neutral Revenue API. It is built for indie and small SaaS founders, including those whose payments don't go through Stripe.

## Project status

- Canonical plan: **MASTER DEVELOPMENT PLAN v2 R1 — APPROVED / LOCKED** — see [`docs/STATUS.md`](docs/STATUS.md) for the current phase.
- P0 and P1a are accepted on `main`. P1b (tracker + browser ingestion + first local end-to-end slice) is technically complete. P2 VPS preparation is implemented and verified on `codex/originmetric-p2-vps-preparation`; actual VPS installation remains next. See [VPS installation guide](docs/runbooks/VPS_INSTALLATION.md) and [preparation report](docs/reports/P2_VPS_PREPARATION_REPORT.md).

## Start here

1. [`docs/STATUS.md`](docs/STATUS.md) — current state and next step.
2. [`docs/planning/MASTER_DEVELOPMENT_PLAN_v2.md`](docs/planning/MASTER_DEVELOPMENT_PLAN_v2.md) — the locked master plan.
3. [`docs/DECISIONS.md`](docs/DECISIONS.md) — locked decisions log.

## Local development quickstart

Requirements: Node.js 22 (`.nvmrc`), npm, Docker (with Compose).

```sh
npm ci                                            # install from the lockfile
cp .env.example .env                              # then replace the placeholder password (local only)
docker compose -f docker-compose.dev.yml up -d    # PostgreSQL 18 on 127.0.0.1:5432 (healthcheck)
npm run db:migrate                                # apply committed SQL migrations (drizzle/)
npm run dev                                       # http://localhost:3000 (smoke page)
```

Checks (every script exits non-zero on failure):

| Command | What it runs |
|---|---|
| `npm run check` | lint, format check, typecheck, unit + real-DB tests, tracker build + size gate |
| `npm run test:e2e` | Next.js production build, then Playwright (Chromium smoke + server API against `DATABASE_URL`) |
| `npm run test:unit` / `npm run test:db` | Vitest unit tests / tests against the real PostgreSQL in `DATABASE_URL` |
| `npm run ops -- <command>` | ops CLI (bundled to `dist/ops.mjs` with esbuild, then run with Node) |
| `npm run tracker:build` | builds `tracker/dist/om.js` + `public/js/v1/om.js` (IIFE, ES2017) and fails above 2.5 KB gzip |
| `npm run demo` | builds the app and runs the complete P1b Playwright vertical slice |

First Playwright run on a new machine: `npx playwright install chromium`.

DB tests create and drop their own temporary databases on the server in `DATABASE_URL`; nothing is mocked.

## Server API walkthrough (P1a, no browser)

With PostgreSQL running and migrations applied:

```sh
npm run ops -- create-project --name "Dev" --domain example.com \
  --timezone Europe/Istanbul --currency USD          # prints project_id + public site_key
npm run ops -- create-key --project <project_id>     # prints om_sk_… ONCE (only prefix + hash stored)
npm run dev                                          # or: npm run build && npm run start

KEY='om_sk_…'                                        # paste the printed key; never commit it
curl -s -X POST http://localhost:3000/api/v1/identify \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"customer_id":"cust_123","visitor_id":"0192f7a4-3b1c-7d2e-8f00-123456789abc"}'
# → 200 {"status":"linked"}   (again → {"status":"duplicate"}; visitor_id null → {"status":"skipped"})

EV='{"event_id":"inv_2026_000123","type":"payment","customer_id":"cust_123","amount":2900,
     "currency":"USD","occurred_at":"2026-09-28T08:00:00Z","billing_interval":"month"}'
curl -s -X POST http://localhost:3000/api/v1/revenue-events \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' -d "$EV"
# → 201 {"id":"…","event_id":"inv_2026_000123","status":"created",
#        "attribution":{"source":null,"status":"unattributed"}}
# same request again          → 200 … "status":"duplicate"
# same event_id, amount 3900  → 409 {"error":{"code":"idempotency_conflict",…}}
# missing/wrong/revoked key   → 401 {"error":{"code":"unauthorized"}}

npm run ops -- recompute --project <project_id> --all   # rebuild attribution from stored facts
```

The headless P1a walkthrough can still produce `unattributed` when no browser session exists. P1b adds the browser/session side of the chain.

## P1b local vertical-slice demo

With PostgreSQL running, migrations applied, and Playwright Chromium installed:

```sh
npm run demo
```

The demo proves the local chain with a real production build and real PostgreSQL:

```text
required-consent fixture
→ consent granted
→ pageview/session stored
→ Google source normalized
→ server identify creates trusted link
→ Revenue API records payment
→ attribution becomes google / attributed
→ token-protected internal result confirms it
```

The tracker is served from `/js/v1/om.js`; browser events go to `POST /api/v1/e`. Browser code cannot create customers or trusted visitor/customer links.

## Migrations

Migrations: edit `src/server/db/schema.ts`, run `npm run db:generate`, review and commit the SQL in `drizzle/`, then `npm run db:migrate`. `npm run db:check` validates migration consistency. Schema is never pushed automatically.

## Layout

```
src/app/            Next.js App Router (server APIs, browser ingestion, fixtures, internal proof page)
src/server/db/      Drizzle client, schema, migrator
src/server/attribution/  source normalization, pure attribute() engine, materializer
src/server/identity/     customers, trusted links, server identify
src/server/revenue/      Revenue API validation, idempotency, refunds
src/server/tenancy/      projects, server API keys
src/server/money/        in-repo ISO 4217 table, exact formatting
src/server/http/         secret-key API handlers, error envelope
src/server/ingestion/    public browser-event validation, origin gate, session/event persistence
src/server/ops/          ops CLI (create-project, create-key, recompute)
src/server/time/    Clock abstraction, strict RFC 3339 parser
src/server/logging/ pino logger (redaction)
drizzle/            committed SQL migrations (0002 is hand-written: triggers + SET NULL FKs)
tracker/            consent-aware browser tracker v0
scripts/            tracker build + size gate
tests/              unit, db (real PostgreSQL), e2e (Playwright)
```

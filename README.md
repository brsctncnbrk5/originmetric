# OriginMetric

**Know where your revenue comes from.**

OriginMetric is a revenue-attribution micro-SaaS. It connects website traffic sources and campaigns to real revenue through a small tracker and a payment-provider-neutral Revenue API. It is built for indie and small SaaS founders, including those whose payments don't go through Stripe.

## Project status

- Canonical plan: **MASTER DEVELOPMENT PLAN v2 R1 — APPROVED / LOCKED** — see [`docs/STATUS.md`](docs/STATUS.md) for the current phase.
- P0 (repository & dev foundation) provides the skeleton only. No product functionality exists yet.

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
| `npm run test:e2e` | Next.js production build, then the Playwright (Chromium) smoke test |
| `npm run test:unit` / `npm run test:db` | Vitest unit tests / tests against the real PostgreSQL in `DATABASE_URL` |
| `npm run tracker:build` | builds `tracker/dist/om.js` (IIFE, ES2017) and fails above 2.5 KB gzip |

First Playwright run on a new machine: `npx playwright install chromium`.

DB tests create and drop their own temporary databases on the server in `DATABASE_URL`; nothing is mocked.

Migrations: edit `src/server/db/schema.ts`, run `npm run db:generate`, review and commit the SQL in `drizzle/`, then `npm run db:migrate`. `npm run db:check` validates migration consistency. Schema is never pushed automatically.

## Layout

```
src/app/            Next.js App Router (smoke page only)
src/server/db/      Drizzle client, schema entry, migrator
src/server/time/    Clock abstraction
src/server/logging/ pino logger (redaction)
drizzle/            committed SQL migrations
tracker/            browser tracker source (skeleton)
scripts/            tracker build + size gate
tests/              unit, db (real PostgreSQL), e2e (Playwright)
```

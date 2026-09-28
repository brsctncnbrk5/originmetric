# OriginMetric — Project Status

> Single source of truth for "where are we". Read after `CLAUDE.md`, before anything else.

| Item | State |
|---|---|
| Current phase | **P1a — Core Domain** (schema, attribution engine, trusted identify, Revenue API) |
| P0 | **COMPLETE / ACCEPTED** (Barış + ChatGPT: APPROVE AS-IS, 2026-09-28) |
| P0-R1 | **COMPLETE / ACCEPTED** (PASS; no further revision) |
| Accepted P0 head | `b99a4a9e4ea56a29f47f29eb1f91916cdcecaaa4` — final CI: GitHub Actions run #4 **success** — https://github.com/brsctncnbrk5/originmetric/actions/runs/36399409364 |
| P1a | **IN PROGRESS** (started 2026-09-28 on its dedicated instruction) |
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

P1a — Core Domain is **in progress** on `claude/originmetric-p1a-core` (base `main` = `03aaea9`). Plan sections: §3, §4, §7, §9–§14, §20, §22, §26, §28 (P1a). P0 remains COMPLETE / ACCEPTED. P1b must not start.

**P1a clarification (from the P1a instruction, §3.2):** a late trusted link may reveal sessions from *before* the established acquisition moment; those may recompute attribution. Sessions after the acquisition moment never move acquisition credit.

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
| P1a | IN PROGRESS | — | Branch `claude/originmetric-p1a-core` from `main` `03aaea9` |

## For a fresh Claude Code session

1. `CLAUDE.md` is loaded automatically. Follow its rules.
2. Read this file.
3. Read only the plan section(s) named in "Next step" (or the phase brief you were given).
4. Do not implement anything unless this file shows a phase as in progress. Right now **P1a is in progress** (P0 accepted).

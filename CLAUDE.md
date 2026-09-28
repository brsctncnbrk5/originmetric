# CLAUDE.md — OriginMetric operating rules

Product: **OriginMetric**, a revenue attribution micro-SaaS. Repository: `brsctncnbrk5/originmetric`.
Roles: Barış = product owner and final decision maker; Claude Code = implementation agent; ChatGPT = review and briefs.

## Read order (keep context small)
1. `docs/STATUS.md`: current phase, plan status, next step. **Always read it first.**
2. `docs/planning/MASTER_DEVELOPMENT_PLAN_v2.md`: read only the section(s) the current phase needs.
3. `docs/DECISIONS.md`: locked decisions (these override the plan where they differ).

Never use `MASTER_DEVELOPMENT_PLAN_v1` (rejected; it exists only in Git history).

## Hard rules
- **No implementation unless STATUS.md says the plan is `APPROVED / LOCKED`** and a phase is in progress.
- Work on one phase (or sub-phase) per session. Stop at its exit criteria, update `docs/STATUS.md`, commit.
- No paid service or new external dependency without Barış's explicit approval (plan §31).
- No scope expansion. Propose a "SCOPE EXCEPTION" instead (plan §1).
- No AI APIs in the core product.
- Never commit secrets. Never log API keys, tokens, passwords, raw IPs or customer IDs.
- Money: integer minor units + ISO currency; never sum across currencies.
- Git: never force-push or rewrite history. Push only to the assigned branch.

## Checks
- `npm run check`: lint, format, typecheck, unit + real-DB tests, tracker size gate (needs PostgreSQL 18 from `docker-compose.dev.yml` and `.env`)
- `npm run test:e2e`: Next.js build + Playwright (Chromium)
- CI: `.github/workflows/ci.yml` (also runs gitleaks). Quickstart: `README.md`.

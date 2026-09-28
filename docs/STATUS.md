# OriginMetric — Project Status

> Single source of truth for "where are we". Read after `CLAUDE.md`, before anything else.

| Item | State |
|---|---|
| Current phase | **PLAN-0 CLEAN REPLAN** |
| MASTER DEVELOPMENT PLAN v1 | **REJECTED / SUPERSEDED** (commit `4b24e5c`; the file was removed from the working tree and stays in Git history only; do not use it) |
| MASTER DEVELOPMENT PLAN v2 | **READY FOR USER REVIEW** — [`docs/planning/MASTER_DEVELOPMENT_PLAN_v2.md`](planning/MASTER_DEVELOPMENT_PLAN_v2.md) |
| Plan locked? | **NO** |
| Implementation | **NOT STARTED.** No application code, schema, tracker or deployment exists |
| Remote push | Blocked by GitHub App authorization (unresolved). Local commits only |

## Next step

Barış + ChatGPT review MASTER DEVELOPMENT PLAN v2 → possible revision R1/R2 → Barış declares **APPROVED / LOCKED** → only then P0.

**Do not begin P0 or any implementation until Barış explicitly says `APPROVED / LOCKED`.**

## Decisions needed before P0 (see plan §33)

- U0: approve/revise the plan
- U2: attribution model (last non-direct touch, customer-level, 90-day lookback)
- U13: core stack (Next.js 16 + Drizzle + PostgreSQL 18)
- U18: GitHub Actions for CI
- U14 (recommended before P0): rename repo `Olacak` → `originmetric` and fix GitHub App push authorization

Other decisions (U1, U3–U12, U15–U17) block later phases only. See plan §33.

## Phase log

| Phase | Status | Commit | Notes |
|---|---|---|---|
| PLAN-0 v1 | REJECTED | `4b24e5c` | Superseded |
| PLAN-0 v2 | READY FOR USER REVIEW | (this commit) | Clean replan from first principles |

## For a fresh Claude Code session

1. `CLAUDE.md` is loaded automatically. Follow its rules.
2. Read this file.
3. Read only the plan section(s) named in "Next step" (or the phase brief you were given).
4. Do not implement anything unless this file shows the plan as `APPROVED / LOCKED` and a phase is marked as in progress.

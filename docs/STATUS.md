# OriginMetric — Project Status

> Single source of truth for "where are we". Read after `CLAUDE.md`, before anything else.

| Item | State |
|---|---|
| Current phase | **PLAN-0 v2 R1** (technical-review corrections applied) |
| MASTER DEVELOPMENT PLAN v1 | **REJECTED / SUPERSEDED** (commit `4b24e5c`; the file was removed from the working tree and stays in Git history only; do not use it) |
| MASTER DEVELOPMENT PLAN v2 | **REVISION R1 — READY FOR USER REVIEW — NOT APPROVED** — [`docs/planning/MASTER_DEVELOPMENT_PLAN_v2.md`](planning/MASTER_DEVELOPMENT_PLAN_v2.md) |
| Plan locked? | **NO** |
| Implementation | **NOT STARTED.** No application code, schema, tracker or deployment exists |
| Working branch | `claude/originmetric-master-plan-k5c3w5` (planning only; not merged to `main`) |

## Next step

Barış + ChatGPT review MASTER DEVELOPMENT PLAN v2 R1 → Barış declares **APPROVED / LOCKED** (or requests R2) → pre-P0 transition (plan §28: DECISIONS.md → STATUS → lock commit → canonical state on `main` → clean remote → P0 branch) → only then P0.

**Do not begin P0 or any implementation until Barış explicitly says `APPROVED / LOCKED`.**

## P0 blockers (only these)

- **U0:** approve/lock the plan
- **U13:** core stack (Next.js 16 + Drizzle + PostgreSQL 18)

Everything else is a recommended default or is asked when its phase approaches (plan §33). U2 (attribution semantics, incl. the R1 identify trust model) is an owner lock needed before P1a, not P0. The repo rename `Olacak` → `originmetric` (U14) is recommended before P0 but does not block it.

## Phase log

| Phase | Status | Commit | Notes |
|---|---|---|---|
| PLAN-0 v1 | REJECTED | `4b24e5c` | Superseded |
| PLAN-0 v2 | SUPERSEDED BY R1 (same file) | `c2e2251` | Clean replan from first principles |
| PLAN-0 v2 R1 | READY FOR USER REVIEW | (this commit) | Privacy/ingestion gates G1/G2, server-only identify, one Cloudflare rate-limit rule, P0 deps fixed, decisions triaged 3/6/10, Resend corrected, plan-lock workflow |

## For a fresh Claude Code session

1. `CLAUDE.md` is loaded automatically. Follow its rules.
2. Read this file.
3. Read only the plan section(s) named in "Next step" (or the phase brief you were given).
4. Do not implement anything unless this file shows the plan as `APPROVED / LOCKED` and a phase is marked as in progress.

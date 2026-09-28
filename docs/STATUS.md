# OriginMetric — Project Status

> Single source of truth for "where are we". Read after `CLAUDE.md`, before anything else.

| Item | State |
|---|---|
| Current phase | **P0 — Repository & Dev Foundation** |
| P0 | **IN PROGRESS** |
| Base commit | `1b7b1e2539b590614cf762aca1e7b47db3ac14d0` (`main`) |
| Implementation branch | `claude/originmetric-p0-foundation` (not merged to `main`) |
| Repository | `brsctncnbrk5/originmetric` (default branch `main`, public) |
| MASTER DEVELOPMENT PLAN v1 | **REJECTED / SUPERSEDED** (commit `4b24e5c`; Git history only; do not use) — D-000 |
| MASTER DEVELOPMENT PLAN v2 R1 | **APPROVED / LOCKED** (2026-09-28) — [`docs/planning/MASTER_DEVELOPMENT_PLAN_v2.md`](planning/MASTER_DEVELOPMENT_PLAN_v2.md) — D-001 |
| PLAN-0 | **COMPLETE** |
| Pre-P0 transition | **COMPLETE** (`main` = `1b7b1e2`, GitHub default branch = `main`, repo renamed and verified) |
| Locked owner decisions | **U0** (D-001) · **U13** core stack (D-002) · **U2** attribution + trusted-link model (D-003) |

## Next step

Finish P0 (plan §28 "P0"). Stop at its exit criteria. Do not start P1a.

## Phase log

| Phase | Status | Commit | Notes |
|---|---|---|---|
| PLAN-0 v1 | REJECTED | `4b24e5c` | Superseded |
| PLAN-0 v2 | SUPERSEDED BY R1 (same file) | `c2e2251` | Clean replan from first principles |
| PLAN-0 v2 R1 | REVIEWED (ChatGPT: PASS, no R2) | `facb60d` | Privacy/ingestion gates G1/G2, server-only identify, one Cloudflare rate-limit rule, P0 deps fixed, decisions triaged 3/6/10, Resend corrected, plan-lock workflow |
| PLAN-0 lock | **COMPLETE — APPROVED / LOCKED** | `cf4f87a` | U0, U13, U2 locked (D-001…D-003) |
| Pre-P0 transition | COMPLETE | `1b7b1e2` | Repo renamed to `originmetric`; `main` established as default branch |
| P0 | IN PROGRESS | — | Branch `claude/originmetric-p0-foundation` |

## For a fresh Claude Code session

1. `CLAUDE.md` is loaded automatically. Follow its rules.
2. Read this file.
3. Read only the plan section(s) named in "Next step" (or the phase brief you were given).
4. Do not implement anything unless this file shows a phase as in progress. Right now **P0 is in progress**.

# OriginMetric — Project Status

> Single source of truth for "where are we". Read after `CLAUDE.md`, before anything else.

| Item | State |
|---|---|
| Current phase | **PLAN-0 COMPLETE → pre-P0 repository transition** |
| MASTER DEVELOPMENT PLAN v1 | **REJECTED / SUPERSEDED** (commit `4b24e5c`; the file was removed from the working tree and stays in Git history only; do not use it) — D-000 |
| MASTER DEVELOPMENT PLAN v2 R1 | **APPROVED / LOCKED** (2026-09-28) — [`docs/planning/MASTER_DEVELOPMENT_PLAN_v2.md`](planning/MASTER_DEVELOPMENT_PLAN_v2.md) — D-001 (reviewed commit `facb60d`) |
| PLAN-0 | **COMPLETE** |
| Locked owner decisions | **U0** (D-001) · **U13** core stack (D-002) · **U2** attribution + trusted-link model (D-003) |
| Implementation | **NOT STARTED.** No application code, schema, tracker or deployment exists |
| P0 | **NOT STARTED** (blocked only by the pre-P0 transition) |
| Working branch | `claude/originmetric-master-plan-k5c3w5` (planning only; **not merged to `main`**) |

## Next step: pre-P0 repository transition (plan §28, §37)

1. ✅ Plan locked; decisions recorded (D-001…D-003); STATUS updated; plan-lock commit on the planning branch.
2. ✅ **Barış:** renamed the GitHub repository `Olacak` → `originmetric` (U14).
3. ✅ **Claude (2026-09-28):** verified per §37. Remote `https://github.com/brsctncnbrk5/originmetric.git`; fetch OK; push to the planning branch OK (dry run); planning branch head `cf4f87a` locally, on the remote and via the GitHub API (unchanged). **Finding:** the remote has **no `main` branch**; the only branch is the planning branch, and GitHub's default branch is set to it. Repo visibility: public.
4. ⏳ Establish the locked PLAN-0 state on `main`: create `main` from the planning branch head (Barış approves), then Barış sets `main` as the GitHub default branch (Settings → Branches). No force push, no history rewrite. Verify a clean remote.
5. ⏳ Only then open a separate P0 implementation branch from `main`.

**Do not begin P0 or any implementation until steps 2–5 are done and this file marks P0 as in progress.**

## P0 blockers

- ~~U0: approve/lock the plan~~ — locked (D-001)
- ~~U13: core stack~~ — locked (D-002)
- Pre-P0 transition (steps 2–5 above). The rename (U14) is recommended before P0 and the owner has chosen to do it first.

## Phase log

| Phase | Status | Commit | Notes |
|---|---|---|---|
| PLAN-0 v1 | REJECTED | `4b24e5c` | Superseded |
| PLAN-0 v2 | SUPERSEDED BY R1 (same file) | `c2e2251` | Clean replan from first principles |
| PLAN-0 v2 R1 | REVIEWED (ChatGPT: PASS, no R2) | `facb60d` | Privacy/ingestion gates G1/G2, server-only identify, one Cloudflare rate-limit rule, P0 deps fixed, decisions triaged 3/6/10, Resend corrected, plan-lock workflow |
| PLAN-0 lock | **COMPLETE — APPROVED / LOCKED** | (this commit) | U0, U13, U2 locked (D-001…D-003). Not merged to `main` pending the repo rename |

## For a fresh Claude Code session

1. `CLAUDE.md` is loaded automatically. Follow its rules.
2. Read this file.
3. Read only the plan section(s) named in "Next step" (or the phase brief you were given).
4. Do not implement anything unless this file shows a phase as in progress. Right now **no phase is in progress**; the pre-P0 transition must finish first.

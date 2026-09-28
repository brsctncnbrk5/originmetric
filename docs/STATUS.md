# OriginMetric — Project Status

**Read this file first in any new session, then `docs/planning/MASTER_DEVELOPMENT_PLAN_v1.md` for full context.**

## Current Phase

PLAN-0 — Master Planning / Architecture

## Plan Status

MASTER DEVELOPMENT PLAN v1 — READY FOR USER REVIEW (not approved, not locked)

## Product Implementation Status

NOT STARTED. No application code, schema, tracker, or deployment exists yet.

## What Exists in the Repository

- `docs/planning/MASTER_DEVELOPMENT_PLAN_v1.md` — the canonical planning document (architecture, domain model, attribution engine, security/privacy, roadmap, decision table, risk register, assumptions register).
- `docs/STATUS.md` — this file.
- `README.md` — project pointer.

## Next Step

Product owner (Barış) + ChatGPT review `MASTER_DEVELOPMENT_PLAN_v1.md`. Implementation (P0 — Repository & Project Bootstrap) must NOT begin until the plan is explicitly approved/locked by the product owner.

## Open Decisions Blocking Nothing Yet, But Unresolved

See "§15 User Decisions Required Before Implementation" in the master plan:
1. Auth approach (Auth.js + self-modeled tenancy recommended, vs. third-party auth SaaS)
2. Attribution semantics confirmation (30-min session boundary, direct-doesn't-overwrite-last-touch)
3. Data retention specifics (recommended defaults in §16, need sign-off)
4. Pricing/billing tiers (not needed until P8)
5. Domain/branding confirmation (needed by P11)

## For a Fresh Claude Code Session

1. Read this file.
2. Read `docs/planning/MASTER_DEVELOPMENT_PLAN_v1.md`.
3. Check `git log` for the latest commits.
4. Do not start implementation (P0) unless the product owner has explicitly said the plan is approved/locked.

# P3 — Accounts, workspaces, projects, keys (tenancy): independent foundation

Date: 2026-10-04. **P3 IN PROGRESS; independent foundation COMPLETE / tested.**
**P2 OPEN / acceptance pending; G1 PENDING.** Owner decision [D-010](../DECISIONS.md)
authorizes continued development without waiting for backup evidence and supersedes
previous “do not proceed to P3” instructions. It does not waive acceptance.

## Canonical scope and dependencies

Read the locked [canonical plan](../planning/MASTER_DEVELOPMENT_PLAN_v2.md),
§28 P3, §9 tenancy, §26 tests, §33 U1, current STATUS and latest P2 report.
The real phase is **Accounts, workspaces, projects, keys (tenancy)**, not recovery
or a dashboard phase. Scope remains Better Auth email/password and admin CLI reset;
auto-created workspace at signup; project CRUD (domains, timezone, primary currency,
exclusions); site key display; API key create/rotate/revoke UI; tenant-scoped data
layer and lint guard; 404-on-foreign policy. Invites/teams, email flows and billing
remain excluded. Exit stays tenant suite green and two accounts unable to see each
other's anything.

Dependencies are P2 (or P1b if deployment is delayed) and **U1 auth choice**.
P1b's proven schema/API/fixture chain supplies the existing technical foundation.
Missing scheduled backup, physical GPC, lifecycle and recovery evidence do not
technically prevent isolated source development. D-010 authorizes that sequencing
while preserving P2/G1 acceptance. U1 is explicitly still OPEN in the locked plan
and DECISIONS; its proposed Better Auth choice was presented to the owner. No auth
package, schema or external dependency was selected/installed without that decision.

## Completed independent work

- Added `AuthorizedProjectContext` and `forProject(ctx)` under `src/server/data`.
  Contexts are frozen, bound to their issuing database/project in a private WeakMap;
  copied/forged objects fail closed. Methods cannot accept a replacement project ID.
- Wrapped existing **operator-token** authorization in `authorizeInternalProject`.
  Invalid/absent credentials and malformed/unknown/deleted projects return one
  `ProjectNotFound` (404) result. `internalProjectData` rejects invalid access before
  constructing the DB pool. This is the existing operator boundary, **not user
  membership authorization**; an operator token intentionally has multi-project
  access. Server API keys are rejected at this boundary.
- Moved the existing internal project result page to the scoped read interface.
  It keeps its token protection, customer/source/status rows and composite-project
  attribution join. The page receives no raw client or query builder.
- Completed scoped project config update and soft delete primitives using existing
  domain/timezone/currency validation. Workspace ownership and site key are not
  caller-reassignable. Soft deletion invalidates subsequent operations and server
  key authentication; no analytics purge/grace flow is added.
- Completed scoped key metadata listing, create, revoke and atomic rotate primitives.
  Metadata excludes hash/secret. Create/rotate return the full random key once;
  existing hashed storage remains. Foreign/unknown/malformed key IDs yield the same
  404; rotation locks project/key in one transaction, giving one winner for concurrent
  rotations. These are server-side primitives, not new public routes or finished UI.
- Moved the pool/dependency construction boundary into `src/server/data`. ESLint
  rejects static runtime raw-client imports/reexports outside data/ops; erased type
  imports remain allowed. App code additionally cannot import DB schema, postgres
  or Drizzle query builders. Guard tests run through the existing CI-blocking lint
  and Vitest steps; no separate optional job was added.
- Added 10 real-DB scope/lifecycle attacks and 3 lint controls. Tests use two isolated
  workspace/project fixtures with identical child IDs, not production accounts.

## Validation and limits

- Final `npm run check`: **356 tests / 25 files PASS**, including **13 new tests**;
  lint, Prettier, TypeScript, tracker build/size **2491 B / 2560 B** PASS.
- Real PostgreSQL 18.6 ephemeral container, tmpfs storage and loopback-only random
  port; migrations applied to this disposable database only.
- Production build PASS; final Playwright **13/13 PASS (9.9 s)**.
  First browser attempt had 12 failures because expected Playwright Chromium 1243
  was absent, with 1 API test passing. Existing `/usr/bin/google-chrome` override
  then gave **13/13 PASS**. A final build/browser run covers the later access-before-
  pool control; no browser download or host package change was necessary.
- Gitleaks source/test scans PASS; final staged-diff scan/publication recorded below.
  An initial two-path `dir` invocation scanned the container root rather than the
  intended directories and produced traversal warnings/findings; it is not counted
  as a valid project scan. Repeated with one read-only mounted source path per run.
- Static import guard is not a sandbox: erased DB types and legacy injected service
  executors remain. Full API/site-key context consolidation and dashboard membership
  must be reviewed with the final P3 attack suite; this foundation cannot claim
  completed §9 defence or full P3 acceptance.

## Remaining P3 and P2 work

| Work | State / actual dependency |
| --- | --- |
| This scoped data/key/lint foundation | COMPLETE at operator/isolated fixture scope. |
| U1 auth selection | OPEN owner decision; blocks auth-specific implementation only. |
| Auth, password-reset CLI, signup workspace/membership | OPEN, depends on U1 and auth schema; existing dogfood workspace is not auto-assigned to a new user. |
| Membership-based `authorizeProject(user, projectId)` | OPEN; needs authenticated user and authoritative `workspace_members`, never caller-provided workspace IDs. |
| Account/project/key UI and auth/session/CSRF/brute-force flows | OPEN, depend on membership/auth; config/key backend primitives above ready. |
| Complete API/site-key contexts and all route/action attacks | OPEN; existing key/site-origin isolation regression retained, full P3 integration still required. |
| Two-account acceptance / full P3 DONE | NOT CLAIMED; no accounts created or production auth deployed. |
| Physical native GPC | OPEN / NOT PASSED; technical injected proof does not substitute. |
| Actual production revenue chain / populated encrypted phone restore | OPEN / NOT RUN; existing actual event/session and empty manual restore retained. |
| Scheduled backup / scheduled retention and freshness proof | OPEN, no new run audited or manufactured in this task; existing working timer unchanged. |
| Actual backup failure/missing-run delivery, independent dead-man, strict lifecycle | OPEN; no notification dispatch or new service. |
| Phone-independent recovery | DEFERRED; existing age identity/recipient preserved, not read/rotated/generated/transferred. |

No production deploy/restart, gate/window opening, customer/revenue write, backup
execution, scheduler change, retention deletion, auth credential change or paid
service. GPC/recovery evidence is still open and does not stop independent source
work. Conditional physical-GPC follow-up remains as documented in P2; no repeated
Chrome check or browser installation is requested.

**Next owner action:** decide U1 (proposed self-hosted Better Auth, email/password,
admin CLI reset until P7 email). No backup evidence or new general development
permission is required to continue independent work.


## Final protection and publication checks

Final production aggregate read: events/sessions/customers/links/revenue/attribution
**1/1/0/0/0/0**, matching the retained P2 baseline. During validation, exact
container IDs/start times/restart counts, production env and installed backup
unit/timer hashes, canonical plan hash, available nginx config hash and timer
active/enabled state matched the private protected baseline. The fixture container
was removed explicitly by its unique name; no shared prune. Age identity was not
read. Private checks/logs are under `.runtime/p3-development-20261004/`.
Final code checks are 356/25 and final rebuilt browser tests 13/13 PASS.
Commit/push on the assigned branch and remote SHA/clean-tree audit follow;
publication evidence is stored privately so the document need not embed its own SHA.
No full new remote CI success is inferred from local checks.

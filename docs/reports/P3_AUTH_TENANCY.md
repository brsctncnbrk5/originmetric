# P3 — Accounts, workspaces, projects, keys (tenancy)

2026-10-04. Implementation and isolated technical validation complete; **P3 IN
PROGRESS / acceptance OPEN**, **P2 OPEN / G1 PENDING**. No production deployment.
Owner [D-011](../DECISIONS.md) locks U1 to self-hosted Better Auth email/password,
defers corporate email purchase and permits independent development while evidence
stays open. Canonical §28 phase definitions and exit criteria remain unchanged.
Provider-independent email preparation is an explicit owner-requested addition;
U3 provider selection is still OPEN. No invites, teams, billing or P4/P5 features.

## Implemented

- Better Auth **1.7.7**, pinned, with the existing Next.js 16 / Drizzle /
  PostgreSQL 18 architecture. Separate credential/session/verification tables;
  library scrypt hashing, 12–128 character passwords, database-backed sessions,
  seven-day expiration and daily refresh. Cookie cache disabled so revocation is
  authoritative; HTTPS cookies Secure, HttpOnly, SameSite=Lax. Explicitly enable
  origin and CSRF checks even under tests.
- Signup automatically creates an owner workspace and membership through a DB
  trigger inside the user insertion transaction. Failure rolls back the account;
  existing operator/dogfood projects are never assigned to a new account.
- English signup/sign-in/sign-out, password reset request/completion and email
  verification controls; session listing, individual revocation and other-session
  revocation. Protected pages redirect logged-out users; HTTP data access fails
  closed. Full production auth configuration is required before activation.
- Membership comes from validated server sessions and authoritative
  `workspace_members`. Project listing/creation cannot accept workspace ownership
  from request input. Foreign/missing/malformed/non-member projects return identical
  404. Existing grants recheck membership for each operation.
- English project create/read/edit/soft-delete: allowed domains, timezone, primary
  currency, excluded referrers and public site key. English server-key create,
  atomic rotate and revoke; full key shown only in current client state, dismissible,
  never returned by metadata reads. Storage remains hash-only.
- `forProject(ctx)` now also wraps identify, revenue and browser ingestion. Contexts
  are privately registered, bound to resolved DB/project and capability. Server/site
  keys resolve inside the data layer; callers cannot replace the project. Browser
  grants cannot identify or write revenue, and neither ingress grant can read or
  mutate dashboard/key configuration. Existing origin, API-key and composite-FK
  isolation checks remain enforced. Legacy injected domain primitives remain internal
  building blocks for this layer, operator jobs and tests, not request entry points.
- Better Auth's built-in limiter plus bounded app per-client-hash limiter on
  sign-in/signup/reset/verification. Trusted Cloudflare ingress only when existing
  proxy mode is configured; local access uses a shared bucket. A process-salted
  opaque IPv6-shaped hash feeds the library limiter, and session hooks discard IP
  data. No raw IP is persisted/logged; no new edge rule. Single-instance in-memory
  limits reset on process restart, as allowed by canonical §16.
- Provider-independent `AuthEmailSender` contract, injected verification and reset
  callbacks. Token verification/tampering, reset expiry/replay, password change and
  old-session revocation tested with an in-memory recipient capture, not real mail.
  Production has **no sender**. Requests for reset/verification return **503** before
  invoking the library, for both known and unknown accounts. UI shows configuration
  failure, never a successful-send message. No provider account/service purchased.
- `npm run auth:recover`: local root/admin-only interactive TTY recovery. Rejects
  arguments and pipes; email prompted, password/confirmation entered without echo.
  No password command argument, env input, shell history or log; errors are generic.
  Transaction updates the credential and invalidates every session/reset token.
  This is a local recovery method, not an HTTP bypass or substitute for beta email.

## Validation

- `npm run check`: **372 tests / 27 files PASS**, including real PostgreSQL 18.6
  auth, tenant and key capability attacks, provider-independent token flows,
  membership revocation, cookie flags, library/app limits, origin checks and existing
  revenue/identify/site-origin/composite-FK regression suites. Lint, Prettier,
  TypeScript and tracker **2491 B / 2560 B** PASS.
- Next.js production build and Docker package build PASS (runtime user `node`;
  auth recovery bundle included). Host BuildKit plugin was unavailable, so the
  existing legacy Docker builder was used without installing host packages. Rebuilt Playwright **14/14 PASS**, including two browser
  accounts, English signup/project/key lifecycle, every foreign project mutation,
  foreign key mutations, hostile origin, missing email configuration and logout.
  Existing browser consent/ingestion/vertical-slice cases also PASS.
- `db:check` PASS; `drizzle-kit generate` reports no schema changes. Migrations apply
  to empty and upgraded isolated databases. New SQL and signup trigger were applied
  only to disposable loopback fixtures; production DB schema unchanged.
- Recovery bundle builds; noninteractive invocation fails closed. DB recovery tests
  prove session and pending reset-token invalidation. No real account password reset.
- Key UI disables mutations during writes and the subsequent server-list refresh;
  a browser regression found and corrected stale-key clicking after rotation.
- Compose forwards optional auth env values; the Docker package includes the
  administrator recovery bundle. Missing values preserve disabled auth.
- Initial browser invocation lacked Playwright's expected bundled Chromium; retried
  with the existing `/usr/bin/google-chrome`, with no browser installation. Earlier
  migration inventory ordering and test-mode origin configuration failures corrected;
  only final passing runs count as evidence.
- `npm audit` reports **9 development-tool findings (4 moderate / 5 high)** in the
  existing Drizzle/ESLint dependency chains, none in Better Auth's production chain.
  No force upgrade/downgrade of the locked stack was performed; tool maintenance
  remains open. Audit is separate from the requested secret scan.
- Final staged-source and Git-history gitleaks scans **PASS**; publication is recorded
  in the private `.runtime/p3-auth/` evidence folder. No remote CI success is inferred
  from local checks.

## Remaining acceptance / configuration

- **Transactional delivery OPEN**: U3 selection, real provider credentials, verified
  sending domain, actual receipt/delivery-failure evidence. Corporate mailbox package
  purchase is deferred and is not itself a technical dependency. Internal P3 permits
  local administrator recovery; private beta requires reset mail, public launch email
  verification. Verification is intentionally not mandatory for internal login yet.
- **P3 acceptance OPEN** pending deployment/configuration and actual acceptance;
  two-account isolation is proven in a disposable fixture, not production.
- **P2/G1 OPEN**: native physical GPC, actual production revenue-chain evidence,
  populated encrypted phone restore, scheduled backup/retention/freshness evidence,
  failure/missing-run notification delivery, independent dead-man and strict lifecycle
  gaps remain open. None were audited/closed by this auth task. Phone-independent
  recovery remains DEFERRED. Existing working schedule continues independently.
- No production rollout, data-gate opening, controlled-window reuse, notifications,
  real revenue writes or external purchases. Existing age identity/recipient and
  recovery credentials were not read, rotated or transferred. Production container
  IDs/start times/restart counts, env and backup units/timer, nginx and canonical plan
  hashes match the previous private baseline; timer remains active/enabled. Production
  counts remain **1 event / 1 session / 0 customer/link/revenue/attribution**.

## Setup and sources

Before an authorized rollout, configure a separate random `BETTER_AUTH_SECRET`
(at least 32 characters) and canonical `BETTER_AUTH_URL` in secure local env,
apply reviewed migrations and preserve the existing closed ingestion gates.
Do not reuse the operator token. No auth secret was generated for production here.
For administrator recovery use a secure local terminal with the authorized DB env:
`npm run auth:recover`, without arguments. In an authorized running deployment,
local root may use `docker exec -it -u 0 originmetric-app-1 node dist/recover-password.mjs`;
this is an administrator operation, never the app's normal runtime identity.
Never paste passwords/tokens into chat.

Implementation references: [official Next.js integration](https://better-auth.com/docs/integrations/next),
[official Drizzle adapter](https://better-auth.com/docs/adapters/drizzle),
[official email/password flows](https://better-auth.com/docs/authentication/email-password).
Installed pinned library types/source were also reviewed for CSRF, IP handling,
limiter behavior and session/reset invalidation. No plan file modification.

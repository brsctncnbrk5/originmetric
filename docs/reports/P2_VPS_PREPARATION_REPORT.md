# OriginMetric — P2 VPS preparation report

Date: 2026-10-02 (Europe/Istanbul)
Status: **PREPARATION COMPLETE / VERIFIED — VPS NOT DEPLOYED**
Branch: `codex/originmetric-p2-vps-preparation`
Base: P1b report head `1230645e4bfe9897dd953fdfba6e8d8943fd93d5`
Authorization: D-004, Barış's explicit instruction to finish VPS preparation and then install through Codex in `/opt/originmetric` under one tmux session.

## Implemented

- Browser ingestion process bucket 500/s; project 200/s; client+site bucket 60/min. Bounded maps fail closed at 20k client / 1k project state; idle expiration; private in-memory daily HMAC salt; raw IP never stored or logged.
- Persistent UTC per-project 200k accepted-event/day abuse ceiling. New additive migration `0003_p2_ingestion_budget`; atomic reservation in the event transaction; duplicates/conflicts roll back budget; restarts cannot reset it. This is not billing/quota scope.
- Proxy trust requires a private overwritten header before CF-Connecting-IP can be used; forged XFF ignored. Missing/malformed production trust drops events uniformly with 202. Public Caddy config additionally requires a real Cloudflare network peer.
- Streaming 8 KB reader stops unknown-length oversized bodies without allocating the entire request.
- DB query/lock timeouts, DB-backed `/api/health`, token-protected internal counters and conservative selfcheck.
- Next standalone Docker image, non-root app, bundled ops migrate command, no host Node build requirement.
- Production Compose: PostgreSQL 18.6, separate non-superuser app DB role, private DB network, no app/DB published ports, bounded logs, restart/health checks. Safe default Caddy bound to loopback only.
- Optional public TLS/Cloudflare peer-gated Caddy overlay with Origin CA certificate mounts; no automatic public publication or DNS/firewall mutation.
- Exact-SHA deploy, mandatory encrypted backup on updates, forward migrations, health/smoke, prior-image rollback attempt and post-rollback health, first-deploy failure stops app/proxy while preserving DB.
- Secret init (600, no output), preflight, read-only host audit, smoke, encrypted pg_dump → age → rclone, 7 daily/4 weekly/2 monthly retention in a dedicated remote prefix, Healthchecks pings.
- Offline-decrypted stdin restore check in a network-none/tmpfs disposable PG18 container; no private key/plaintext dump persisted on VPS; table/migration/count sanity checks.
- Turkish VPS/tmux/Codex handoff guide at `docs/runbooks/VPS_INSTALLATION.md`.
- CI production package proof: real image/migrations/Caddy/consent browser/API attribution, non-root and no app/DB publication, synthetic local remote encryption/restore, failing-upload check. No actual external storage account is opened.

## Validation

Tested code head: `a8957d872dc2597d6b2d20203e9c62bebee732f4`.
Full [GitHub CI run #46](https://github.com/brsctncnbrk5/originmetric/actions/runs/36934400786): **success**, 2026-10-01 UTC / 2026-10-02 Istanbul. The final handoff update changes documentation only.

| Verification | Result |
|---|---|
| Full-history secret scan, lint, format, typecheck | PASS |
| Clean migration application, journal consistency, no ungenerated schema changes | PASS |
| Unit + real PostgreSQL 18 tests | 341 passed, 22 files (217 unit tests) |
| Production build and tracker size | PASS; 2491/2560 B gzip |
| Playwright browser/API tests | 10 passed |
| Exact P1b demo command | 1 passed |
| Deploy control: no secret overwrite, prior-image rollback + health, first-failure DB preservation | PASS |
| Real production Docker image, migration, Caddy validation, smoke | PASS |
| Production browser consent → trusted identify → test payment → google attribution | PASS |
| Non-root app, private app/DB ports, protected internal routes, redacted logs | PASS |
| Synthetic encrypted backup, isolated PostgreSQL restore, missing-remote failure path | PASS |

Local lint/format/typecheck, 217 unit tests, production build, shell syntax/control and schema consistency also passed. CI's local rclone remote contains synthetic data; it is not evidence of a real off-VPS storage service or actual VPS installation.

Preparation runtime has Node 24; CI and Docker pin Node 22.22.2/Node 22. No Docker/PostgreSQL daemon is available in this ChatGPT workspace, so real DB/Playwright/Docker package validation must be observed in GitHub CI; it is not claimed as local VPS testing.

## Remaining for actual P2 acceptance

- Actual VPS topology/access, free RAM/disk and existing ports/services audit.
- Domain/DNS/Cloudflare account choice, actual Origin CA certificate, Full (strict), one verified edge rate-limit rule, Docker-aware IPv4/IPv6 firewall and external port checks.
- Choose/configure actual off-VPS backup remote and monitoring accounts; no paid service without approval.
- Run production install and real-domain consent/identity/revenue dogfood; confirm banner on actual site before uncontrolled traffic.
- Real off-VPS backup download and isolated restore evidence; cron and monitoring setup.
- Public G1 evidence + P2 installation report. **P2 remains in progress; P3 not started.**

## Scope and limitations

No auth/dashboard/billing/AI/bot heuristics/monthly quotas added. `main` is not changed by the preparation branch. P1b technical review is green; no manual user demo viewing is invented. Native system tools age/rclone are already planned for P2; no npm runtime dependency was added. Secrets and private keys are not in Git.

Process rate buckets reset on app restart; the daily hard cap does not. The process guard limits malformed/unknown traffic too. Single app process is required; scaling to multiple app replicas needs a new coordinated admission design. Daily DB reservation serializes a project's ingestion transactions; suitable for initial dogfood and to be load-measured before scale.

Synthetic backup/restore CI is a package check, not an actual off-VPS operational acceptance. Public ingress configuration is a sample for an otherwise available 80/443 listener; existing VPS reverse proxy topology must be reviewed. Compose public overlay requires >=2.24.4. Deploy rollback covers app images/forward-compatible schema, not automatic reconstruction of changed host firewall/DNS/TLS topology. No global Docker pruning is performed; keep at least the last three OriginMetric image tags.

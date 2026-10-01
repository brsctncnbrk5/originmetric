# OriginMetric — P2 VPS installation report

Date: 2026-10-02 (Europe/Berlin; installation started 2026-10-01 UTC)
Status: **LOCAL VPS INSTALLATION VERIFIED — PUBLIC G1 / P2 ACCEPTANCE PENDING**
Authorization: Barış's VPS installation instruction and D-004. **P3 not started.**

## Source verification

- Repository: `https://github.com/brsctncnbrk5/originmetric.git`.
- Assigned branch: `codex/originmetric-p2-vps-preparation`.
- Installed full SHA: `b750a1b5262eb83d04810afc2c71c35678ecfbcc`.
- GitHub branch SHA matched the checkout (`git ls-remote`); initial working tree was clean.
- Tested code SHA: `a8957d872dc2597d6b2d20203e9c62bebee732f4`, CI #46. The installed head adds only documentation to that code; Dockerfile, deploy/scripts and lockfile have no diff.
- Read CLAUDE.md, STATUS, DECISIONS, preparation report, installation runbook and the locked plan's P2/G1 sections before deployment.

## Host and existing services

Read-only `scripts/vps/audit-host.sh` and follow-up topology checks ran on the actual VPS. Sandbox restrictions initially blocked Docker/netlink access; host checks and deployment then ran with approved escalation.

| Item | Observed |
|---|---|
| OS / kernel | Ubuntu 24.04.4 LTS / Linux 6.8.0-137-generic |
| Memory | 23 GiB total; approximately 20–21 GiB available |
| Disk before install | 290 GiB filesystem; approximately 82 GiB available |
| Docker / Compose | Engine 29.1.3 / Compose 2.40.3 |
| Existing public listener | nginx owns IPv4 80/443; SSH on IPv4/IPv6 22 |
| Docker before install | No existing containers or named volumes; default networks only |
| Firewall before install | UFW inactive; Docker-USER has no custom rules; IPv4 INPUT ACCEPT / FORWARD DROP; IPv6 INPUT/FORWARD ACCEPT |
| Host timezone | Europe/Berlin |
| tmux | Existing `originmetric` session confirmed; other sessions preserved |

Public Compose overlay was not enabled because nginx already owns 80/443 and external inputs are missing. No nginx configuration, DNS, TLS, host firewall policy, other project's config, crontab, or existing tmux session was changed. No global prune, package upgrade, autoremove or reboot was performed.

Installed only the runbook's missing free system tools: age 1.1.1 and distribution rclone 1.60.1. Package installation completed with exit 0. The package hook showed an existing newer-kernel/reboot notice and a terminal warning; no reboot was performed. After installation and deployment, nginx and both tradebot services remained active with the same process IDs and pre-session start times:

- nginx: PID 427077; started 2026-09-30 06:03:59 CEST.
- tradebot-dashboard: PID 427132; same start timestamp.
- tradebot-portfolio: PID 427105; same start timestamp.

No game/project directories were modified. This records observed service preservation; it is not a functional test of unrelated games or projects.

## Installation and checks

Executed `init-env.sh`, `preflight.sh`, and `deploy.sh b750a1b5262eb83d04810afc2c71c35678ecfbcc` on the clean checkout.

| Check | Result |
|---|---|
| Production secret generation | PASS; `.env.production` mode 600, ignored by Git; values not printed |
| Preflight | PASS |
| Exact-SHA Docker production build | PASS; Node 22.22.2, Next.js 16.3.6; image ID prefix `d21b61001747` |
| Tracker build size | 2491 B gzip / 2560 B budget |
| Caddy configuration validation | PASS in deploy sequence |
| Forward migrations | PASS; 4 migration records, 10 public domain tables |
| Database version | Actual server 18.6 |
| App DB role | `originmetric`: not superuser; no CREATEDB or CREATEROLE |
| App runtime | `node`, UID/GID 1000; healthy |
| PostgreSQL runtime | Healthy; persistent OriginMetric volume |
| Host publication | App/DB bindings empty; Caddy only `127.0.0.1:8088 -> 80/tcp` |
| Backend network | `originmetric_backend`, internal=true |
| Restart / logs | All three services unless-stopped; json-file 20m × 5 |
| Smoke | PASS: DB-backed health, tracker, private page/metrics 404, non-consent fixture 404, malformed ingestion uniform 202 |
| One-off selfcheck | PASS; abuse/failure alert counters empty |
| Existing service continuity | nginx and tradebot active; same PIDs/start times |

`.runtime/current-tag` records the installed full SHA. Final documentation commit is separate from the runtime image; it does not require redeployment. A first attempt at an additional read-only DB assertion had a shell quoting error; it was corrected in an ignored local verification script and rerun successfully. No schema or data mutation came from that assertion.

Docker used its available legacy builder and emitted a deprecation notice; the production build passed. No Docker daemon/toolchain upgrade was made. Full CI/unit/browser suites were not rerun on production DB; the actual VPS build, migration, smoke, isolation and role checks above supplement CI #46.

## Pending inputs and acceptance evidence

The missing inputs were requested together during installation. No account, hostname or public exposure was assumed:

1. OriginMetric service domain and actual dogfood site host.
2. Cloudflare zone/access method, current DNS/proxy/Full (strict) state, securely supplied Origin CA certificate/key, available single rate-limit rule.
3. Existing free off-VPS provider, OriginMetric-specific bucket/prefix and safe credential/config provisioning; offline-generated **public age recipient only**.
4. Existing Healthchecks and uptime accounts/configuration.

Until these are supplied, `.env.production` stays `OM_INGRESS=local`, `PUBLIC_G1_READY=no`, with external configuration unset. No production dogfood project/key has been created with a placeholder domain.

Remaining work within P2:

- Review an OriginMetric-only nginx/public ingress route preserving real Cloudflare peer validation, token overwrite and redacted logging. Do not proxy public traffic through the synthetic local Caddy listener: it overwrites CF-Connecting-IP with loopback for review only.
- Verify installation-day official Cloudflare IPv4/IPv6 ranges, one edge rate-limit rule, actual Origin CA/Full (strict), Docker-aware scoped firewall and independent external IPv4/IPv6 port checks. Existing shared nginx requires a compatible scoped design; no global policy reset.
- Actual-domain controlled browser consent/withdrawal/GPC and trusted identify/payment/renewal/refund/duplicate proof; actual site's consent banner confirmation.
- Real encrypted off-VPS upload, download to offline device and stdin-only isolated restore. **No backup or restore was run or claimed here.**
- Only after successful real backup/restore, add OriginMetric-only cron entries, logrotate and monitoring; record intended backup hour in Europe/Berlin.
- Confirm encrypted/password-manager preservation of production secrets by the owner.

**Public G1: not passed. P2: in progress, local installation verified. P3: not started.**

## Repository handoff

Report and STATUS were committed locally on the assigned P2 branch. Push was attempted only to that branch. GitHub rejected it with HTTP 403: the VPS's configured credential authenticates as `brsctncnbrk3-hub`, which cannot write `brsctncnbrk5/originmetric`. No credential, remote or history was changed. A repository-authorized credential must be provisioned securely before retrying the push; the local commit remains available.

Follow-up authentication audit (2026-10-02): global Git HTTPS credential helper delegates to `gh auth git-credential`. No GH_TOKEN/GITHUB_TOKEN or askpass override is set. The only stored gh account is `brsctncnbrk3-hub`; authenticated GitHub repository API confirms `permissions.push=false`. No default SSH private key or loaded agent identity is available, and standard Git credential-store files are absent. Remote branch remains `b750a1b5262eb83d04810afc2c71c35678ecfbcc`; local installation commits `9a5ca4c` and `8e6ef88` remain intact. No additional push was attempted with the known unauthorized account.

Prepared an ignored, mode-700 `.runtime/github-auth` directory for a project-specific gh login. The owner must run the following in the VPS terminal and complete the browser flow using `brsctncnbrk5` or another account with repository write access:

```bash
cd /opt/originmetric
GH_CONFIG_DIR=/opt/originmetric/.runtime/github-auth gh auth login --hostname github.com --git-protocol https --web
```

This isolated login preserves the global account used by other projects. No token/password should be pasted into chat. After login, verify the isolated account's repository push permission, use it as a command-scoped Git credential helper for a normal push to the assigned P2 branch, then compare the remote full SHA to local HEAD and verify the installation commits are ancestors. Login and that verification have not yet occurred. P3 remains unstarted.

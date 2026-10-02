# OriginMetric — P2 VPS installation report

Date: 2026-10-02 (Europe/Berlin; installation started 2026-10-01 UTC)
Status: **DOMAIN / HTTPS VERIFIED — PUBLIC DATA ROUTES CLOSED; G1 / P2 ACCEPTANCE PENDING**
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

This isolated login preserves the global account used by other projects. No token/password should be pasted into chat. After login, verify the isolated account's repository push permission, use it as a command-scoped Git credential helper for a normal push to the assigned P2 branch, then compare the remote full SHA to local HEAD and verify the installation commits are ancestors.

**Resolution (2026-10-02):** the owner completed isolated login. Authenticated `gh api user` returned `brsctncnbrk5`; repository API confirmed `permissions.push=true`. The clean checkout remained on the assigned branch and expected remote. A command-scoped helper using `GH_CONFIG_DIR=/opt/originmetric/.runtime/github-auth` performed a normal fast-forward push from `b750a1b` to `26eac2cd67b200c9b23af6101dc94210272e24a1`. `git ls-remote` confirmed that exact SHA on `refs/heads/codex/originmetric-p2-vps-preparation`; ancestor checks confirmed both installation commits `9a5ca4c` and `8e6ef88` are included. No force push, history rewrite, global credential switch, service change or deployment occurred. This subsequent documentation update records the resolved blocker. P3 remains unstarted.

## Domain and HTTPS installation — 2026-10-02

This section supersedes the earlier pending-domain/public-health state. The owner purchased `originmetric.app` and supplied proxied apex A and www CNAME records. No Cloudflare dashboard settings were changed by the agent.

- Before modification, archived `/etc/nginx`, copied existing certificate renewal configuration and `.env.production` into a private ignored `.runtime/https-backup-*` directory. `.runtime/https-backup-path` identifies it. Existing nginx file hashes were recorded and compared after installation: unchanged.
- Added only `/etc/nginx/sites-available/originmetric` and its enabled symlink; reviewed source is `deploy/nginx.originmetric.conf`. No default/tradebot site edit, stop or restart. Every reload followed successful `nginx -t`.
- Issued a publicly trusted Let's Encrypt certificate using HTTP-01 webroot `/var/www/originmetric-acme`. Both apex and www are certificate SANs; expiry 2026-12-30 23:23:04 UTC. Private key stays in `/etc/letsencrypt`; never printed or committed. Existing Certbot executable was reused read-only from `/opt/tradebot-dashboard-tools/bin/certbot`; no new package/account subscription was installed.
- Added only `/etc/cron.d/originmetric-cert-renew`: twice daily, 02:23 and 14:23 Europe/Berlin, renew **only** the OriginMetric certificate. Deploy hook tests nginx before reload. Existing tradebot renewal timer/configuration remains unchanged. The renewal job depends on that existing Certbot executable remaining installed.
- HTTP ACME challenge remains accessible for renewal. All other HTTP requests through Cloudflare redirect to `https://originmetric.app`; HTTPS www redirects to the apex, retaining path/query.
- OriginMetric nginx HTTPS vhosts accept only actual Cloudflare peers, using the installation-day official IPv4/IPv6 ranges. Direct HTTPS origin access returns 403. This application-layer gate does not establish the plan's outstanding host-firewall/external-port acceptance evidence. Shared nginx listeners and host firewall policies were preserved.
- OriginMetric access logging is off and its nginx error log is discarded to avoid request-context leakage. Caddy's existing filtered operational logs remain. No global log configuration changed.
- `.env.production` now records `OM_DOMAIN=originmetric.app`; `OM_INGRESS=local` and `PUBLIC_G1_READY=no` deliberately remain. The current Compose Caddy listener is still a synthetic/local review upstream. No app image, app/DB container, database or port binding changed.

### Verified behavior

| Test | Result |
|---|---|
| nginx configuration | PASS before all reloads |
| HTTPS apex `/` and referenced Next static assets | 200 |
| HTTPS `/api/health` | 200, DB-backed `status:ok` |
| HTTPS `/js/v1/om.js` | 200 |
| HTTPS www with path/query | 308 to matching HTTPS apex URL |
| Direct origin TLS certificate verification | PASS; trusted chain and hostname, without curl `-k` |
| Direct origin HTTPS health | 403 |
| Certificate renewal `certbot renew --cert-name originmetric.app --dry-run` | PASS; both SANs validated in simulated renewal |
| `/internal`, `/internal/projects/*`, `/api/internal/metrics` | 404 |
| `/fixtures/required` | 404 (public fixtures closed pending G1) |
| Public ingestion POST `/api/v1/e` | 202 dropped by nginx, not forwarded to app |
| Public identify/revenue routes | 503, not forwarded to app |
| Local smoke and DB role/schema assertions | PASS; PG18.6, 4 migrations, 10 tables, restricted role |
| App/DB publication | Empty port bindings; Caddy only loopback 8088 |
| Existing nginx/tradebot service continuity | Same main PIDs and original start times |
| Original nginx file hashes | Unchanged |

The first requests immediately following reload briefly returned the previous site's response; repeat checks settled to the expected dedicated-site responses. Old worker/edge connection reuse is a possible explanation, not a proven diagnosis. A Python urllib probe received 403 while curl checks succeeded; this is not evidence that all browser/edge-policy combinations pass. All listed public route assertions passed with curl; real-browser consent/dogfood remains pending.

### Owner's Cloudflare panel actions and remaining P2 criteria

1. SSL/TLS → Overview: choose **Full (strict)**, not Flexible. The installed certificate meets the origin certificate requirements; panel mode itself cannot be proven from a successful HTTPS request. Edge certificate/Universal SSL must remain active for apex/www.
2. Keep both DNS records proxied. Enable Always Use HTTPS if desired, preserving the HTTP-01 challenge path for certificate renewal.
3. Configure/verify the **single** Free rate-limit rule for `http.request.uri.path eq "/api/v1/e"`, IP characteristic; runbook starting target 60 requests/10 seconds, Block 10 seconds, subject to the actual panel's available Free settings. Do not enable a paid tier or a second rule.
4. Do not cache API/internal/fixture responses or add a broad Cache Everything rule. Tracker/static cache can be evaluated separately.

Before any public event acceptance, install a validated nginx-to-Caddy proxy path that overwrites the private trust token and preserves the actual CF client header behind the Cloudflare peer gate. **Do not remove the nginx data-route gate while the review Caddy overwrites CF-Connecting-IP with loopback.** Then complete G1 evidence, the real site's required-consent banner and actual-domain attribution tests, scoped Docker-aware firewall/independent external IPv4/IPv6 checks, real encrypted off-VPS backup/download/manual isolated restore, owner secrets preservation and backup/uptime/Healthchecks scheduling. Backup account/public age recipient and monitoring inputs remain missing. P2 is not accepted; P3 has not started.

Official references checked for this installation: [Cloudflare IPv4](https://www.cloudflare.com/ips-v4), [IPv6](https://www.cloudflare.com/ips-v6), [Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/), [rate-limit parameters](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/), [Certbot webroot](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot).

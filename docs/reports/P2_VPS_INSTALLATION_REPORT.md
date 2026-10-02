# OriginMetric — P2 VPS installation report

Date: 2026-10-02 (Europe/Berlin; installation started 2026-10-01 UTC)
Status: **HTTPS / PROXY / SCOPED FIREWALL VERIFIED — PUBLIC DATA ROUTES CLOSED; G1 / P2 ACCEPTANCE PENDING**
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

## Remaining security preparation — 2026-10-02

This section supersedes the prior synthetic-upstream and pending-Full-(strict) instructions. Canonical plan §28 P2/G1 was retained. No AGENTS.md was found in the repository or its parent directories; CLAUDE.md and locked decisions were read. Starting branch was `codex/originmetric-p2-vps-preparation`, clean at `4333381`; fetch showed local/remote equality. P3 has not started.

### Cloudflare status and HTTP evidence

The owner states apex A → `169.58.134.223`, www CNAME → apex, both Proxied, and **Full (strict) saved**. No Cloudflare account/API access was available; the saved mode and rule inventory are **owner-reported/uninspected**, not independently verified. Successful HTTPS is compatible with that statement but cannot prove the selected mode.

Repeated live requests: apex/root, DB-backed health and tracker 200; www 308 preserves path/query; `/internal`, `/internal/projects/test`, `/api/internal/metrics`, `/fixtures/required` 404; public event POST 202/drop; identify/revenue 503. Direct-origin TLS is valid without `-k`, but requests to both OriginMetric hosts return 403 even with forged CF-Connecting-IP/XFF. Public data routes were never opened.

API/internal/fixture responses including nginx 202/404/503 now carry `Cache-Control: no-store`; observed edge status was DYNAMIC. Root is also no-store. Application health, ingestion, server APIs and internal metrics already set no-store; nginx now covers responses generated before the app. Neither nginx nor Caddy enables a response cache. The previously cached, unchanged tracker returned HIT (static caching is permitted); this does not mean API data is cached. Fresh proxy responses use conservative no-store headers. Actual Cloudflare Cache Rules, Page Rules, Workers and overrides remain uninspected.

### Trust chain installed and tested

- Official [IPv4](https://www.cloudflare.com/ips-v4) and [IPv6](https://www.cloudflare.com/ips-v6) lists were fetched again and matched the committed snapshot (15 + 7 CIDRs). No automatic unaudited list updater was installed; reverify lists before go-live and when upstream ranges change.
- `deploy/nginx.originmetric.conf` applies `set_real_ip_from` and CF-Connecting-IP only inside the OriginMetric servers, with `real_ip_recursive off`. Peer admission uses **`$realip_remote_addr`**, the original transport peer, so a forged Cloudflare-looking client IP cannot pass the origin gate. nginx forwards the normalized `$remote_addr` as CF-Connecting-IP, removes XFF/X-Real-IP, and injects the private token from root-owned mode-600 `/etc/nginx/originmetric-proxy-token.conf`. Never print `nginx -T` after installing this private include.
- `deploy/compose.nginx.yml` selects `Caddyfile.nginx` while preserving the loopback port. This listener refuses missing/wrong proxy tokens with 403 and preserves nginx's CF IP; it removes XFF/X-Real-IP before the app. The synthetic `Caddyfile.local` remains for isolated local/CI proof only. Production `.env.production` now uses **`OM_INGRESS=nginx`**, **`PUBLIC_G1_READY=no`**.
- The application keeps `INGEST_PROXY_MODE=cloudflare`; `ingestionClient` requires the private timing-safe token, validates IPv4/IPv6, never trusts/falls back to XFF and fails closed on missing/malformed CF IP. There is no blanket trust-all-proxies framework setting used for ingestion.
- Live private packet inspection of a health request proved the VPS's actual IPv6 client reached nginx → Caddy → app unchanged. Attacker XFF and token values were removed/replaced. Capture payloads were never printed or committed and the capture was deleted. This proves header transport without enabling ingestion. A forged CF header sent through the edge returned 403; the precise rejecting layer was not inferred.
- `python3 scripts/vps/test-nginx-proxy.py` runs a separate nginx process on ephemeral loopback ports with a synthetic backend/token. Trusted-peer simulation forwards IPv4/IPv6 correctly, strips hostile XFF/X-Real-IP and replaces token; untrusted transport peers remain 403 even when the forged CF value belongs to a Cloudflare range. No live server reload is used by this test.
- New unit cases prove missing/wrong/short token, missing/invalid/multiple CF IP refusal, and XFF cannot influence valid IPv4/IPv6 results. These tests complement the live transport proof; they do not claim a production fact was written.

### Scoped network protection and external evidence

Before changes, relevant nginx config, environment, Caddy config, IPv4/IPv6 rule snapshots and service identities were backed up privately under the directory identified by `.runtime/security-backup-path`. `.runtime/rollback-security.sh` restores the previous OriginMetric site/environment/Caddy and removes only the new tagged firewall rules. It validates nginx before reload and preserves DB/other services. Syntax checked; live rollback was not executed, because that would revert the verified fix. Existing deploy-control failure/rollback tests passed.

No policy was changed and no chain was flushed. UFW remains inactive. `scripts/vps/originmetric-firewall.sh` adds only:

1. IPv4 and IPv6 INPUT: eth0 TCP 3000/5432/8088 DROP. Audit confirmed no unrelated listeners on these ports; these ports are reserved for OriginMetric private services on this host.
2. IPv4 and IPv6 DOCKER-USER: reject new/unrelated traffic from eth0 into **OriginMetric's two bridge networks only**, preserving established/related replies and host/loopback proxy traffic. This also protects against accidental future container port publication/Docker NAT bypass.

`originmetric-firewall.service` installs these idempotently after Docker and reapplies on Docker service restart (PartOf/After). Installed script: `/usr/local/sbin/originmetric-firewall`. Re-running apply preserved rule count. Persistence is configured/enabled and currently active; no VPS reboot or Docker restart was performed. If OriginMetric networks are deleted/recreated, rerun/restart the unit to discover new bridge IDs; the audited external interface is eth0. Explicit firewall rollback: disable the unit, then invoke the script with `remove`; stopping the unit alone deliberately keeps protections.

SSH 22 and shared nginx 80/443 were preserved. nginx/SSH/tradebot main PIDs and unrelated nginx file contents match the pre-change backup. App and DB bindings remain `{}`; Caddy only `127.0.0.1:8088`. Docker networks have IPv6 disabled; host has a global IPv6 address, so ip6tables protection was still installed. nginx currently listens to IPv4 80/443 only; SSH listens on IPv4/IPv6. No unrelated project's ports or config were changed.

Independent TCP checks used [Check-Host's documented remote-node API](https://check-host.net/about/api), without an account or payment. Requests originated at independent remote nodes, not at the VPS. Evidence is point-in-time reachability, not a comprehensive penetration test:

| IPv4 port | Independent nodes | Result | Evidence |
|---|---|---|---|
| 22 | de2, us3 | TCP connected (SSH control) | [report](https://check-host.net/check-report/4e82fa25kd2) |
| 443 | ch2, ir7 | TCP connected (shared HTTPS control) | [report](https://check-host.net/check-report/4e82fa2bk62d) |
| 3000 | in1, ir4 | Both connection timed out | [report](https://check-host.net/check-report/4e82fa30kb08) |
| 5432 | ch2, ir5 | Both connection timed out | [report](https://check-host.net/check-report/4e82fa38k2ae) |
| 8088 | il1, kz1 | Both connection timed out | [report](https://check-host.net/check-report/4e82fa3ck40e) |

Private raw request/result JSON is retained in `.runtime/external-port-results.json`. IPv4 firewall DROP counters increased during these probes. **Independent IPv6 control is missing**: provider rejected bracketed IPv6 TCP targets as `invalid_url`; this is not a closed-port result. Host listener/network/firewall inspection is local evidence only. A separate IPv6-capable external machine must test 22 as a positive control and 3000/5432/8088 for non-reachability.

**Canonical shared-port limitation:** plan says 80/443 limited to Cloudflare. These are shared with direct-IP tradebot and remain generally reachable at transport level. OriginMetric hostnames enforce a Cloudflare-only nginx peer gate, with HTTP-01 ACME exception. Host-wide Cloudflare-only 80/443 was not applied and is not claimed. P2 acceptance needs review of this compatible per-vhost design against the locked criterion or an isolated OriginMetric ingress/IP; this report does not silently redefine the plan.

### Exact Cloudflare panel actions

1. Keep the owner-saved **Full (strict)** and both DNS records Proxied. No need to repeat the already completed SSL change. Confirm there are no Worker routes that rewrite client IP for OriginMetric. Network → Pseudo IPv4 should be **Off** (do not use Overwrite Headers); Rules → Settings / Managed Transforms → **Remove visitor IP headers** must be off for this service. The live IPv6 proof is consistent with intact headers but does not inspect panel settings. See [Cloudflare header semantics](https://developers.cloudflare.com/fundamentals/reference/http-headers/).
2. Security → Security rules → Create rule → Rate limiting rules (older dashboard: Security → WAF → Rate limiting rules). Use the existing single rule if one is already present; do not create a second rule or enable a paid tier:

| Field | Exact value |
|---|---|
| Rule name | `OriginMetric ingestion IP limit` (proposed descriptive name) |
| Match expression | `http.request.uri.path eq "/api/v1/e"` |
| Requests / period | **60 requests / 10 seconds** |
| Same characteristics | **IP** (`ip.src`; Cloudflare implicitly includes data center) |
| Custom counting expression | None; count all matching requests |
| Action | **Block**, default HTTP 429 |
| Duration / mitigation timeout | **10 seconds**, perform action throughout duration |

Canonical plan reserves exactly one rule and the endpoint; it does **not** lock the numerical threshold/name. **60/10 s is a recommendation**, retained from the preparation runbook, to absorb short/NAT bursts while the app separately limits 60/minute per client+site, 200/s per project, 500/s process-wide and 200,000/day per project. Tune later from controlled drop evidence; this recommendation is not a new owner decision. Do not add host/method/header predicates: Free supports path-based matching and IP counting, lacks custom counting/cache exclusion, and offers 10 s period and 10 s mitigation with one rule. [Official availability](https://developers.cloudflare.com/waf/rate-limiting-rules/) and [parameters](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/) were checked 2026-10-02. Limits are approximate and scoped by Cloudflare data center; in-app ceilings remain necessary.

3. Rules → Cache Rules: create/update `OriginMetric private routes bypass`, custom expression:

```text
starts_with(http.request.uri.path, "/api/") or
http.request.uri.path eq "/api" or
starts_with(http.request.uri.path, "/internal") or
starts_with(http.request.uri.path, "/fixtures")
```

Set **Cache eligibility → Bypass cache**. Place it after any matching broad cache rule so the bypass is the last matching cache-eligibility setting. Audit existing Cache Everything/Page Rules/Workers and remove conflicting API/internal caching or make their scope static-only. Do not set an Edge TTL that ignores origin no-store for these paths. If API/internal URLs were previously cached, purge only affected URLs. Leave tracker/static caching separate. [Official Cache Rules settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/). This is a cache rule, not a second rate-limit rule.

4. Report that the single rate-limit and bypass rules are deployed (rule settings/IDs without credentials). Then run controlled no-customer-data edge rate-limit verification while nginx still drops ingestion; save 429/security-event evidence. This session has **not** configured or tested an active Cloudflare rate-limit rule and has **not** inspected the account's cache rule inventory.

### Validation and remaining gates

- PASS: nginx -t before reload; Caddy nginx-listener validation; bash syntax; deploy-control rollback test; isolated nginx IPv4/IPv6 spoof proof; live HTTPS/route/cache/header proof; smoke and selfcheck (no abuse/failure counters); service/config continuity.
- PASS: ESLint, Prettier, TypeScript; **342 tests / 22 files** against an isolated ephemeral PostgreSQL 18.6 (218 unit + 124 DB), including rate limits, daily cap, log redaction and browser identity poisoning; tracker 2491 B gzip / 2560 B. The test DB/container/network were removed; production DB was not used. The first migration attempt ran before the test DB was ready and exited; readiness was confirmed and the full sequence reran successfully.
- No app/DB redeploy, schema change, paid service, global GitHub-account change, real customer data or public ingestion enablement. Browser/app code was unchanged; live actual-domain consent/banner/dogfood evidence remains pending. Existing browser CI evidence is historical and is not reported as a fresh browser test here.

G1 items 1/2 (consent/GPC) retain prior automated browser evidence; item 3 validation/origin/dedup/failure and item 6 browser trust separation retain prior evidence plus current DB regressions; item 5 redaction passed current tests. **G1 item 4 remains incomplete until the single active edge rule is configured and verified.** Actual-site required-consent banner confirmation is also required before uncontrolled traffic.

P2 additionally awaits independent IPv6 external evidence/shared-ingress criterion review, real required-consent dogfood and production attribution proof, encrypted off-VPS upload + owner download + one manual isolated restore, nightly backup/Healthchecks/uptime setup, and owner confirmation of secure secret preservation. Backup provider/prefix/public age recipient and monitoring inputs remain missing. **G1 not passed; P2 not accepted; P3 not started; all public data acceptance remains closed.**

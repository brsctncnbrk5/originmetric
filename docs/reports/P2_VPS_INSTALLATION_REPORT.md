# OriginMetric — P2 VPS installation report

Date: 2026-10-02 (Europe/Berlin; installation started 2026-10-01 UTC)
Status: **CLOUDFLARE EDGE / PROXY / EXTERNAL IPv4+IPv6 VERIFIED — PUBLIC DATA ROUTES CLOSED; G1 / P2 ACCEPTANCE PENDING**
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

## Post-Cloudflare verification — 2026-10-02, 01:24–01:29 UTC

This is the current acceptance evidence. It supersedes earlier statements that the edge rate-limit/cache rules were not configured/tested and that independent IPv6 evidence was missing. Other unfinished P2 items remain unfinished. Starting checkout was clean on `codex/originmetric-p2-vps-preparation`, local/remote both `c4f1601307554ec75f2763ad23b5b6f7efb3588e` after authenticated fetch. No AGENTS.md exists at `/`, `/opt` or the repository root; CLAUDE.md, STATUS, locked canonical P2/G1 sections, DECISIONS and this report were read.

### Panel evidence supplied by the owner

These are panel/handoff observations, **separate from the behavior tests below**. This session did not obtain Cloudflare dashboard/API access or change any rule.

| Setting | Supplied evidence | Independent status in this session |
|---|---|---|
| `OriginMetric ingestion IP limit` | Active, Block; entered path `/api/v1/e`, IP, 60 requests/10 s, mitigation 10 s | Edge blocking/recovery independently tested; exact saved counting period, characteristics and total rate-rule inventory not read via panel/API |
| `OriginMetric API cache bypass` | Active; Bypass cache; expression below | Covered-path response behavior independently tested; rule order/other Page Rules or cache overrides not independently inventoried |
| Pseudo IPv4 | Off; confirmed from panel images in supplied handoff | Fresh IPv6 transport independently tested; images were not re-inspected here |
| Remove visitor IP headers | Off; confirmed from panel images in supplied handoff | Intact client transport independently tested |
| Workers Routes | Empty, per supplied panel handoff | No independent Worker/account inventory |
| Full (strict) | New owner-supplied SSL/TLS Overview panel-image evidence: **“Current encryption mode: Full (strict)”**, reported 2026-10-02 | **Panel-image evidence supplied by the user**; no independent Cloudflare API/dashboard verification by this agent. Working HTTPS alone does not prove saved SSL mode |

Reported bypass expression:

```text
starts_with(http.request.uri.path, "/api/") or
http.request.uri.path eq "/api" or
starts_with(http.request.uri.path, "/internal") or
starts_with(http.request.uri.path, "/fixtures")
```

### Passed live checks and edge/origin separation

| Check | Result |
|---|---|
| HTTPS `/`, `/api/health`, `/js/v1/om.js` | PASS: 200; health body hash matches `{"status":"ok"}` |
| HTTPS www `/probe/path?check=synthetic` | PASS: 308 → `https://originmetric.app/probe/path?check=synthetic` |
| `/api`, `/api/`, `/api/internal/metrics`, `/internal`, `/internal/projects/test`, `/internal-probe`, `/fixtures`, `/fixtures/required`, `/fixtures-probe` | PASS: each requested twice at the same URL; 404, `Cache-Control: no-store`, `CF-Cache-Status: DYNAMIC` |
| POST `/api/v1/e` | PASS: normal 202/drop, twice; no-store/DYNAMIC |
| POST identify/revenue | PASS: 503, twice; no-store/DYNAMIC; data acceptance remains disabled |
| Tracker | 200, no-store/BYPASS in this sample; static-cache policy is separate |
| Production facts | PASS: events, sessions, customers, revenue_events, customer_visitors all zero before tests and at final read-only check |

**Bounded edge test:** empty POST bodies, no site key/auth/customer identifiers; nginx's installed exact endpoint location is `return 202` with no proxy to Caddy/app. Its file matches the reviewed committed configuration exactly; the site has no 429/limit directive. No data gate or log setting was changed. Maximum 100 requests per burst, stop at the first blocked wave/request. The two actual bursts sent 76 and 61 requests, plus five recovery probes in total; low-volume route/smoke requests were separate.

Initial IPv4 test (01:24 UTC) used four concurrent curl workers and took 5.919 s for 76 requests: 72×202 then 4×429. CF-Ray showed both FRA and CDG. +2/+5 s remained 429, +9 s returned 202 from CDG. **This is not mitigation-expiry proof** because the Cloudflare data center changed. Cloudflare counts include the data-center characteristic, per its [official parameter reference](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/).

The follow-up pinned one IPv4 edge address and reused one TLS/HTTP connection; **all 66 requests including controls/recovery carried FRA rays**. From 01:26:28.568 to 01:26:30.610 UTC, requests 1–60 returned 202 and **request 61 returned 429**, CF-Ray `a43feb594e941dc1-FRA`, body containing Cloudflare error code **1015**. Its absent CF-Cache-Status also differed from normal DYNAMIC endpoint responses.

A narrowly filtered private packet capture independently separated the rejecting layer:

- The first 202 observed three CF→origin TLS payload packets and no private upstream request, consistent with nginx's drop gate.
- Request 61 and the +2/+5/+9 s blocked probes each observed **zero CF→origin TLS payload packets and zero private upstream payload packets** during the request interval.
- An adjacent `/api/health` control on that same connection/ray location returned 200 and observed CF→origin payload plus private nginx/Caddy/app traffic. The capture therefore had a working positive control during mitigation.
- The 429/error-1015 response plus this transport evidence and the installed nginx endpoint gate establishes a **Cloudflare edge block**, rather than treating a 429 or `Server: cloudflare` header alone as sufficient evidence. Raw captures were deleted; only sanitized counts/rays/timings were retained. No token/IP/payload was printed or committed.

Recovery on the same connection was 429 at **+2.007 / +5.006 / +9.008 s**, then 202/drop at **+11.015 s** (ray `a43feb9e1c321dc1-FRA`). Mitigation expiry is therefore bracketed between the 9-second blocked probe and the 11-second recovered probe, consistent with an entered 10 s timeout. Threshold behavior was 60 allowed then the 61st blocked in this controlled burst. **The saved 10-second counting window and exact dashboard parameters are not independently proven by a short burst**, and the test does not claim globally exact limits. Rule ID attribution through a Security Event/API and an independent inventory of exactly one rule remain unavailable.

The API/internal/fixtures samples had **no HIT/STALE/UPDATING/REVALIDATED**. This proves sampled response behavior after the reported bypass deployment, not which matching Cloudflare rule produced it or that every possible override is absent. No origin cache was enabled and no cache purge was needed.

### Client IP, spoofing and origin isolation

PASS: fresh health probes over **both IPv4 and IPv6**, with synthetic hostile XFF/X-Real-IP/token headers, were privately inspected on nginx→Caddy and Caddy→app transport. The true VPS client address for the selected family was preserved in CF-Connecting-IP at both hops; XFF/X-Real-IP were absent and the 64-character private token replaced the forged value. Captures were deleted in cleanup and no fact-creating endpoint was forwarded.

PASS: apex/www direct-origin HTTP and HTTPS health requests returned 403 both with no spoof headers and with `CF-Connecting-IP: 104.16.0.1` (synthetic attacker input belonging to a CF range), hostile XFF and forged token. TLS chain/hostname verification remained enabled (`-k` was never used). These direct-origin checks ran **from the VPS itself**, and are explicitly local behavior evidence. Unauthenticated/forged-token loopback Caddy requests also returned 403. Spoofed CF-Connecting-IP through the real edge returned 403 in both client families; **that status alone does not identify the rejecting layer**.

PASS: isolated `scripts/vps/test-nginx-proxy.py` re-proved original-TCP-peer gating, trusted-peer IPv4/IPv6 forwarding, XFF stripping and token replacement. Targeted ingestion-client and logger unit suites passed **9 tests**, including refusal of absent/wrong tokens and invalid/multiple IP headers. nginx `-t`, public smoke and selfcheck passed; abuse/failure counters were empty. The first short-buffer packet attempt did not capture enough headers and was rerun with longer capture flushing; the successful assertion results above are the evidence used.

### Independent external IPv4 and IPv6 port checks

The [Globalping API](https://api.globalping.io/v1/spec.yaml) accepts literal IPv6 targets and provides free unauthenticated measurements. Eight TCP-ping measurements used **two probes each**, two TCP connections per probe, in **Falkenstein (DE)** and **Helsinki (FI)**. No account, credential, credit purchase or paid service was created. Actual `resolvedAddress` values matched the intended literal origin address/family in every result. These connections originated at external probes, not at the VPS which submitted the API requests.

| Family | TCP port | Both independent probes | Measurement result |
|---|---|---|---|
| IPv4 | 22 | 2/2 connections each; positive control | [result](https://api.globalping.io/v1/measurements/2oROGB3Hcxy4SQIPT00021Evu) |
| IPv4 | 3000 | 0/2 replies each, timeout/non-reachability | [result](https://api.globalping.io/v1/measurements/2CALAv0sb9anm7aXn00021Evu) |
| IPv4 | 5432 | 0/2 replies each, timeout/non-reachability | [result](https://api.globalping.io/v1/measurements/2BKnOcS6rahH8gN4G00021Evu) |
| IPv4 | 8088 | 0/2 replies each, timeout/non-reachability | [result](https://api.globalping.io/v1/measurements/2aqVoReyT8zIfKzuL00021Evu) |
| IPv6 | 22 | 2/2 connections each; positive control | [result](https://api.globalping.io/v1/measurements/2X3hhTVFthIroQtPQ00021Evu) |
| IPv6 | 3000 | 0/2 replies each, timeout/non-reachability | [result](https://api.globalping.io/v1/measurements/24UVDQdt9az5JIo1A00021Evu) |
| IPv6 | 5432 | 0/2 replies each, timeout/non-reachability | [result](https://api.globalping.io/v1/measurements/2zib7VFsVlRzbIwQ500021Evu) |
| IPv6 | 8088 | 0/2 replies each, timeout/non-reachability | [result](https://api.globalping.io/v1/measurements/2ttUPIrb5QFXPKk0R00021Evu) |

Point-in-time non-reachability passes this scoped external check; it is not a comprehensive scan of all host ports. Measurement endpoints can expire; the observed results are durably summarized above and original private JSON is retained in ignored mode-600 `.runtime/p2-external-results.json`. An initial malformed IPv6 API option was rejected by input validation, corrected to a literal-target request without `ipVersion`, then all eight measurements finished. A display-only summary parser error after saving the full results was corrected during inspection; no additional measurements were required.

### GitHub CI and service preservation

The previously queued CI is independently verified: **run #56 completed success** on `c4f1601307554ec75f2763ad23b5b6f7efb3588e` — [GitHub run](https://github.com/brsctncnbrk5/originmetric/actions/runs/36948381417). All required job steps passed: secret scan, checks/migrations/tests, tracker/build, browser/demo and production Docker/consent/synthetic encrypted-restore proof. Another run on the same SHA (#55) was cancelled; the successful run is the acceptance evidence. CI's synthetic encrypted restore is **not** the pending real off-VPS disaster-recovery proof.

No production fix/reload/redeploy, firewall/SSH change or data-route opening was needed. Pre-edit documentation copies were saved in `.runtime/docs-backup-cloudflare`; existing `.runtime/security-backup-path` and `.runtime/rollback-security.sh` remain available. nginx/SSH/tradebot main PIDs stayed 427077/427051/427132/427105 and active. App/DB port bindings remain empty; Caddy publication remains only `127.0.0.1:8088`. `.env.production` is mode 600, `OM_INGRESS=nginx`, `PUBLIC_G1_READY=no`. Installed image is still `b750a1b...`; newer repository security changes did not change application source. No other project's configuration was edited; all 15 unrelated nginx files present in the private pre-security backup were compared byte-for-byte and remained identical.

Ignored proof scripts/results: `.runtime/p2-cloudflare-*`, `.runtime/p2-edge-isolation-*`, `.runtime/p2-client-ip-*`, `.runtime/p2-external-*`. Response bodies/captured tokens were not persisted in report artifacts; packet files were deleted. Only the two documentation files are changed by this handoff, with a normal commit/push on the assigned branch and full SHA equality checked at handoff.

### Failed, unverified and remaining canonical acceptance items

**Failed/unmet criterion:** host-wide 80/443 Cloudflare-only restriction remains **unmet**. Shared IPv4 listeners continue serving tradebot directly. The OriginMetric vhost gate is verified, but cannot silently substitute for canonical §28's transport restriction. Resolve by explicit owner/plan acceptance of the scoped design or an isolated OriginMetric ingress/IP; preserve SSH and shared projects.

**Independently unverified:** saved Full (strict) mode via API/dashboard access (now supported by user-supplied panel-image evidence); complete Cloudflare rule inventory/ordering, exact saved 10 s counting period/IP characteristic and exactly one rate-rule count. Supplied panel evidence and successful edge tests reduce uncertainty but do not provide account-level verification. No observed route/cache/spoof/security regression remains failed after the final checks.

**Canonical G1 (§28) remains pending:**

1. Items 1/2: required consent (zero storage/network before consent, grant/withdrawal clearing) and GPC retain passing browser CI evidence; consolidate a fresh checklist against the deployed build/actual intended site. The owner must confirm its required-consent banner before uncontrolled visits.
2. Item 3: body/schema/origin/dedup/failure isolation retains green automated evidence; public drop responses intentionally do not exercise accepted production ingestion.
3. Item 4: in-app limits/ceilings/daily cap and trusted-IP tests are green; the **edge-block/recovery portion now passes**. Preserve the remaining account-configuration evidence caveats above.
4. Items 5/6: redaction and browser identity-poisoning tests are green in CI; fresh targeted redaction/client tests passed locally.
5. The canonical `npm run gate:g1` deployed-build checklist command (§26) is still absent from package scripts. Existing independent checks must be consolidated into that recorded deployed-build gate before declaring G1 green; this report does not invent G1 acceptance from CI alone.

**Other canonical P2 requirements still pending:** actual required-consent dogfood deployment and consented production attribution (trusted server identify, payment, renewal/refund/duplicate; revenue test from the owner's machine; token-protected internal result review); shared-ingress criterion resolution; independent Full (strict)/single-rule configuration evidence; real nightly encrypted off-VPS backup upload, owner download and one stdin-only isolated manual restore; OriginMetric-only backup scheduling, uptime/Healthchecks monitoring; owner confirmation of encrypted/password-manager preservation of production secrets. Backup provider/prefix/public age recipient and monitoring inputs are still missing. Independent external IPv6 evidence is now complete and is no longer a blocker.

**G1 not passed; P2 not accepted; P3 not started.** Ingestion stays nginx 202/drop, identify/revenue 503, internal/fixtures 404. Opening those routes is not authorized by these successful preparatory tests.


## Shared 80/443 resolution preparation — 2026-10-02

**Preparation only; no live nginx/firewall/DNS/certificate/scheduler change or data-route opening.** Starting HEAD: `9c2ce800e8b41608b44cebed3cbbdad329a32b40`, assigned P2 branch, clean checkout. Its documentation CI [run 36951916150](https://github.com/brsctncnbrk5/originmetric/actions/runs/36951916150) completed success. AGENTS.md was absent at `/`, `/opt` and `/opt/originmetric`; CLAUDE.md, STATUS, DECISIONS, the canonical plan and this report were read. No new locked decision was made.

### Exact locked requirement and current failure

Canonical [§28 / P2 security check](../planning/MASTER_DEVELOPMENT_PLAN_v2.md#p2--deploy-the-slice--dogfood-on-a-real-site), line 976:

> **Security check:** G1 checklist; DB not reachable from the internet (external port scan); 80/443 limited to Cloudflare; `.env` perms; TLS Full (strict); exactly one Cloudflare rate-limit rule configured.

The firewall meaning is explicit in §20: **T17**, line 725, says “DB port unpublished, firewall (ufw) allows 22/80/443 only; 80/443 restricted to Cloudflare IP ranges”; **T19**, line 727, says “Firewall allows only Cloudflare IPs on 80/443 (this is also what makes `CF-Connecting-IP` trustworthy for rate limiting)”. §6 line 327 also bases header trust on an origin firewall accepting Cloudflare IPs only. D-001 locks this plan; later plan changes require an explicit decision entry. An IP-scoped interpretation, nginx 403, TLS Full (strict), a private proxy token or successful header tests do not silently pass this host-wide firewall criterion. The separate T17 wording about other allowed ports must also be reconciled against all unrelated listeners before full P2 acceptance; this preparation is scoped to 80/443 and does not claim a complete host firewall pass.

OriginMetric's original-peer `geo $realip_remote_addr` check, site-specific real-IP trust, XFF/X-Real-IP stripping and overwritten private token protect its upstream path. They act after the TCP connection (and HTTPS handshake) reaches shared nginx. Direct peers can still reach tradebot's default vhost; OriginMetric HTTP-01 has a public path exception. Existing private-port DROP rules cover 3000/5432/8088, not 80/443. Thus those verified protections remain useful, while **the locked 80/443 requirement remains unmet**.

New SSL evidence is the user's supplied panel-image observation, “Current encryption mode: Full (strict)”, under SSL/TLS Overview. It is recorded as panel evidence, without claiming this session retrieved or independently inspected the image through Cloudflare, or verified the setting via API. This resolves the previous absence of explicit panel evidence; account-level independent verification remains distinct.

### Fresh read-only topology and dependencies

`nginx -T` succeeded; output was parsed with only selected directives emitted and origin addresses redacted. The private token include was never printed. `ss`, `ip -j addr`, `iptables-save`, `ip6tables-save`, nft table names, Docker port bindings, systemd state and certificate renewal configuration were inspected read-only. Public origin addresses and private credentials are omitted here.

| Dependency | Observed configuration | Effect of restricting shared 80/443 |
|---|---|---|
| Public network | `eth0`: one global IPv4 and one global IPv6; other global-scope IPv4 addresses are Docker bridges, not spare public addresses | No observed spare public IP; both families require rules even though nginx currently has no IPv6 web listener |
| nginx | Only `originmetric` and `tradebot-dashboard` enabled; wildcard IPv4 80 and 443, tradebot `default_server` | Cannot distinguish hostnames in a TCP-source firewall; a shared restriction affects both sites |
| OriginMetric | apex/www, Let's Encrypt SAN certificate; public health/static proxy to `127.0.0.1:8088`; event 202/drop, other data routes closed | Cloudflare traffic can continue; direct ACME validation needs a compatible renewal path |
| tradebot-dashboard | IP-literal `server_name`, HTTP redirects to HTTPS IP; `/login`, `/api/status`, `/api/portfolio` and catch-all proxy to loopback 8786; existing certificate `tradebot-dashboard` | Direct-IP web users, clients and monitoring lose access unless migrated first; no user/client inventory is inferable from config alone |
| tradebot-portfolio | Active systemd service under `/opt/tradebot/app`, no separate 80/443 listener observed; dashboard exposes `/api/portfolio` | Portfolio process need not restart; its browser/API consumers are affected through the dashboard. Outbound integrations were not assumed inventoried |
| Certificate renewal | Both production certificates use webroot HTTP-01; OriginMetric cron 02:23/14:23, tradebot timer 00:00/12:00 plus randomized delay; both use `/opt/tradebot-dashboard-tools/bin/certbot` | IP-certificate HTTP-01 renewal cannot rely on proxied hostname DNS; keep its job until access migration/retirement is explicitly authorized |
| Firewall | UFW inactive; IPv4 INPUT ACCEPT/FORWARD DROP, IPv6 INPUT/FORWARD ACCEPT; nft-backed filter/NAT tables; no Cloudflare allowlist on INPUT | Add narrowly scoped rules with the existing backend; do not enable/reset UFW or flush Docker/nft tables |
| Existing OriginMetric rules | INPUT drops eth0 TCP 3000/5432/8088 in both families; DOCKER-USER drops new ingress to the two OriginMetric bridges | Preserve these rules and `originmetric-firewall.service`; this is separate from host web protection |
| SSH and private upstreams | SSH wildcard IPv4/IPv6 22; Caddy loopback 8088; app/DB unpublished; dashboard loopback 8786 | Rules matching only public web ports leave SSH, loopback and unpublished services intact |

nginx/SSH/dashboard/portfolio remained active with main PIDs `427077 / 427051 / 427132 / 427105`, and unchanged start times. This is topology/service evidence, not a fresh authenticated functional test of tradebot. Other project directories, application source, secrets, logs and databases were not read to discover credentials or clients.

### Options and recommendation

| Option | Protection and acceptance | Dependencies / effect |
|---|---|---|
| **A — migrate all shared web consumers to proxied domains, then host-wide Cloudflare allowlist (recommended if tradebot URL migration is acceptable)** | Meets the existing 80/443 transport requirement without changing its text, after external tests pass | Owner supplies a tradebot hostname/zone and approves client URL migration. Keep old IP access until replacement is tested; direct-IP access necessarily ends at cutover. Both projects retain functionality through tested domains; SSH unaffected |
| B — dedicated OriginMetric public IP on this VPS | Can enforce Cloudflare-only on a destination IP while tradebot stays direct on the old IP | Requires provider address/routing availability, cost approval if applicable, explicit IP-bound nginx listeners (including default tradebot), A/AAAA changes and destination-scoped firewall. **Other host IP still exposes 80/443: not a host-wide pass.** Requires explicit owner/plan decision accepting endpoint scope before acceptance; no such decision exists |
| C — move OriginMetric to a dedicated host with Cloudflare-only ingress | Separates the product origin completely and preserves tradebot direct access on this host; new product host can meet host-wide 80/443 restriction | Requires host/cost/access/backup migration inputs and explicit architecture decision against D-002's existing-VPS direction. No purchase/migration authorized here |
| D — accept current per-vhost gate, add AOP/mTLS, or use Tunnel | Additional request authentication or outbound ingress can strengthen isolation | Current shared host still exposes tradebot 80/443. These do not establish the locked firewall pass; a Tunnel also changes ingress dependencies. Requires a reviewed decision if selected; not the default recommendation |

**There is no same-host solution that simultaneously preserves unrestricted tradebot direct-IP 80/443 and satisfies host-wide Cloudflare-only 80/443.** Prefer A to preserve the locked requirement and existing VPS. If the owner requires the old direct-IP URL to remain, do not apply A; select B with an explicit criterion decision or C with an explicit architecture decision. Until that decision/input, keep the acceptance blocker open. Neither owner approval nor implementation is implied by this preparation.

Cloudflare's [origin allowlist guidance](https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/) supports allowing its origin-facing ranges and blocking other sources. The official [IPv4 list](https://www.cloudflare.com/ips-v4) and [IPv6 list](https://www.cloudflare.com/ips-v6) were checked 2026-10-02 (15/7 ranges, matching the committed nginx list); re-fetch and validate them at implementation. These public documentation reads are **not** account/API setting verification.

### Concrete proposed changes for A (not applied)

1. **Tradebot replacement vhost:** owner-selected `<TRADEBOT_HOST>`; proxied A record to the existing IPv4, no origin AAAA unless an explicit IPv6 listener is added and tested. Add `/etc/nginx/sites-available/tradebot-cloudflare` and enabled symlink. Use `listen 80` and `listen 443 ssl`, `server_name <TRADEBOT_HOST>`, a hostname-valid certificate in `/etc/letsencrypt/live/<TRADEBOT_HOST>/`, HTTP 308 to `https://<TRADEBOT_HOST>$request_uri`, and the existing tradebot locations/upstream `http://127.0.0.1:8786`. Copy existing auth, proxy, timeout, security and caching directives without weakening them. Preserve location-specific protections. Confirm app Host/Origin, allowed hosts, CSRF, cookies, redirects, absolute URLs, login/session behavior and any WebSocket consumers on this hostname; no application patch assumed necessary. Do not copy OriginMetric's private token into tradebot.
2. **Keep OriginMetric trust and data gates:** no change to its upstream/header/token directives, `OM_INGRESS=nginx`, `PUBLIC_G1_READY=no`, event 202/drop, identify/revenue 503, private/fixture 404. Remove its unauthenticated HTTP challenge location only after DNS-01 renewal succeeds; its normal HTTP peer gate then covers all paths. The new tradebot vhost must not become a bypass into OriginMetric upstreams. Use a separate fail-closed default web vhost returning 444 for unknown Host/SNI routing once the old IP site is retired; keep legitimate vhosts explicit.
3. **Certificates before firewall:** issue hostname certificates and use automated DNS-01 for OriginMetric and the new tradebot hostname. [Let's Encrypt challenge documentation](https://letsencrypt.org/docs/challenge-types/) confirms HTTP-01 requires port 80 and DNS-01 uses TXT records. This avoids opening firewall exceptions for ACME and avoids relying on edge rules allowing challenge paths. Audit the reused Certbot environment's DNS plugin availability first; installing a plugin needs its own reviewed dependency step. Supply narrowly scoped DNS credentials only into root-owned mode-600 files, never in command arguments/repo/chat. Use separate cert names/jobs and successful dry-runs; retire tradebot's old IP-certificate renewal only when its endpoint is explicitly retired. Record exact replacement schedules. No broad `certbot renew` affecting unrelated certs.
4. **Public web firewall:** add dedicated chains `OM_CF_WEB4` and `OM_CF_WEB6` in the existing IPv4/IPv6 filter backend. Populate reviewed ranges before attaching jumps. Proposed chain semantics below; repeat each source line for every corresponding validated range. Use `-C` checks for idempotent jumps. No global policy change, flush, NAT edit, SSH rule or Docker chain replacement.

```text
IPv4 filter:
  -N OM_CF_WEB4
  -A OM_CF_WEB4 -s <each official IPv4 CIDR> -j RETURN
  -A OM_CF_WEB4 -j DROP
  -I INPUT 1 -i eth0 -p tcp -m multiport --dports 80,443 -j OM_CF_WEB4
IPv6 filter:
  -N OM_CF_WEB6
  -A OM_CF_WEB6 -s <each official IPv6 CIDR> -j RETURN
  -A OM_CF_WEB6 -j DROP
  -I INPUT 1 -i eth0 -p tcp -m multiport --dports 80,443 -j OM_CF_WEB6
```

This is a reviewable rule specification, **not an executable script**: placeholders must be replaced with validated lists. RETURN resumes existing INPUT evaluation, preserving other restrictions. The jumps must precede any broad ACCEPT/ESTABLISHED rules; there is deliberately no non-CF ESTABLISHED exception on these web ports. Previously established direct web connections are also blocked at cutover. Loopback does not match eth0; TCP 22 and other ports do not match. No UDP 443 listener is observed; block public UDP 80/443 in both families in the same scoped change to prevent future QUIC bypass (Caddy UDP publication stays disabled).

5. **Persistence and range refresh:** a separate idempotent `/usr/local/sbin/originmetric-cf-web-firewall` with `apply/remove` and a dedicated systemd oneshot service before nginx starts (`Before=nginx.service`, enabled for boot) should restore these chains. Verify the unit ordering and startup failure behavior in staging before enabling. Keep existing private-port service intact; do not persist/restore all Docker-generated rules. Range updates require TLS download, CIDR/family validation, a nonempty reviewed list and staged replacement; keep the last known good list on fetch/validation failure. DNS credential files and firewall snapshots stay private. Include provider firewall rules if any are discovered; provider control-plane policy was not inspected here.

**Blast radius:** all public eth0 web consumers in both families and certificate automation for both sites. tradebot app/portfolio services and SSH need no restart. nginx reload affects workers for both sites and is only done after `nginx -t`. No code redeploy, schema migration, DB write, backup restore or ingestion enablement is part of this cutover.

### Implementation inputs, tests and rollback

Required non-secret inputs: whether tradebot's direct-IP URL may retire; its replacement hostname/Cloudflare zone; list of human users, API/automation/WebSocket clients and monitors requiring URL updates; owner-approved cutover window and functional tester; DNS-01 provisioning method/plugin; provider console/recovery access; confirmation of any other external interface/provider firewall. DNS credentials/private keys must be provisioned securely on the host, never sent in chat. B additionally needs provider-assigned IPv4/IPv6, routing/interface details, budget and an explicit endpoint-scope decision. C needs an approved host and D-002 architecture decision. No response to these inputs is assumed.

Future implementation sequence/tests (none claimed run now):

1. Save private mode-600 nginx/cert-renewal/cron/systemd/firewall snapshots and DNS record values/TTLs; record service PIDs and hashes. Keep two SSH sessions and provider recovery console. Stage both rule families and an automatic **5-minute rollback** that removes only the new jumps before enabling the first family; never rely on a web connection for recovery.
2. Before web restriction, owner authenticates to the new tradebot hostname: login/logout, session persistence, status/portfolio, required read-only API clients and WebSockets if used. Verify auth remains enforced, cache does not expose private responses, certificate chain/hostname and Full (strict). Complete hostname DNS-01 issue/renew dry-runs for both sites. Update consumers and prove no old direct-IP dependency remains. If any fails, leave the old site/firewall intact.
3. Stage `nginx -t`; apply/reload only reviewed vhosts. Attach staged IPv4 and IPv6 web jumps; check ordering/counters and open a **new** external SSH connection over each family. Do not accept survival of an existing SSH session as sufficient.
4. From at least two independent non-CF IPv4/IPv6 nodes: TCP 80/443 must not establish to every public origin address, including unknown Host/direct IP and spoofed CF headers; TCP 22 positive controls succeed; 3000/5432/8088 remain unreachable. VPS-local 403 is not a transport-pass substitute. Recheck no published Docker web port bypass and no public UDP 443 response/listener.
5. Through the real edge: both projects' hostname HTTPS works; OriginMetric root/health/tracker 200, www path/query 308, unchanged data gates/no-store/cache behavior. Re-run private synthetic original-peer/client-IP/token-spoof proof without printing captures. Confirm production facts stay empty. Domain IPv6 client transport through Cloudflare is a separate check from direct-origin IPv6 scanning.
6. Verify active range set, persistent service ordering, both certificate renewals and monitors. Exercise reboot/persistence in an isolated environment; a production reboot requires separately authorized maintenance. Cancel timed rollback only after both external SSH and both site functional checks pass. Record external measurements and mark only the shared-port criterion satisfied; G1/backup/dogfood/P2 acceptance remain separate.

Rollback on either site's failure, certificate regression, SSH failure or unexpected listener: remove INPUT jumps with exact `iptables -w -D INPUT -i eth0 -p tcp -m multiport --dports 80,443 -j OM_CF_WEB4` and IPv6 equivalent to `OM_CF_WEB6`, plus the exact UDP jumps introduced at implementation; disable only the new persistence unit. Then delete only the now-unreferenced new chains. Do not run UFW reset, restore all nftables/iptables blindly, flush INPUT/DOCKER-USER, delete conntrack state or alter SSH. Restore changed vhosts/symlinks and renewal jobs from private backups, `nginx -t` then reload. Restore prior DNS/consumer endpoints (allow for TTL propagation) and old tradebot IP endpoint/job. Keep OriginMetric's pre-existing private-port rules, token trust and public data gates throughout. If rollback reopens shared web access, explicitly reinstate the **80/443 unmet** status; rollback is service recovery, not security acceptance.

### This preparation's validation and handoff

Fresh `nginx -T`/syntax, sanitized topology/firewall inspection and unchanged main service PIDs passed. Planned migrations, rule deployment, certificate dry-runs, external web-block scans and tradebot authenticated tests have **not** run. The documentation diff/format and final documentation CI are checked at handoff; final run/SHA result is supplied in the handoff message so the immutable commit is not claimed to contain its own future CI result. Canonical plan and DECISIONS remain unchanged. **G1 pending; P2 unaccepted; P3 not started; data acceptance closed.**

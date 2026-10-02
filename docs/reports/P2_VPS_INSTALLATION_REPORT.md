# OriginMetric — P2 VPS installation report

Date: 2026-10-02 (Europe/Berlin; installation started 2026-10-01 UTC)
Status: **TRADEBOT REMOVED; CLOUDFLARE EDGE / PROXY / HOST WEB FIREWALL VERIFIED — DATA ROUTES CLOSED; G1 / P2 ACCEPTANCE PENDING**
Authorization: Barış's VPS installation instruction and D-004, with latest Tradebot removal decision D-006. **P3 not started.**

The dated sections below record earlier states. The removal/cutover and CI/G1 follow-up sections are authoritative for the current host state.

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

## Tradebot retirement decision and open-position gate — 2026-10-02

**Historical investigation, 12:09–12:18 UTC.** Its PAPER wait interpretation was subsequently superseded by explicit owner permission. Use the recovery continuation below for the current gate and next action.

### Owner decision and applicable instructions

Barış explicitly cancelled the Tradebot hostname migration and authorized retiring Tradebot while retaining all files, databases, history and secrets. Do not create `tradebot.originmetric.app`. The instruction requires a read-only check for active orders/positions and **waiting at the stop step if any exist**, without cancellation or position closure. This direction supersedes the domain-migration proposal above and is recorded as D-005; the locked canonical plan is unchanged.

No AGENTS.md was found at `/`, `/opt`, `/opt/originmetric`, `/opt/tradebot`, or within either project tree (excluding dependency/Git directories). OriginMetric CLAUDE.md, STATUS, DECISIONS, canonical §§20/23/28 and this P2 report were read. Starting branch was `codex/originmetric-p2-vps-preparation`, clean, at `beef0347d9f94d7f01d60ee22e26add17669b028`.

### Stop gate: active PAPER positions — waiting for owner direction

Production SQLite was opened with URI `mode=ro` and `PRAGMA query_only=ON`; application store constructors, credentials, private auth files and account APIs were not used. Observations at 12:09–12:11 UTC:

| Ledger | Open positions | Observation |
|---|---|---|
| Canonical portfolio | **3** | `mode=PAPER`, status RUNNING, recent observation timestamp, managed by `tradebot-portfolio` |
| Shadow portfolios | **8** total | S04=1, S05=2, S06=2, S09=2, S10=1; the other five were empty |
| Legacy portfolio | **0** | Managed by the same running portfolio process |
| External-position reservations | **0** | Canonical state contained no inherited reservation |

The active runner accepts only a `[paper]` policy and its transport allows only GET public market-data endpoints; its local execution updates simulation ledgers. No separate exchange-order queue exists in the inspected state schema. **This establishes the local PAPER configuration, not an independently queried exchange-account order inventory.** No account secrets were read and no exchange orders were cancelled or positions closed. Historical research/parity databases are not treated as running account state.

The owner was asked whether to keep the bot running or explicitly permit stopping while retaining the open PAPER records. No answer is inferred from silence. **Tradebot shutdown, disabling automatic starts, web retirement and the dependent shared-port firewall cutover have not been applied.** Position counts are point-in-time observations and must be rechecked before a future stop.

### Services, schedulers, web consumers and cancelled migration

| Unit | State during investigation | Required retirement action after the stop gate |
|---|---|---|
| `tradebot-portfolio.service` | Active/enabled; PID 427105 | Controlled SIGTERM via systemd; runner handles stop and persists STOPPED state without a forced close command |
| `tradebot-dashboard.service` | Active/enabled; PID 427132, Gunicorn worker 427140; loopback 8786 | Stop/disable after the gate; preserve auth/session secrets |
| `tradebot-history.service` | Inactive/enabled | Disable automatic boot execution |
| `tradebot-research.service` | Inactive/enabled | Disable automatic boot execution |
| `tradebot-paper.service` | Inactive/disabled; legacy exit-only drop-in present | Keep disabled; preserve unit/drop-in; do not invoke `paper-stop` without auditing its effects |
| `tradebot-cert-renew.timer` | Active/enabled; 00:00/12:00 + randomized delay up to 1800 s | Stop/disable when its IP web endpoint is retired |
| `tradebot-cert-renew.service` | Inactive/static; last result success | Keep files/certificates; no blanket Certbot renewal or deletion |

No additional local Tradebot cron job, systemd unit reference or detached process was found in the inspected system locations/process inventory. OriginMetric's cron references the **shared executable** `/opt/tradebot-dashboard-tools/bin/certbot`; retain this installation even after Tradebot retirement. Root crontabs and cron hourly/daily/weekly/monthly locations were checked for references. Remote schedules/accounts are not inventoried.

Fresh `nginx -T`, public TCP/UDP listener ownership, Docker publications, systemd and process inspection identified nginx as the only host public IPv4 TCP 80/443 listener. Its effective configuration loads only OriginMetric and the old Tradebot IP-default site. No host IPv6 web or UDP 80/443 listener was observed. Caddy publishes only loopback 8088; its displayed container-only 443/UDP ports are not host publications. App/DB remain unpublished. Existing other project directories/services were not edited. Provider control-plane firewall and off-host dependencies were not independently inspected.

No enabled/available migration vhost, migration certificate/renewal configuration or service-origin change was found. The running Tradebot origin and its Nginx route remain the original IP endpoint. Authoritative Cloudflare DNS for `tradebot.originmetric.app` returned NXDOMAIN. There is therefore **no observed started migration change to undo**, and no DNS/API account write was performed; this is not a full Cloudflare-zone inventory.

### Backups, unchanged configuration and official ranges

Private ignored snapshots are under `.runtime/p2-tradebot-retirement-20261002T121152Z`, located by `.runtime/p2-tradebot-retirement-path`. The directory is mode 700 and files mode 600. They include Nginx (including the private include), certificate renewal definitions, the OriginMetric certificate cron, Tradebot units/drop-in and both firewall rule sets. A later byte comparison found **all 28 archived regular configuration files unchanged**. Firewall rule definitions were also unchanged after ignoring generated timestamps/counters. Tradebot database backups are a future pre-shutdown dependency; this session only read the live databases.

Official [IPv4](https://www.cloudflare.com/ips-v4) and [IPv6](https://www.cloudflare.com/ips-v6) lists were fetched with TLS validation and checked as nonempty, unique, global, strict CIDRs of the expected family. **15 IPv4 and 7 IPv6 ranges**, all matching the reviewed Nginx trust configuration:

- IPv4 list SHA-256: `ec7cbcfadc91344da6b906b2c564ddd0c9f35de1054f50502762743fee07c5bf`.
- IPv6 list SHA-256: `274414aae4cfacd1f28bf7b5fbbd8bc2c90bebad4cd7f1dfe5bb0c1e8dcbbca1`.

An initial Python urllib fetch received HTTP 403; curl successfully fetched both official lists, which were validated before recording. No new firewall chain, persistence unit, refresh job or automatic rollback timer was installed/armed because the stop gate prevents cutover. Before any future mutation, re-fetch the lists, re-audit listeners, stage web-only rules and an independently tested automatic rollback. Existing private-port protection and SSH must remain intact; never flush/reset firewall or Docker rules.

### Fresh validation and external evidence

| Check | Result in this session |
|---|---|
| `nginx -T` / configuration syntax | PASS |
| Isolated `scripts/vps/test-nginx-proxy.py` | PASS: IPv4/IPv6 forwarding, original-peer gate, XFF stripping and token overwrite |
| IPv4 and IPv6 edge HTTPS `/`, `/api/health`, `/js/v1/om.js` | PASS: 200 with normal TLS validation; health remains DB-backed |
| www path/query redirect | PASS: 308 to apex, preserving path/query |
| Data-route gates, GET-only checks | Event endpoint 202/drop; identify/revenue 503; internal 404; no gate changed |
| Production facts, SELECT-only | events/sessions/customers/revenue/customer-visitors all zero |
| Environment, whitelisted values only | `OM_INGRESS=nginx`, `PUBLIC_G1_READY=no` |
| OriginMetric certificate simulation | **PASS**: scoped `certbot renew --cert-name originmetric.app --dry-run --no-random-sleep-on-renew`, production certificate hash unchanged |
| Service continuity | nginx/SSH/dashboard/portfolio main PIDs unchanged: 427077/427051/427132/427105; Tradebot timer remains active |

The API/internal samples were no-store/DYNAMIC. Tracker IPv4 was BYPASS/no-store; tracker IPv6 was UPDATING without no-store, consistent with static asset caching being separate from data-route gates. No cache purge or cache-policy change was made, and no API cache-hit claim is made.

Six fresh Globalping TCP measurements used two independent probes in **Falkenstein (DE)** and **Helsinki (FI)**, two attempts per probe, and literal origin addresses. Resolved addresses matched the requested family/target:

| Family | Port | Observed on both probes | Measurement |
|---|---|---|---|
| IPv4 | 22 | 2/2 replies per probe; SSH positive control | [result](https://api.globalping.io/v1/measurements/2vq0NoX0eKZr3XG6M00021F6M) |
| IPv4 | 80 | **2/2 replies per probe; direct transport remains open** | [result](https://api.globalping.io/v1/measurements/2ga0REwIhNMQnAfND00021F6M) |
| IPv4 | 443 | **2/2 replies per probe; direct transport remains open** | [result](https://api.globalping.io/v1/measurements/268gNHmBLPGRJCnxS00021F6M) |
| IPv6 | 22 | 2/2 replies per probe; SSH positive control | [result](https://api.globalping.io/v1/measurements/2I8A33w8hEGxZpJwA00021F6M) |
| IPv6 | 80 | 0/2 replies per probe | [result](https://api.globalping.io/v1/measurements/20UYWRjHADbVP5eUc00021F6M) |
| IPv6 | 443 | 0/2 replies per probe | [result](https://api.globalping.io/v1/measurements/2RBmDVTxSlrvoSZid00021F6M) |

IPv6 non-response does not establish a source allowlist; no IPv6 web listener exists and the host INPUT policy remains ACCEPT. **Direct-origin blocking is not verified and fails on IPv4.** Existing per-hostname HTTP 403 protection cannot replace transport restriction. Original private API JSON is retained only in the ignored mode-600 snapshot directory. The first request with unsupported location strings failed before a measurement was started; it was corrected to Europe probes. A display parser expected an obsolete nested location field and failed after all measurements were saved; parsing was corrected without issuing more measurements.

### Certificate compatibility and remaining implementation dependencies

OriginMetric currently renews its apex/www certificate with HTTP-01 through `/var/www/originmetric-acme`, scheduled at 02:23/14:23 Europe/Berlin using the shared Certbot installation. The scoped staging renewal succeeded **before** any firewall change; no production certificate was replaced and deploy hooks were not requested for the simulation. This is not proof of renewal under the future restriction.

HTTP-01 via the **proxied hostname** can be evaluated after Tradebot retirement and staged firewall restriction, keeping the challenge route reachable through Cloudflare and checking edge redirects/WAF/cache. It avoids a new DNS credential/plugin if its post-restriction renewal simulation succeeds for both SANs. It must not depend on temporarily reopening direct-origin 80 or on a Let's Encrypt IP allowlist. [Let's Encrypt challenge documentation](https://letsencrypt.org/docs/challenge-types/) explains the HTTP port-80 and DNS-TXT methods.

If this cannot be validated, use automated DNS-01. The inspected Certbot environment does not have the Cloudflare DNS plugin installed. Required token permission is **`Zone:DNS:Edit`, scoped only to `originmetric.app`**, per the [plugin documentation](https://certbot-dns-cloudflare.readthedocs.io/en/stable/). Proposed secure credential path: `/etc/letsencrypt/cloudflare-originmetric.ini`, root-owned mode 600, containing the plugin's `dns_cloudflare_api_token` field; provision it directly on the server, never in chat, command arguments, Git or reports. No global API key/account-wide privilege is requested. Plugin installation/compatibility and secure credential provisioning remain unperformed; no token file was created.

After an explicit owner answer to the PAPER stop gate: take consistent private backups of the state databases; audit shutdown/ExecStop behavior and stop/disable only Tradebot units/timer; unlink only its enabled Nginx site while retaining source files/certificates and the shared Certbot tools. Replace its default web routing with a reviewed fail-closed default where needed. Test nginx and reload only after a successful syntax check. Stage a tested timed rollback **before** IPv4/IPv6 TCP/UDP web-only firewall jumps, retain SSH and Docker/private-port rules, then verify new external SSH connections, edge health/tracker and scoped renewal under restriction. Cancel rollback only after the checks pass. Provider recovery access, persistence/range refresh and any newly discovered dependency must be addressed rather than assumed absent.

Documentation diff/format and secret checks are performed before the normal assigned-branch commit/push; final SHA/remote equality and CI state are reported in the handoff rather than invented in this commit. **Tradebot retirement waiting; host-wide 80/443 criterion unmet; G1/P2 pending; public data acceptance closed; P3 not started.**


## Tradebot removal and OriginMetric web firewall — 2026-10-02

### Latest authorization, concurrency and exchange limitation

D-006 supersedes preservation: delete verified exclusive Tradebot resources on the VPS, without new Tradebot backups, remote repository deletion or off-VPS deletion. Domain migration remains cancelled. P2 acceptance, public data opening and P3 remain unauthorized.

The command process tree was traced to app-server PID **1455262** (parent PID 1). PID **1929142** is a CLI under bash **1428600**, terminal `/dev/pts/1`, `originmetric:0.0`; no independent command children/thread writer were present and its screen matched this current task. Older OriginMetric threads had completed/aborted. No other Tradebot writer was found in process cwd/commands or thread lifecycles. No Codex/tmux session was killed; unrelated project agents were not changed. The earlier conclusion based on an old `Working` screen was incorrect.

**Real exchange account state is unknown.** Scoped Tradebot config keys, process environment variable names and available connectors were inspected without revealing values. No authorized account API access was found, so no authenticated order/position query could be completed. This limitation was reported before stopping. The actual portfolio runner enforces a PAPER/SPOT-only policy; both network transports have fixed public market hosts, explicit GET-only endpoint allowlists and no authentication/order endpoint. Canonical execution changes only local simulation ledgers; embedded legacy management uses `PaperSession`. The dashboard reads local state. Thus this running installation was verified not to manage real exchange exposure; no empty-account claim is made. No exchange cancellation or position closure occurred.

Before D-006, authorized recovery work had created three individual online SQLite snapshots, all `integrity_check=ok`, plus host snapshots. The portfolio snapshot at **14:30:54 UTC** contained **3 canonical + 8 shadow PAPER positions** (S01=2, S04=1, S05=1, S06=2, S09=2). The supplied 13:30 report's **3 + 11** is a previous observation of a still-running simulation. Neither count blocked removal. The three new local database copies and their dedicated summaries/manifests were deleted after D-006; no new Tradebot backup was created after the instruction changed.

### Verified exclusive resources removed

A private removal manifest at `.runtime/p2-recovery-path` records **129 scoped entries (including two certificate lineages)**, without credential values. Operations held the existing project operation lock. Removed:

- Controlled stop/disable of portfolio, dashboard, history, research, legacy paper and certificate timer; all **seven** unit files, the legacy drop-in, boot/timer symlinks and timer stamp. Portfolio handled normal termination without a close-position command.
- `/opt/tradebot` including source/local Git history, reports and research; `/root/tradebot-worktree`; `/var/lib/tradebot` including SQLite/WAL/locks/history/cache; `/etc/tradebot` including dashboard auth secrets and their local backup.
- Dedicated `/root/tradebot*` checkpoints, database copies, archive/hash pairs, maintenance scripts, browser evidence/venv; exclusive `/var/backups/tradebot` research/source/database backups; verified `/tmp/tradebot*` research logs, bundles/staging and audit files. Directories were checked for mounts; no parent directory was recursively removed.
- Tradebot nginx enabled/available definitions and dedicated nginx log rotations. Source-identified dedicated nginx/certificate copies in existing OriginMetric backup directories were also removed.
- `tradebot-dashboard` and `tradebot-dashboard-staging` certificate lineages via name-scoped Certbot deletion. The production leaf was referenced only by the removed dashboard vhost; staging had no live nginx consumer. Neither had an OriginMetric SAN; shared certificates/accounts were not deleted.
- Dedicated locked/nologin user and group, after checking remaining UID ownership and processes. No Tradebot user cron existed.

Docker inspection covered every container/image/volume/network: **no Tradebot-owned object existed**. Three containers and all named volumes were OriginMetric; networks/base images were OriginMetric or generic/shared. Nothing was pruned. No package uninstall, remote GitHub operation against Tradebot, external backup deletion or modification to Eternal Dominion occurred.

### Shared or uncertain resources deliberately retained

| Resource | Reason retained |
|---|---|
| `/opt/tradebot-dashboard-tools` | OriginMetric's certificate cron uses its Certbot executable; the complete shared virtualenv is retained, including dependencies whose exclusive ownership is unproven |
| `/var/backups/tradebot-snapshot-20260926` | Its archive contains the now-shared ACME account private keys, nginx configuration and Certbot environment; ownership is mixed despite its name |
| Mixed OriginMetric host archives and nginx snapshots under `.runtime` | Include OriginMetric/nginx/firewall/certificate recovery state; archived Tradebot members may remain, so deletion is not claimed complete for historical shared records |
| system journal, Certbot logs/ACME accounts, system account backup files | Shared host/account history; selective global deletion would affect other services |
| Generic packages and shared browser caches | Shared or uncertain ownership; no global cache cleanup |
| OriginMetric/Eternal resources, other Docker objects, remote repositories/off-VPS backups | Explicitly out of deletion scope |

The live host has no Tradebot process/cwd, 8786 listener, loaded/unit-file entry, timer, dedicated cron or nginx reference. The shared Certbot cron path is the intentional remaining runtime reference. The mixed `/var/backups/tradebot-snapshot-20260926` archive is an explicit historical exception. `/opt/tradebot-dashboard-tools` is the only matching top-level resource in the audited live roots; mixed historical evidence and shared logs may still contain the old name.

Unknown/IP-host routing now uses `/etc/nginx/sites-available/originmetric-default-deny`, sourced from `deploy/nginx.default-deny.conf`: HTTP 444 and rejected unknown TLS handshake, without a new IPv6 listener. OriginMetric's named vhosts and private ingress token remained unchanged. `nginx -t` passed before reload and after deletion; nginx master **427077** and SSH master **427051** remained unchanged.

### Scoped firewall, recovery and renewal evidence

Official Cloudflare lists were fetched over TLS and validated as unique strict global CIDRs: **15 IPv4 / 7 IPv6**, matching the existing nginx trust lists. Dedicated `/etc/originmetric/firewall/cloudflare-v{4,6}.txt` files are root-owned mode 600. Source `scripts/vps/originmetric-web-firewall.sh` is installed at `/usr/local/sbin/originmetric-web-firewall`; `deploy/originmetric-web-firewall.service` is installed/enabled and ordered before nginx. Existing private-port service remains active/enabled.

`OM_CF_WEB4` / `OM_CF_WEB6` are populated before attaching INPUT jumps. Only eth0 TCP/UDP destination 80/443 matches: TCP returns to existing INPUT evaluation for validated CF sources; all other web traffic, including UDP from CF, drops. Jumps precede broad ACCEPT/ESTABLISHED rules. SSH, other ports, existing INPUT policies, Docker/NAT and OriginMetric private-port rules are untouched. No publicly published Docker web path or UDP web listener was found. Other projects' unrelated listeners are outside this change; this is not a claim that every non-22 host port is closed.

Validation before live mutation:

- `bash -n` and `systemd-analyze verify` passed.
- `unshare -n python3 scripts/vps/test-web-firewall.py <range-dir>` passed **30 actual packet checks**. Both families permit CF TCP, block direct TCP and all web UDP, retain SSH/private-port protection, and preserve those rules after repeat removal. Repeat apply creates no duplicate jumps. Invalid second-family input was rejected before either ruleset changed. Tests modify only their own network namespaces.
- A transient three-second systemd action created its expected marker, proving independent scheduling. Its collected timer was already unloaded when cleanup attempted to stop it; the harmless cleanup error did not invalidate the executed action.
- Scoped OriginMetric HTTP-01 staging renewal succeeded after Tradebot removal, with the production certificate unchanged. The existing cron remains 02:23/14:23 Europe/Berlin; only `originmetric.app` is renewed, using the retained shared executable and nginx syntax-check/reload hook.

Before the first live jump, an independent **five-minute** `originmetric-web-firewall-rollback.timer` was armed. Its action calls `/usr/local/sbin/originmetric-web-firewall-rollback`: remove only the exact owned TCP/UDP jumps/chains and disable the new persistence service. It never restores or flushes a shared ruleset. Private pre-cutover firewall/nginx snapshots remain in the ignored evidence directory. The manual recovery command is the same installed rollback executable. Web would become unrestricted after rollback, so the firewall criterion must then be marked unmet.

Under the actual restriction, scoped renewal simulation **passed again**, both certificate SANs succeeded and the production certificate hash stayed unchanged. HTTP-01 through the proxied domain therefore works with the live CF allowlist; DNS-01 credentials/plugin are not required for this setup. IPv4/IPv6 edge root/health/tracker were 200; event GET 202/drop, identify/revenue GET 503 and internal GET 404 remained unchanged. All five production fact tables were zero by SELECT-only inspection.

### Independent external results and current limits

Fresh TCP probes used literal origin addresses, two independent Europe nodes in **Falkenstein/Helsinki**, two packets per probe, and verified resolved targets. Each table result applies to both probes; no VPS self-scan is substituted.

| Port | IPv4 | IPv6 | Measurement links |
|---|---|---|---|
| 22 | 2/2 replies | 2/2 replies | [IPv4](https://api.globalping.io/v1/measurements/2Riq5RhpMnyctuCJk00021F8n), [IPv6](https://api.globalping.io/v1/measurements/2JWGyVopxvXClP6mA00021F8n) |
| 80 | 0/2 replies | 0/2 replies | [IPv4](https://api.globalping.io/v1/measurements/2hhXKAcUrYkdwl1ac00021F8n), [IPv6](https://api.globalping.io/v1/measurements/2kjlXL7u2cjhmL5aS00021F8n) |
| 443 | 0/2 replies | 0/2 replies | [IPv4](https://api.globalping.io/v1/measurements/2csj7U6sYEoqaXUjb00021F8n), [IPv6](https://api.globalping.io/v1/measurements/20vtf66mEEDJxq6BC00021F8n) |
| 3000 | 0/2 replies | 0/2 replies | [IPv4](https://api.globalping.io/v1/measurements/2GSYjwa3GEcWZPKd000021F8n), [IPv6](https://api.globalping.io/v1/measurements/2iSVXXGmh7tsL2lK700021F8n) |
| 5432 | 0/2 replies | 0/2 replies | [IPv4](https://api.globalping.io/v1/measurements/2sAlUqPmDx3umaunG00021F8n), [IPv6](https://api.globalping.io/v1/measurements/2LBvjXnLQ6lRM3VFy00021F8n) |
| 8088 | 0/2 replies | 0/2 replies | [IPv4](https://api.globalping.io/v1/measurements/2z4dl0iAIJW3Guvn300021F8n), [IPv6](https://api.globalping.io/v1/measurements/2fmWI3TlY9Jv8FoV900021F8n) |

The timer was cancelled **only after** renewal, HTTPS/gates, all external probes and live rule-order/service checks passed. Validation took **29 seconds**; completed at **14:45:40 UTC**. No pending rollback or Tradebot job remains. New external TCP connections prove SSH transport reachable in both families; a new authenticated SSH login/provider recovery-console login was not performed. IPv6 has no host web listener, so its external non-response alone does not prove filtering; installed rules plus actual IPv6 namespace packet tests provide the additional policy evidence.

Persistence unit syntax/order and repeat apply were verified; no production reboot was performed. Range refresh is **manual**, with drift rejected on apply. Future refresh must validate official ranges and update nginx trust plus staged firewall chains together, with another timed rollback; do not clear live chains or temporarily reopen direct web access.

**Only the scoped host-web restriction criterion is now verified. G1/P2 remain pending.** Missing G1 runner/deployed evidence, actual-site consent setup, remaining Cloudflare panel inventory/counting-window review, encrypted off-VPS backup plus manual restore, monitoring and owner secret-preservation confirmation are not waived. Public data acceptance remains closed; P3 is not started. Normal assigned-branch commit/push, secret/format checks and local/remote SHA comparison are reported at handoff.


## CI, G1, backup and monitoring follow-up — 2026-10-02

The requested pending CI on `3e954fd3783b3bf1ff9c90b95260ab738f013d08` finished **successfully**: [GitHub Actions #62](https://github.com/brsctncnbrk5/originmetric/actions/runs/37023480832). All required steps passed: full-history secret scan, lint/format/types, migration/schema checks, unit/real-DB tests, tracker budget, production build, Playwright, demo and production Docker consent/encrypted restore proof. The duplicate push run `37023473297` was cancelled by concurrency; no failed CI defect needed correction. Repeating G1 did uncover an existing intermittent regression-test defect: the wrong-secret case replaced the final character with `Z`, leaving a valid key unchanged when it already ended in `Z`. The fixture now always changes that character; production authentication code is unchanged. This is repository validation, not P2 acceptance or a real off-VPS restore.

### Deployed-build G1 technical evidence

Added `npm run gate:g1`, using the existing installed Docker/PostgreSQL image, Playwright and Chromium; no dependency or paid service added. It takes the shared operation lock, requires production `PUBLIC_G1_READY=no`, verifies app/DB/tracker source matches the deployed SHA, and clones the running image without production credentials, volumes or database access. A unique disposable network and tmpfs PostgreSQL hold synthetic data. Both random published ports bind only loopback. Browser routes outside the fixture origin are aborted. Production fact counts are inspected SELECT-only before/after; the runner verifies both fixture containers and network are removed.

| Evidence | Result |
|---|---|
| Deployed source SHA | `b750a1b5262eb83d04810afc2c71c35678ecfbcc`; source/tracker/migrations unchanged |
| Running image ID | `sha256:d21b610017470121198935d78635b00a791ab2eb011b2ff8261fe6e5bc85259e` |
| Live vs clone tracker SHA-256 | Equal: `b629914f93296cbb78d4d09e940c0e0ff78139b59f9a3008ecbae68a9eb6d7e9` |
| Required consent | Zero event requests, cookies, visitor and tracker localStorage before consent |
| Consent/withdrawal | Consent returns 202 in fixture; withdrawal removes state and subsequent SPA navigation sends nothing |
| GPC default | Zero event requests and no visitor identifier |
| Browser trust boundary | Browser identify creates no customers, visitor links or revenue |
| Matching-source regressions | **7 files / 56 tests passed**: tracker, ingestion/origin/8 KB/schema/dedup/failure, process/project/client/daily limits, logger/handler redaction and server-only identify |
| Production facts / cleanup | Five fact counts unchanged; disposable fixture containers/network removed |

Private evidence is reachable through `.runtime/g1-latest-path` (summary and regression log, root-only directory). The normal command reports **technical PASS / overall PENDING**, exit 2. `--technical-only` exits 0 after technical PASS; it is not approval of G1 or the phase. These are tests against an exact image clone and matching source, not consented attribution on the production database or proof that the owner's actual banner is integrated. Earlier missing-runner statements remain historical.

The first fixture attempt revealed Docker internal-only network port publication; it was corrected to a dedicated fixture network with loopback bindings. Handler regression environment is explicitly local for synthetic requests; cloudflare proxy-mode coverage is separately explicit in existing tests. Production proxy mode was unchanged.

### Fresh external health/tracker evidence

Anonymous, existing Globalping access tested both HTTPS endpoints from **Falkenstein and Helsinki** independently of the VPS; **all eight responses were HTTP 200**. No account, subscription or paid credits were started. This proves one-time external availability, not recurring monitoring or notification delivery.

| Endpoint | IPv4, both nodes | IPv6, both nodes |
|---|---|---|
| `/api/health` | [200 / 200](https://api.globalping.io/v1/measurements/2Liv0qnkMYjgbOCao00021F9h) | [200 / 200](https://api.globalping.io/v1/measurements/2G9TEQEvjHvHuGKLB00021F9h) |
| `/js/v1/om.js` | [200 / 200](https://api.globalping.io/v1/measurements/259p4lOhlSmBPg2x900021F9h) | [200 / 200](https://api.globalping.io/v1/measurements/2yfrcsjW6UaSOu9hf00021F9h) |

Private results are in `.runtime/monitor-one-shot-{raw,summary}.json`. Local `nginx -t`, live smoke/selfcheck and SSH/nginx/firewall unit state passed. No fixture containers/networks remained after the final G1 run.

### Remaining evidence and required owner input

| Requirement | Current evidence / blocker | Concrete information required |
|---|---|---|
| Actual-site consent / controlled dogfood | Fixture consent passes; actual site/banner integration is unconfirmed. Production data remains closed; no live attribution claimed. | Actual dogfood URL and how banner allow/withdraw invoke `originmetric.consent(true/false)`. Keep real traffic blocked until all G1 evidence is reviewed. |
| Single saved Cloudflare rule | Previous external 60/429/recovery behavior remains evidence; saved rule count/order and counting period were not independently inspected. | Existing authorized panel/API access or redacted saved-rule evidence showing exactly one rule, expression/action/threshold/counting period/mitigation. Put API credentials directly in a scoped server file; do not send tokens in chat. |
| Off-VPS encrypted backup | `AGE_RECIPIENT` and `BACKUP_REMOTE` empty; no root rclone configuration or existing backup objects found. No provider/account selected here. | Existing authorized provider, dedicated bucket/prefix ending `/originmetric`, config file path and **public** age recipient generated on an offline device. Server credential files root-owned mode 600; private age key stays offline. |
| Manual restore of actual remote object | CI synthetic restore passed; actual encrypted upload/download and owner offline decrypt/stream have not occurred. | Owner downloads the uploaded encrypted object on an offline-key device, streams decrypt into `restore-check.sh` over SSH and supplies successful table/migration/count evidence. No plaintext dump saved to disk; no production DB restore. |
| Monitoring / notifications | Live smoke/selfcheck passed; abuse/failure counters empty. `HEALTHCHECKS_URL` / `SELFCHECK_URL` empty; no backup/selfcheck cron. An on-demand selfcheck is not external uptime/alert delivery. | Existing authorized uptime and Healthchecks accounts, separate backup/selfcheck check URLs provisioned privately, and notification destination. External health/tracker checks and backup start/success/fail notification evidence are still needed. |
| Secret recovery | Server secret file protected; offline owner preservation unconfirmed. | Confirm production secrets/config and offline age private key are preserved in the owner's password manager/offline recovery store, without revealing their values. |

Runbook §6 describes secure provisioning and the real backup/manual restore sequence. Nightly backup/per-period selfcheck schedules remain uninstalled until real backup/restore prerequisites pass. No fake remote, offline key on VPS, new subscription or assumed successful alert delivery was substituted. Shared tools, mixed archives and shared logs retained under D-006 were not modified or removed. No app redeploy, production schema write or ingestion opening occurred. **G1 pending; P2 open; P3 not started.**


## Existing configuration re-audit — 2026-10-02

Read the locked canonical §24/25/28/P2, current STATUS and this report; constraints and D-004/D-006 remain in force. [CI #64](https://github.com/brsctncnbrk5/originmetric/actions/runs/37029502463) succeeded on `a64503c2a34516f1cfb460d16a7d110dfe85a2b7`, including the Docker dogfood/synthetic restore step. Its synthetic results are not a real site, remote backup or manual restore proof.

Own command ancestry is Python/bash → app-server **1455262**. PID **1455334** is the app-server daemon updater, with no children or thread rollout open; it is not a separate OriginMetric writer. CLI **1929142**, parent bash **1428600**, terminal **pts/1**, has no independent child writer and attaches to the current thread. Prior screen text was not used as evidence. No new concurrent project writer or held operation lock was identified; no process was killed. The unrelated `/root` CLI and Eternal resources were untouched.

### Observed scope, without credential values

| Dependency | Read-only inspection / result | Meaning |
|---|---|---|
| Existing dogfood site | Enabled nginx hosts are only OriginMetric apex/www and default-deny. `src/app/page.tsx` and actual HTTPS root both show the smoke page; no tracker snippet, required-consent attribute or consent call. Production DB read-only transaction found **0 active projects**, empty allowed-domain list and five zero fact counts. | No configured real dogfood integration is currently proven. An owner site outside this VPS may exist; it was not assumed absent. Fixture helper buttons are technical evidence only. |
| Off-VPS backup | `.env.production` root-owned 600; `AGE_RECIPIENT` / `BACKUP_REMOTE` empty. No project `secrets`/`backups` directory, root default rclone files or relevant process/shell configuration found. | No accessible authorized remote/public recipient was discovered. No provider selected, object uploaded or remote retention executed. Local/shared security archives are not off-VPS DB backups. |
| Monitoring | `HEALTHCHECKS_URL` / `SELFCHECK_URL` empty; no relevant production-container env. No root crontab or project backup/selfcheck cron/timer. Existing scoped certificate cron and firewall units remain. No matching root config entry identified. | Existing external uptime/Healthchecks accounts and notification destination remain unknown. Prior one-time HTTP probes/selfcheck do not prove a recurring monitor or delivery. |
| Cloudflare read access | No relevant env keys in command environment, root shell startup files or production containers. No standard Wrangler/Certbot credential files, project secrets directory, dedicated `/etc/originmetric` credential or callable Cloudflare connector found. Existing `cloudflare-v4/v6` files are public CIDR lists; prior `.runtime` evidence is historical. | Saved zone rule inventory/counting period could not be independently read. Existing account/dashboard access elsewhere may exist; no token guessed or other project's credentials reused. |

Searches returned metadata/key names or matching filenames, not secret values. Scope covered current OriginMetric files, `/etc/originmetric`, enabled nginx definitions, standard root provider configuration paths, relevant shell variables and scheduler references. Other project data and mixed archived credentials were not searched for reusable authority. Shared tools/archives/logs were preserved. There was no provider write, external notification/test ping, data ingestion opening or production project creation.

### One consolidated owner-input list

1. **Dogfood:** choose the exact existing URL (own site or OriginMetric landing page), provide its integration/config location and describe banner allow/withdraw callbacks. Obtain from the site's owner/CMP settings. Acceptance: `data-consent="required"`, zero pre-consent storage/network, withdrawal cleanup; owner confirms actual-site wiring and later controlled consented production attribution. The current smoke page is not accepted as an integrated landing page.
2. **Cloudflare:** provide the `originmetric.app` Zone ID and an existing zone-scoped **Zone WAF Read** token via the private server file below, or redacted saved-rule evidence from the dashboard's rate-limit/custom-rule pages. Obtain from Cloudflare zone Overview and Profile → API Tokens. Acceptance: independently inspect the saved single rate-limit rule, enabled/action/expression/order, threshold/counting period/mitigation and custom-rule inventory. The [official read-only ruleset API](https://developers.cloudflare.com/ruleset-engine/rulesets-api/view/) requires `Zone WAF Read`; no write permission is needed for this inspection.
3. **Backup/restore:** name the existing authorized storage provider and dedicated remote bucket/prefix ending `/originmetric`; provision its scoped rclone config and public age recipient. Obtain config from that account's storage console and recipient from `age-keygen` on the offline-key device. Acceptance: real encrypted off-VPS upload, owner download/decrypt stream into isolated manual restore, table/migration/count results; confirm production config and private key are saved in the owner's encrypted recovery store. Do not put the private age key on the VPS or in chat.
4. **Monitoring:** identify the existing uptime/Healthchecks account, health/tracker monitors, separate backup/selfcheck checks and notification destination. Obtain from those dashboards/check integrations; provision check URLs privately. Acceptance: recurring external HTTPS checks, scheduled backup/selfcheck and demonstrated delivery. **Before any external notification or test ping**, name destination and exact start/success/fail or alert operation and obtain explicit approval. Provisioning URLs is not permission to send. No notification approval was requested without a known destination.

The secure placement steps are in the [installation runbook](../runbooks/VPS_INSTALLATION.md#p2-erişimlerini-güvenli-yerleştirme). Only paths, non-secret identifiers/public recipient and redacted evidence belong in chat. No paid service, new subscription or target was assumed. **G1 pending; P2 remains open; public ingestion remains closed; P3 not started.**

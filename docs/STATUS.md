# OriginMetric — Project Status

> Single source of truth for "where are we". Read after `CLAUDE.md`, before anything else.

| Item | State |
|---|---|
| Current phase | **P2 — Deploy the slice & dogfood**: CLOUDFLARE EDGE / PROXY / HOST WEB FIREWALL VERIFIED; G1 PENDING |
| P0 | **COMPLETE / ACCEPTED** (Barış + ChatGPT: APPROVE AS-IS, 2026-09-28) |
| P0-R1 | **COMPLETE / ACCEPTED** (PASS; no further revision) |
| Accepted P0 head | `b99a4a9e4ea56a29f47f29eb1f91916cdcecaaa4` — final CI: GitHub Actions run #4 **success** — https://github.com/brsctncnbrk5/originmetric/actions/runs/36399409364 |
| P1a | **COMPLETE / ACCEPTED** (Barış + ChatGPT technical review: APPROVE AS-IS) |
| P1b | **TECHNICALLY COMPLETE / PROCEEDING AUTHORIZED** (`codex/originmetric-p1b-vertical-slice`) |
| P2 | **TRADEBOT REMOVED; WEB FIREWALL VERIFIED — DATA ROUTES CLOSED; ACCEPTANCE PENDING** |
| P2 last full-suite tested code head | `fea039e51dd8eb43804b33cd281ead6353d7dc70` — [CI run #68: success](https://github.com/brsctncnbrk5/originmetric/actions/runs/37039757133) |
| P1a code commit | `760362f` (CI-verified; the final P1a commit is the STATUS commit on top of it) |
| P1b code head | `9ce12b7672141d2d42f43992c5a766f3609f59c7` — CI run #38 **success** — https://github.com/brsctncnbrk5/originmetric/actions/runs/36911778514 |
| P1a base `main` | `03aaea9e9abf779c704b974909495a20189f6edf` |
| P1a implementation branch | `claude/originmetric-p1a-core` |
| P0 base commit | `1b7b1e2539b590614cf762aca1e7b47db3ac14d0` (`main`) |
| P0 implementation branch | `claude/originmetric-p0-foundation` (accepted; fast-forwarded into `main`) |
| Repository | `brsctncnbrk5/originmetric` (default branch `main`, public) |
| MASTER DEVELOPMENT PLAN v1 | **REJECTED / SUPERSEDED** (commit `4b24e5c`; Git history only; do not use) — D-000 |
| MASTER DEVELOPMENT PLAN v2 R1 | **APPROVED / LOCKED** (2026-09-28) — [`docs/planning/MASTER_DEVELOPMENT_PLAN_v2.md`](planning/MASTER_DEVELOPMENT_PLAN_v2.md) — D-001 |
| PLAN-0 | **COMPLETE** |
| Pre-P0 transition | **COMPLETE** (`main` = `1b7b1e2`, GitHub default branch = `main`, repo renamed and verified) |
| Locked owner decisions | **U0** (D-001) · **U13** core stack (D-002) · **U2** attribution + trusted-link model (D-003) |

## Next step

**2026-10-03 — P2 technical acceptance continuation; G1/P2 still PENDING/OPEN:**
controlled monitoring/backup-failure/backup-missing GitHub notification paths
completed (expected failures; no production outage). Actual email receipt and
independent missing-run monitoring remain unverified. Backup ±50% size warnings,
local freshness/failure watchdog and guarded predeploy GitHub adapter tested.
Retention dry-run deleted nothing; independent 90-day backstop prepared but
**not activated** pending private Actions no-spend verification/source pin.
Tracker origin `/js/` cache headers installed and edge **MISS/HIT/HIT** observed;
Cloudflare browser TTL still **14400 seconds**, saved override review pending.
Production DB/app/volumes unchanged; only the documented nginx cache-header
reload occurred. Daily **03:15 UTC** timer enabled/active; first scheduled result
**PENDING**, next 2026-10-04 03:15 UTC. No new test customer/revenue was created.
[Evidence and remaining seven acceptance items](reports/P2_GITHUB_RECOVERY_MONITORING.md#p2-acceptance-continuation--2026-10-03).

**Prepared next acceptance:** [controlled dogfood and populated restore runbook](runbooks/P2_DOGFOOD_ACCEPTANCE.md).
Local consent/GPC tests pass, but production `/dogfood` is still 404; formal G1,
reviewed deployment, owner browser checks, persisted labelled trusted test chain
and populated-backup restore are still required. Existing empty restore and
owner-reported vault/env attachment steps remain complete; off-phone vault is
DEFERRED. Current age key decision stands. **P3 NOT STARTED; ingestion closed.**
Next owner check is only the saved tracker browser TTL; broader completed
Cloudflare/vault/phone prerequisites are not requested again.

**2026-10-03 — REAL MANUAL RESTORE VERIFIED; P2 still OPEN:** exact GitHub snapshot `om-db-v1-20261003T130037Z-eeab03ba` restored via phone decryption → SSH at **14:45:11–14:45:22 UTC**. Owner reports pipeline **0/0**; independently checked VPS `pg_restore=0`, exact schema/10 tables, 4 migration hashes/timestamps, all 10 domain row counts **0**, and 14 foreign keys with **0 orphan rows**. Empty domain tables do not prove real-visit/revenue freshness or populated relationships. New private final confirmation resolves the receiver's pending-phone flag; historical result files are preserved. Exact temporary restore container absent; task ciphertext staging removed; production metadata/config hashes unchanged. Daily **03:15 UTC** timer **enabled/active/waiting**, next **2026-10-04 03:15 UTC**; no scheduled backup completion yet. Independently observed three successful scheduled HTTPS monitoring runs; uninterrupted five-minute observation/dead-man/email remain unproved. [Final evidence and complete remaining P2 criteria](reports/P2_GITHUB_RECOVERY_MONITORING.md#real-manual-restore-verified-and-remaining-p2-acceptance--2026-10-03).

**Next canonical work / remaining acceptance:** actual `originmetric.app` required-consent/banner/withdrawal/GPC and owner confirmation; formal six-item G1 review before ingestion opens; reviewed deploy/smoke plus persisted trusted identify→payment→attribution, duplicate/refund/renewal and private internal access; backup failure/missing-run/email and dump-size-warning evidence (first scheduled backup still pending); provider lifecycle/retention backstop acceptance; phone-independent secret recovery (**off-phone vault DEFERRED**); saved tracker-cache configuration and explicit limits of direct Cloudflare/original-export review. Earlier panel evidence remains valid; no repeated general GitHub approval or key rotation is required. **G1 PENDING; P2 OPEN; P3 NOT STARTED; data gates remain closed.** No next-phase work begun.

Earlier restore-blocker and pending-phone entries below are historical; the verified result above supersedes them.

**2026-10-03 — real phone stream failed before PostgreSQL / SSH-context bug fixed:** owner reports decrypt **0**, receiver **1**. Latest actual evidence confirms no pg_restore/schema/migration/count/integrity result; no test container remains and production metadata/configs unchanged. Receiver `git show` inherited SSH `/root`, reproduced exit 128 outside the repo; fixed all receiver subprocesses to use the project directory and added safe phase/exit metadata. Synthetic and invalid-archive regression checks from `/root` are preparation only. [Failure evidence and correction](reports/P2_GITHUB_RECOVERY_MONITORING.md#real-phone-attempt-failed-before-restore-ssh-working-directory-fix--2026-10-03). **Next:** repeat the existing phone decryption → SSH pipeline and capture both exits immediately. **Real restore NOT VERIFIED; P2 OPEN; P3 NOT STARTED.** Existing key and **03:15 UTC** timer unchanged.

**2026-10-03 — phone ciphertext hash confirmed / isolated receiver ready:** owner reports `SHA256SUMS` OK and exact expected ciphertext hash. New `scripts/vps/restore-phone.py` prepares streamed-only restoration, exact snapshot-source migration/schema comparison, all ten table counts and 14 FK orphan checks; synthetic and invalid-archive controls are preparation evidence only. No private-key transfer/rotation, plaintext files, production SQL/deploy or timer change. [Validation scope and pending real stream](reports/P2_GITHUB_RECOVERY_MONITORING.md#phone-hash-confirmed-and-isolated-receiver-prepared--2026-10-03). **Next:** phone `age -d` → SSH receiver, capture both exits, then record actual results and cleanup. **Restore NOT VERIFIED; P2 OPEN; P3 NOT STARTED.**

**2026-10-03 — phone prerequisites reported complete / existing key retained by owner decision:** root:600 phone identity, age 1.1.1, 341 GB free and `SSH_PRECHECK_OK` reported by owner. Owner reports screenshot exposure and explicitly declines rotation after the risk was communicated: preserve the existing private key offline and continue the current public recipient for future backups; no key value recorded or transferred. [Decision and source distinction](reports/P2_GITHUB_RECOVERY_MONITORING.md#phone-prerequisites-and-existing-key-decision--2026-10-03). Next: phone ciphertext/manifest download and SHA-256 check, then real isolated restore with schema/migrations/counts/relational integrity. **Restore NOT VERIFIED; P2 OPEN; P3 NOT STARTED.** Daily **03:15 UTC** timer unchanged.

**2026-10-03 — recovery audit: remote readback PASS / real restore BLOCKED:** last service execution (13:00:36–13:00:49 UTC) and private snapshot `om-db-v1-20261003T130037Z-eeab03ba` rechecked. At **13:09:36 UTC**, freshly downloaded ciphertext and exact manifest matched recorded SHA-256/32381 B; this is backup/readback evidence only. Daily timer remains **enabled / active / waiting**, **03:15 UTC**, next **2026-10-04 03:15 UTC**, `Persistent=true`; no scheduled execution recorded yet. Metadata-only result: no usable private age identity discovered in audited OriginMetric/standard age locations; other projects were excluded. **No decryption or PostgreSQL restore ran; schema/migrations/table counts/relational integrity remain NOT CHECKED, `restore_verified=false`.** Temporary downloads removed; no temporary database resources created; production DB/volumes/app untouched. [Audit scope, evidence and minimum offline streaming step](reports/P2_GITHUB_RECOVERY_MONITORING.md#real-restore-audit--2026-10-03). Scoped credential/timer setup is complete. **Next:** owner streams this exact GitHub DB backup, decrypted on the existing offline-key device, to the isolated restore tool; share only exit codes/sanitized results, never secrets. Then finish outstanding canonical P2/G1 consent/dogfood and monitoring/recovery acceptance. **P2 OPEN; P3 NOT STARTED.**

**2026-10-03 — scoped backup identity verified / daily timer ACTIVE:** root-owned mode-600 token file and mode-700 runtime/auth directories verified without displaying contents; token path is ignored and untracked by Git. Scoped credential verified owner `brsctncnbrk5` and active private `originmetric-recovery`. Installed systemd service completed DB dump → age → private draft upload → ciphertext/manifest remote SHA-256 readback → owned retention **PASS** at **13:00:45 UTC** (32381 B; one eligible prior snapshot pruned). Only after fresh remote verification, the daily **03:15 UTC** timer was enabled; systemd confirms **enabled / active / waiting**, next **2026-10-04 03:15:00 UTC**. [Snapshot and activation evidence](reports/P2_GITHUB_RECOVERY_MONITORING.md#scoped-backup-identity-and-daily-timer-activation--2026-10-03). Manual restore remains **UNVERIFIED**; no scheduled-run success is claimed yet. Existing off-phone recovery deferral and G1/P2 acceptance gaps remain open.

**2026-10-03 — D-008 initial implementation (historical identity blocker resolved below):** user authorized GitHub DB backups (03:15 UTC / Türkiye 06:15, 7/4/2, ≤90 days), separate public hosted HTTPS monitoring and phone dashboards. First real consistent DB dump → age → private draft Release upload + ciphertext/manifest remote SHA-256 readback **PASS** (32381 B); no env/config files or private key included, no restore claimed. Separate `brsctncnbrk5/originmetric-monitoring` manual run **37088999270 PASS**, health/tracker 200 with content checks; **5-minute schedule enabled** on its main branch. At initial handoff the backup timer was **disabled/inactive** pending a selected-repo fine-grained Contents RW credential; the scoped activation below supersedes that blocker. Broad owner login was used only for the earlier authorized one-time work. [Actual evidence, dashboards, times and exact credential/restore steps](reports/P2_GITHUB_RECOVERY_MONITORING.md#d-008-uygulama-gerçek-db-backup-ve-bağımsız-monitoring--2026-10-03). General approval is already given; canonical plan file unchanged. Phone-off vault backup **DEFERRED**, actual restore/email/dead-man/lifecycle/real-domain acceptance still OPEN. **G1/P2 pending/open; data gates closed.**

**2026-10-03 — project-auth remote ZIP readback PASS / concrete proposal:** only `GH_CONFIG_DIR=/opt/originmetric/.runtime/github-auth` was used; API owner `brsctncnbrk5`, recovery repo private and release draft reverified. Existing 1863 B phone ZIP downloaded again; SHA-256 matches original/local/remote digest, CRC/exact members/three manifest hashes pass. This is **not a DB backup or restore**. Earlier push/access blocker is resolved; `c84d67a`/`c1e0e6b` were preserved/pushed and local/remote `c1e0e6b` matched before this task. One **pending** proposal is documented: private draft DB Releases, nightly 03:15 UTC, 7 daily/4 weekly/2 monthly (≤90 d), public GitHub-hosted 5-minute HTTPS checks, mobile GitHub Actions/Releases dashboard; no schedule/upload/notification activated. See [readback evidence, precise configuration, cost/permissions and separate gaps](reports/P2_GITHUB_RECOVERY_MONITORING.md#github-zip-readback-ve-tek-önerilen-yapılandırma--2026-10-03). Off-phone vault backup remains **DEFERRED**; phone-loss readiness incomplete. **G1 pending; P2 open; data gates closed.**

**2026-10-03 — new owner evidence and independent P2 preparation:** user reports all three SHA256SUMS entries OK, harmless-sample decrypt/compare success, real env decryption check without content display, and encrypted env attached/saved in KeePassDX. These are **owner-reported results**, not independent verification or DB/full restore evidence. **Off-phone vault backup explicitly DEFERRED**; phone-independent vault/key/account access remains unverified and phone-loss readiness is incomplete. Backup remote SHA-256 readback and semantic public HTTPS observation are prepared/tested; GitHub monitoring template remains inactive. The earlier global-account audit received 404; the newer project-auth update above now verifies private access and preserves that historical transfer evidence. See [current source-separated results and remaining gates](reports/P2_GITHUB_RECOVERY_MONITORING.md#owner-reported-phone-checks-and-independent-preparation--2026-10-03). **G1 pending; P2 open; data gates closed.** **Historical access/push blocker resolved:** the newer project-auth update above supersedes this session's earlier 403/404 limitation; both local commits were subsequently pushed without rewriting.

**2026-10-03 — owner-authorized private phone download:** verified the existing file manifest and prepared/uploaded a ZIP containing only the four named recovery files. `originmetric` is public and unchanged; created private `brsctncnbrk5/originmetric-recovery`, rechecked visibility, and uploaded one asset to a new draft release. Authenticated server readback matched ZIP hash, CRC and every member. [Private release and download links](reports/P2_GITHUB_RECOVERY_MONITORING.md#private-github-phone-transfer--2026-10-03). No recovery file entered Git history; no public VPS endpoint, app/env/BACKUP_REMOTE/plan change or automatic backup. At transfer time these owner steps were unverified; the newer owner-reported phone checks/vault storage and explicit off-phone deferral above supersede that pending checklist. Independent recovery/restore remains unverified. **G1 pending; P2 open; P3 not started.**

**2026-10-03 — transferred Cloudflare evidence recorded:** the user's panel review (approximately 00:13–01:17 Europe/Istanbul), copied expression and ChatGPT-reviewed JSON summary now support one Active/First IP rate rule (**60 requests / 10 s, Block / 10 s**), one Active/First API cache bypass, empty Custom/Page/Worker/Origin/header-transform inventories, both IP transforms Off and **Full (strict)** in two views. The original screenshots/JSON are not assumed present on the VPS; this agent performed **no direct Cloudflare panel/API or original-export inspection**. The transferred summary reports 22 blocks (10 ratelimit, 11 firewallManaged, 1 bic); both supplied sample Ray IDs match existing VPS behavior records, including the +9 s 429/1015 probe at 2026-10-02 01:26:39 UTC. JSON itself contains no response status. See the [source-separated evidence and canonical assessment](reports/P2_VPS_INSTALLATION_REPORT.md#cloudflare-transferred-evidence-and-acceptance--2026-10-03) and [updated recovery report](reports/P2_GITHUB_RECOVERY_MONITORING.md#cloudflare-transferred-evidence--2026-10-03). The earlier four-panel request is satisfied **at the user-supplied evidence level**; direct saved-rule/original-export verification remains unverified. API bypass does not prove saved static-tracker cache configuration.

**2026-10-03 — age recipient provisioned / local recovery preparation:** age 1.1.1 accepted the supplied public recipient through harmless-sample encryption. Only `AGE_RECIPIENT` changed in `.env.production`; other values, including `BACKUP_REMOTE` and `PUBLIC_G1_READY`, were preserved and **root:root / 600** verified. A separate `env.production.age` was prepared alongside the harmless sample in ignored local storage; no DB backup/upload, key/password generation, private-key transfer or app restart occurred. Canonical plan and runtime remained unchanged. Private-key creation in phone Debian, KeePassDX storage and paper-copy preparation are **user declarations, not independent verification**. The newer owner-reported decryption/vault storage and off-phone deferral above supersede the earlier pending phone checklist; independent recovery/restore remains unverified. See [artifact paths and phone verification commands](reports/P2_VPS_INSTALLATION_REPORT.md#age-recipient-and-separate-env-recovery-preparation--2026-10-03).

**Next concrete owner step (updated after verified restore):** confirm the actual `originmetric.app` required-consent/banner setup and resolve the remaining [canonical P2 acceptance items](reports/P2_GITHUB_RECOVERY_MONITORING.md#real-manual-restore-verified-and-remaining-p2-acceptance--2026-10-03). Credential provisioning, daily timer activation and the exact real manual restore are complete; no repeated token setup, key transfer, general approval or restore request is needed. Off-phone vault backup stays deferred. Email/dead-man/lifecycle, formal G1 and actual-domain consent/persisted attribution acceptance remain open. **G1 pending; P2 open; P3 not started.** `PUBLIC_G1_READY=no`, events **202/drop**, identify/revenue **503**, internal/fixtures **404** remain closed.

**2026-10-02 latest decision implemented: Tradebot removed from the VPS (D-006).** The owner revoked preservation and authorized deleting verified exclusive Tradebot resources. Portfolio/dashboard stopped cleanly; all seven unit files and their boot/timer links were removed, along with the dedicated nologin account, source/local Git worktrees, databases/research/history, auth secrets, logs, local checkpoints/bundles and dedicated certificates. No Tradebot Docker object existed. The removal manifest records 129 scoped entries; the account was removed separately. Backups created before the new deletion instruction were also removed. No new Tradebot backup was created after that instruction.

No other active Tradebot/OriginMetric writer was identified after excluding the current app-server tree and checking prior thread lifecycles; the old CLI screen was not used as proof of independent work. Before stopping, the unavailable real-account access was reported: **remote exchange orders/positions remain unknown**. Running code/configuration was independently verified to enforce PAPER-only policy, public GET-only market transport and local execution; it does not manage real exchange exposure. No exchange orders were cancelled or positions closed. Final checks find no Tradebot process, 8786 listener, unit, timer, cron or nginx route.

**Shared resources retained deliberately:** `/opt/tradebot-dashboard-tools` is still required by OriginMetric's scoped certificate cron. The mixed `/var/backups/tradebot-snapshot-20260926` (shared ACME/nginx/Certbot), OriginMetric host archives, shared journald/Certbot logs and ACME account state remain; these may contain historical Tradebot records and were not treated as exclusive Tradebot resources. Generic packages, shared browser caches, other projects, Docker resources, GitHub and off-VPS backups were untouched. A new default nginx vhost rejects unknown/IP hosts; `nginx -t` and OriginMetric checks pass. See the [removal inventory and limitations](reports/P2_VPS_INSTALLATION_REPORT.md#tradebot-removal-and-originmetric-web-firewall--2026-10-02).

**Host web firewall criterion now verified:** dedicated `OM_CF_WEB4`/`OM_CF_WEB6` INPUT chains restrict eth0 TCP 80/443 to the current official Cloudflare ranges and drop UDP 80/443. Existing private-port/Docker rules and SSH are preserved. The enabled `originmetric-web-firewall.service` runs before nginx. Isolated packet tests passed **30 checks**, including repeat apply/remove, allowed CF transport, blocked direct transport/UDP and preserved SSH/private rules after rollback. A timed independent systemd action was exercised; the actual five-minute rollback was armed before cutover and cancelled only after all checks passed. Scoped HTTP-01 renewal succeeded both after Tradebot removal and **under the live restriction**, with the production certificate unchanged. No DNS credential/plugin was needed.

Independent Falkenstein/Helsinki probes now confirm SSH 22 reachable and direct 80/443/3000/5432/8088 unreachable in **both** families. IPv4/IPv6 edge root/health/tracker return 200; event GET remains 202/drop, identify/revenue GET 503 and internal GET 404. All five production fact tables remain empty. Private evidence is located through `.runtime/p2-recovery-path`. Persistence unit ordering was validated; no production reboot or provider-console login was performed. Cloudflare range refresh is currently manual, with drift causing apply to fail rather than silently accepting different rules.

**2026-10-02 CI/G1 follow-up:** CI #62 on `3e954fd` completed successfully, including full-history secrets, unit/DB, browser/demo, production Docker consent dogfood and synthetic encrypted restore. The duplicate push run was cancelled by concurrency, not failed. Added `npm run gate:g1`: the exact deployed image is tested in disposable, loopback-only fixtures with a temporary database, matching deployed source and identical live tracker bytes. Required consent/withdrawal, default GPC, browser trust boundary and **56 tests across seven regression files passed**; production facts remained unchanged and fixtures were removed. Technical checks pass; overall G1 remains **PENDING** for actual-site consent/banner confirmation and independent saved Cloudflare rule inventory/counting-window review. Default command returns 2 for this pending state; `--technical-only` returns 0 only for technical verification. This command does not approve traffic or the phase.

**Earlier next-work request (superseded by D-007 and the 2026-10-03 update above):** owner supplies actual banner integration, authorized off-VPS storage/config and offline-owned public age recipient, plus independent monitoring configuration and notification destination. No recipient/remote/check URLs or rclone configuration were found; real backup/download/manual restore, schedules and alert delivery cannot yet be claimed. Live smoke/selfcheck passed with empty abuse/failure counters; eight independent Falkenstein/Helsinki IPv4/IPv6 HTTPS health/tracker checks returned 200. CI synthetic restore and one selfcheck are not substitutes for those missing proofs. Provision secrets in server files mode 600, never chat; keep age private key off the VPS. See the [current evidence and precise blockers](reports/P2_VPS_INSTALLATION_REPORT.md#ci-g1-backup-and-monitoring-follow-up--2026-10-02). **G1/P2 not accepted; public data routes closed; P3 not started.**

**2026-10-02 configuration re-audit:** the existing public root is a smoke page without tracker/banner wiring; production has zero active projects and no allowed domains. No off-VPS/check/token configuration was discovered in the inspected project files, standard root config locations, relevant shell environment or production containers. This is scoped absence of configuration, not proof that external accounts/sites do not exist. The [re-audit and consolidated owner-input list](reports/P2_VPS_INSTALLATION_REPORT.md#existing-configuration-re-audit--2026-10-02) distinguish unavailable evidence from technical fixture PASS. CI #64 for `a64503c` is green and recorded. Following the latest instruction, external notification/test messages require a named destination and explicit approval **before** any ping; configured scripts may send them automatically. No ping or test message was sent during this audit.

**2026-10-02 latest preference / preparation (D-007):** dogfood is exclusively `originmetric.app`; no other site touched. `/dogfood` with required consent, allow/deny/withdraw and GPC, a token-protected `/internal/operations` view, a local observation/history collector and local-only encrypted recovery packager are prepared. Three focused browser tests plus snapshot unit checks, production build and tracker budget passed. Production deployment/project key is pending the real off-VPS backup prerequisite; no real-domain banner or stored attribution acceptance is claimed. Production config/image/gates remain unchanged.

At the 2026-10-02 feasibility audit, GitHub private Releases were technically plausible for the small measured streams (DB **32181 B**, config **133120 B**) but that earlier audit had no verified private target/recipient or completed upload/manual restore. The later private phone transfer/recipient/readback evidence above supersedes those target/recipient gaps; real DB backup/manual restore remains open. Their storage/lifecycle/separate-secret backup policy differs from canonical §24; dashboard/Actions do not prove §25 independent dead-man/email delivery. GitHub schedule may be late/dropped; billing/quota access was unavailable. The independent HTTPS workflow is an **inactive template**, not a new scheduled service. Local health/tracker/selfcheck passed; backup/restore/independent uptime remain UNKNOWN. See [feasibility, scope, target/content and owner actions](reports/P2_GITHUB_RECOVERY_MONITORING.md). **P2 open; ingestion closed; P3 not started.**

### Earlier P2 evidence (before D-006 removal and web cutover)

The shared-port domain-migration proposal below is historical and superseded by this decision; it is not the current implementation direction.

OriginMetric still runs image `b750a1b5262eb83d04810afc2c71c35678ecfbcc`; app/DB remain unpublished. Shared nginx proxies to authenticated Caddy on `127.0.0.1:8088` (`OM_INGRESS=nginx`). Live IPv4 **and** IPv6 health transport now proves the true client reaches nginx/Caddy/app, hostile XFF/X-Real-IP are removed and the private proxy token is overwritten; captures were deleted. Direct-origin apex/www HTTP/HTTPS requests, including spoofed CF-range headers, return 403 (VPS-local behavior checks, not independent external scans). SSH, tradebot and unrelated nginx files/PIDs remain preserved.

**2026-10-02 post-Cloudflare verification:** HTTPS root/health/tracker 200 and www path/query 308 passed. Repeated API/internal/fixtures requests were `no-store` + Cloudflare `DYNAMIC`, with no HIT. The owner reports the named rate-limit rule Active/Block and cache bypass active; Pseudo IPv4 Off / visitor-IP removal Off were confirmed from panel images in the supplied handoff, and Workers Routes was reported empty. No dashboard/API access was used here. New user-supplied SSL/TLS Overview panel-image evidence states **“Current encryption mode: Full (strict)”**; this is panel evidence, not independent API verification. Exact rule inventory/order and the saved 10-second counting period remain independently uninspected.

The controlled same-connection IPv4/FRA test returned **60 × 202/drop, then request 61 → 429 / Cloudflare error 1015**. Blocked requests produced no observed CF→origin or private upstream payload, while the adjacent health control reached the origin/app and returned 200. At +2/+5/+9 seconds the endpoint stayed blocked; at +11 seconds it recovered to 202/drop. This independently verifies edge blocking/recovery and behavior consistent with the entered 60 threshold / 10-second mitigation, without proving the saved counting-window configuration. An initial mixed-FRA/CDG test is recorded separately and is not used for timing acceptance. All five production fact tables stayed empty.

**Independent external IPv4/IPv6 checks now PASS:** Globalping remote probes in Falkenstein (DE) and Helsinki (FI) connected to SSH 22 in both families; TCP 3000/5432/8088 had no replies in either family. Literal resolved target addresses were checked; these are external-node measurements, not VPS self-scans. Raw private results and proof scripts are ignored under `.runtime/p2-*`; durable summaries/measurement links are in the [installation report](reports/P2_VPS_INSTALLATION_REPORT.md). Shared 80/443 still do not satisfy canonical §28/P2 and §20/T17/T19 host-wide Cloudflare-only firewall requirements. A dedicated IP on this same host would require an explicit endpoint-scope acceptance decision; the existing per-vhost gate cannot pass the criterion.

**2026-10-02 shared-port preparation (read-only):** only OriginMetric and direct-IP tradebot-dashboard nginx sites are enabled. Both certificates currently depend on HTTP-01; tradebot's default 80/443 site feeds loopback 8786 and exposes portfolio through its API. SSH 22 is separate. Recommended plan-preserving solution: first migrate tradebot users/clients to an owner-selected Cloudflare-proxied hostname and verify functionality, switch both hostname certificates to automated DNS-01, then apply dedicated IPv4/IPv6 web-only Cloudflare firewall chains. This preserves services through tested domains, but necessarily retires unrestricted direct-IP web access. If that URL must remain, use an explicitly reviewed IP-scope decision or a dedicated OriginMetric host with an architecture decision; neither has been approved. No canonical wording or decision was changed.

The [installation report's concrete proposal](reports/P2_VPS_INSTALLATION_REPORT.md#shared-80443-resolution-preparation--2026-10-02) contains file/rule changes, dependency inventory, impact, external tests and timed rollback. Implementation needs tradebot hostname/zone, client/monitor inventory and URL-retirement decision, secure DNS-01 provisioning, maintenance/tester and recovery-console details. No live nginx/firewall/DNS/certificate/scheduler change, data-route opening or P3 work occurred. Starting documentation HEAD `9c2ce800e8b41608b44cebed3cbbdad329a32b40` has [successful CI](https://github.com/brsctncnbrk5/originmetric/actions/runs/36951916150); this handoff's final SHA/CI result is reported after push.

**Earlier handoff (missing runner/shared-ingress/panel-detail requests superseded by later dated updates): G1 is not passed, P2 not accepted, P3 not started.** Public events remain nginx 202/drop; identify/revenue 503; internal/fixtures 404; `PUBLIC_G1_READY=no`. Next: consolidate the six G1 checks against the deployed build (canonical `npm run gate:g1` is still absent), confirm actual-site required consent/banner, independently inspect outstanding Cloudflare settings, resolve shared-ingress acceptance, then controlled production dogfood attribution. P2 also needs real encrypted off-VPS upload, owner download/manual isolated restore, nightly backup/Healthchecks/uptime and owner secret-preservation confirmation. No data-route opening was performed.

Current local checks: nginx syntax, isolated IPv4/IPv6 spoof harness, **9 targeted unit tests**, public smoke/selfcheck and live route/cache/header/edge checks passed. CI #56 on `c4f1601` passed the full suite including browser/demo, production package and synthetic encrypted restore; its fixture restore is not a real off-VPS backup/restore. No app/DB redeploy or infrastructure fix was needed. Existing private security backups/rollback remain; documentation pre-edit copies are in `.runtime/docs-backup-cloudflare`.

GitHub's earlier authorization blocker is resolved. Push uses the existing project-specific `.runtime/github-auth` credential helper only; the global account remains unchanged. Work continues on `codex/originmetric-p2-vps-preparation` with normal pushes and full local/remote SHA comparison at handoff.

**P1a clarification (from the P1a instruction, §3.2):** a late trusted link may reveal sessions from *before* the established acquisition moment; those may recompute attribution. Sessions after the acquisition moment never move acquisition credit.


**Accepted P1a review guardrails:**
- Stored session sources are normalized facts. If source-normalization rules later change and historical sessions must change too, use an explicit migration/rebuild/re-normalization strategy; current `ops recompute` only recomputes attribution from stored session facts.
- `test:true` revenue currently participates in acquisition semantics under the locked model. When test-data deletion/purge is implemented later, tests must prove that deleting test data cannot leave stale live attribution.

## P1b result (2026-10-01)

- Branch: `codex/originmetric-p1b-vertical-slice`, based on canonical `main` `a7969c09c525cf57bcd25d9970e2e52240d6b6b3`.
- Final technical code head: `9ce12b7672141d2d42f43992c5a766f3609f59c7`.
- CI: GitHub Actions run #38 — **success** — https://github.com/brsctncnbrk5/originmetric/actions/runs/36911778514
- Completion report: [`docs/reports/P1B_COMPLETION_REPORT.md`](reports/P1B_COMPLETION_REPORT.md).
- Tracker v0: automatic pageview + SPA navigation, 30-minute/campaign session rules, first-party visitor/session state, UTM/referrer/click-ID hints, `getVisitorId()`, required-consent mode, consent withdrawal clearing, GPC safe default, sendBeacon/fetch failure isolation, no browser identify.
- Public ingestion: `POST /api/v1/e` with public site-key resolution, allowed-origin/Referer fallback, strict 8 KB schema, event dedup, session upsert, already-linked attribution recompute, uniform 202/drop behaviour and no trusted-link creation.
- Fixtures/internal proof: consent/GPC/CSP/storage-disabled/blocked-endpoint fixtures and token-protected `/internal/projects/[id]`.
- Full vertical slice proven: consented Google visit → stored session/source → secret-key server identify → payment → `google / attributed` → internal result page.
- A real ingestion defect discovered by the new regression suite was fixed: an existing session's pageview update now uses the already-`FOR UPDATE`-locked row values rather than raw SQL fragments.

| Check | Result |
|---|---|
| Vitest: **333 passed / 0 failed**, 20 files | PASS |
| P1b ingestion integration tests: 7 | PASS |
| Tracker-core unit tests: 9 | PASS |
| Internal-token unit tests: 3 | PASS |
| Playwright: **10 passed / 0 failed** | PASS |
| Required consent: zero OriginMetric storage/network before consent; withdrawal clears state and stops sending | PASS |
| GPC safe default + explicit `data-gpc="ignore"` | PASS |
| Storage-disabled / blocked-endpoint host-page failure isolation | PASS |
| Strict CSP fixture | PASS |
| Browser identify/link poisoning prevention | PASS |
| SPA direct continuation + campaign split | PASS |
| Complete vertical-slice test | PASS |
| `npm run demo` exact command in CI | PASS |
| Tracker gzip: **2491 B / 2560 B** | PASS |
| lint / Prettier / typecheck / migrations / Next production build / gitleaks | PASS |

**Historical review gate (2026-10-01):** P1b was technically complete and awaiting Barış review; P2 had not started then. D-004 subsequently authorized P2 preparation and installation. This does not claim manual demo viewing or final P2 acceptance.

## P1a result (2026-09-28)

- Branch `claude/originmetric-p1a-core` from `main` `03aaea9e9abf779c704b974909495a20189f6edf`. Code commit `760362f`.
- CI: GitHub Actions run #7 — **success** — https://github.com/brsctncnbrk5/originmetric/actions/runs/36405850470

**Migrations** (forward-only; `0000_foundation.sql` unchanged):
- `0001_p1a_core_domain.sql` (Drizzle-generated): 9 tables `workspaces`, `projects`, `api_keys`, `events`, `sessions`, `customers`, `customer_visitors`, `revenue_events`, `customer_attribution`; `uuidv7()` IDs, `timestamptz`, BIGINT money, `project_id`-leading keys/indexes (only the §12 indexes), composite `(project_id, x_id)` FKs, CHECKs (amount > 0, currency/event_id/prefix/hash formats, link methods, types, statuses).
- `0002_p1a_integrity.sql` (hand-written, not expressible in Drizzle): UPDATE-forbidding triggers on `revenue_events`, `customer_visitors`, `events`; entry-source immutability trigger on `sessions` (only `last_seen_at`/`pageviews` may change); `customer_attribution` session pointers → `sessions(project_id, id)` `ON DELETE SET NULL (<pointer column>)` so copied source strings survive session purge.
- Not created: Better Auth tables, `workspace_members`, `usage_daily`, `job_runs`, billing/subscription/audit tables.
- Verified: empty DB → all apply; P0 DB → 0001/0002 apply (test); `db:check` clean; `drizzle-kit generate` → no changes.

**Implementation**
- ISO 4217: in-repo table (0/2/3/4-decimal exponents), exact decimal formatting via `Intl.NumberFormat` string input, per-currency sums only. No FX, no MRR.
- Source normalization (pure, `rules_version` 1): UTM (trim/lowercase/200-char cap/aliases) → click-ID presence hint (`gclid`/`fbclid`/`msclkid` → google/facebook/bing, `paid (inferred)`, value never an input) → external referrer (known hosts, else registrable domain via `tldts`) → `direct`. Self-referral = project domains and subdomains + built-in payment/auth list + project exclusions.
- Attribution engine `attribute(touches, facts, rules)`: pure; acquisition = min(first link, first payment); eligible = linked visitors' sessions in [acq − 90 d, acq] (inclusive); latest non-direct → `attributed`, all direct → `direct`, none → `unattributed`; ties by (started_at, session UUID). Materializer recomputes one customer inside the fact-changing transaction under a `FOR UPDATE` lock on the customer row.
- Server keys `om_sk_<8 base62>_<43 base62 = 32 CSPRNG bytes>`; stored prefix + SHA-256 hex only; `timingSafeEqual` (dummy compare on unknown prefix); one identical 401 for missing/malformed/unknown/wrong/revoked keys and keys of soft-deleted projects; `last_used_at` at most once per minute; multiple active keys; `revoked_at`.
- `POST /api/v1/identify`: `visitor_id: null` → `skipped` with no writes; else customer upsert + `server_identify` link + recompute in one transaction → `linked` / `duplicate`.
- `POST /api/v1/revenue-events`: strict Zod contract, 16 KB body cap, strict RFC 3339 parser, injected `Clock` bounds; `payload_hash` = SHA-256 of a fixed-shape canonical array of normalized values; unique `(project_id, event_id)` is the race authority (`ON CONFLICT DO NOTHING` → re-read → duplicate/409 with full rollback); refund rules under customer + original-payment row locks; `revenue_api` links.
- Logging: only route, method, status, duration, project_id, api_key_prefix, error_code, outcome; unexpected errors log class + SQLSTATE only. P0 redaction unchanged.
- `ops` CLI (`npm run ops -- …`, esbuild-bundled to `dist/ops.mjs`): `create-project`, `create-key` (secret printed once), `recompute --project <id> (--all | --customer <id>)`.

| Check | Result |
|---|---|
| Vitest: **314 passed / 0 failed**, 17 files (unit 199: engine 25, normalization 60, currency 31, revenue validation/time 52, key format 22, P0 9; real PostgreSQL 18.6 115: constraints 20, identify/401/tenancy 27, revenue/idempotency/refunds/renewals 36, materializer 6, keys 6, ops 10, logging 2, migrations 5, connectivity 3) | PASS |
| Concurrency: 8 identical revenue requests → 1×201 + 7×200, one row, one link; 6 same-`event_id`/different-customer → 1×201 + 5×409, no stray customers; 6 concurrent 300-unit refunds of a 1000 payment → 3×201 + 3×422, total 900 (repeated 6×, stable) | PASS |
| Cross-project DB tests (trusted link, revenue customer, refund_of, attribution row, session pointer, event→session) all fail with FK violations | PASS |
| `npm run check` (lint, format, typecheck, tests, tracker 112 B / 2560 B) | PASS |
| `npm run test:e2e` (Next.js build + Playwright: smoke + server API against the real build) | PASS |
| gitleaks v8.30.1 (full history) | PASS |
| curl walkthrough (below) | PASS |

**curl walkthrough** (live `next start`, key redacted): `ops create-project` → project + `pk_…`; `ops create-key` → `om_sk_5QjOH7Eu_<redacted>` (shown once). identify without key → `401 {"error":{"code":"unauthorized"}}`; identify → `200 linked`; again → `200 duplicate`; `visitor_id:null` → `200 skipped`; revenue `inv_2026_000123` → `201 created, attribution {source:null, status:"unattributed"}` (no tracker yet: correct); retry → `200 duplicate` (same id); amount changed → `409 idempotency_conflict`; email customer → `422 invalid_request field customer_id`; wrong secret → `401`; `ops recompute --all` → `1 customer unattributed`. Server logs contained no key, customer ID or visitor ID. Commands: README "Server API walkthrough".

**New dependencies** (exact pins, runtime): `zod` 4.6.5 (strict API schema validation, anticipated by the plan; already in the lockfile transitively); `tldts` 7.4.16 (+ `tldts-core` 7.4.16; Public Suffix List for registrable domains, zero other deps, bundled list, no network).

**Choices to review / warnings:**
- Session `source` is normalized at ingestion (P1b) and stored; recompute does not re-normalize old sessions, so a later change to project domains/exclusions affects new sessions only.
- Referrer medium is left `null` (plan defines none). Click IDs outrank an external referrer (UTM still wins).
- Self-referral matches the project domain *and all its subdomains*.
- Test payments (`test: true`) count toward the acquisition moment (plan literal); reporting will exclude them later.
- `customer_id` containing `@` is rejected (email-looking PII rule, deliberately broad); IDs are 1–128 printable ASCII without whitespace.
- `occurred_at` fractional seconds beyond milliseconds are truncated (stored precision); two payloads differing only below 1 ms are duplicates.
- Lookback = exactly 90 × 24 h before the acquisition moment, both bounds inclusive.
- Every payment triggers a (bounded, idempotent) recompute; refunds recompute only for a new customer or new link.
- `npm audit`: the 4 known moderate drizzle-kit/esbuild dev-only advisories remain (unchanged from P0).

## P0 result (2026-09-28)

**P0-R1 correction (2026-09-28):** PostgreSQL image `postgres:18.0-alpine` → `postgres:18.6-alpine` (current 18.x patch) in `docker-compose.dev.yml` and CI. Patch-level only: no schema, dependency or architecture change. Full local verification re-run on 18.6: PASS. Tests still assert server major 18 only. Code verified by CI at `9703358` (the final commit is the STATUS commit on top of it): GitHub Actions run #3 — **success** — https://github.com/brsctncnbrk5/originmetric/actions/runs/36399231624

- Code verified by CI at `581979f`; the final P0 commit is the STATUS commit on top of it (see `git log`).
- CI: GitHub Actions run #1 — **success** — https://github.com/brsctncnbrk5/originmetric/actions/runs/36395109290

| Check | Result |
|---|---|
| `npm ci` from lockfile (local clean clone + CI) | PASS |
| ESLint / Prettier check / `tsc --noEmit` (strict) | PASS |
| Vitest: 15 tests, 5 files (unit: clock, logger redaction, tracker budget; db: connectivity, migrations) | PASS |
| PostgreSQL 18 dev container healthcheck | PASS |
| Real-DB connectivity test (asserts server major = 18) | PASS |
| All migrations apply to a clean DB (test + `db:migrate` CLI) + `db:check` + no ungenerated schema diff | PASS |
| Tracker build (IIFE, ES2017) + gzip gate: **112 B** / 2560 B | PASS |
| Next.js production build | PASS |
| Playwright Chromium smoke | PASS |
| `npm run check` / `npm run test:e2e` | PASS |
| gitleaks v8.30.1 (full history, CI + local) | PASS |
| actionlint on the workflow | PASS |

**Pins:** Node 22 (`.nvmrc`; local 22.22.2) · npm 10 · Next.js 16.3.6 · React 19.3.0 · TypeScript 6.0.3 · ESLint 9.39.5 + eslint-config-next 16.3.6 · Prettier 3.9.9 · drizzle-orm 0.45.3 · drizzle-kit 0.31.11 · postgres (postgres.js) 3.4.9 · pino 10.3.1 · Vitest 5.0.2 · @playwright/test 1.63.0 · esbuild 0.28.2 · PostgreSQL 18.6 (image `postgres:18.6-alpine`) · gitleaks v8.30.1 (Docker image).

**Choices to review:**
- Baseline migration `drizzle/0000_foundation.sql` is a no-op (`SELECT 1`): it creates no tables and only proves the migrator records it in `drizzle.__drizzle_migrations`.
- DB tests create and drop a temporary database per test file on the server in `DATABASE_URL` (so the DB user needs `CREATEDB`; the dev/CI users are superusers).
- `.env` is loaded by `drizzle.config.ts` / `vitest.config.ts` with Node's built-in `process.loadEnvFile` (no dotenv dependency).
- TypeScript 6.0.3 instead of 7.x: typescript-eslint 8.70 supports `<6.1`. ESLint 9 instead of 10: eslint-config-next's React/import plugins don't declare ESLint 10 support.
- CI runs on `pull_request`, pushes to `main` and `claude/**`, and manual dispatch. One job, no matrix, no deployment. Public repo: standard runners are free.

**Warnings / limitations:**
- `npm audit`: 4 moderate advisories, all in drizzle-kit's dev-only transitive `@esbuild-kit/*` → old esbuild (GHSA-67mh-4wv8-2f99, esbuild dev-server). Not shipped at runtime and the esbuild dev server is not used. The only "fix" is a breaking drizzle-kit downgrade, so it was left as is. Recheck when drizzle-kit updates.
- Drizzle's postgres-js driver returns timestamps as strings on the raw `sql` client it wraps. P1a should use Drizzle column modes consistently.
- Locally, Playwright used the pre-installed Chromium via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. CI installs its matching Chromium.

## Phase log

| Phase | Status | Commit | Notes |
|---|---|---|---|
| PLAN-0 v1 | REJECTED | `4b24e5c` | Superseded |
| PLAN-0 v2 | SUPERSEDED BY R1 (same file) | `c2e2251` | Clean replan from first principles |
| PLAN-0 v2 R1 | REVIEWED (ChatGPT: PASS, no R2) | `facb60d` | Privacy/ingestion gates G1/G2, server-only identify, one Cloudflare rate-limit rule, P0 deps fixed, decisions triaged 3/6/10, Resend corrected, plan-lock workflow |
| PLAN-0 lock | **COMPLETE — APPROVED / LOCKED** | `cf4f87a` | U0, U13, U2 locked (D-001…D-003) |
| Pre-P0 transition | COMPLETE | `1b7b1e2` | Repo renamed to `originmetric`; `main` established as default branch |
| P0 | **COMPLETE / ACCEPTED** | `581979f` (+ STATUS commit) | CI run #1 green; branch `claude/originmetric-p0-foundation` |
| P0-R1 | **COMPLETE / ACCEPTED** | `9703358` (+ STATUS commit) | PostgreSQL image bumped to `postgres:18.6-alpine` |
| P0 acceptance | COMPLETE | `b99a4a9` (accepted head, CI run #4 green) | Barış + ChatGPT: APPROVE AS-IS; P0-R1 PASS; branch fast-forwarded into `main` |
| P1a | **COMPLETE / ACCEPTED** | `760362f` (+ reviewed STATUS head `4fbe69e`) | ChatGPT technical review: APPROVE AS-IS; final reviewed CI run #8 green |
| P1b | **TECHNICALLY COMPLETE / PROCEEDING AUTHORIZED** | `9ce12b7` | CI run #38 green; vertical slice + exact `npm run demo` green; D-004 authorizes proceeding |

## For a fresh Claude Code session

1. `CLAUDE.md` is loaded automatically. Follow its rules.
2. Read this file.
3. Read only the plan section(s) named in "Next step" (or the phase brief you were given).
4. Current task: **P2 VPS preparation**, authorized by Barış (D-004). Read the P2 preparation report and VPS installation runbook. Do not claim P2 live or start P3 without the required VPS evidence.

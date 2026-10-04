# OriginMetric — Decisions Log

Append-only. A decision appears here only after Barış **locks** it. Proposed decisions live in the master plan (§33) until then.
Format: `D-NNN | date | decision | why | alternatives rejected | supersedes`.

---

### D-000 | 2026-09-28 | MASTER DEVELOPMENT PLAN v1 rejected
- **Decision:** MASTER DEVELOPMENT PLAN v1 (commit `4b24e5c`) is REJECTED / SUPERSEDED. A clean replan (v2) was produced from first principles.
- **Why:** among other reasons, the product owner judged that v1 delayed the first end-to-end vertical slice too far.
- **Alternatives rejected:** revising or patching v1.
- **Supersedes:** v1 in full.

### D-001 | 2026-09-28 | U0: MASTER DEVELOPMENT PLAN v2 R1 approved and locked
- **Decision:** MASTER DEVELOPMENT PLAN v2 R1 ([`docs/planning/MASTER_DEVELOPMENT_PLAN_v2.md`](planning/MASTER_DEVELOPMENT_PLAN_v2.md)) is **APPROVED / LOCKED** by Barış. Canonical reviewed commit before the lock: `facb60d70c0afe8a9a64989b75687167258a625f`. PLAN-0 is complete. Implementation is not started; P0 begins only after the pre-P0 transition (plan §28).
- **Why:** Barış reviewed the plan with ChatGPT; the final technical review returned PASS with no R2 required.
- **Alternatives rejected:** a further revision (R2); MASTER DEVELOPMENT PLAN v1 (already rejected, D-000).
- **Supersedes:** the "READY FOR USER REVIEW" status of v2 R1. Later changes to the plan require a new explicit decision entry.

### D-002 | 2026-09-28 | U13: core stack locked
- **Decision:**
  - Application: **Next.js 16 + TypeScript**
  - Database access: **Drizzle**
  - Database: **PostgreSQL 18**
  - Architecture: **modular monolith**
  - Deployment direction: **Docker Compose on the existing VPS**
- **Why:** everything builds on it and it is high lock-in; the plan's technology decision matrix (§32) recommends it.
- **Alternatives rejected:** the §32 alternatives. No other framework, ORM or database may be substituted without a future explicit architecture decision recorded here.
- **Supersedes:** —

### D-003 | 2026-09-28 | U2: attribution semantics and trusted-link identity model locked
- **Decision (attribution):**
  - Primary attribution: **customer-level last-non-direct touch**.
  - Lookback: **90 days**.
  - Direct does **not** overwrite an existing eligible non-direct touch.
  - First touch is retained as **secondary** attribution information.
  - **Unattributed** is separate from **Direct**.
  - Renewals inherit the customer's acquisition attribution.
  - Refunds remain assigned to the customer's acquisition source and reduce net revenue.
- **Decision (identity trust):**
  - Browser data **cannot** create visitor ↔ customer links.
  - Only **secret-key authenticated server-side** operations may create links. Supported trusted paths: `POST /api/v1/identify`, or `visitor_id` supplied with an authenticated revenue event.
  - Browser `identify()` is **not** part of the MVP. Signed browser identify remains a possible post-validation feature only.
- **Why:** this is the product's core definition and its data-integrity model (plan §3, §4.4, §7.1b).
- **Alternatives rejected:** first touch as primary; a user-selectable attribution model from day one; browser/unsigned identify in the MVP.
- **Supersedes:** —

### D-004 | 2026-10-02 | Proceed with P2 VPS preparation and Codex VPS handoff
- **User instruction:** “Vpse kurulum için gerekli olan hazırlıkların hepsini bitir ... 1 tmux oturumu ... ben kodeksi o klasörde çalıştırayım ve kurulumu sen yap.”
- **Decision:** Complete P2 repository-side preparation now. Installation continues through Codex in a single `originmetric` tmux session in `/opt/originmetric`, after a host audit. ChatGPT/Codex is the implementation agent.
- **Review basis:** P1b automated technical verification and CI/demo were reviewed. Manual demo viewing by Barış was not performed or claimed. This explicit instruction authorizes advancing with P2 preparation despite the prior waiting state; it does not declare production G1 or P2 acceptance.
- **Constraints:** No paid service without prior approval; preserve unrelated VPS projects and services. DNS, domain, backup account and actual VPS topology are resolved during installation. Stop after P2, with evidence and report.
- **Supersedes:** P1b's waiting restriction only for proceeding with the authorized P2 preparation/installation; attribution semantics and other locked decisions are unchanged.

### D-005 | 2026-10-02 | Cancel Tradebot hostname migration; retire Tradebot after a real-account check
- **User instruction:** Cancel the earlier Tradebot domain migration; do not create `tradebot.originmetric.app`. Retire Tradebot, preserve files/databases/history/secrets, and restrict shared web ingress to Cloudflare when dependencies permit.
- **Decision:** Inventory Tradebot and other web consumers first. Open PAPER positions are explicitly permitted to remain in preserved databases and do not block shutdown. Verify real exchange orders/positions using existing authorized read-only access; real exposure or an unverifiable account blocks shutdown, without order cancellation or position closure. When that check passes, stop and disable only Tradebot and its web routing. Back up and prepare automatic rollback before any scoped IPv4/IPv6 web firewall change, preserve SSH and other projects, and verify certificate renewal plus independent external access.
- **Constraints:** No firewall reset, ingestion enablement, unsupported P2 acceptance or P3 work. DNS credentials are provisioned securely on the server, never requested in chat. No purchases are authorized.
- **Supersedes:** The earlier shared-port Tradebot hostname-migration direction and the initial PAPER-position wait interpretation. The owner's subsequent explicit instruction permits preserving PAPER positions while stopping. D-001's canonical acceptance criterion and D-002's existing-VPS architecture remain unchanged.

### D-006 | 2026-10-02 | Remove verified Tradebot resources from the VPS
- **User instruction:** Completely remove Tradebot from the VPS; revoke its file/database/history preservation requirement. Do not create new Tradebot backups. Do not delete the GitHub repository or off-VPS backups.
- **Decision:** Exclude this session from the concurrent-writer check; do not delete while another Tradebot writer is active. Inventory ownership first, then remove only verified exclusive Tradebot processes, source, local databases/history/backups/secrets, dashboard, units/schedulers, nginx definitions and other resources. Preserve shared or uncertain resources and report them. PAPER records do not block removal. Check real exchange exposure read-only; report real exposure or uncertainty about the running bot's management before stopping/deleting it, without exchange cancellation or position closure.
- **Observed scope:** No authorized exchange-account access was found, so the remote account state remains unknown. Before stopping, this limitation was reported together with the verified running implementation: enforced PAPER-only policy, GET-only unauthenticated public market transport, local simulation execution and legacy PAPER management. This installation does not manage real exchange orders/positions; no claim of an empty exchange account is made.
- **Constraints:** Preserve OriginMetric, Eternal Dominion, SSH, shared packages/certificates and other projects. No parent-directory wipe or Docker prune. For OriginMetric, verify certificate renewal and scoped automatic recovery before web firewall cutover, then external IPv4/IPv6 access. Keep data routes closed; no P2 acceptance or P3.
- **Supersedes:** D-005's Tradebot preservation/retirement direction. Domain migration remains cancelled; the canonical plan and other locked decisions remain unchanged.


### D-007 | 2026-10-02 | OriginMetric-only dogfood; evaluate GitHub recovery and dashboard observations
- **User instruction:** Use only `originmetric.app` for the real dogfood/consent test; touch no other owner site. GitHub is the only existing external service available for backup/monitoring; show observations and alert history in the dashboard. Evaluate private repo/Release and independent GitHub checks against the canonical criteria, announce target/content before first upload, keep private decryption key outside VPS/GitHub, and do not start a paid service/new external account.
- **Decision:** Prepare the actual consent page, local encrypted-recovery packaging and existing-token protected operations view. Evaluate GitHub constraints without creating/uploading to a target or activating external checks/notifications. Keep ingestion closed. Same-VPS observations are not independent uptime; synthetic/browser fixtures are not real-site, off-VPS or manual-restore acceptance.
- **Plan status:** This instruction authorizes preparation/evaluation, not silent replacement of canonical §24 object-storage/lifecycle/separate-secret-recovery or §25 Healthchecks/email delivery. Their GitHub/dashboard gaps and concrete proposed alternative are recorded for the owner's explicit decision. Existing deploy's verified off-VPS backup prerequisite remains in effect.
- **Constraints:** Other projects/sites/shared resources remain protected. External messages/test notifications still need a named target/operation and explicit approval. P2 remains open; no data-gate opening or P3.
- **Supersedes:** The unspecified dogfood-site choice and requests to choose another existing third-party storage/monitoring account. The locked canonical criteria have not been waived.


### D-008 | 2026-10-03 | Activate GitHub-only DB backups and independent public HTTPS observations
- **User instruction:** Implement and enable age-encrypted daily DB draft Release backups to private `originmetric-recovery`, 03:15 UTC / 06:15 Türkiye, 7 daily / 4 weekly / 2 monthly with 90-day maximum; approximately five-minute standard GitHub-hosted HTTPS checks in a separate public repo and phone Actions/Releases access. No repeated general approval is required.
- **Decision:** Complete/test the DB-only upload/readback/owned retention chain, perform the first real encrypted backup and independent manual HTTPS run, then enable schedules when their specific credential/check prerequisites pass. A broad owner token may support the explicitly authorized one-time operations; it must never become the unattended backup identity. If a suitable repo-scoped credential is absent, preserve prepared work and give secure local setup instructions without asking for a token in chat.
- **Scope:** Separate public `brsctncnbrk5/originmetric-monitoring` contains only required public observation code/workflow/results. Regular private DB backups contain no env/config secret files. Existing phone ZIP and unrelated releases/assets are protected. No paid service, global GitHub identity change or history rewriting.
- **Acceptance boundary:** This authorizes these operational actions despite the owner's off-phone vault backup deferral; it does not claim complete phone-loss preparation, real restore, object-storage lifecycle backstop, email/dead-man detection, G1/P2 acceptance or data-gate opening. Canonical plan file is unchanged; its outstanding acceptance differences remain explicit.
- **Supersedes:** D-007's preparation-only restriction for these named operational actions and the pending GitHub configuration approval. All other locked decisions, separate secret storage and production gates remain in force. Off-phone vault backup remains **DEFERRED**.


### D-009 | 2026-10-04 local | One bounded actual-domain G1/1 controlled test

- **Owner instruction:** Explicitly approve only the specified isolated test browser/current test project, `/api/v1/e` access for at most ten minutes, run G1/1, close access, verify closure and retain actual evidence.
- **Scope:** One fresh operator browser, temporary private-cookie/POST/origin/dogfood-referrer gate; existing project and unique campaign. No uncontrolled traffic, identify/revenue events, backup, phone restore or new service/key. `PUBLIC_G1_READY=no` retained.
- **Boundary:** Canonical §28 controlled-traffic test authorization only; formal G1 and enabled-owner GPC are not waived. D-007's closed-ingestion restriction temporarily relaxed only for this one test; route restored immediately after completion. No recurring or further window authorized.
- **Result:** Actual G1/1 PASS in operator-browser scope; one labelled event/session, no customer/link/revenue/attribution. Immediate verified closure within 7.982 seconds. Off-phone recovery remains DEFERRED, existing age identity/recipient unchanged, P2 OPEN and P3 NOT STARTED.


### D-010 | 2026-10-04 | Continue independent P3 development while P2 evidence stays open

- **Owner:** Barış, explicit current instruction.
- **Decision:** Do not wait for pending backup evidence to continue development. Start and complete safe P3 work independent of missing P2 proofs. Block only work with an actual technical dependency; do not alter the canonical phase scope or acceptance criteria.
- **Verified phase:** Canonical §28 **P3 — Accounts, workspaces, projects, keys (tenancy)**; dependencies P2 (or P1b if deployment is delayed) and U1 auth. This is development sequencing authorization, not P2 acceptance or public go-live.
- **Supersedes:** Earlier “do not proceed to P3” restrictions in D-005/D-006/D-007 and historical P3 NOT STARTED next-step instructions. P2 remains OPEN / acceptance pending, G1 PENDING, physical GPC OPEN / NOT PASSED, phone-independent recovery DEFERRED.
- **Constraints:** Preserve existing age key/recipient and installed working backup scheduler; no paid service, production deployment, data-gate opening, test-window reuse, production revenue write or external notification implied. Canonical plan and exit criteria remain unchanged.
- **U1:** Still OPEN unless separately explicitly decided by the owner; independent data-layer/lint/test foundations do not select or install an auth dependency.

### D-011 | 2026-10-04 | U1 locked: Better Auth + email/password

- **Owner instruction:** Approve self-hosted Better Auth with email/password; continue independent P3 work without waiting for backup evidence.
- **Decision:** U1 LOCKED. Integrate with existing Next.js/Drizzle/PostgreSQL architecture and application-owned workspace membership. Prepare and test provider-independent verification/reset as explicitly requested; this does not redefine canonical phases. Administrator CLI reset is a secure local recovery method only.
- **Email:** No corporate email package purchase now. U3 transactional provider remains OPEN. Missing real delivery must be explicit; never claim a message was sent without delivery.
- **Constraints:** No paid service, production rollout or gate opening. Preserve age identity, recovery credentials and working scheduler. P2 evidence and P3 acceptance stay OPEN until actually satisfied.
- **Supersedes:** D-010's U1 OPEN restriction only; locked plan and acceptance remain unchanged.

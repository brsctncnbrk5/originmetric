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

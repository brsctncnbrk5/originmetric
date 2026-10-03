# P2 controlled dogfood acceptance

Updated 2026-10-03. **CLOSED PREVIEW READY / TECHNICAL G1 PASS / FORMAL G1 PENDING / P2 OPEN.** Use only the owner's
`originmetric.app` visits. P3 is outside this runbook. Test records are never real
customers, sales or revenue. Keep the existing age recipient; the private key stays
on the phone. Daily backup remains **03:15 UTC**.

## Before the owner's browser visit

1. Review the six canonical G1 items (§28) and preserve the intended
   required-consent setup. Keep actual-domain checks pending until the closed
   preview is deployed below. The deployed-build gate must use that reviewed
   source, not the old running image. Local browser fixtures alone cannot pass
   the real-domain gate.
2. Resolve the saved `/js/*` Cloudflare cache rule and browser TTL. Existing API
   bypass, rate rule and Full (strict) panel evidence remain accepted at their
   recorded source level. Do not repeat the previous inventory/attachment steps.
3. Register a separate workspace/project named `P2 ACCEPTANCE TEST — NOT REAL
   CUSTOMERS`, domain `originmetric.app`, UTC, USD, using the existing ops CLI.
   Capture CLI output in a **new** root-owned mode-600 ignored runtime file; never
   display its IDs or the one-time server key. Give the key the label
   `P2 acceptance test only`. Persist only the registered public site key in
   `OM_DOGFOOD_SITE_KEY`. Do not change age credentials or other env fields.
4. Explicitly select `BACKUP_BACKEND=github` for the reviewed deployment. The new
   predeploy adapter requires the same scoped credential and inherited deployment
   lock; failed remote backup/readback stops deployment before image build or
   migration. It does not fall back to a broad operator credential. Use the normal
   exact-clean-reviewed-SHA deploy, smoke and rollback path from VPS_INSTALLATION.
   Keep ingestion closed while reviewing the banner. Serve the exact `/dogfood`
   page through the reviewed proxy configuration. This preparation is now
   complete at source `e74bfc1fcc6e404be977feee059dc1d3c78d170c`: backed-up reviewed
   deploy/smoke and technical G1 pass; `/dogfood` returns 200. The old 404 is
   historical. No customer/revenue/attribution facts have been created.
5. Complete the real-domain deny, allow, withdraw and GPC checks one at a time.
   Before consent: no `om_*` storage and no `/api/v1/e` request. Withdrawal clears
   tracker state and stops requests; GPC suppresses both even after Allow. Record
   counts/booleans only; no HAR, cookie, IP, visitor ID or screenshots of secrets.
   Run the deployed-build `npm run gate:g1`, retain its safe evidence/source SHA
   and dated owner confirmation, and record all six G1 outcomes before opening
   the ingestion gate. A browser 202 is
   insufficient: closed ingress also returns 202 while dropping events.

Owner deny check is now **COMPLETE**: owner clicked **Reddet**, saw **Reddedildi**,
and at that deny step had not clicked Allow. The deny audit found zero production facts and empty application
ingestion counters empty; a labelled operator empty POST confirmed the active
202/drop path without application ingestion. This does not observe the owner's
phone outbound requests; proxy access logs are disabled.

Owner Allow UI is now **COMPLETE, OWNER-REPORTED**: clicked **İzin ver** in the
same tab and saw **İzin verildi**, recorded 2026-10-03 17:31 UTC. This proves the
reported banner transition, not data collection. Ingestion remains 202/drop;
**data collection NOT PASSED** until the gate opens after formal G1 and an actual
persisted visit is independently verified. This is not a GPC-enabled browser test.

Owner withdrawal UI is now **COMPLETE, OWNER-REPORTED**: same tab, no reload,
**İzni geri çek** clicked, **İzin geri çekildi** visible. Separate live controls
verified normal tracker cookies 2 → 0 and visitor absent; forced cookie-write
failure fallback localStorage 3 → 0. No new analytics requests after history
events/reload in either control. These controls are not phone storage/network
inspection and the UI message alone is not deletion/sending proof.

Owner GPC reference check is now **COMPLETE, OWNER-REPORTED: NOT_EXPOSED**.
Android Chrome Client-side detection showed **DOM signal not present**; this
records the absent DOM signal at the reference, not enabled-owner GPC acceptance.
Server-side Sec-GPC was not checked. Enabled-owner GPC is **NOT PASSED**, not
waived. Independently injected GPC=true on the live page remains technical proof
that storage and analytics are blocked even after Allow.

Current step is **formal six-item G1 review**; see the
[consolidated checklist](../reports/P2_GITHUB_RECOVERY_MONITORING.md#gpc-not-exposed-recorded--formal-g1-review--2026-10-03).
Technical evidence is PASS. On 2026-10-03 the owner explicitly accepted the
actual required-consent banner and Reddet / İzin ver / İzni geri çek controls;
dated owner setup confirmation is COMPLETE. Enabled-owner GPC evidence remains
pending. Owner reports no other available GPC browser; no installation requested.
Keep this evidence gap open. The monitoring and detector-error email receipts
are now owner-confirmed; actual missing-backup/failure delivery remains open. Preserve accepted Cloudflare panel
proof and its direct API/export inspection limit. Do not repeat the completed
reference check or install a browser/extension/change flags. Data gates remain
closed; persisted visits/trusted conversion and populated restore start only
after formal G1 completion.

## Closed-ingestion preparation and isolated rehearsal

Run from `/opt/originmetric` while ingestion remains closed:

```bash
node scripts/vps/prepare-p2-acceptance.mjs
npm run gate:g1 -- --technical-only --rehearse-dogfood
```

The first command checks the zero-fact baseline and existing owner evidence,
then creates a new mode-600 private plan under `.runtime/p2-prepared-*/plan.json`.
No execution/approval override flag exists; `productionWritesAllowed=false`.
Keep its label for the eventual owner visit and every customer/payment/refund.
It does not create a key, rotate the age identity or approve a gate change.

The second command uses the current deployed image/tracker and disposable
loopback-only app/DB fixtures. It proves consented persistence → trusted identify
and retry → payment and exact duplicate → conflicting retry with no extra facts
→ renewal → linked refund. SQL checks exact campaign/trusted session, immutable
acquisition, test-only USD totals **5800 / 500 / 5300 minor units**. Missing/wrong
internal token is 404, valid fixture token 200. A populated fixture dump is streamed
in memory into a network-none/tmpfs PostgreSQL container. Ten-table counts, exact
schema/migrations, fourteen FKs, private visitor/customer/session identities,
payload digests, source, individual payment/refund details, totals and freshness
must match. Four tampered semantic controls must fail. This is **ISOLATED REHEARSAL**,
not a real owner visit, encrypted off-VPS backup, phone decrypt or production restore.
No private age key is generated/read/transferred; all owned fixtures are removed.
Production ten-table counts and protected container/config metadata must be unchanged.

The gate consumes `.runtime/p2-current-owner-evidence.json` generated from existing
explicit owner records. Banner setup is ACCEPTED at its original source level;
owner GPC stays NOT_EXPOSED / enabled-owner acceptance NOT PASSED. Provider API/export
limits remain explicit. Technical-only exit 0 is not formal G1 acceptance;
without `--technical-only`, overall pending returns 2.

## Visit → conversion → revenue → attribution

Use a fresh controlled run label `p2_acceptance_<UTC timestamp>` in the campaign
and all event/customer/subscription labels. After G1, owner opens:

```text
https://originmetric.app/dogfood?utm_source=p2-test&utm_medium=controlled&utm_campaign=<run-label>
```

Owner explicitly consents. Operator confirms one persisted session/event for the
registered test project and exact campaign. Capture that session's visitor ID only
in the new private runtime record, never in chat or logs. Reject ambiguity rather
than choosing an arbitrary recent visitor. Preserve initial counts and source.

From the owner's SSH/operator path, send a trusted server-key identify for the
opaque `p2_acceptance_...` customer. The key stays outside the browser. Then send:

| Action | Payload facts | Required result |
| --- | --- | --- |
| Conversion / identify | Selected visitor; opaque test customer | 200 linked; retry 200 duplicate |
| Initial payment | Unique labelled event; type payment; amount 2900 minor USD; `test: true`; current RFC3339 time | 201; source `p2-test`, status attributed |
| Identical retry | Exactly the same payload, including occurred_at | 200 duplicate; still one payment row |
| Conflicting retry | Same event_id, changed amount | 409; no extra fact/customer/link |
| Renewal | New labelled payment event; amount 2900 USD; `test: true`; same test subscription, billing_interval month | 201; original acquisition/source unchanged |
| Refund | New labelled event; type refund; amount 500 USD; `refund_of` = original **external event_id**; `test: true` | 201; original acquisition/source unchanged |

Keep complete payloads/responses private. Record HTTP codes, boolean assertions
and aggregate test counts only. Verify expected revenue facts: 2 payments + 1
refund, all `test=true`; USD payment total 5800, refunds 500, net 5300 **test minor
units only**. Verify trusted links and credited session/source by SQL, not merely
the HTTP response. Access the internal project result via the existing private,
token-protected operator path; missing/wrong token denied and public path closed.
Check app logs in memory for key/customer/visitor leakage; output only a boolean.
Never print record bodies. Do not delete or truncate production data for cleanup.

## New populated backup and actual restore

1. Stop owner test traffic and retain a quiescent window. Capture safe aggregate
   counts of all ten domain tables and latest test revenue timestamp; do not read
   raw customer/event bodies. Run the regular scoped GitHub backup and verify
   ciphertext + SHA256SUMS remote readback. Preserve the snapshot metadata/source
   SHA and pre/post counts; if counts changed during capture, do not claim an exact
   snapshot comparison—repeat in a quiescent window.
2. Create a **new**, private verified-transfer JSON (never replace the previous
   empty-snapshot evidence) with `snapshot`, `sha256`, `source_sha`,
   `remote_hash_and_manifest_match: true`, exact `expected_row_counts` for ten
   tables, and `require_populated_test_restore: true`. This is metadata, not a key
   or plaintext dump. Source SHA must come from this snapshot, not current HEAD.
3. Download this specific encrypted snapshot/manifest to a new phone directory;
   verify SHA-256. Existing key/age/SSH prerequisites and vault attachment steps
   are already complete; repeat only this **new snapshot** download/hash check.
4. Phone decrypts with its existing identity and pipes to SSH receiver:
   `scripts/vps/restore-phone.py --snapshot-evidence <new-private-JSON-path>`.
   Provide the owner short commands in separate steps with the actual verified
   paths. No private key transfer, plaintext file, overwritten file or dump log.
   Immediately retain both pipeline exits; success requires decrypt=0/restore=0.
5. Independently inspect new server evidence: snapshot-pinned schema, 10 tables,
   4 exact migration hashes/timestamps, exact populated counts, 14 FK orphan
   checks = 0, nonempty visit/link/revenue/attribution chain, all revenue labelled
   test, and latest revenue timestamp equal to snapshot evidence. Additionally
   compare the restored test project's source/status, immutable acquisition,
   trusted link, duplicate/refund/renewal counts and per-currency test totals to
   the private pre-backup acceptance assertions. Counts/FKs alone cannot prove
   attribution or freshness. The receiver now enforces the private semantic
   baseline as well as counts/FKs; missing baseline, changed trusted identity,
   source, payload digest, individual payment/refund details, totals/acquisition
   or freshness cannot PASS. The receiver does not fabricate phone exit evidence.
6. Confirm isolated network/ports/tmpfs and exact test container deletion; compare
   production container/config metadata before/after this restore. Remove only
   this test's temporary resources. Preserve safe evidence, record results in
   STATUS/recovery report, scan secrets and commit/push with SHA equality.

The previously verified **empty** manual restore remains valid and must not be
repeated as a prerequisite. This populated drill is a separate acceptance proof.
Missing email/dead-man, lifecycle backstop, first scheduled success, independent
phone-loss recovery or G1 evidence keeps P2 open even if this drill succeeds.

### Read-only populated snapshot evidence capture (future actual test only)

After formal G1, separately reviewed gate work and the actual labelled owner chain
have completed, stop owner traffic. Use the **exact private plan path** printed
by preparation:

```bash
python3 scripts/vps/capture-p2-acceptance.py --plan <private-plan.json>
```

It selects the registered originmetric.app project privately, requires the exact
labelled chain and records all ten counts plus the receiver's fixed semantic
metrics in a new mode-600 pre-backup JSON. It refuses empty/unlabelled/incomplete
chains and cannot write application data. Record its printed private evidence path.
Run the existing scoped backup/readback with the current age recipient, then:

```bash
python3 scripts/vps/capture-p2-acceptance.py --plan <private-plan.json> --before <private-pre-backup.json>
```

The existing last-backup metadata must show remote readback verified **inside**
the UTC pre/post capture window; counts, deployed source and semantic metrics
must remain identical. Snapshot application/schema source must match deployed
source. Only then does the tool create a new private `snapshot-evidence-*.json`
for `restore-phone.py --snapshot-evidence`. It never manufactures a restore,
phone exit or actual visit result. These commands are prepared; no populated
production snapshot or phone restore has been run during closed-ingestion work.

## Prepared first actual controlled consent test — approval pending

The first applicable actual-domain test is canonical **G1 item 1**: a fresh isolated
operator browser on the registered originmetric.app test project, deny → allow →
exact labelled persisted pageview/session → withdraw. Existing owner banner
acceptance is retained. This is actual-domain operator evidence; it cannot claim
inspection of the owner's phone or native enabled-owner GPC. The unavailable
native GPC test remains NOT PASSED. Formal G1 stays PENDING.

The normal production chain above still requires formal G1. This proposed test is
an explicitly approved, bounded controlled-traffic exception under canonical §28's
controlled-traffic rule, not public go-live or a waiver. **Do not activate without
owner approval of the scope below.**

- Only `/api/v1/e`, POST, exact origin and `/dogfood` referrer, plus a private
  temporary HttpOnly/Secure/SameSite=Strict access cookie. The private entry URL
  stays in mode-600 runtime files and is consumed by one fresh operator browser.
- Maximum **600 seconds from activation**, ending earlier immediately after the
  test. The server checks allowed epoch seconds; copying a cookie or failure of
  the rollback timer cannot extend the window. Other requests continue to drop
  without forwarding (202; oversized bodies may receive 413).
- Keep `PUBLIC_G1_READY=no`, other public APIs closed, existing Cloudflare/host
  firewall, application/DB, deployed image and age key/recipient unchanged.
- Expected production data: **one test-labelled event and session**, source
  `p2-test`, medium `controlled`; zero customers/links/revenue/attribution. No
  identify, payment, renewal, refund, backup or phone restore is authorized by
  this approval. Retain labelled test facts; do not delete/truncate production.
- Before consent and after deny: zero tracker state/visitor and outbound event
  requests. Allow: 202 plus independently verified exact SQL persistence;
  202 alone cannot PASS. Withdraw: zero tracker state/visitor, no new request or
  fact after a history event. Store only booleans/counts, not IDs/bodies/headers.

Prepared commands (activation and actual test are **not executed**):

```bash
python3 scripts/vps/prepare-controlled-consent.py
# Read .runtime/p2-consent-window-last-path privately for <window-directory>.
# Only after the exact owner approval:
python3 scripts/vps/prepare-controlled-consent.py activate <window-directory>
node scripts/vps/accept-controlled-consent.mjs <window-directory>
# Immediate manual closure if test runner fails or is interrupted:
python3 scripts/vps/prepare-controlled-consent.py rollback <window-directory>
```

Preparation snapshots the exact closed nginx config and protected-resource
metadata. Activation refuses a changed config or reused window, generates a fresh
server deadline and arms a scoped systemd rollback **before** changing the site.
Nginx syntax/reload failure restores the closed config. The test runner closes the
browser and restores config in `finally`; the independent 600-second timer repeats
closure. Rollback refuses to overwrite a subsequently changed unrelated config;
the server deadline still expires. Confirm restored bytes, nginx reload, public
drop behavior and protected resources before claiming final test PASS. If timer
arming, reload, persistence, withdrawal or cleanup fails, retain failure evidence
and close the route; no acceptance PASS is inferred.

The local nginx mock controls and candidate syntax checks are preparation only.
They do not prove an installed timer, actual production visit or owner acceptance.
Keep **GPC NOT_EXPOSED, phone-independent recovery DEFERRED, G1 PENDING, P2 OPEN,
P3 NOT STARTED** regardless of this partial test's eventual result.

# P2 controlled dogfood acceptance

Prepared 2026-10-03. **NOT EXECUTED / G1 PENDING / P2 OPEN.** Use only the owner's
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
   page through the reviewed proxy configuration; it currently returns 404 on the
   old deployed image, so **do not ask the owner to test it yet**.
5. Complete the real-domain deny, allow, withdraw and GPC checks one at a time.
   Before consent: no `om_*` storage and no `/api/v1/e` request. Withdrawal clears
   tracker state and stops requests; GPC suppresses both even after Allow. Record
   counts/booleans only; no HAR, cookie, IP, visitor ID or screenshots of secrets.
   Run the deployed-build `npm run gate:g1`, retain its safe evidence/source SHA
   and dated owner confirmation, and record all six G1 outcomes before opening
   the ingestion gate. A browser 202 is
   insufficient: closed ingress also returns 202 while dropping events.

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
   attribution or freshness. The receiver does not fabricate phone exit evidence.
6. Confirm isolated network/ports/tmpfs and exact test container deletion; compare
   production container/config metadata before/after this restore. Remove only
   this test's temporary resources. Preserve safe evidence, record results in
   STATUS/recovery report, scan secrets and commit/push with SHA equality.

The previously verified **empty** manual restore remains valid and must not be
repeated as a prerequisite. This populated drill is a separate acceptance proof.
Missing email/dead-man, lifecycle backstop, first scheduled success, independent
phone-loss recovery or G1 evidence keeps P2 open even if this drill succeeds.

// Read-only preparation: produces a private plan, never sends ingestion/identify/revenue.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

assert.equal(process.argv.length, 2, "Preparation takes no execution/approval override flags");
const config = readFileSync(".env.production", "utf8");
assert.match(config, /^PUBLIC_G1_READY=['"]?no['"]?$/m);
assert.match(config, /^OM_DOMAIN=['"]?originmetric\.app['"]?$/m);
const tag = readFileSync(".runtime/current-tag", "utf8").trim();
assert.match(tag, /^[a-f0-9]{40}$/);
const recorded = (prefix) =>
  readdirSync(".runtime")
    .filter((p) => p.startsWith(prefix))
    .sort()
    .at(-1);
const bannerPath = `.runtime/${recorded("p2-banner-accepted-")}/owner-confirmation.json`;
const gpcPath = `.runtime/${recorded("p2-gpc-unavailable-")}/owner-result.json`;
const banner = JSON.parse(readFileSync(bannerPath, "utf8"));
const gpc = JSON.parse(readFileSync(gpcPath, "utf8"));
assert.equal(banner.source, "OWNER_EXPLICIT_CONFIRMATION");
assert.equal(banner.banner_setup, "ACCEPTED");
assert.equal(gpc.owner_gpc, "NOT_EXPOSED");
const counts = JSON.parse(
  execFileSync(
    "docker",
    [
      "exec",
      "originmetric-db-1",
      "psql",
      "-U",
      "originmetric",
      "-d",
      "originmetric",
      "-Atc",
      "SELECT json_build_object('events',(SELECT count(*) FROM events),'sessions',(SELECT count(*) FROM sessions),'customers',(SELECT count(*) FROM customers),'links',(SELECT count(*) FROM customer_visitors),'revenue',(SELECT count(*) FROM revenue_events),'attribution',(SELECT count(*) FROM customer_attribution))",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ),
);
assert.ok(
  Object.values(counts).every((n) => n === 0),
  "Baseline facts changed; review before preparation",
);
const label = `p2_acceptance_${randomUUID().replaceAll("-", "")}`;
const out = `.runtime/p2-prepared-${new Date().toISOString().replaceAll(/[-:.]/g, "")}`;
mkdirSync(out, { mode: 0o700 });
const write = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
const owner = {
  bannerSetup: "ACCEPTED_OWNER_REPORTED",
  bannerEvidence: bannerPath,
  ownerGpc: "NOT_EXPOSED",
  ownerGpcEvidence: gpcPath,
  enabledOwnerGpc: "NOT_PASSED",
  offPhoneRecovery: "DEFERRED",
  formalG1: "PENDING",
};
write(".runtime/p2-current-owner-evidence.json", owner);
const plan = {
  kind: "PREPARATION_ONLY",
  preparedAt: new Date().toISOString(),
  deployedSourceSha: tag,
  label,
  productionWritesAllowed: false,
  ingestionGate: "CLOSED",
  baselineCounts: counts,
  ownerEvidence: owner,
  visitUrl: `https://originmetric.app/dogfood?utm_source=p2-test&utm_medium=controlled&utm_campaign=${label}`,
  requirementsBeforeExecution: [
    "Complete formal G1 with evidence; do not waive owner GPC",
    "Review and separately authorize scoped data-route change",
    "Capture unique persisted consented owner session",
  ],
  privateValuesToCaptureLater: [
    "Project ID",
    "Unambiguous visitor/session ID",
    "Existing test-only server key",
    "Current occurred_at (reuse exactly for identical retry)",
    "Internal token (never in browser)",
  ],
  expectedCodes: {
    identify: 200,
    identifyRetry: 200,
    payment: 201,
    paymentRetry: 200,
    paymentConflict: 409,
    renewal: 201,
    refund: 201,
    internalMissing: 404,
    internalWrong: 404,
    internalAuthorized: 200,
  },
  revenue: {
    test: true,
    currency: "USD",
    paymentMinor: 2900,
    renewalMinor: 2900,
    refundMinor: 500,
    netMinor: 5300,
    billingInterval: "month",
    paymentEvent: `${label}_payment`,
    renewalEvent: `${label}_renewal`,
    refundEvent: `${label}_refund`,
    refundOfExternalEvent: `${label}_payment`,
    subscription: `${label}_sub`,
    customer: label,
  },
  semanticAssertions: {
    source: "p2-test",
    medium: "controlled",
    campaign: label,
    trustedLinkMethod: "server_identify",
    acquisitionUnchanged: true,
    sessionCount: 1,
    payments: 2,
    refunds: 1,
    allRevenueTest: true,
  },
  newSnapshotRequirements: [
    "Quiescent pre/post counts for all ten tables",
    "Remote ciphertext and manifest hash match",
    "Snapshot source SHA",
    "Private acceptance_assertions from receiver's fixed metrics query",
    "Existing phone age identity; no key generation/rotation",
    "New phone decrypt and receiver exits 0/0",
    "Exact schema/migrations/FKs, source/totals/acquisition/freshness match",
    "Isolated cleanup; production unchanged",
  ],
  realVisitAndRevenueAcceptance: "NOT_RUN",
  populatedEncryptedPhoneRestore: "NOT_RUN",
};
write(`${out}/plan.json`, plan);
writeFileSync(".runtime/p2-prepared-last-path", out + "\n", { mode: 0o600 });
console.log(
  JSON.stringify(
    {
      result: "PREPARATION_COMPLETE",
      privatePlan: `${out}/plan.json`,
      baselineCounts: counts,
      productionWritesAllowed: false,
      formalG1: "PENDING",
      ownerGpc: "NOT_EXPOSED",
      offPhoneRecovery: "DEFERRED",
      P2: "OPEN",
      P3: "NOT_STARTED",
    },
    null,
    2,
  ),
);

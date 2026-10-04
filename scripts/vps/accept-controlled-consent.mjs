// Invoke only after approval and activation of the private controlled window.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

assert.equal(process.argv.length, 3);
const directory = process.argv[2];
assert.match(directory, /^\/opt\/originmetric\/\.runtime\/p2-consent-window-[a-f0-9]+$/);
const plan = JSON.parse(readFileSync(`${directory}/window.json`, "utf8"));
const active = JSON.parse(readFileSync(`${directory}/activation.json`, "utf8"));
assert.ok(active.expiresEpoch > Date.now() / 1000 + 30);
assert.match(plan.label, /^p2_acceptance_[a-z0-9_]+$/);
const run = (command, args) => execFileSync(command, args, { encoding: "utf8", stdio: "pipe" });
const counts = () =>
  JSON.parse(
    run("docker", [
      "exec",
      "originmetric-db-1",
      "psql",
      "-U",
      "originmetric",
      "-d",
      "originmetric",
      "-Atc",
      `SELECT json_build_object('events',(SELECT count(*) FROM events),'sessions',(SELECT count(*) FROM sessions),'labelledEvents',(SELECT count(*) FROM events WHERE utm_campaign='${plan.label}'),'labelledSessions',(SELECT count(*) FROM sessions WHERE campaign='${plan.label}' AND source='p2-test' AND medium='controlled'),'customers',(SELECT count(*) FROM customers),'links',(SELECT count(*) FROM customer_visitors),'revenue',(SELECT count(*) FROM revenue_events),'attribution',(SELECT count(*) FROM customer_attribution))`,
    ]),
  );
const summary = {
  kind: "ACTUAL_DOMAIN_OPERATOR_CONTROLLED_TEST",
  canonicalItem: 1,
  acceptance: "NOT_PASSED",
  ownerPhoneObserved: false,
  ownerGpc: "NOT_EXPOSED",
  enabledOwnerGpc: "NOT_PASSED",
  formalG1: "PENDING",
  checks: {},
};
let browser;
try {
  assert.ok(Object.values(counts()).every((value) => value === 0));
  const executablePath = existsSync(chromium.executablePath())
    ? chromium.executablePath()
    : "/usr/bin/google-chrome";
  browser = await chromium.launch({ executablePath });
  const context = await browser.newContext();
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === "https://originmetric.app"
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  let sends = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/e") sends++;
  });
  // No traces, screenshots, HAR, console forwarding or request-body capture.
  await page.goto(readFileSync(`${directory}/entry-url`, "utf8").trim());
  await page.waitForFunction(() => typeof window.originmetric === "function");
  const state = async () => ({
    cookies: (await context.cookies()).filter((cookie) => cookie.name.startsWith("om_")).length,
    ...(await page.evaluate(() => ({
      localKeys: Object.keys(localStorage).filter((key) => key.startsWith("om_")).length,
      visitorPresent: window.originmetric.getVisitorId() !== null,
    }))),
  });
  await page.waitForTimeout(500);
  assert.equal(sends, 0);
  assert.deepEqual(await state(), { cookies: 0, localKeys: 0, visitorPresent: false });
  await page.click("#consent-deny");
  await page.waitForTimeout(300);
  assert.equal(sends, 0);
  assert.deepEqual(await state(), { cookies: 0, localKeys: 0, visitorPresent: false });
  summary.checks.beforeConsentAndDeny = "PASS";
  const response = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/v1/e");
  await page.click("#consent-allow");
  assert.equal((await response).status(), 202);
  assert.equal((await state()).visitorPresent, true);
  const persisted = counts();
  assert.equal(persisted.events, 1);
  assert.equal(persisted.sessions, 1);
  assert.equal(persisted.labelledEvents, 1);
  assert.equal(persisted.labelledSessions, 1);
  for (const table of ["customers", "links", "revenue", "attribution"])
    assert.equal(persisted[table], 0);
  summary.checks.consentedExactLabelPersistence = "PASS";
  await page.click("#consent-withdraw");
  assert.deepEqual(await state(), { cookies: 0, localKeys: 0, visitorPresent: false });
  const afterWithdrawal = sends;
  await page.evaluate(() => history.pushState({}, "", "/dogfood?withdrawal_check=1"));
  await page.waitForTimeout(500);
  assert.equal(sends, afterWithdrawal);
  assert.deepEqual(counts(), persisted);
  summary.checks.withdrawalClearsStateAndStopsSending = "PASS";
  summary.acceptance = "PASS_ACTUAL_DOMAIN_OPERATOR_SCOPE_ONLY";
  summary.finalCounts = persisted;
} catch (error) {
  summary.failureClass = error.constructor.name;
} finally {
  try {
    await browser?.close();
  } catch (error) {
    summary.acceptance = "NOT_PASSED";
    summary.browserCleanupFailureClass = error.constructor.name;
  }
  try {
    run("python3", ["scripts/vps/prepare-controlled-consent.py", "rollback", directory]);
    assert.equal(
      readFileSync("/etc/nginx/sites-available/originmetric", "utf8"),
      readFileSync(`${directory}/closed.conf`, "utf8"),
    );
    const protectedAfter = JSON.parse(
      run("python3", [
        "-c",
        "import importlib.util,json,sys; sys.dont_write_bytecode=True; s=importlib.util.spec_from_file_location('receiver','scripts/vps/restore-phone.py'); r=importlib.util.module_from_spec(s); s.loader.exec_module(r); print(json.dumps(r.protected()))",
      ]),
    );
    assert.deepEqual(
      protectedAfter,
      JSON.parse(readFileSync(`${directory}/protected-before.json`, "utf8")),
    );
    const closedProbe = await fetch("https://originmetric.app/api/v1/e", {
      method: "POST",
      headers: {
        Origin: "https://originmetric.app",
        Referer: "https://originmetric.app/dogfood",
        Cookie: `p2_acceptance_access=${readFileSync(`${directory}/access-token`, "utf8").trim()}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(closedProbe.status, 202);
    await closedProbe.body?.cancel();
    if (summary.finalCounts) assert.deepEqual(counts(), summary.finalCounts);
    summary.closedDropProbe = "PASS";
    summary.ingestionClosedAgain = true;
    summary.protectedResourcesUnchanged = true;
  } catch (error) {
    summary.acceptance = "NOT_PASSED";
    summary.rollbackFailureClass = error.constructor.name;
  }
  writeFileSync(`${directory}/actual-result.json`, JSON.stringify(summary, null, 2) + "\n", {
    mode: 0o600,
  });
}
console.log(JSON.stringify(summary));
if (summary.acceptance !== "PASS_ACTUAL_DOMAIN_OPERATOR_SCOPE_ONLY") process.exitCode = 1;

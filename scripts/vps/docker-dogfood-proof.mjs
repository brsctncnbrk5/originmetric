// Real browser/API proof against the production image + isolated Compose DB (CI only).
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

assert.equal(process.env.CI, "true");
const compose = ["compose", "--env-file", ".env.production", "-f", "deploy/compose.yml"];
const ops = (...args) =>
  execFileSync("docker", [...compose, "exec", "-T", "app", "node", "dist/ops.mjs", ...args], {
    encoding: "utf8",
  });
const projectOutput = ops(
  "create-project",
  "--name",
  "CI Docker dogfood",
  "--domain",
  "127.0.0.1",
  "--timezone",
  "UTC",
  "--currency",
  "USD",
);
const project = projectOutput.match(/project_id:\s+([0-9a-f-]+)/)?.[1];
const site = projectOutput.match(/site_key:\s+(pk_[A-Za-z0-9]+)/)?.[1];
assert.ok(project && site);
const key = ops("create-key", "--project", project, "--name", "ci-dogfood")
  .trim()
  .split("\n")
  .at(-1);
assert.ok(key?.startsWith("om_sk_"));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  let requests = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/v1/e") requests++;
  });
  const base = "http://127.0.0.1:8088";
  await page.goto(`${base}/fixtures/required?site=${site}&utm_source=Google`);
  await page.waitForFunction(() => typeof window.originmetric === "function");
  assert.equal(requests, 0);
  assert.equal(await page.evaluate(() => window.originmetric.getVisitorId()), null);
  assert.equal(await page.evaluate(() => document.cookie), "");
  assert.equal(
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("om_")).length),
    0,
  );
  const sent = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/e");
  await page.click("#consent-yes");
  assert.equal((await sent).status(), 202);
  const visitor = await page.evaluate(() => window.originmetric.getVisitorId());
  const customer = `ci_dogfood_${randomUUID()}`;
  const identify = await page.request.post(`${base}/api/v1/identify`, {
    headers: { authorization: `Bearer ${key}` },
    data: { customer_id: customer, visitor_id: visitor },
  });
  assert.equal(identify.status(), 200);
  const payment = {
    event_id: `ci_invoice_${randomUUID()}`,
    type: "payment",
    customer_id: customer,
    visitor_id: null,
    amount: 2900,
    currency: "USD",
    occurred_at: new Date(Date.now() + 2000).toISOString(),
    test: true,
  };
  const revenue = await page.request.post(`${base}/api/v1/revenue-events`, {
    headers: { authorization: `Bearer ${key}` },
    data: payment,
  });
  assert.equal(revenue.status(), 201);
  assert.deepEqual((await revenue.json()).attribution, { source: "google", status: "attributed" });
  const duplicate = await page.request.post(`${base}/api/v1/revenue-events`, {
    headers: { authorization: `Bearer ${key}` },
    data: payment,
  });
  assert.equal(duplicate.status(), 200);
  const internal = execFileSync(
    "docker",
    [...compose, "exec", "-T", "app", "node", "--input-type=module", "-"],
    {
      encoding: "utf8",
      input: `const r=await fetch('http://127.0.0.1:3000/internal/projects/${project}',{headers:{authorization:'Bearer '+process.env.INTERNAL_TOKEN}});if(!r.ok)process.exit(1);const h=await r.text();if(!h.includes('google')||!h.includes('attributed'))process.exit(1);console.log('internal result PASS');`,
    },
  );
  assert.match(internal, /PASS/);
  await page.click("#consent-no");
  assert.equal(await page.evaluate(() => window.originmetric.getVisitorId()), null);
  console.log(
    "Production image consent → trusted identify → test payment → google attribution: PASS",
  );
} finally {
  await browser.close();
}

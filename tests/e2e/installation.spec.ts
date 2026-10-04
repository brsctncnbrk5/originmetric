import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { startSaas } from "../../scripts/examples/saas.mjs";

test("isolated SaaS: copied project snippet → signup → server test payment → real setup checks", async ({
  browser,
  baseURL,
}, testInfo) => {
  const owner = await browser.newContext();
  const other = await browser.newContext();
  const visitor = await browser.newContext();
  const suffix = randomBytes(8).toString("hex");
  const password = randomBytes(24).toString("hex");
  // Existing accounts.spec proves two authenticated tenants; avoid a fourth
  // local signup in the shared limiter window. This context checks logged-out access.
  expect(
    (
      await owner.request.post("/api/auth/sign-up/email", {
        headers: { origin: baseURL! },
        data: { name: "Fixture", email: `owner-${suffix}@example.com`, password },
      })
    ).status(),
  ).toBe(200);
  const created = await owner.request.post("/api/account/projects", {
    headers: { origin: baseURL! },
    data: {
      name: "Installation fixture",
      allowedDomains: ["127.0.0.1"],
      timezone: "UTC",
      primaryCurrency: "USD",
    },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).projectId;
  const key = await owner.request.post(`/api/account/projects/${id}`, {
    headers: { origin: baseURL! },
    data: { action: "create-key", name: "Fixture only" },
  });
  const secret = (await key.json()).key;
  const dashboard = await owner.newPage();
  await dashboard.goto(`/dashboard/projects/${id}`);
  const snippet = await dashboard.getByLabel("Project tracker code").inputValue();
  expect(snippet).not.toContain(secret);
  const status = async () =>
    (await (await owner.request.get(`/api/account/projects/${id}`)).json()).installation;
  expect(await status()).toMatchObject({
    trackerReceivedAt: null,
    revenueReceivedAt: null,
    sourceMatched: false,
  });
  expect((await other.request.get(`/api/account/projects/${id}`)).status()).toBe(404);
  const fixture = await startSaas({ snippet, env: { OM_URL: baseURL!, OM_SERVER_KEY: secret } });
  const page = await visitor.newPage();
  const times: Record<string, number> = {};
  try {
    times.visit = performance.now();
    await page.goto(`${fixture.url}/?utm_source=Google&utm_medium=CPC&utm_campaign=installation`);
    await page.waitForFunction(() => typeof window.originmetric?.getVisitorId === "function");
    await page.waitForTimeout(300);
    expect((await status()).trackerReceivedAt).toBeNull();
    await page.click("#allow");
    times.consent = performance.now();
    await expect.poll(async () => (await status()).trackerReceivedAt).not.toBeNull();
    times.trackerStored = performance.now();
    await page.click("#signup");
    await expect(page.locator("#result")).toHaveText("Synthetic account created");
    times.signup = performance.now();
    await page.click("#pay");
    await expect(page.locator("#result")).toContainText('"source":"google"');
    times.paymentResponse = performance.now();
    await expect.poll(async () => (await status()).sourceMatched).toBe(true);
    times.matchRead = performance.now();
    expect(await status()).toMatchObject({
      reason: "matched",
      payment: { amount: "2900", currency: "USD", source: "google", campaign: "installation" },
    });
    await expect(dashboard.getByTestId("installation-status")).toContainText(
      "Source match: verified",
      { timeout: 10000 },
    );
    times.uiMatch = performance.now();
    await dashboard.route(`**/api/account/projects/${id}`, (route) =>
      route.fulfill({ status: 503, body: "{}" }),
    );
    await expect(
      dashboard.getByRole("region", { name: "Installation", exact: true }).getByRole("alert"),
    ).toContainText("Setup checks unavailable", {
      timeout: 10000,
    });
    await expect(dashboard.getByTestId("installation-status")).toHaveCount(0);
    await dashboard.unroute(`**/api/account/projects/${id}`);
    // Run the downloadable sample as a real Node CLI, with secrets only in server env.
    const directory = mkdtempSync(join(tmpdir(), "om-installation-"));
    try {
      const file = join(directory, "payment.json");
      writeFileSync(
        file,
        JSON.stringify({
          eventId: `test_cli_${randomUUID()}`,
          customerId: `test_cli_${randomUUID()}`,
          visitorId: await page.evaluate(() => window.originmetric?.getVisitorId() ?? null),
          occurredAt: new Date().toISOString(),
        }),
        { mode: 0o600 },
      );
      const result = execFileSync(process.execPath, ["public/examples/revenue.mjs", file], {
        env: { ...process.env, OM_URL: baseURL!, OM_SERVER_KEY: secret },
        encoding: "utf8",
      });
      expect(JSON.parse(result)).toMatchObject({
        status: "created",
        attribution: { source: "google", status: "attributed" },
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
    // Retry exactly the same server-side saved payload; no second payment.
    await page.click("#pay");
    await expect(page.locator("#result")).toContainText('"status":"duplicate"');
    // A NEW customer with no saved visitor must replace green with an actionable failure.
    await page.evaluate(() => window.originmetric?.("consent", false));
    await page.click("#signup");
    await expect(page.locator("#result")).toHaveText("Synthetic account created");
    await page.click("#pay");
    await expect(page.locator("#result")).toContainText('"status":"unattributed"');
    expect(await status()).toMatchObject({ sourceMatched: false, reason: "missing_visitor_link" });
    await expect(dashboard.getByTestId("installation-status")).toContainText(
      "Payment received without a visitor link",
      { timeout: 10000 },
    );
    // A syntactically valid but wrong project key receives 202/drop, not a green receipt.
    const empty = await owner.request.post("/api/account/projects", {
      headers: { origin: baseURL! },
      data: {
        name: "Empty",
        allowedDomains: ["other.example.com"],
        timezone: "UTC",
        primaryCurrency: "USD",
      },
    });
    const emptyId = (await empty.json()).projectId;
    const emptyData = await (await owner.request.get(`/api/account/projects/${emptyId}`)).json();
    const dropped = await owner.request.post("/api/v1/e", {
      headers: { origin: fixture.url },
      data: {
        site_key: emptyData.project.siteKey,
        type: "pageview",
        event_id: randomUUID(),
        session_id: randomUUID(),
        visitor_id: randomUUID(),
        path: "/",
      },
    });
    expect(dropped.status()).toBe(202);
    expect(
      (await (await owner.request.get(`/api/account/projects/${emptyId}`)).json()).installation,
    ).toMatchObject({ trackerReceivedAt: null, revenueReceivedAt: null, sourceMatched: false });
    expect((await other.request.get(`/api/account/projects/${id}`)).status()).toBe(404);
    const measurements = {
      scope: "automated fixture latency; not first-time customer installation time",
      consentToStoredTrackerMs: times.trackerStored - times.consent,
      signupToPaymentResponseMs: times.paymentResponse - times.signup,
      consentToMatchedReadMs: times.matchRead - times.consent,
      visitToUiMatchMs: times.uiMatch - times.visit,
    };
    await testInfo.attach("installation-measurements", {
      body: JSON.stringify(measurements, null, 2),
      contentType: "application/json",
    });
    console.log(JSON.stringify(measurements));
  } finally {
    await fixture.close();
    await Promise.all([owner.close(), other.close(), visitor.close()]);
  }
});

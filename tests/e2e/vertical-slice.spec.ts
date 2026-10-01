import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import { expect, test } from "@playwright/test";
import { createDb, type DbHandle } from "../../src/server/db/client";
import { sessions } from "../../src/server/db/schema";
import { createApiKey } from "../../src/server/tenancy/api-keys";
import { createProject } from "../../src/server/tenancy/projects";
import { systemClock } from "../../src/server/time/clock";

if (existsSync(".env")) process.loadEnvFile(".env");

let handle: DbHandle;

test.beforeAll(() => {
  handle = createDb(undefined, { max: 3 });
});

test.afterAll(async () => {
  await handle?.close();
});

test("vertical slice: consented visit → identify → revenue → attribution", async ({
  page,
  request,
}) => {
  const project = await createProject(
    handle.db,
    {
      name: `P1b vertical ${randomUUID().slice(0, 8)}`,
      allowedDomains: ["127.0.0.1"],
      timezone: "UTC",
      primaryCurrency: "USD",
    },
    systemClock,
  );
  const serverKey = await createApiKey(
    handle.db,
    { projectId: project.projectId, name: "vertical-slice" },
    systemClock,
  );
  const customerId = `cust_vertical_${randomUUID().slice(0, 8)}`;

  const ingestion = page.waitForRequest((req) => new URL(req.url()).pathname === "/api/v1/e");
  await page.goto(
    `/fixtures/required?site=${project.siteKey}&utm_source=Google&utm_medium=CPC&utm_campaign=P1B`,
  );

  const beforeConsent = await page.evaluate(() => {
    const om = (
      window as Window & {
        originmetric?: { getVisitorId(): string | null };
      }
    ).originmetric;
    return om?.getVisitorId() ?? null;
  });
  expect(beforeConsent).toBeNull();

  await page.click("#consent-yes");
  await ingestion;

  const visitorId = await page.evaluate(() => {
    const om = (
      window as Window & {
        originmetric?: { getVisitorId(): string | null };
      }
    ).originmetric;
    return om?.getVisitorId() ?? null;
  });
  expect(visitorId).toMatch(/^[0-9a-f-]{36}$/i);

  await expect
    .poll(async () => {
      const rows = await handle.db
        .select({
          visitorId: sessions.visitorId,
          source: sessions.source,
          medium: sessions.medium,
          campaign: sessions.campaign,
        })
        .from(sessions)
        .where(eq(sessions.projectId, project.projectId));
      return rows;
    })
    .toEqual([
      {
        visitorId,
        source: "google",
        medium: "cpc",
        campaign: "p1b",
      },
    ]);

  const auth = { authorization: `Bearer ${serverKey.key}` };
  const identify = await request.post("/api/v1/identify", {
    headers: auth,
    data: { customer_id: customerId, visitor_id: visitorId },
  });
  expect(identify.status()).toBe(200);
  expect(await identify.json()).toEqual({ status: "linked" });

  const revenue = await request.post("/api/v1/revenue-events", {
    headers: auth,
    data: {
      event_id: `inv_vertical_${randomUUID()}`,
      type: "payment",
      customer_id: customerId,
      visitor_id: null,
      amount: 2900,
      currency: "USD",
      occurred_at: new Date(Date.now() + 2_000).toISOString(),
      billing_interval: "month",
      subscription_id: `sub_${randomUUID()}`,
      test: true,
    },
  });
  expect(revenue.status()).toBe(201);
  expect(await revenue.json()).toMatchObject({
    status: "created",
    attribution: { source: "google", status: "attributed" },
  });

  const withoutToken = await request.get(`/internal/projects/${project.projectId}`);
  expect(withoutToken.status()).toBe(404);

  const internalToken = process.env.INTERNAL_TOKEN ?? "originmetric-e2e-internal";
  await page.setExtraHTTPHeaders({ authorization: `Bearer ${internalToken}` });
  await page.goto(`/internal/projects/${project.projectId}`);
  await expect(page.getByTestId("internal-result")).toBeVisible();
  await expect(page.getByRole("cell", { name: customerId })).toBeVisible();
  await expect(page.getByRole("cell", { name: "attributed" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "google" })).toBeVisible();
});

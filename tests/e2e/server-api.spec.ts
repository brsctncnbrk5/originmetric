import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createDb, type DbHandle } from "../../src/server/db/client";
import { createApiKey } from "../../src/server/tenancy/api-keys";
import { createProject } from "../../src/server/tenancy/projects";
import { systemClock } from "../../src/server/time/clock";

// The P1a server API through the real Next.js production build: key auth, identify,
// revenue idempotency. Uses the migrated database in DATABASE_URL (CI migrates it first).

if (existsSync(".env")) process.loadEnvFile(".env");

let handle: DbHandle;
let key: string;

test.beforeAll(async () => {
  handle = createDb(undefined, { max: 2 });
  const project = await createProject(
    handle.db,
    { name: "e2e", allowedDomains: ["e2e.example"], timezone: "UTC", primaryCurrency: "USD" },
    systemClock,
  );
  key = (await createApiKey(handle.db, { projectId: project.projectId }, systemClock)).key;
});

test.afterAll(async () => {
  await handle?.close();
});

test("server API: 401 without a key, identify, revenue created → duplicate → 409", async ({
  request,
}) => {
  const auth = { authorization: `Bearer ${key}` };
  const customer = `cust_e2e_${randomUUID().slice(0, 8)}`;

  const noKey = await request.post("/api/v1/identify", {
    data: { customer_id: customer, visitor_id: null },
  });
  expect(noKey.status()).toBe(401);
  expect(await noKey.json()).toEqual({ error: { code: "unauthorized" } });

  const identify = await request.post("/api/v1/identify", {
    headers: auth,
    data: { customer_id: customer, visitor_id: randomUUID() },
  });
  expect(identify.status()).toBe(200);
  expect(await identify.json()).toEqual({ status: "linked" });

  const event = {
    event_id: `inv_${randomUUID()}`,
    type: "payment",
    customer_id: customer,
    amount: 2900,
    currency: "USD",
    occurred_at: new Date(Date.now() - 60_000).toISOString(),
  };
  const created = await request.post("/api/v1/revenue-events", { headers: auth, data: event });
  expect(created.status()).toBe(201);
  const createdBody = await created.json();
  expect(createdBody).toMatchObject({ status: "created", attribution: { status: "unattributed" } });

  const duplicate = await request.post("/api/v1/revenue-events", { headers: auth, data: event });
  expect(duplicate.status()).toBe(200);
  expect(await duplicate.json()).toEqual({ ...createdBody, status: "duplicate" });

  const conflict = await request.post("/api/v1/revenue-events", {
    headers: auth,
    data: { ...event, amount: 3900 },
  });
  expect(conflict.status()).toBe(409);
  expect((await conflict.json()).error.code).toBe("idempotency_conflict");
});

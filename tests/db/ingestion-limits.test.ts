import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { ingestionDaily, events } from "@/server/db/schema";
import { handleBrowserEvent } from "@/server/ingestion/handler";
import { DEFAULT_LIMITS, IngestionLimits } from "@/server/ingestion/limits";
import { createFakeClock } from "@/server/time/clock";
import type { TempDatabase } from "../helpers/db";
import { createDomainDatabase, createTestProject, makeDeps, T0 } from "../helpers/domain";

let tmp: TempDatabase;
beforeAll(async () => {
  tmp = await createDomainDatabase();
});
afterAll(async () => {
  await tmp?.destroy();
});

function payload(site: string) {
  return {
    site_key: site,
    type: "pageview",
    event_id: randomUUID(),
    visitor_id: randomUUID(),
    session_id: randomUUID(),
    path: "/",
    referrer_host: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    screen_class: "desktop",
  };
}
function request(body: unknown) {
  return new Request("http://localhost/api/v1/e", {
    method: "POST",
    headers: {
      origin: "https://example.com",
      "cf-connecting-ip": "198.51.100.44",
      authorization: "secret-body-test",
      cookie: "sensitive-cookie",
    },
    body: JSON.stringify(body),
  });
}

it("atomically enforces a daily cap across concurrent requests and app restarts; resets by UTC day", async () => {
  const clock = createFakeClock(T0);
  const p = await createTestProject(tmp.db, clock);
  const deps = {
    ...makeDeps(tmp.db, clock),
    limits: new IngestionLimits({ ...DEFAULT_LIMITS, dailyPerProject: 3 }),
    proxyEnv: { INGEST_PROXY_MODE: "local" },
  };
  const a = payload(p.siteKey);
  await handleBrowserEvent(request(a), deps);
  await handleBrowserEvent(request(a), deps); // duplicate does not consume daily budget
  await Promise.all(
    Array.from({ length: 8 }, () => handleBrowserEvent(request(payload(p.siteKey)), deps)),
  );
  expect(await tmp.db.select().from(events).where(eq(events.projectId, p.projectId))).toHaveLength(
    3,
  );
  expect(
    (await tmp.db.select().from(ingestionDaily).where(eq(ingestionDaily.projectId, p.projectId)))[0]
      ?.accepted,
  ).toBe(3);
  const restarted = {
    ...deps,
    limits: new IngestionLimits({ ...DEFAULT_LIMITS, dailyPerProject: 3 }),
  };
  await handleBrowserEvent(request(payload(p.siteKey)), restarted);
  expect(restarted.logs.text()).toContain("dropped_daily_limit");
  expect(await tmp.db.select().from(events).where(eq(events.projectId, p.projectId))).toHaveLength(
    3,
  );
  clock.advance(86400_000);
  await handleBrowserEvent(request(payload(p.siteKey)), restarted);
  expect(await tmp.db.select().from(events).where(eq(events.projectId, p.projectId))).toHaveLength(
    4,
  );
  for (const value of [
    "198.51.100.44",
    "secret-body-test",
    "sensitive-cookie",
    a.visitor_id,
    a.session_id,
  ])
    expect(deps.logs.text()).not.toContain(value);
});

it("rate-limited valid requests write nothing and retain uniform 202 responses", async () => {
  const clock = createFakeClock(T0);
  const p = await createTestProject(tmp.db, clock);
  const deps = {
    ...makeDeps(tmp.db, clock),
    limits: new IngestionLimits({ ...DEFAULT_LIMITS, clientPerMinute: 1 }),
    proxyEnv: { INGEST_PROXY_MODE: "local" },
  };
  expect((await handleBrowserEvent(request(payload(p.siteKey)), deps)).status).toBe(202);
  expect((await handleBrowserEvent(request(payload(p.siteKey)), deps)).status).toBe(202);
  expect(await tmp.db.select().from(events).where(eq(events.projectId, p.projectId))).toHaveLength(
    1,
  );
  expect(deps.logs.text()).toContain("dropped_client_limit");
});

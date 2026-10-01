import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { customers, customerVisitors, events, sessions } from "@/server/db/schema";
import { handleBrowserEvent } from "@/server/ingestion/handler";
import { createFakeClock } from "@/server/time/clock";
import type { TempDatabase } from "../helpers/db";
import { T0, createDomainDatabase, createTestProject, makeDeps } from "../helpers/domain";

let tmp: TempDatabase;
const clock = createFakeClock(T0);

beforeAll(async () => {
  tmp = await createDomainDatabase();
});

afterAll(async () => {
  await tmp?.destroy();
});

function browserEvent(siteKey: string, overrides: Record<string, unknown> = {}) {
  return {
    site_key: siteKey,
    type: "pageview",
    event_id: randomUUID(),
    visitor_id: randomUUID(),
    session_id: randomUUID(),
    path: "/landing",
    referrer_host: null,
    utm_source: "Google",
    utm_medium: "CPC",
    utm_campaign: "Launch",
    utm_content: null,
    utm_term: null,
    screen_class: "desktop",
    ...overrides,
  };
}

function request(
  payload: unknown,
  origin = "https://example.com",
  headers: Record<string, string> = {},
): Request {
  return new Request("https://originmetric.test/api/v1/e", {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      origin,
      ...headers,
    },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

async function projectRows(projectId: string) {
  const projectEvents = await tmp.db
    .select()
    .from(events)
    .where(eq(events.projectId, projectId));
  const projectSessions = await tmp.db
    .select()
    .from(sessions)
    .where(eq(sessions.projectId, projectId));
  return { projectEvents, projectSessions };
}

describe("POST /api/v1/e browser ingestion", () => {
  it("accepts a valid event, normalizes the entry source, and updates the same session", async () => {
    const project = await createTestProject(tmp.db, clock, {
      name: `ingest-${randomUUID()}`,
      allowedDomains: ["example.com"],
    });
    const first = browserEvent(project.siteKey);
    const deps = makeDeps(tmp.db, clock);

    const response = await handleBrowserEvent(request(first), deps);
    expect(response.status).toBe(202);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://example.com");

    let rows = await projectRows(project.projectId);
    expect(rows.projectEvents).toHaveLength(1);
    expect(rows.projectSessions).toHaveLength(1);
    expect(rows.projectSessions[0]).toMatchObject({
      visitorId: first.visitor_id,
      id: first.session_id,
      pageviews: 1,
      source: "google",
      medium: "cpc",
      campaign: "launch",
      landingPath: "/landing",
    });

    const second = browserEvent(project.siteKey, {
      event_id: randomUUID(),
      visitor_id: first.visitor_id,
      session_id: first.session_id,
      path: "/pricing",
      utm_source: "reddit",
      utm_medium: "social",
    });
    expect((await handleBrowserEvent(request(second), deps)).status).toBe(202);

    rows = await projectRows(project.projectId);
    expect(rows.projectEvents).toHaveLength(2);
    expect(rows.projectSessions).toHaveLength(1);
    expect(rows.projectSessions[0]).toMatchObject({
      pageviews: 2,
      source: "google",
      medium: "cpc",
      campaign: "launch",
      landingPath: "/landing",
    });
  });

  it("deduplicates by project/event_id without incrementing pageviews", async () => {
    const project = await createTestProject(tmp.db, clock, {
      name: `dedup-${randomUUID()}`,
      allowedDomains: ["example.com"],
    });
    const event = browserEvent(project.siteKey);
    const deps = makeDeps(tmp.db, clock);

    await handleBrowserEvent(request(event), deps);
    await handleBrowserEvent(request(event), deps);

    const rows = await projectRows(project.projectId);
    expect(rows.projectEvents).toHaveLength(1);
    expect(rows.projectSessions).toHaveLength(1);
    expect(rows.projectSessions[0]?.pageviews).toBe(1);
  });

  it("silently drops wrong origins and emits no CORS oracle", async () => {
    const project = await createTestProject(tmp.db, clock, {
      name: `origin-${randomUUID()}`,
      allowedDomains: ["example.com"],
    });
    const response = await handleBrowserEvent(
      request(browserEvent(project.siteKey), "https://attacker.example"),
      makeDeps(tmp.db, clock),
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    const rows = await projectRows(project.projectId);
    expect(rows.projectEvents).toHaveLength(0);
    expect(rows.projectSessions).toHaveLength(0);
  });

  it("drops a session ID reused by a different visitor", async () => {
    const project = await createTestProject(tmp.db, clock, {
      name: `session-${randomUUID()}`,
      allowedDomains: ["example.com"],
    });
    const first = browserEvent(project.siteKey);
    const deps = makeDeps(tmp.db, clock);
    await handleBrowserEvent(request(first), deps);

    const poisoned = browserEvent(project.siteKey, {
      event_id: randomUUID(),
      session_id: first.session_id,
      visitor_id: randomUUID(),
    });
    expect((await handleBrowserEvent(request(poisoned), deps)).status).toBe(202);

    const rows = await projectRows(project.projectId);
    expect(rows.projectEvents).toHaveLength(1);
    expect(rows.projectSessions).toHaveLength(1);
    expect(rows.projectSessions[0]?.visitorId).toBe(first.visitor_id);
    expect(rows.projectSessions[0]?.pageviews).toBe(1);
  });

  it("cannot create customers or trusted links from browser payloads", async () => {
    const project = await createTestProject(tmp.db, clock, {
      name: `poison-${randomUUID()}`,
      allowedDomains: ["example.com"],
    });
    const payload = {
      ...browserEvent(project.siteKey),
      customer_id: "victim_customer",
      identify: "victim_customer",
    };

    expect((await handleBrowserEvent(request(payload), makeDeps(tmp.db, clock))).status).toBe(202);

    const projectCustomers = await tmp.db
      .select()
      .from(customers)
      .where(eq(customers.projectId, project.projectId));
    const projectLinks = await tmp.db
      .select()
      .from(customerVisitors)
      .where(eq(customerVisitors.projectId, project.projectId));
    const rows = await projectRows(project.projectId);
    expect(projectCustomers).toHaveLength(0);
    expect(projectLinks).toHaveLength(0);
    expect(rows.projectEvents).toHaveLength(0);
  });

  it("enforces the 8 KB body ceiling before persistence", async () => {
    const project = await createTestProject(tmp.db, clock, {
      name: `size-${randomUUID()}`,
      allowedDomains: ["example.com"],
    });
    const huge = JSON.stringify({
      ...browserEvent(project.siteKey),
      padding: "x".repeat(9 * 1024),
    });
    const response = await handleBrowserEvent(
      request(huge, "https://example.com", { "content-length": String(Buffer.byteLength(huge)) }),
      makeDeps(tmp.db, clock),
    );
    expect(response.status).toBe(202);
    expect((await projectRows(project.projectId)).projectEvents).toHaveLength(0);
  });

  it("accepts an allowed Referer when Origin is absent", async () => {
    const project = await createTestProject(tmp.db, clock, {
      name: `referer-${randomUUID()}`,
      allowedDomains: ["*.example.com"],
    });
    const payload = browserEvent(project.siteKey);
    const req = new Request("https://originmetric.test/api/v1/e", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        referer: "https://app.example.com/signup?private=value",
      },
      body: JSON.stringify(payload),
    });
    const response = await handleBrowserEvent(req, makeDeps(tmp.db, clock));
    expect(response.status).toBe(202);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.example.com");

    const rows = await projectRows(project.projectId);
    expect(rows.projectEvents).toHaveLength(1);
    expect(rows.projectSessions).toHaveLength(1);
  });
});

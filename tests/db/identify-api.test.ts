import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { customerAttribution, customerVisitors, customers } from "@/server/db/schema";
import { revokeApiKey } from "@/server/tenancy/api-keys";
import { createFakeClock } from "@/server/time/clock";
import type { TempDatabase } from "../helpers/db";
import {
  T0,
  callIdentify,
  callRevenue,
  createDomainDatabase,
  createTestProject,
  makeDeps,
  payment,
  seedSessions,
  uid,
  type TestProject,
} from "../helpers/domain";

let tmp: TempDatabase;
let A: TestProject;
let B: TestProject;
const clock = createFakeClock(T0);

beforeAll(async () => {
  tmp = await createDomainDatabase();
  A = await createTestProject(tmp.db, clock, { name: "A" });
  B = await createTestProject(tmp.db, clock, { name: "B" });
});

afterAll(async () => {
  await tmp?.destroy();
});

async function linksOf(projectId: string, externalId: string) {
  return tmp.db
    .select({ visitorId: customerVisitors.visitorId, method: customerVisitors.method })
    .from(customerVisitors)
    .innerJoin(
      customers,
      and(
        eq(customers.projectId, customerVisitors.projectId),
        eq(customers.id, customerVisitors.customerId),
      ),
    )
    .where(and(eq(customers.projectId, projectId), eq(customers.externalId, externalId)));
}

async function customerCount(projectId: string, externalId: string) {
  const rows = await tmp.db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.projectId, projectId), eq(customers.externalId, externalId)));
  return rows.length;
}

describe("POST /api/v1/identify", () => {
  it("creates a trusted server_identify link and an attribution row", async () => {
    const deps = makeDeps(tmp.db, clock);
    const res = await callIdentify(deps, A.key, {
      customer_id: "cust_id_1",
      visitor_id: uid(1, "a"),
    });
    expect(res).toEqual({ status: 200, body: { status: "linked" } });
    expect(await linksOf(A.projectId, "cust_id_1")).toEqual([
      { visitorId: uid(1, "a"), method: "server_identify" },
    ]);
    const [attr] = await tmp.db.select().from(customerAttribution);
    expect(attr).toMatchObject({ status: "unattributed", acquiredAt: T0, rulesVersion: 1 });
  });

  it("duplicate identify → 200 duplicate, no new rows", async () => {
    const deps = makeDeps(tmp.db, clock);
    const res = await callIdentify(deps, A.key, {
      customer_id: "cust_id_1",
      visitor_id: uid(1, "a"),
    });
    expect(res).toEqual({ status: 200, body: { status: "duplicate" } });
    expect(await linksOf(A.projectId, "cust_id_1")).toHaveLength(1);
  });

  it("uppercase visitor UUID is the same visitor (normalized)", async () => {
    const deps = makeDeps(tmp.db, clock);
    const res = await callIdentify(deps, A.key, {
      customer_id: "cust_id_1",
      visitor_id: uid(1, "a").toUpperCase(),
    });
    expect(res.body).toEqual({ status: "duplicate" });
  });

  it("visitor_id null → 200 skipped, true no-op (no customer created)", async () => {
    const deps = makeDeps(tmp.db, clock);
    const res = await callIdentify(deps, A.key, { customer_id: "cust_never", visitor_id: null });
    expect(res).toEqual({ status: 200, body: { status: "skipped" } });
    expect(await customerCount(A.projectId, "cust_never")).toBe(0);
  });

  it("one customer → multiple visitors", async () => {
    const deps = makeDeps(tmp.db, clock);
    await callIdentify(deps, A.key, { customer_id: "multi", visitor_id: uid(10, "b") });
    await callIdentify(deps, A.key, { customer_id: "multi", visitor_id: uid(11, "b") });
    expect((await linksOf(A.projectId, "multi")).map((l) => l.visitorId).sort()).toEqual([
      uid(10, "b"),
      uid(11, "b"),
    ]);
  });

  it("one visitor → two customers (shared computer)", async () => {
    const deps = makeDeps(tmp.db, clock);
    const shared = uid(20, "c");
    expect(
      (await callIdentify(deps, A.key, { customer_id: "alice", visitor_id: shared })).body.status,
    ).toBe("linked");
    expect(
      (await callIdentify(deps, A.key, { customer_id: "bob", visitor_id: shared })).body.status,
    ).toBe("linked");
    expect(await linksOf(A.projectId, "alice")).toHaveLength(1);
    expect(await linksOf(A.projectId, "bob")).toHaveLength(1);
  });

  it("recomputes attribution from the linked visitor's pre-acquisition sessions", async () => {
    const visitor = uid(30, "d");
    await seedSessions(tmp.db, A.projectId, [
      {
        id: uid(31, "d"),
        visitorId: visitor,
        startedAt: "2026-09-20T10:00:00Z",
        source: "google",
        medium: "cpc",
      },
      { id: uid(32, "d"), visitorId: visitor, startedAt: "2026-09-29T10:00:00Z", source: "direct" },
    ]);
    const deps = makeDeps(tmp.db, clock);
    await callIdentify(deps, A.key, { customer_id: "with_sessions", visitor_id: visitor });
    const rev = await callRevenue(
      deps,
      A.key,
      payment({ event_id: "inv_ws", customer_id: "with_sessions" }),
    );
    expect(rev.body.attribution).toEqual({ source: "google", status: "attributed" });
  });

  it.each([
    [
      "email-like customer_id",
      { customer_id: "jane.doe@example.com", visitor_id: uid(1) },
      "customer_id",
    ],
    ["missing customer_id", { visitor_id: uid(1) }, "customer_id"],
    ["visitor_id key absent", { customer_id: "c1" }, "visitor_id"],
    ["visitor_id not a UUID", { customer_id: "c1", visitor_id: "abc" }, "visitor_id"],
    ["customer_id too long", { customer_id: "x".repeat(129), visitor_id: uid(1) }, "customer_id"],
    ["unknown field", { customer_id: "c1", visitor_id: uid(1), email: "x" }, "email"],
  ])("%s → 422 invalid_request", async (_name, body, field) => {
    const res = await callIdentify(makeDeps(tmp.db, clock), A.key, body);
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: { code: "invalid_request", field } });
  });

  it.each([
    ["not JSON", "{nope"],
    ["JSON array", "[1,2]"],
    [
      "oversized body",
      JSON.stringify({ customer_id: "c1", visitor_id: uid(1), pad: "x".repeat(20_000) }),
    ],
  ])("%s → 422 invalid_request", async (_name, raw) => {
    const res = await callIdentify(makeDeps(tmp.db, clock), A.key, raw);
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: { code: "invalid_request" } });
  });
});

describe("uniform 401", () => {
  const UNAUTHORIZED = { status: 401, body: { error: { code: "unauthorized" } } };
  const body = { customer_id: "c401", visitor_id: uid(401) };

  it.each([
    ["missing key", () => null],
    ["malformed key", () => "not-a-key"],
    ["public site key", () => A.siteKey],
    ["unknown prefix", () => `om_sk_ZZZZZZZZ_${A.key.slice(-43)}`],
    ["wrong secret", () => `${A.key.slice(0, -43)}${"0".repeat(43)}`],
    ["wrong secret (one char)", () => `${A.key.slice(0, -1)}${A.key.endsWith("a") ? "b" : "a"}`],
  ])("%s → identical 401 on both endpoints", async (_name, key) => {
    const deps = makeDeps(tmp.db, clock);
    expect(await callIdentify(deps, key(), body)).toEqual(UNAUTHORIZED);
    expect(await callRevenue(deps, key(), payment({ event_id: "e401" }))).toEqual(UNAUTHORIZED);
    expect(await customerCount(A.projectId, "c401")).toBe(0);
  });

  it("revoked key → identical 401", async () => {
    const extra = await createTestProject(tmp.db, clock, { name: "revoke" });
    await revokeApiKey(tmp.db, extra.keyId, clock);
    const deps = makeDeps(tmp.db, clock);
    expect(await callIdentify(deps, extra.key, body)).toEqual(UNAUTHORIZED);
    expect(await callRevenue(deps, extra.key, payment())).toEqual(UNAUTHORIZED);
  });

  it("authentication runs before validation (invalid body + bad key → 401)", async () => {
    expect(await callIdentify(makeDeps(tmp.db, clock), null, "{bad")).toEqual(UNAUTHORIZED);
  });
});

describe("tenant isolation through the API", () => {
  it("project comes only from the key: same customer_id in A and B are different customers", async () => {
    const deps = makeDeps(tmp.db, clock);
    await callIdentify(deps, A.key, { customer_id: "shared_ext", visitor_id: uid(50, "e") });
    await callIdentify(deps, B.key, { customer_id: "shared_ext", visitor_id: uid(51, "e") });
    expect(await linksOf(A.projectId, "shared_ext")).toEqual([
      { visitorId: uid(50, "e"), method: "server_identify" },
    ]);
    expect(await linksOf(B.projectId, "shared_ext")).toEqual([
      { visitorId: uid(51, "e"), method: "server_identify" },
    ]);
  });

  it("A's key with B's customer ID creates an A customer and never touches B", async () => {
    const deps = makeDeps(tmp.db, clock);
    await callIdentify(deps, B.key, { customer_id: "only_in_b", visitor_id: uid(60, "e") });
    const res = await callRevenue(
      deps,
      A.key,
      payment({ event_id: "cross_1", customer_id: "only_in_b", visitor_id: uid(61, "e") }),
    );
    expect(res.status).toBe(201);
    expect(await linksOf(B.projectId, "only_in_b")).toEqual([
      { visitorId: uid(60, "e"), method: "server_identify" },
    ]);
    expect(await linksOf(A.projectId, "only_in_b")).toEqual([
      { visitorId: uid(61, "e"), method: "revenue_api" },
    ]);
  });

  it("forged touches on an attacker's own visitor never affect a victim customer", async () => {
    const attackerVisitor = uid(70, "f");
    const victimVisitor = uid(71, "f");
    await seedSessions(tmp.db, A.projectId, [
      {
        id: uid(72, "f"),
        visitorId: attackerVisitor,
        startedAt: "2026-09-30T10:00:00Z",
        source: "evil.example",
      },
      {
        id: uid(73, "f"),
        visitorId: victimVisitor,
        startedAt: "2026-09-25T10:00:00Z",
        source: "newsletter",
      },
    ]);
    const deps = makeDeps(tmp.db, clock);
    await callIdentify(deps, A.key, { customer_id: "victim", visitor_id: victimVisitor });
    const res = await callRevenue(
      deps,
      A.key,
      payment({ event_id: "victim_pay", customer_id: "victim" }),
    );
    expect(res.body.attribution).toEqual({ source: "newsletter", status: "attributed" });
    // B's key cannot link anything in A.
    await callIdentify(deps, B.key, { customer_id: "victim", visitor_id: attackerVisitor });
    expect(await linksOf(A.projectId, "victim")).toEqual([
      { visitorId: victimVisitor, method: "server_identify" },
    ]);
  });
});

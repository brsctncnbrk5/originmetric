import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  customerAttribution,
  customerVisitors,
  customers,
  revenueEvents,
} from "@/server/db/schema";
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
let P: TestProject;
const clock = createFakeClock(T0);
const deps = () => makeDeps(tmp.db, clock);

beforeAll(async () => {
  // Larger pool so concurrent requests really run in parallel transactions.
  tmp = await createDomainDatabase({ max: 12 });
  P = await createTestProject(tmp.db, clock);
});

afterAll(async () => {
  await tmp?.destroy();
});

async function revenueRows(eventId?: string) {
  const rows = await tmp.db
    .select()
    .from(revenueEvents)
    .where(eq(revenueEvents.projectId, P.projectId));
  return eventId === undefined ? rows : rows.filter((r) => r.eventId === eventId);
}

async function customerExists(externalId: string) {
  const rows = await tmp.db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.projectId, P.projectId), eq(customers.externalId, externalId)));
  return rows.length > 0;
}

describe("POST /api/v1/revenue-events: contract", () => {
  it("201 created with the documented body; row stores normalized values", async () => {
    const res = await callRevenue(
      deps(),
      P.key,
      payment({ event_id: "inv_c1", customer_id: "cust_c1", currency: "usd" }),
    );
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      event_id: "inv_c1",
      status: "created",
      attribution: { source: null, status: "unattributed" },
    });
    const [row] = await revenueRows("inv_c1");
    expect(row).toMatchObject({
      type: "payment",
      amountMinor: 2900n,
      currency: "USD",
      occurredAt: new Date("2026-10-01T11:00:00Z"),
      receivedAt: T0,
      billingInterval: "month",
      subscriptionId: "sub_1",
      test: false,
      refundOfId: null,
    });
    expect(row?.payloadHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a visitor_id creates a trusted revenue_api link", async () => {
    const visitor = uid(1, "a");
    await callRevenue(
      deps(),
      P.key,
      payment({ event_id: "inv_v1", customer_id: "cust_v1", visitor_id: visitor }),
    );
    const links = await tmp.db
      .select({ method: customerVisitors.method, visitorId: customerVisitors.visitorId })
      .from(customerVisitors)
      .where(
        and(eq(customerVisitors.projectId, P.projectId), eq(customerVisitors.visitorId, visitor)),
      );
    expect(links).toEqual([{ method: "revenue_api", visitorId: visitor }]);
  });

  it("stores test events (default false; explicit true)", async () => {
    await callRevenue(deps(), P.key, payment({ event_id: "inv_t1", test: true }));
    expect((await revenueRows("inv_t1"))[0]?.test).toBe(true);
  });

  it.each([
    ["unknown currency", { currency: "ABC" }, "currency"],
    ["non-integer amount", { amount: 10.5 }, "amount"],
    ["amount above 10^12", { amount: 1e12 + 1 }, "amount"],
    ["email customer", { customer_id: "a@b.co" }, "customer_id"],
    ["future occurred_at", { occurred_at: "2026-10-01T12:05:01Z" }, "occurred_at"],
    ["pre-2000 occurred_at", { occurred_at: "1999-12-31T23:59:59Z" }, "occurred_at"],
  ])("%s → 422 and nothing written", async (_name, patch, field) => {
    const res = await callRevenue(
      deps(),
      P.key,
      payment({ event_id: "inv_bad", customer_id: "cust_bad", ...patch }),
    );
    expect(res).toEqual({
      status: 422,
      body: { error: { code: "invalid_request", message: expect.any(String), field } },
    });
    expect(await revenueRows("inv_bad")).toHaveLength(0);
    expect(await customerExists("cust_bad")).toBe(false);
  });

  it("accepts the maximum amount exactly (10^12)", async () => {
    expect(
      (await callRevenue(deps(), P.key, payment({ event_id: "inv_max", amount: 1e12 }))).status,
    ).toBe(201);
    expect((await revenueRows("inv_max"))[0]?.amountMinor).toBe(1_000_000_000_000n);
  });

  it("JPY and KWD amounts are stored as integer minor units", async () => {
    await callRevenue(
      deps(),
      P.key,
      payment({ event_id: "inv_jpy", customer_id: "cust_jpy", currency: "JPY", amount: 5000 }),
    );
    await callRevenue(
      deps(),
      P.key,
      payment({ event_id: "inv_kwd", customer_id: "cust_kwd", currency: "kwd", amount: 1234 }),
    );
    expect((await revenueRows("inv_jpy"))[0]).toMatchObject({
      amountMinor: 5000n,
      currency: "JPY",
    });
    expect((await revenueRows("inv_kwd"))[0]).toMatchObject({
      amountMinor: 1234n,
      currency: "KWD",
    });
  });
});

describe("idempotency", () => {
  const first = payment({ event_id: "inv_idem", customer_id: "cust_idem" });

  it("create → 201, identical retry → 200 duplicate with the same body", async () => {
    const created = await callRevenue(deps(), P.key, first);
    expect(created.status).toBe(201);
    const retry = await callRevenue(deps(), P.key, first);
    expect(retry.status).toBe(200);
    expect(retry.body).toEqual({ ...created.body, status: "duplicate" });
    expect(await revenueRows("inv_idem")).toHaveLength(1);
  });

  it("semantically identical retry with different formatting → duplicate", async () => {
    const variant = {
      event_id: "inv_idem",
      customer_id: "cust_idem",
      type: "payment",
      amount: 2900,
      currency: "usd",
      occurred_at: "2026-10-01T14:00:00.000+03:00",
      billing_interval: "month",
      subscription_id: "sub_1",
    };
    const res = await callRevenue(deps(), P.key, variant);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("duplicate");
  });

  it.each([
    ["changed amount", { amount: 3000 }],
    ["changed customer", { customer_id: "cust_other" }],
    ["changed currency", { currency: "EUR" }],
    ["changed occurred_at", { occurred_at: "2026-10-01T11:00:01Z" }],
    ["added visitor", { visitor_id: uid(9) }],
  ])("%s with the same event_id → 409, no side effects", async (_name, patch) => {
    const res = await callRevenue(deps(), P.key, { ...first, ...patch });
    expect(res).toEqual({
      status: 409,
      body: { error: { code: "idempotency_conflict", message: expect.any(String) } },
    });
    expect(await revenueRows("inv_idem")).toHaveLength(1);
    expect(await customerExists("cust_other")).toBe(false);
  });

  it("concurrent identical requests → exactly one row; one 201, the rest 200 duplicate", async () => {
    const body = payment({
      event_id: "inv_race",
      customer_id: "cust_race_new",
      visitor_id: uid(2, "b"),
    });
    const results = await Promise.all(
      Array.from({ length: 8 }, () => callRevenue(deps(), P.key, body)),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 200, 200, 200, 201]);
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(await revenueRows("inv_race")).toHaveLength(1);
    const links = await tmp.db
      .select()
      .from(customerVisitors)
      .where(
        and(
          eq(customerVisitors.projectId, P.projectId),
          eq(customerVisitors.visitorId, uid(2, "b")),
        ),
      );
    expect(links).toHaveLength(1);
  });

  it("concurrent same event_id with different customers → one 201, others 409, no stray customers", async () => {
    const bodies = Array.from({ length: 6 }, (_, i) =>
      payment({ event_id: "inv_race2", customer_id: `cust_race2_${i}` }),
    );
    const results = await Promise.all(bodies.map((b) => callRevenue(deps(), P.key, b)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
    const winner = results.findIndex((r) => r.status === 201);
    for (let i = 0; i < bodies.length; i++) {
      expect(await customerExists(`cust_race2_${i}`)).toBe(i === winner);
    }
  });
});

describe("refunds", () => {
  const customer = "cust_refund";

  beforeAll(async () => {
    const d = makeDeps(tmp.db, clock);
    await callRevenue(
      d,
      P.key,
      payment({ event_id: "pay_r1", customer_id: customer, amount: 10000 }),
    );
    await callRevenue(
      d,
      P.key,
      payment({ event_id: "pay_r2", customer_id: customer, amount: 5000 }),
    );
    await callRevenue(
      d,
      P.key,
      payment({ event_id: "pay_other", customer_id: "cust_someone_else", amount: 5000 }),
    );
  });

  const refund = (patch: Record<string, unknown>) =>
    payment({
      type: "refund",
      customer_id: customer,
      billing_interval: null,
      subscription_id: null,
      ...patch,
    });

  it("full refund", async () => {
    const res = await callRevenue(
      deps(),
      P.key,
      refund({ event_id: "ref_full", refund_of: "pay_r2", amount: 5000 }),
    );
    expect(res.status).toBe(201);
    const [original] = await revenueRows("pay_r2");
    const [row] = await revenueRows("ref_full");
    expect(row).toMatchObject({ type: "refund", amountMinor: 5000n, refundOfId: original?.id });
  });

  it("any further refund of a fully refunded payment → 422", async () => {
    const res = await callRevenue(
      deps(),
      P.key,
      refund({ event_id: "ref_more", refund_of: "pay_r2", amount: 1 }),
    );
    expect(res).toMatchObject({
      status: 422,
      body: { error: { code: "invalid_request", field: "amount" } },
    });
  });

  it("multiple partial refunds up to the original amount", async () => {
    for (const [i, amount] of [3000, 3000, 4000].entries()) {
      const res = await callRevenue(
        deps(),
        P.key,
        refund({ event_id: `ref_part_${i}`, refund_of: "pay_r1", amount }),
      );
      expect(res.status).toBe(201);
    }
    const over = await callRevenue(
      deps(),
      P.key,
      refund({ event_id: "ref_part_over", refund_of: "pay_r1", amount: 1 }),
    );
    expect(over).toMatchObject({ status: 422, body: { error: { field: "amount" } } });
  });

  it("an identical refund retry after the balance is exhausted is still a duplicate, not 422", async () => {
    const res = await callRevenue(
      deps(),
      P.key,
      refund({ event_id: "ref_part_2", refund_of: "pay_r1", amount: 4000 }),
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("duplicate");
  });

  it.each([
    [
      "refund larger than the payment",
      {
        event_id: "ref_big",
        refund_of: "pay_other",
        customer_id: "cust_someone_else",
        amount: 5001,
      },
      "amount",
    ],
    [
      "refund of another customer's payment",
      { event_id: "ref_wrong_cust", refund_of: "pay_other", amount: 100 },
      "refund_of",
    ],
    [
      "refund in another currency",
      {
        event_id: "ref_wrong_cur",
        refund_of: "pay_other",
        customer_id: "cust_someone_else",
        currency: "EUR",
        amount: 100,
      },
      "currency",
    ],
    [
      "refund of a refund",
      { event_id: "ref_of_ref", refund_of: "ref_full", amount: 1 },
      "refund_of",
    ],
    [
      "refund of an unknown event",
      { event_id: "ref_unknown", refund_of: "nope", amount: 1 },
      "refund_of",
    ],
  ])("%s → 422 and nothing written", async (_name, patch, field) => {
    const res = await callRevenue(deps(), P.key, refund(patch));
    expect(res).toMatchObject({ status: 422, body: { error: { code: "invalid_request", field } } });
    expect(await revenueRows(patch.event_id)).toHaveLength(0);
  });

  it("refund without refund_of is accepted", async () => {
    const res = await callRevenue(
      deps(),
      P.key,
      refund({ event_id: "ref_unlinked", refund_of: null, amount: 700 }),
    );
    expect(res.status).toBe(201);
    expect((await revenueRows("ref_unlinked"))[0]?.refundOfId).toBeNull();
  });

  it("the original payment row is never mutated", async () => {
    const [original] = await revenueRows("pay_r1");
    expect(original).toMatchObject({ type: "payment", amountMinor: 10000n, refundOfId: null });
  });

  it("concurrent partial refunds can never over-refund", async () => {
    await callRevenue(
      deps(),
      P.key,
      payment({ event_id: "pay_conc", customer_id: "cust_conc", amount: 1000 }),
    );
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        callRevenue(
          deps(),
          P.key,
          refund({
            event_id: `ref_conc_${i}`,
            customer_id: "cust_conc",
            refund_of: "pay_conc",
            amount: 300,
          }),
        ),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 422)).toHaveLength(3);
    const [original] = await revenueRows("pay_conc");
    const refunds = (await revenueRows()).filter((r) => r.refundOfId === original?.id);
    expect(refunds.reduce((s, r) => s + r.amountMinor, 0n)).toBe(900n);
  });
});

describe("attribution inheritance: refunds and renewals", () => {
  const visitor = uid(100, "c");

  beforeAll(async () => {
    await seedSessions(tmp.db, P.projectId, [
      {
        id: uid(101, "c"),
        visitorId: visitor,
        startedAt: "2026-09-15T09:00:00Z",
        source: "google",
        medium: "cpc",
        campaign: "launch",
      },
      {
        id: uid(102, "c"),
        visitorId: visitor,
        startedAt: "2026-09-30T09:00:00Z",
        source: "direct",
      },
    ]);
  });

  it("first payment with visitor_id acquires via google", async () => {
    const res = await callRevenue(
      deps(),
      P.key,
      payment({ event_id: "ren_1", customer_id: "cust_ren", visitor_id: visitor }),
    );
    expect(res.body.attribution).toEqual({ source: "google", status: "attributed" });
  });

  it("refund inherits the acquisition source", async () => {
    const res = await callRevenue(
      deps(),
      P.key,
      payment({
        event_id: "ren_ref",
        type: "refund",
        customer_id: "cust_ren",
        refund_of: "ren_1",
        amount: 100,
        billing_interval: null,
        subscription_id: null,
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body.attribution).toEqual({ source: "google", status: "attributed" });
  });

  it("later payment (renewal) after a new post-acquisition campaign visit keeps the original source", async () => {
    await seedSessions(tmp.db, P.projectId, [
      {
        id: uid(103, "c"),
        visitorId: visitor,
        startedAt: "2026-10-20T09:00:00Z",
        source: "facebook",
        campaign: "winback",
      },
    ]);
    const later = createFakeClock("2026-11-01T12:00:00Z");
    const res = await callRevenue(
      makeDeps(tmp.db, later),
      P.key,
      payment({
        event_id: "ren_2",
        customer_id: "cust_ren",
        visitor_id: visitor,
        occurred_at: "2026-11-01T11:00:00Z",
      }),
    );
    expect(res.body.attribution).toEqual({ source: "google", status: "attributed" });
    const [attr] = await tmp.db
      .select()
      .from(customerAttribution)
      .innerJoin(
        customers,
        and(
          eq(customers.projectId, customerAttribution.projectId),
          eq(customers.id, customerAttribution.customerId),
        ),
      )
      .where(and(eq(customers.projectId, P.projectId), eq(customers.externalId, "cust_ren")));
    expect(attr?.customer_attribution).toMatchObject({
      acquiredAt: new Date("2026-10-01T11:00:00Z"),
      creditedSessionId: uid(101, "c"),
      creditedCampaign: "launch",
      firstTouchSource: "google",
    });
  });

  it("a later identify from a new visitor with only post-acquisition sessions does not reacquire", async () => {
    const newVisitor = uid(110, "c");
    await seedSessions(tmp.db, P.projectId, [
      {
        id: uid(111, "c"),
        visitorId: newVisitor,
        startedAt: "2026-11-02T09:00:00Z",
        source: "bing",
      },
    ]);
    const later = createFakeClock("2026-11-03T12:00:00Z");
    await callIdentify(makeDeps(tmp.db, later), P.key, {
      customer_id: "cust_ren",
      visitor_id: newVisitor,
    });
    const res = await callRevenue(makeDeps(tmp.db, later), P.key, payment({ event_id: "ren_1" }));
    expect(res.status).toBe(409); // sanity: ren_1 belongs to cust_ren with different payload
    const retry = await callRevenue(
      makeDeps(tmp.db, later),
      P.key,
      payment({ event_id: "ren_1", customer_id: "cust_ren", visitor_id: visitor }),
    );
    expect(retry.body).toMatchObject({
      status: "duplicate",
      attribution: { source: "google", status: "attributed" },
    });
  });
});

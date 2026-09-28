import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ATTRIBUTION_RULES_VERSION } from "@/server/attribution/engine";
import { loadEligibleTouches } from "@/server/attribution/materialize";
import { customerAttribution, customers } from "@/server/db/schema";
import { createFakeClock } from "@/server/time/clock";
import type { TempDatabase } from "../helpers/db";
import {
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
let Other: TestProject;

beforeAll(async () => {
  tmp = await createDomainDatabase();
  const clock = createFakeClock("2026-10-01T00:00:00Z");
  P = await createTestProject(tmp.db, clock);
  Other = await createTestProject(tmp.db, clock, { name: "other" });
});

afterAll(async () => {
  await tmp?.destroy();
});

async function attributionOf(externalId: string, projectId = P.projectId) {
  const [row] = await tmp.db
    .select({ a: customerAttribution, customerId: customers.id })
    .from(customers)
    .innerJoin(
      customerAttribution,
      and(
        eq(customerAttribution.projectId, customers.projectId),
        eq(customerAttribution.customerId, customers.id),
      ),
    )
    .where(and(eq(customers.projectId, projectId), eq(customers.externalId, externalId)));
  if (!row) throw new Error(`no attribution for ${externalId}`);
  return { ...row.a, customerId: row.customerId };
}

const at = (iso: string) => makeDeps(tmp.db, createFakeClock(iso));

describe("materialized attribution (real PostgreSQL)", () => {
  it("late trusted link reveals an earlier pre-acquisition session → recomputed", async () => {
    const v1 = uid(1, "a");
    const v2 = uid(2, "a");
    await seedSessions(tmp.db, P.projectId, [
      { id: uid(11, "a"), visitorId: v1, startedAt: "2026-09-28T10:00:00Z", source: "direct" },
      {
        id: uid(12, "a"),
        visitorId: v2,
        startedAt: "2026-09-20T10:00:00Z",
        source: "newsletter",
        campaign: "sept",
      },
    ]);
    // Acquisition: identify of v1 at 10-01.
    await callIdentify(at("2026-10-01T12:00:00Z"), P.key, { customer_id: "late", visitor_id: v1 });
    expect(await attributionOf("late")).toMatchObject({
      status: "direct",
      creditedSource: "direct",
    });

    // Weeks later the customer logs in on a second browser (v2) that had an earlier campaign session.
    await callIdentify(at("2026-10-20T12:00:00Z"), P.key, { customer_id: "late", visitor_id: v2 });
    const after = await attributionOf("late");
    expect(after).toMatchObject({
      status: "attributed",
      creditedSource: "newsletter",
      creditedCampaign: "sept",
      creditedSessionId: uid(12, "a"),
      firstTouchSessionId: uid(12, "a"),
      firstTouchSource: "newsletter",
      acquiredAt: new Date("2026-10-01T12:00:00Z"),
      rulesVersion: ATTRIBUTION_RULES_VERSION,
      computedAt: new Date("2026-10-20T12:00:00Z"),
    });
  });

  it("late link with only post-acquisition sessions → credit unchanged", async () => {
    const v1 = uid(3, "a");
    const v2 = uid(4, "a");
    await seedSessions(tmp.db, P.projectId, [
      { id: uid(13, "a"), visitorId: v1, startedAt: "2026-09-25T10:00:00Z", source: "twitter" },
      {
        id: uid(14, "a"),
        visitorId: v2,
        startedAt: "2026-10-05T10:00:00Z",
        source: "google",
        medium: "cpc",
      },
    ]);
    await callIdentify(at("2026-10-01T12:00:00Z"), P.key, { customer_id: "late2", visitor_id: v1 });
    await callIdentify(at("2026-10-10T12:00:00Z"), P.key, { customer_id: "late2", visitor_id: v2 });
    expect(await attributionOf("late2")).toMatchObject({
      status: "attributed",
      creditedSource: "twitter",
    });
  });

  it("acquisition = first payment when it precedes the first link", async () => {
    const v = uid(5, "a");
    await seedSessions(tmp.db, P.projectId, [
      { id: uid(15, "a"), visitorId: v, startedAt: "2026-09-10T10:00:00Z", source: "reddit" },
      // Between the payment (09-15) and the link (10-01): post-acquisition, ignored.
      { id: uid(16, "a"), visitorId: v, startedAt: "2026-09-20T10:00:00Z", source: "bing" },
    ]);
    await callRevenue(
      at("2026-10-01T12:00:00Z"),
      P.key,
      payment({ event_id: "pp_1", customer_id: "paid_first", occurred_at: "2026-09-15T00:00:00Z" }),
    );
    await callIdentify(at("2026-10-01T12:00:00Z"), P.key, {
      customer_id: "paid_first",
      visitor_id: v,
    });
    expect(await attributionOf("paid_first")).toMatchObject({
      acquiredAt: new Date("2026-09-15T00:00:00Z"),
      creditedSource: "reddit",
    });
  });

  it("customer with no linked visitor → unattributed (never folded into direct)", async () => {
    await callRevenue(
      at("2026-10-01T12:00:00Z"),
      P.key,
      payment({ event_id: "nolink_1", customer_id: "nolink" }),
    );
    expect(await attributionOf("nolink")).toMatchObject({
      status: "unattributed",
      creditedSource: null,
      creditedSessionId: null,
      acquiredAt: new Date("2026-10-01T11:00:00Z"),
    });
  });

  it("the touch query is bounded to one project's customer, its visitors and the 90-day window", async () => {
    const v = uid(6, "a");
    await seedSessions(tmp.db, P.projectId, [
      { id: uid(17, "a"), visitorId: v, startedAt: "2026-06-01T00:00:00Z", source: "too-old" },
      { id: uid(18, "a"), visitorId: v, startedAt: "2026-07-03T12:00:00Z", source: "edge" },
      { id: uid(19, "a"), visitorId: v, startedAt: "2026-10-01T12:00:01Z", source: "after" },
      {
        id: uid(20, "a"),
        visitorId: uid(7, "a"),
        startedAt: "2026-09-30T00:00:00Z",
        source: "unlinked",
      },
    ]);
    // Same visitor ID in another project: must never be considered.
    await seedSessions(tmp.db, Other.projectId, [
      {
        id: uid(21, "a"),
        visitorId: v,
        startedAt: "2026-09-30T00:00:00Z",
        source: "other-project",
      },
    ]);
    await callIdentify(at("2026-10-01T12:00:00Z"), P.key, {
      customer_id: "bounded",
      visitor_id: v,
    });
    const attr = await attributionOf("bounded");
    const touches = await loadEligibleTouches(
      tmp.db,
      { projectId: P.projectId, customerId: attr.customerId },
      new Date("2026-10-01T12:00:00Z"),
    );
    expect(touches.map((t) => t.source)).toEqual(["edge"]);
    expect(attr.creditedSource).toBe("edge");
  });

  it("post-acquisition link from a different project's visitor cannot poison attribution", async () => {
    const shared = uid(8, "a");
    await seedSessions(tmp.db, Other.projectId, [
      {
        id: uid(22, "a"),
        visitorId: shared,
        startedAt: "2026-09-29T00:00:00Z",
        source: "attacker",
      },
    ]);
    await callIdentify(at("2026-10-01T12:00:00Z"), P.key, {
      customer_id: "poison",
      visitor_id: shared,
    });
    expect(await attributionOf("poison")).toMatchObject({ status: "unattributed" });
  });
});

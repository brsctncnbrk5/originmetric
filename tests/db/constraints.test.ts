import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFakeClock } from "@/server/time/clock";
import type { TempDatabase } from "../helpers/db";
import {
  T0,
  createDomainDatabase,
  createTestProject,
  uid,
  type TestProject,
} from "../helpers/domain";

// Direct SQL attempts (parameterized) against the real schema: the database itself must make
// cross-project references and invalid money impossible, independent of application code.

const FK_VIOLATION = { code: "23503" };
const CHECK_VIOLATION = { code: "23514" };
const UNIQUE_VIOLATION = { code: "23505" };
const IMMUTABLE = { code: "23000" };
const HASH = "a".repeat(64);

let tmp: TempDatabase;
let A: TestProject;
let B: TestProject;
let customerA: string;
let customerB: string;
let paymentB: string;

beforeAll(async () => {
  tmp = await createDomainDatabase();
  const clock = createFakeClock(T0);
  A = await createTestProject(tmp.db, clock, { name: "A" });
  B = await createTestProject(tmp.db, clock, { name: "B" });
  [{ id: customerA }] = (await tmp.sql`
    insert into customers (project_id, external_id) values (${A.projectId}, 'cust_1') returning id`) as unknown as [
    { id: string },
  ];
  [{ id: customerB }] = (await tmp.sql`
    insert into customers (project_id, external_id) values (${B.projectId}, 'cust_1') returning id`) as unknown as [
    { id: string },
  ];
  [{ id: paymentB }] = (await tmp.sql`
    insert into revenue_events (project_id, event_id, type, customer_id, amount_minor, currency,
      occurred_at, received_at, payload_hash)
    values (${B.projectId}, 'inv_b', 'payment', ${customerB}, 1000, 'USD', now(), now(), ${HASH})
    returning id`) as unknown as [{ id: string }];
  await tmp.sql`
    insert into sessions (project_id, id, visitor_id, started_at, last_seen_at, source, landing_path)
    values (${B.projectId}, ${uid(1)}, ${uid(2)}, now(), now(), 'google', '/')`;
});

afterAll(async () => {
  await tmp?.destroy();
});

function insertRevenue(
  projectId: string,
  customerId: string,
  extra: { eventId?: string; amount?: number; type?: string; refundOf?: string | null } = {},
) {
  return tmp.sql`
    insert into revenue_events (project_id, event_id, type, customer_id, amount_minor, currency,
      occurred_at, received_at, refund_of_id, payload_hash)
    values (${projectId}, ${extra.eventId ?? "inv_x"}, ${extra.type ?? "payment"}, ${customerId},
      ${extra.amount ?? 100}, 'USD', now(), now(), ${extra.refundOf ?? null}, ${HASH})`;
}

describe("composite tenant foreign keys", () => {
  it("the same external customer ID exists independently in projects A and B", () => {
    expect(customerA).not.toBe(customerB);
  });

  it("cross-project trusted link fails", async () => {
    await expect(tmp.sql`
      insert into customer_visitors (project_id, customer_id, visitor_id, linked_at, method)
      values (${A.projectId}, ${customerB}, ${uid(9)}, now(), 'server_identify')`).rejects.toMatchObject(
      FK_VIOLATION,
    );
  });

  it("cross-project revenue customer fails", async () => {
    await expect(insertRevenue(A.projectId, customerB)).rejects.toMatchObject(FK_VIOLATION);
  });

  it("cross-project refund_of fails", async () => {
    await expect(
      insertRevenue(A.projectId, customerA, {
        type: "refund",
        refundOf: paymentB,
        eventId: "ref_x",
      }),
    ).rejects.toMatchObject(FK_VIOLATION);
  });

  it("cross-project attribution row fails", async () => {
    await expect(tmp.sql`
      insert into customer_attribution (project_id, customer_id, rules_version, status, computed_at)
      values (${A.projectId}, ${customerB}, 1, 'unattributed', now())`).rejects.toMatchObject(
      FK_VIOLATION,
    );
  });

  it("cross-project credited session pointer fails", async () => {
    await expect(tmp.sql`
      insert into customer_attribution (project_id, customer_id, rules_version, status, acquired_at,
        credited_session_id, credited_source, first_touch_source, computed_at)
      values (${A.projectId}, ${customerA}, 1, 'attributed', now(), ${uid(1)}, 'google', 'google', now())`).rejects.toMatchObject(
      FK_VIOLATION,
    );
  });

  it("cross-project event → session fails", async () => {
    await expect(tmp.sql`
      insert into events (project_id, event_id, visitor_id, session_id, received_at, path)
      values (${A.projectId}, ${uid(3)}, ${uid(2)}, ${uid(1)}, now(), '/')`).rejects.toMatchObject(
      FK_VIOLATION,
    );
  });
});

describe("value constraints", () => {
  it.each([0, -1])("amount %i fails at the DB", async (amount) => {
    await expect(
      insertRevenue(A.projectId, customerA, { amount, eventId: `amt_${amount}` }),
    ).rejects.toMatchObject(CHECK_VIOLATION);
  });

  it("duplicate (project_id, event_id) fails; same event_id in another project is fine", async () => {
    await insertRevenue(A.projectId, customerA, { eventId: "dup_1" });
    await expect(insertRevenue(A.projectId, customerA, { eventId: "dup_1" })).rejects.toMatchObject(
      UNIQUE_VIOLATION,
    );
    await expect(
      insertRevenue(B.projectId, customerB, { eventId: "dup_1" }),
    ).resolves.toBeDefined();
  });

  it("duplicate external customer ID within a project fails", async () => {
    await expect(tmp.sql`
      insert into customers (project_id, external_id) values (${A.projectId}, 'cust_1')`).rejects.toMatchObject(
      UNIQUE_VIOLATION,
    );
  });

  it("only server_identify / revenue_api link methods are allowed", async () => {
    await expect(tmp.sql`
      insert into customer_visitors (project_id, customer_id, visitor_id, linked_at, method)
      values (${A.projectId}, ${customerA}, ${uid(9)}, now(), 'browser')`).rejects.toMatchObject(
      CHECK_VIOLATION,
    );
  });

  it.each([
    ["type", () => ({ type: "subscription_started", eventId: "t1" })],
    ["refund_of on a payment", () => ({ type: "payment", refundOf: paymentB, eventId: "t2" })],
  ])("rejects invalid %s", async (_n, extra) => {
    // Lazy: paymentB only exists after beforeAll.
    await expect(insertRevenue(B.projectId, customerB, extra())).rejects.toMatchObject(
      CHECK_VIOLATION,
    );
  });

  it("rejects a lowercase / malformed currency", async () => {
    await expect(tmp.sql`
      insert into revenue_events (project_id, event_id, type, customer_id, amount_minor, currency,
        occurred_at, received_at, payload_hash)
      values (${A.projectId}, 'cur_1', 'payment', ${customerA}, 1, 'usd', now(), now(), ${HASH})`).rejects.toMatchObject(
      CHECK_VIOLATION,
    );
  });

  it("stores API keys as prefix + 64-hex hash only", async () => {
    await expect(tmp.sql`
      insert into api_keys (project_id, prefix, secret_hash)
      values (${A.projectId}, 'abcdefgh', 'om_sk_plaintext')`).rejects.toMatchObject(
      CHECK_VIOLATION,
    );
  });
});

describe("immutability", () => {
  it("revenue rows cannot be updated", async () => {
    await expect(
      tmp.sql`update revenue_events set amount_minor = 1 where id = ${paymentB}`,
    ).rejects.toMatchObject(IMMUTABLE);
  });

  it("trusted links cannot be updated", async () => {
    await tmp.sql`
      insert into customer_visitors (project_id, customer_id, visitor_id, linked_at, method)
      values (${A.projectId}, ${customerA}, ${uid(7)}, now(), 'server_identify')`;
    await expect(tmp.sql`
      update customer_visitors set method = 'revenue_api' where visitor_id = ${uid(7)}`).rejects.toMatchObject(
      IMMUTABLE,
    );
  });

  it("session entry-source fields are immutable; counters may change", async () => {
    await expect(
      tmp.sql`update sessions set source = 'bing' where id = ${uid(1)}`,
    ).rejects.toMatchObject(IMMUTABLE);
    await tmp.sql`update sessions set pageviews = pageviews + 1, last_seen_at = now() + interval '1 minute' where id = ${uid(1)}`;
    const [row] = await tmp.sql<
      { pageviews: number }[]
    >`select pageviews from sessions where id = ${uid(1)}`;
    expect(row?.pageviews).toBe(2);
  });
});

describe("session purge keeps copied attribution", () => {
  it("deleting a credited session nulls the pointer but keeps the source strings", async () => {
    await tmp.sql`
      insert into customer_attribution (project_id, customer_id, rules_version, status, acquired_at,
        credited_session_id, credited_source, credited_medium, first_touch_session_id,
        first_touch_source, computed_at)
      values (${B.projectId}, ${customerB}, 1, 'attributed', now(), ${uid(1)}, 'google', 'cpc',
        ${uid(1)}, 'google', now())`;
    await tmp.sql`delete from sessions where project_id = ${B.projectId} and id = ${uid(1)}`;
    const [row] = await tmp.sql<
      {
        credited_session_id: string | null;
        first_touch_session_id: string | null;
        credited_source: string;
        project_id: string;
      }[]
    >`select * from customer_attribution where customer_id = ${customerB}`;
    expect(row).toMatchObject({
      credited_session_id: null,
      first_touch_session_id: null,
      credited_source: "google",
      project_id: B.projectId,
    });
  });
});

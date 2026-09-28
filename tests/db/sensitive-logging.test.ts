import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  type TestProject,
} from "../helpers/domain";

// Plan §22: representative requests through the real handlers; captured logs must contain no
// Authorization header, key/secret, customer ID, visitor ID or raw body content.

let tmp: TempDatabase;
let P: TestProject;
const clock = createFakeClock(T0);

const CUSTOMER = "cust_sensitive_8841";
const VISITOR = "7f3c2a10-5b6e-4d1f-9a8b-0c1d2e3f4a5b";
const EVENT = "inv_sensitive_5521";
const MARKER = "raw-body-marker-3141";

beforeAll(async () => {
  tmp = await createDomainDatabase();
  P = await createTestProject(tmp.db, clock);
});

afterAll(async () => {
  await tmp?.destroy();
});

describe("API request logging", () => {
  it("never logs secrets, customer/visitor IDs or bodies, on any outcome", async () => {
    const deps = makeDeps(tmp.db, clock);
    const secret = P.key.split("_").at(-1) ?? "";
    const bodies = [
      { customer_id: CUSTOMER, visitor_id: VISITOR },
      { customer_id: CUSTOMER, visitor_id: VISITOR, extra: MARKER },
    ];
    await callIdentify(deps, P.key, bodies[0]);
    await callIdentify(deps, P.key, bodies[0]); // duplicate
    await callIdentify(deps, P.key, bodies[1]); // 422
    await callIdentify(deps, `${P.key.slice(0, -1)}Z`, bodies[0]); // 401 wrong secret
    await callIdentify(deps, null, bodies[0], { cookie: "om_vid=" + VISITOR }); // 401 missing
    const rev = payment({ event_id: EVENT, customer_id: CUSTOMER, visitor_id: VISITOR });
    await callRevenue(deps, P.key, rev); // 201
    await callRevenue(deps, P.key, rev); // 200 duplicate
    await callRevenue(deps, P.key, { ...rev, amount: 1 }); // 409
    await callRevenue(deps, P.key, { ...rev, event_id: "x2", customer_id: `${MARKER}@mail.com` }); // 422
    await callRevenue(deps, P.key, `{"event_id":"${MARKER}",`); // 422 bad JSON

    const out = deps.logs.text();
    expect(deps.logs.lines).toHaveLength(10);
    for (const forbidden of [
      P.key,
      secret,
      CUSTOMER,
      VISITOR,
      MARKER,
      "Bearer",
      "authorization",
      "om_sk_",
    ]) {
      expect(out).not.toContain(forbidden);
    }
    const entries = deps.logs.lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual(
        expect.arrayContaining(["route", "method", "status", "duration_ms"]),
      );
      const allowed = [
        "level",
        "time",
        "msg",
        "route",
        "method",
        "status",
        "duration_ms",
        "project_id",
        "api_key_prefix",
        "error_code",
        "outcome",
      ];
      expect(Object.keys(entry).every((k) => allowed.includes(k))).toBe(true);
    }
    expect(entries.map((e) => e.status)).toEqual([
      200, 200, 422, 401, 401, 201, 200, 409, 422, 422,
    ]);
    // Safe fields are present on authenticated requests only.
    expect(entries[0]).toMatchObject({
      project_id: P.projectId,
      api_key_prefix: P.keyPrefix,
      outcome: "linked",
    });
    expect(entries[3]).not.toHaveProperty("api_key_prefix");
    expect(entries[7]).toMatchObject({ error_code: "idempotency_conflict" });
  });

  it("unexpected errors log only class and SQLSTATE, and answer a generic 500", async () => {
    const broken = await createDomainDatabase();
    const project = await createTestProject(broken.db, clock);
    const deps = makeDeps(broken.db, clock);
    await broken.sql`drop table customer_visitors cascade`;
    const res = await callIdentify(deps, project.key, {
      customer_id: CUSTOMER,
      visitor_id: VISITOR,
    });
    await broken.destroy();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: "internal", message: "internal error; retry is safe" },
    });
    const out = deps.logs.text();
    expect(out).toContain('"sqlstate":"42P01"');
    expect(out).not.toContain(CUSTOMER);
    expect(out).not.toContain(VISITOR);
  });
});

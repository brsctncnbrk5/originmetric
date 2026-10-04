import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { projects } from "@/server/db/schema";
import {
  authorizeInternalProject,
  authorizeServerKey,
  authorizeSiteKey,
  forProject,
} from "@/server/data/project";
import { createFakeClock } from "@/server/time/clock";
import {
  createDomainDatabase,
  createTestProject,
  makeDeps,
  callRevenue,
  callIdentify,
  payment,
  seedSessions,
  T0,
  uid,
  type TestProject,
} from "../helpers/domain";
import type { TempDatabase } from "../helpers/db";
let tmp: TempDatabase;
let a: TestProject;
let b: TestProject;
const clock = createFakeClock(T0);
const token = "Bearer install-fixture";
const scoped = async (project: TestProject) =>
  forProject(await authorizeInternalProject(tmp.db, token, project.projectId));
beforeAll(async () => {
  vi.stubEnv("INTERNAL_TOKEN", "install-fixture");
  tmp = await createDomainDatabase();
  a = await createTestProject(tmp.db, clock);
  b = await createTestProject(tmp.db, clock);
});
afterAll(async () => {
  await tmp?.destroy();
  vi.unstubAllEnvs();
});
it("does not combine another project's matching source with A's receipts", async () => {
  await seedSessions(tmp.db, b.projectId, [
    { id: uid(1), visitorId: uid(2), startedAt: "2026-10-01T10:00:00Z", source: "google" },
  ]);
  expect(
    (await callRevenue(makeDeps(tmp.db, clock), b.key, payment({ visitor_id: uid(2), test: true })))
      .status,
  ).toBe(201);
  expect(await (await scoped(a)).installationStatus()).toMatchObject({
    trackerReceivedAt: null,
    revenueReceivedAt: null,
    sourceMatched: false,
    reason: "no_test_payment",
  });
  expect(await (await scoped(b)).installationStatus()).toMatchObject({
    sourceMatched: true,
    reason: "matched",
  });
});
it("live events cannot satisfy test revenue receipt; missing visitor gets a specific reason", async () => {
  const deps = makeDeps(tmp.db, clock);
  await callRevenue(deps, a.key, payment({ event_id: "live", test: false }));
  expect((await (await scoped(a)).installationStatus()).revenueReceivedAt).toBeNull();
  await callRevenue(
    deps,
    a.key,
    payment({ event_id: "test", customer_id: "test_missing", test: true }),
  );
  expect(await (await scoped(a)).installationStatus()).toMatchObject({
    sourceMatched: false,
    reason: "missing_visitor_link",
    payment: { amount: "2900", currency: "USD", source: null },
  });
});
it("a trusted visitor without an eligible session is not a source match", async () => {
  const deps = makeDeps(tmp.db, clock);
  await callRevenue(
    deps,
    a.key,
    payment({
      event_id: "test_no_session",
      customer_id: "test_no_session",
      visitor_id: uid(9),
      test: true,
    }),
  );
  expect(await (await scoped(a)).installationStatus()).toMatchObject({
    sourceMatched: false,
    reason: "no_eligible_session",
  });
});
it("a retained Direct session has an actionable campaign explanation", async () => {
  await seedSessions(tmp.db, a.projectId, [
    { id: uid(10), visitorId: uid(11), startedAt: "2026-10-01T10:00:00Z" },
  ]);
  await callRevenue(
    makeDeps(tmp.db, clock),
    a.key,
    payment({
      event_id: "test_direct",
      customer_id: "test_direct",
      visitor_id: uid(11),
      test: true,
    }),
  );
  expect(await (await scoped(a)).installationStatus()).toMatchObject({
    sourceMatched: false,
    reason: "direct_visit",
    payment: { status: "direct", source: "direct" },
  });
});
it("identify can repair a missing trusted link, and checks reflect real recomputation", async () => {
  await seedSessions(tmp.db, a.projectId, [
    { id: uid(20), visitorId: uid(21), startedAt: "2026-10-01T10:00:00Z", source: "google" },
  ]);
  const deps = makeDeps(tmp.db, clock);
  await callRevenue(
    deps,
    a.key,
    payment({ event_id: "test_repair", customer_id: "test_repair", test: true }),
  );
  expect((await (await scoped(a)).installationStatus()).reason).toBe("missing_visitor_link");
  await callIdentify(deps, a.key, { customer_id: "test_repair", visitor_id: uid(21) });
  expect(await (await scoped(a)).installationStatus()).toMatchObject({
    sourceMatched: true,
    reason: "matched",
  });
});
it("server/site ingress grants cannot read setup data; deletion invalidates issued read grants", async () => {
  const server = await authorizeServerKey(tmp.db, `Bearer ${a.key}`, clock);
  const site = await authorizeSiteKey(tmp.db, a.siteKey);
  for (const context of [server!.context, site!.context])
    await expect(forProject(context).installationStatus()).rejects.toMatchObject({ status: 404 });
  const grant = await scoped(a);
  await tmp.db.update(projects).set({ deletedAt: clock.now() }).where(eq(projects.id, a.projectId));
  await expect(grant.installationStatus()).rejects.toMatchObject({ status: 404 });
  expect((await (await scoped(b)).installationStatus()).sourceMatched).toBe(true);
});

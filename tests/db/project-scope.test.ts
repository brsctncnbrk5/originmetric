import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { apiKeys, customers, projects } from "@/server/db/schema";
import {
  authorizeInternalProject,
  internalProjectData,
  forProject,
  ProjectNotFound,
  type AuthorizedProjectContext,
} from "@/server/data/project";
import { authenticateApiKey } from "@/server/tenancy/api-keys";
import { createFakeClock } from "@/server/time/clock";
import {
  createDomainDatabase,
  createTestProject,
  T0,
  uid,
  type TestProject,
} from "../helpers/domain";
import type { TempDatabase } from "../helpers/db";

let tmp: TempDatabase;
let a: TestProject;
let b: TestProject;
const clock = createFakeClock(T0);
const authorization = "Bearer fixture-internal-token";
const input = {
  name: "Updated A",
  allowedDomains: ["a.example.com"],
  timezone: "UTC",
  primaryCurrency: "USD",
  excludedReferrers: ["checkout.example.com"],
};
let scope: ReturnType<typeof forProject>;

beforeAll(async () => {
  vi.stubEnv("INTERNAL_TOKEN", "fixture-internal-token");
  tmp = await createDomainDatabase();
  a = await createTestProject(tmp.db, clock, { name: "A", allowedDomains: ["a.example.com"] });
  b = await createTestProject(tmp.db, clock, { name: "B", allowedDomains: ["b.example.com"] });
  scope = forProject(await authorizeInternalProject(tmp.db, authorization, a.projectId));
  await tmp.db.insert(customers).values([
    { projectId: a.projectId, id: uid(1), externalId: "only-a" },
    { projectId: b.projectId, id: uid(1), externalId: "only-b" },
  ]);
});
afterAll(async () => {
  await tmp?.destroy();
  vi.unstubAllEnvs();
});

async function expect404(action: Promise<unknown>) {
  await expect(action).rejects.toMatchObject({
    name: "ProjectNotFound",
    message: "Not found",
    status: 404,
  });
}

describe("P3 scoped operator foundation (not user membership acceptance)", () => {
  it("rejects missing/wrong token, server API key, malformed and unknown project uniformly", async () => {
    for (const token of [null, "Bearer wrong", `Bearer ${a.key}`]) {
      await expect404(authorizeInternalProject(tmp.db, token, a.projectId));
    }
    for (const id of ["not-uuid", uid(999)])
      await expect404(authorizeInternalProject(tmp.db, authorization, id));
  });
  it("rejects invalid operator access before opening a pool", async () => {
    vi.stubEnv("DATABASE_URL", "");
    try {
      await expect404(internalProjectData(null, a.projectId));
      await expect404(internalProjectData(authorization, "not-uuid"));
    } finally {
      vi.unstubAllEnvs();
      vi.stubEnv("INTERNAL_TOKEN", "fixture-internal-token");
    }
  });
  it("rejects forged or copied contexts even when TypeScript is bypassed", async () => {
    expect(() => forProject({} as AuthorizedProjectContext)).toThrow(ProjectNotFound);
    const context = await authorizeInternalProject(tmp.db, authorization, a.projectId);
    expect(Object.isFrozen(context)).toBe(true);
    expect(() => forProject({ ...context })).toThrow(ProjectNotFound);
  });
  it("reads only A rows even with identical child IDs in B", async () => {
    expect((await scope.project()).id).toBe(a.projectId);
    expect(await scope.customerRows()).toEqual([
      { customer: "only-a", status: null, source: null },
    ]);
  });
  it("key listing is project-scoped and never exposes secret/hash", async () => {
    const keys = await scope.keys();
    expect(keys.map((k) => k.id)).toEqual([a.keyId]);
    expect(Object.keys(keys[0]!).sort()).toEqual(
      ["createdAt", "id", "lastUsedAt", "name", "prefix", "revokedAt"].sort(),
    );
  });
  it("foreign, unknown and malformed revoke/rotate return the same 404 without touching B", async () => {
    const before = await tmp.db.select().from(apiKeys).where(eq(apiKeys.projectId, b.projectId));
    for (const id of [b.keyId, uid(998), "invalid"]) {
      await expect404(scope.revokeKey(id, clock));
      await expect404(scope.rotateKey(id, clock));
    }
    expect(await tmp.db.select().from(apiKeys).where(eq(apiKeys.projectId, b.projectId))).toEqual(
      before,
    );
    expect((await authenticateApiKey(tmp.db, `Bearer ${b.key}`, clock))?.projectId).toBe(
      b.projectId,
    );
  });
  it("creates a show-once key, rotates atomically and revokes without crossing tenants", async () => {
    const created = await scope.createKey("rotation", clock);
    expect(created.projectId).toBe(a.projectId);
    const rotated = await scope.rotateKey(created.id, clock);
    expect(await authenticateApiKey(tmp.db, `Bearer ${created.key}`, clock)).toBeNull();
    expect((await authenticateApiKey(tmp.db, `Bearer ${rotated.key}`, clock))?.projectId).toBe(
      a.projectId,
    );
    await expect404(scope.rotateKey(created.id, clock));
    await scope.revokeKey(rotated.id, clock);
    expect(await authenticateApiKey(tmp.db, `Bearer ${rotated.key}`, clock)).toBeNull();
    const stored = await tmp.db.select().from(apiKeys).where(eq(apiKeys.projectId, a.projectId));
    expect(JSON.stringify(stored)).not.toContain(rotated.key);
  });
  it("concurrent rotations yield one replacement only", async () => {
    const key = await scope.createKey(null, clock);
    const results = await Promise.allSettled([
      scope.rotateKey(key.id, clock),
      scope.rotateKey(key.id, clock),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected");
    expect(failed?.status === "rejected" && failed.reason).toBeInstanceOf(ProjectNotFound);
  });
  it("validates project config and updates A without touching B", async () => {
    const before = await tmp.db.select().from(projects).where(eq(projects.id, b.projectId));
    await expect(scope.update({ ...input, timezone: "+03:00" }, clock)).rejects.toThrow();
    const updated = await scope.update(input, clock);
    expect(updated).toMatchObject({
      name: "Updated A",
      allowedDomains: ["a.example.com"],
      siteKey: a.siteKey,
      workspaceId: a.workspaceId,
    });
    expect(await tmp.db.select().from(projects).where(eq(projects.id, b.projectId))).toEqual(
      before,
    );
  });
  it("soft deletion invalidates issued contexts, blocks keys and preserves B", async () => {
    await scope.delete(clock);
    await expect404(scope.project());
    await expect404(scope.customerRows());
    await expect404(scope.keys());
    await expect404(scope.createKey(null, clock));
    await expect404(scope.update(input, clock));
    await expect404(scope.revokeKey(a.keyId, clock));
    await expect404(scope.rotateKey(a.keyId, clock));
    await expect404(authorizeInternalProject(tmp.db, authorization, a.projectId));
    expect(await authenticateApiKey(tmp.db, `Bearer ${a.key}`, clock)).toBeNull();
    expect((await authenticateApiKey(tmp.db, `Bearer ${b.key}`, clock))?.projectId).toBe(
      b.projectId,
    );
    expect(
      await forProject(
        await authorizeInternalProject(tmp.db, authorization, b.projectId),
      ).customerRows(),
    ).toEqual([{ customer: "only-b", status: null, source: null }]);
  });
});

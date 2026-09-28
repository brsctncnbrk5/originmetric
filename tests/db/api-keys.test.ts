import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiKeys, projects } from "@/server/db/schema";
import {
  LAST_USED_RESOLUTION_MS,
  authenticateApiKey,
  createApiKey,
  hashSecret,
  parseApiKey,
  revokeApiKey,
} from "@/server/tenancy/api-keys";
import { createFakeClock } from "@/server/time/clock";
import type { TempDatabase } from "../helpers/db";
import { T0, createDomainDatabase, createTestProject, type TestProject } from "../helpers/domain";

let tmp: TempDatabase;
let P: TestProject;
const clock = createFakeClock(T0);
const bearer = (key: string) => `Bearer ${key}`;

beforeAll(async () => {
  tmp = await createDomainDatabase();
  P = await createTestProject(tmp.db, clock);
});

afterAll(async () => {
  await tmp?.destroy();
});

async function dumpDatabaseText(): Promise<string> {
  // Every column of every table as text: the full key or secret must not appear anywhere.
  const tables = await tmp.sql<{ table_name: string }[]>`
    select table_name from information_schema.tables where table_schema = 'public'`;
  let text = "";
  for (const { table_name } of tables) {
    const rows = await tmp.sql`select t::text as row from ${tmp.sql(table_name)} t`;
    text += rows.map((r) => String(r.row)).join("\n");
  }
  return text;
}

describe("API key storage", () => {
  it("stores only prefix + SHA-256(secret); the full key and secret are absent from the DB", async () => {
    const created = await createApiKey(tmp.db, { projectId: P.projectId, name: "storage" }, clock);
    const parsed = parseApiKey(created.key);
    const [row] = await tmp.db.select().from(apiKeys).where(eq(apiKeys.id, created.id));
    expect(row).toMatchObject({
      prefix: parsed?.prefix,
      secretHash: hashSecret(parsed?.secret ?? ""),
      scope: "server:write",
      revokedAt: null,
      lastUsedAt: null,
    });
    const dump = await dumpDatabaseText();
    expect(dump).not.toContain(created.key);
    expect(dump).not.toContain(parsed?.secret);
    expect(dump).toContain(row?.secretHash);
  });

  it("rotation: several active keys work at once; revoking one leaves the other working", async () => {
    const k1 = await createApiKey(tmp.db, { projectId: P.projectId, name: "old" }, clock);
    const k2 = await createApiKey(tmp.db, { projectId: P.projectId, name: "new" }, clock);
    expect((await authenticateApiKey(tmp.db, bearer(k1.key), clock))?.projectId).toBe(P.projectId);
    expect((await authenticateApiKey(tmp.db, bearer(k2.key), clock))?.projectId).toBe(P.projectId);
    await revokeApiKey(tmp.db, k1.id, clock);
    expect(await authenticateApiKey(tmp.db, bearer(k1.key), clock)).toBeNull();
    expect((await authenticateApiKey(tmp.db, bearer(k2.key), clock))?.keyId).toBe(k2.id);
  });

  it("keys of a soft-deleted project stop working", async () => {
    const other = await createTestProject(tmp.db, clock, { name: "deleted" });
    await tmp.db.update(projects).set({ deletedAt: T0 }).where(eq(projects.id, other.projectId));
    expect(await authenticateApiKey(tmp.db, bearer(other.key), clock)).toBeNull();
  });

  it("the authenticated project comes from the key", async () => {
    const auth = await authenticateApiKey(tmp.db, bearer(P.key), clock);
    expect(auth).toEqual({
      keyId: P.keyId,
      projectId: P.projectId,
      prefix: P.keyPrefix,
      scope: "server:write",
    });
  });
});

describe("last_used_at", () => {
  it("is set on first use and written at most once per minute", async () => {
    const c = createFakeClock("2026-10-02T00:00:00Z");
    const key = await createApiKey(tmp.db, { projectId: P.projectId }, c);
    const lastUsed = async () =>
      (
        await tmp.db.select({ t: apiKeys.lastUsedAt }).from(apiKeys).where(eq(apiKeys.id, key.id))
      )[0]?.t;

    await authenticateApiKey(tmp.db, bearer(key.key), c);
    expect(await lastUsed()).toEqual(new Date("2026-10-02T00:00:00Z"));

    c.advance(30_000);
    await authenticateApiKey(tmp.db, bearer(key.key), c);
    expect(await lastUsed()).toEqual(new Date("2026-10-02T00:00:00Z"));

    c.advance(LAST_USED_RESOLUTION_MS);
    await authenticateApiKey(tmp.db, bearer(key.key), c);
    expect(await lastUsed()).toEqual(new Date("2026-10-02T00:01:30Z"));
  });

  it("failed authentication never updates it", async () => {
    const c = createFakeClock("2026-10-03T00:00:00Z");
    const key = await createApiKey(tmp.db, { projectId: P.projectId }, c);
    await authenticateApiKey(
      tmp.db,
      bearer(`${key.key.slice(0, -1)}${key.key.endsWith("x") ? "y" : "x"}`),
      c,
    );
    const [row] = await tmp.db
      .select({ t: apiKeys.lastUsedAt })
      .from(apiKeys)
      .where(eq(apiKeys.id, key.id));
    expect(row?.t).toBeNull();
  });
});

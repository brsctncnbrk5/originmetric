import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRATIONS_FOLDER, applyMigrations } from "@/server/db/migrate";
import { createTempDatabase, type TempDatabase } from "../helpers/db";

interface Journal {
  entries: { tag: string }[];
}

const journal = JSON.parse(
  readFileSync(path.join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"),
) as Journal;

let tmp: TempDatabase;

beforeAll(async () => {
  tmp = await createTempDatabase();
});

afterAll(async () => {
  await tmp?.destroy();
});

describe("migrations", () => {
  it("apply all committed migrations to a clean database", async () => {
    await applyMigrations(tmp.db);
    const applied = await tmp.sql<{ n: number }[]>`
      select count(*)::int as n from drizzle.__drizzle_migrations`;
    expect(journal.entries.length).toBeGreaterThan(0);
    expect(applied[0]?.n).toBe(journal.entries.length);
  });

  it("are idempotent when re-applied", async () => {
    await applyMigrations(tmp.db);
    const applied = await tmp.sql<{ n: number }[]>`
      select count(*)::int as n from drizzle.__drizzle_migrations`;
    expect(applied[0]?.n).toBe(journal.entries.length);
  });

  it("create no domain tables in P0", async () => {
    const tables = await tmp.sql<{ table_name: string }[]>`
      select table_name from information_schema.tables where table_schema = 'public'`;
    expect(tables).toEqual([]);
  });
});

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRATIONS_FOLDER, applyMigrations } from "@/server/db/migrate";
import { createTempDatabase, type TempDatabase } from "../helpers/db";

interface Journal {
  entries: { tag: string }[];
}

const journal = JSON.parse(
  readFileSync(path.join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"),
) as Journal;

const P1A_TABLES = [
  "api_keys",
  "customer_attribution",
  "customer_visitors",
  "customers",
  "events",
  "ingestion_daily",
  "projects",
  "revenue_events",
  "sessions",
  "workspaces",
];

async function publicTables(tmp: TempDatabase): Promise<string[]> {
  const rows = await tmp.sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  return rows.map((r) => r.table_name);
}

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

  it("keep the P0 baseline first and unchanged", () => {
    expect(journal.entries[0]?.tag).toBe("0000_foundation");
    const baseline = readFileSync(path.join(MIGRATIONS_FOLDER, "0000_foundation.sql"), "utf8");
    expect(baseline.trim().endsWith("SELECT 1;")).toBe(true);
  });

  it("create domain tables and the P2 abuse budget (no auth, billing or job tables)", async () => {
    expect(await publicTables(tmp)).toEqual(P1A_TABLES);
  });
});

describe("upgrade path", () => {
  let p0: TempDatabase;
  let p0Folder: string;

  beforeAll(async () => {
    p0 = await createTempDatabase();
    // A migrations folder containing only the P0 baseline = a database as P0 left it.
    p0Folder = mkdtempSync(path.join(tmpdir(), "om-p0-migrations-"));
    cpSync(MIGRATIONS_FOLDER, p0Folder, { recursive: true });
    const p0Journal = {
      ...JSON.parse(readFileSync(path.join(p0Folder, "meta", "_journal.json"), "utf8")),
    };
    p0Journal.entries = p0Journal.entries.slice(0, 1);
    writeFileSync(path.join(p0Folder, "meta", "_journal.json"), JSON.stringify(p0Journal));
  });

  afterAll(async () => {
    await p0?.destroy();
    if (p0Folder) rmSync(p0Folder, { recursive: true, force: true });
  });

  it("a P0 database upgrades with the P1a migrations", async () => {
    await migrate(p0.db, { migrationsFolder: p0Folder });
    expect(await publicTables(p0)).toEqual([]);
    await applyMigrations(p0.db);
    expect(await publicTables(p0)).toEqual(P1A_TABLES);
    const applied = await p0.sql<{ n: number }[]>`
      select count(*)::int as n from drizzle.__drizzle_migrations`;
    expect(applied[0]?.n).toBe(journal.entries.length);
  });
});

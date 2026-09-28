import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTempDatabase, type TempDatabase } from "../helpers/db";

let tmp: TempDatabase;

beforeAll(async () => {
  tmp = await createTempDatabase();
});

afterAll(async () => {
  await tmp?.destroy();
});

describe("PostgreSQL connectivity (real database)", () => {
  it("runs a query through Drizzle", async () => {
    const rows = await tmp.db.execute<{ one: number }>(sql`select 1 as one`);
    expect(rows[0]?.one).toBe(1);
  });

  it("is PostgreSQL 18", async () => {
    const rows = await tmp.sql<{ server_version_num: string }[]>`show server_version_num`;
    const major = Math.floor(Number(rows[0]?.server_version_num) / 10000);
    expect(major).toBe(18);
  });

  it("can create and drop objects in its isolated database", async () => {
    await tmp.sql`create table p0_probe (n int)`;
    await tmp.sql`insert into p0_probe values (42)`;
    const rows = await tmp.sql<{ n: number }[]>`select n from p0_probe`;
    expect(rows[0]?.n).toBe(42);
  });
});

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PostgresJsTransaction } from "drizzle-orm/postgres-js/session";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = PostgresJsTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
/** Anything that can run queries: the pool-backed database or an open transaction. */
export type Executor = Database | Transaction;

export interface DbHandle {
  db: Database;
  sql: Sql;
  close: () => Promise<void>;
}

export function requireDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (see .env.example)");
  }
  return url;
}

/** Create a Drizzle database handle over a postgres.js connection pool. */
export function createDb(
  url: string = requireDatabaseUrl(),
  options: { max?: number } = {},
): DbHandle {
  // The DB session runs in UTC (plan §11); timestamptz values are absolute either way.
  const sql = postgres(url, {
    max: options.max ?? 10,
    onnotice: () => {},
    connection: { TimeZone: "UTC" },
  });
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}

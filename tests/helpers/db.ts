import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { createDb, requireDatabaseUrl, type DbHandle } from "@/server/db/client";

export interface TempDatabase extends DbHandle {
  name: string;
  /** Close connections and drop the temporary database. */
  destroy: () => Promise<void>;
}

/**
 * Create a fresh, empty database on the real PostgreSQL server named by DATABASE_URL.
 * Each test file gets its own database, so tests never share state. No mocks.
 */
export async function createTempDatabase(): Promise<TempDatabase> {
  const baseUrl = requireDatabaseUrl();
  const name = `om_test_${randomBytes(6).toString("hex")}`;
  const admin = postgres(baseUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }

  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  const handle = createDb(url.toString(), { max: 2 });

  return {
    ...handle,
    name,
    destroy: async () => {
      await handle.close();
      const cleanup = postgres(baseUrl, { max: 1, onnotice: () => {} });
      try {
        await cleanup.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      } finally {
        await cleanup.end({ timeout: 5 });
      }
    },
  };
}

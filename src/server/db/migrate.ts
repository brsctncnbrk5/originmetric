import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Database } from "./client";

/** Directory of committed, reviewable SQL migrations. */
export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

/** Apply all committed migrations (used by tests; the CLI path is `npm run db:migrate`). */
export async function applyMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

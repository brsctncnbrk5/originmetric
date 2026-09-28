import { createDb, type DbHandle } from "./client";

const globalForDb = globalThis as unknown as { __originmetricDb?: DbHandle };

/**
 * Process-wide database handle for the Next.js server (lazy, so `next build` never connects).
 * Kept on globalThis so dev-mode module reloads do not open a new pool each time.
 */
export function getDbHandle(): DbHandle {
  globalForDb.__originmetricDb ??= createDb();
  return globalForDb.__originmetricDb;
}

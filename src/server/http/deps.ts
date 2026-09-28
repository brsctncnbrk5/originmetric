import { getDbHandle } from "@/server/db/instance";
import { logger } from "@/server/logging/logger";
import { systemClock } from "@/server/time/clock";
import type { ApiDeps } from "./handlers";

/** Production dependencies for route handlers (lazy DB pool, system clock, central logger). */
export function apiDeps(): ApiDeps {
  return { db: getDbHandle().db, clock: systemClock, logger };
}

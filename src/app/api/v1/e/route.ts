import { getDbHandle } from "@/server/db/instance";
import { handleBrowserEvent } from "@/server/ingestion/handler";
import { logger } from "@/server/logging/logger";
import { systemClock } from "@/server/time/clock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return handleBrowserEvent(request, {
    db: getDbHandle().db,
    clock: systemClock,
    logger,
  });
}

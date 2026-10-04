import { isInternalRequestAuthorized } from "@/server/internal/auth";
import { ingestionLimits } from "@/server/ingestion/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  if (!isInternalRequestAuthorized(request.headers.get("authorization")))
    return new Response(null, { status: 404 });
  return Response.json(
    { ingestion: ingestionLimits.snapshot() },
    { headers: { "cache-control": "no-store" } },
  );
}

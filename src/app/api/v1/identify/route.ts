import { apiDeps } from "@/server/data/api-deps";
import { handleIdentify } from "@/server/http/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return handleIdentify(request, apiDeps());
}

/**
 * Framework-agnostic handlers for the secret-key server API. Next.js route files are thin
 * wrappers around these, and tests call them directly against a real database.
 *
 * Logging (plan §22): only route, method, status, duration, project_id, api_key_prefix,
 * error_code and outcome. Never headers, keys, bodies, customer IDs or visitor IDs. Unexpected
 * errors log only their class and SQLSTATE (PostgreSQL error details can contain input values).
 */
import type { Logger } from "pino";
import { errorFacts } from "@/server/logging/logger";
import type { Database } from "@/server/db/client";
import { identify, parseIdentifyBody } from "@/server/identity/identify";
import { recordRevenueEvent } from "@/server/revenue/service";
import { parseRevenueBody } from "@/server/revenue/validation";
import { authenticateApiKey, type AuthenticatedKey } from "@/server/tenancy/api-keys";
import type { Clock } from "@/server/time/clock";
import {
  InvalidRequest,
  internalError,
  invalidRequest,
  json,
  readJsonObject,
  unauthorized,
  type ErrorBody,
} from "./api";

export interface ApiDeps {
  db: Database;
  clock: Clock;
  logger: Logger;
}

interface HandlerResult {
  response: Response;
  outcome?: string;
}

async function withServerKey(
  route: string,
  request: Request,
  deps: ApiDeps,
  handle: (key: AuthenticatedKey) => Promise<HandlerResult>,
): Promise<Response> {
  const started = performance.now();
  const fields: Record<string, unknown> = { route, method: request.method };
  let response: Response;
  try {
    const key = await authenticateApiKey(deps.db, request.headers.get("authorization"), deps.clock);
    if (!key) {
      response = unauthorized();
    } else {
      fields.project_id = key.projectId;
      fields.api_key_prefix = key.prefix;
      const result = await handle(key);
      response = result.response;
      if (result.outcome) fields.outcome = result.outcome;
    }
  } catch (err) {
    if (err instanceof InvalidRequest) {
      response = invalidRequest(err);
    } else {
      Object.assign(fields, errorFacts(err));
      response = internalError();
    }
  }
  if (response.status >= 400) {
    const body = (await response.clone().json()) as ErrorBody;
    fields.error_code = body.error.code;
  }
  fields.status = response.status;
  fields.duration_ms = Math.round(performance.now() - started);
  const level = response.status >= 500 ? "error" : response.status >= 400 ? "warn" : "info";
  deps.logger[level](fields, "api request");
  return response;
}

/** POST /api/v1/identify */
export function handleIdentify(request: Request, deps: ApiDeps): Promise<Response> {
  return withServerKey("/api/v1/identify", request, deps, async (key) => {
    const input = parseIdentifyBody(await readJsonObject(request));
    const status = await identify(deps.db, key.projectId, input, deps.clock);
    return { response: json(200, { status }), outcome: status };
  });
}

/** POST /api/v1/revenue-events */
export function handleRevenueEvent(request: Request, deps: ApiDeps): Promise<Response> {
  return withServerKey("/api/v1/revenue-events", request, deps, async (key) => {
    const input = parseRevenueBody(await readJsonObject(request), deps.clock);
    const outcome = await recordRevenueEvent(deps.db, key.projectId, input, deps.clock);
    if (outcome.kind === "conflict") {
      const body: ErrorBody = {
        error: {
          code: "idempotency_conflict",
          message: "event_id was already used with a different payload",
        },
      };
      return { response: json(409, body), outcome: "conflict" };
    }
    const body = {
      id: outcome.id,
      event_id: outcome.eventId,
      status: outcome.kind,
      attribution: { source: outcome.attribution.source, status: outcome.attribution.status },
    };
    return { response: json(outcome.kind === "created" ? 201 : 200, body), outcome: outcome.kind };
  });
}

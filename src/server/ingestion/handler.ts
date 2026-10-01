import type { Logger } from "pino";
import { normalizeHost } from "@/server/attribution/source";
import type { Database } from "@/server/db/client";
import { errorFacts } from "@/server/logging/logger";
import type { Clock } from "@/server/time/clock";
import { findProjectBySiteKey, recordBrowserEvent } from "./service";
import { parseBrowserEvent } from "./validation";
import { BodyTooLarge, readBoundedBody } from "@/server/http/bounded-body";
import { ingestionClient, ingestionLimits, type IngestionLimits } from "./limits";

export const MAX_BROWSER_BODY_BYTES = 8 * 1024;

export interface IngestionDeps {
  db: Database;
  clock: Clock;
  logger: Logger;
  limits?: IngestionLimits;
  proxyEnv?: Record<string, string | undefined>;
}

function acceptedResponse(origin: string | null): Response {
  const headers = new Headers({ "cache-control": "no-store" });
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }
  return new Response(null, { status: 202, headers });
}

function matchesAllowedDomain(host: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    const lower = pattern.toLowerCase();
    if (lower.startsWith("*.")) {
      const base = lower.slice(2);
      return host !== base && host.endsWith(`.${base}`);
    }
    return host === lower;
  });
}

function requestOrigin(request: Request, allowedDomains: readonly string[]): string | null {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const url = new URL(origin);
      const host = normalizeHost(url.hostname);
      return host && matchesAllowedDomain(host, allowedDomains) ? url.origin : null;
    } catch {
      return null;
    }
  }

  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    const url = new URL(referer);
    const host = normalizeHost(url.hostname);
    return host && matchesAllowedDomain(host, allowedDomains) ? url.origin : null;
  } catch {
    return null;
  }
}

export async function handleBrowserEvent(request: Request, deps: IngestionDeps): Promise<Response> {
  const started = performance.now();
  const fields: Record<string, unknown> = {
    route: "/api/v1/e",
    method: request.method,
    status: 202,
  };
  let corsOrigin: string | null = null;
  const limits = deps.limits ?? ingestionLimits;

  try {
    const processLimit = limits.admitProcess(deps.clock.now().getTime());
    if (processLimit) {
      fields.outcome = processLimit;
      return acceptedResponse(null);
    }
    const client = ingestionClient(request, deps.proxyEnv);
    if (client === null) {
      fields.outcome = "dropped_untrusted_proxy";
      return acceptedResponse(null);
    }
    const bytes = await readBoundedBody(request, MAX_BROWSER_BODY_BYTES);

    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      fields.outcome = "dropped_invalid_json";
      return acceptedResponse(null);
    }

    const input = parseBrowserEvent(raw);
    if (!input) {
      fields.outcome = "dropped_invalid_schema";
      return acceptedResponse(null);
    }

    const project = await findProjectBySiteKey(deps.db, input.siteKey);
    if (!project) {
      fields.outcome = "dropped_unknown_site";
      return acceptedResponse(null);
    }
    fields.project_id = project.id;

    corsOrigin = requestOrigin(request, project.allowedDomains);
    if (!corsOrigin) {
      fields.outcome = "dropped_origin";
      return acceptedResponse(null);
    }
    const projectLimit = limits.admitProject(
      project.id,
      input.siteKey,
      client,
      deps.clock.now().getTime(),
    );
    if (projectLimit) {
      fields.outcome = projectLimit;
      return acceptedResponse(corsOrigin);
    }
    fields.outcome = await recordBrowserEvent(deps.db, project, input, deps.clock, limits.dailyCap);
    return acceptedResponse(corsOrigin);
  } catch (error) {
    if (error instanceof BodyTooLarge) {
      fields.outcome = "dropped_body_size";
      return acceptedResponse(corsOrigin);
    }
    Object.assign(fields, errorFacts(error));
    fields.outcome = "dropped_internal";
    return acceptedResponse(corsOrigin);
  } finally {
    limits.count(String(fields.outcome ?? "dropped_internal"));
    fields.duration_ms = Math.round(performance.now() - started);
    const level = "error_class" in fields ? "warn" : "info";
    deps.logger[level](fields, "browser ingestion");
  }
}

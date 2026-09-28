import { Writable } from "node:stream";
import { applyMigrations } from "@/server/db/migrate";
import { createLogger } from "@/server/logging/logger";
import type { ApiDeps } from "@/server/http/handlers";
import { handleIdentify, handleRevenueEvent } from "@/server/http/handlers";
import { createApiKey } from "@/server/tenancy/api-keys";
import { createProject, type CreateProjectInput } from "@/server/tenancy/projects";
import { createFakeClock, type FakeClock } from "@/server/time/clock";
import type { Database } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import { createTempDatabase, type TempDatabase } from "./db";

export const T0 = new Date("2026-10-01T12:00:00.000Z");

/** A fresh, fully migrated real PostgreSQL database. */
export async function createDomainDatabase(options: { max?: number } = {}): Promise<TempDatabase> {
  const tmp = await createTempDatabase(options);
  await applyMigrations(tmp.db);
  return tmp;
}

export interface TestProject {
  projectId: string;
  workspaceId: string;
  siteKey: string;
  key: string;
  keyPrefix: string;
  keyId: string;
}

export async function createTestProject(
  db: Database,
  clock: FakeClock,
  overrides: Partial<CreateProjectInput> = {},
): Promise<TestProject> {
  const project = await createProject(
    db,
    {
      name: "Test project",
      allowedDomains: ["example.com"],
      timezone: "Europe/Istanbul",
      primaryCurrency: "USD",
      ...overrides,
    },
    clock,
  );
  const key = await createApiKey(db, { projectId: project.projectId, name: "test" }, clock);
  return {
    projectId: project.projectId,
    workspaceId: project.workspaceId,
    siteKey: project.siteKey,
    key: key.key,
    keyPrefix: key.prefix,
    keyId: key.id,
  };
}

export interface CapturedLogs {
  lines: string[];
  text: () => string;
}

export function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return {
    logger: createLogger({ destination: stream, level: "trace" }),
    logs: { lines, text: () => lines.join("") },
  };
}

export function makeDeps(
  db: Database,
  clock: FakeClock = createFakeClock(T0),
): ApiDeps & { logs: CapturedLogs; clock: FakeClock } {
  const { logger, logs } = captureLogger();
  return { db, clock, logger, logs };
}

export function apiRequest(
  path: string,
  body: unknown,
  key?: string | null,
  headers: Record<string, string> = {},
): Request {
  const h: Record<string, string> = { "content-type": "application/json", ...headers };
  if (key) h.authorization = `Bearer ${key}`;
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: h,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

async function toResult(res: Response): Promise<ApiResult> {
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

export async function callIdentify(
  deps: ApiDeps,
  key: string | null,
  body: unknown,
  headers?: Record<string, string>,
): Promise<ApiResult> {
  return toResult(await handleIdentify(apiRequest("/api/v1/identify", body, key, headers), deps));
}

export async function callRevenue(
  deps: ApiDeps,
  key: string | null,
  body: unknown,
  headers?: Record<string, string>,
): Promise<ApiResult> {
  return toResult(
    await handleRevenueEvent(apiRequest("/api/v1/revenue-events", body, key, headers), deps),
  );
}

export function payment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event_id: "inv_1",
    type: "payment",
    customer_id: "cust_1",
    visitor_id: null,
    amount: 2900,
    currency: "USD",
    occurred_at: "2026-10-01T11:00:00Z",
    refund_of: null,
    billing_interval: "month",
    subscription_id: "sub_1",
    test: false,
    ...overrides,
  };
}

export interface SessionSeed {
  id: string;
  visitorId: string;
  startedAt: Date | string;
  source?: string;
  medium?: string | null;
  campaign?: string | null;
  referrerHost?: string | null;
}

/** Insert sessions directly (ingestion is P1b). */
export async function seedSessions(
  db: Database,
  projectId: string,
  seeds: SessionSeed[],
): Promise<void> {
  if (seeds.length === 0) return;
  await db.insert(sessions).values(
    seeds.map((s) => {
      const startedAt = new Date(s.startedAt);
      return {
        projectId,
        id: s.id,
        visitorId: s.visitorId,
        startedAt,
        lastSeenAt: startedAt,
        source: s.source ?? "direct",
        medium: s.medium ?? null,
        campaign: s.campaign ?? null,
        referrerHost: s.referrerHost ?? null,
        landingPath: "/",
      };
    }),
  );
}

/** Deterministic UUIDs for readable tests: uid(1) → 00000000-0000-4000-8000-000000000001. */
export function uid(n: number, prefix = "0"): string {
  return `${prefix.repeat(8).slice(0, 8)}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

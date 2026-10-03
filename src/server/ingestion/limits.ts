import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const DEFAULT_LIMITS = {
  processPerSecond: 500,
  projectPerSecond: 200,
  clientPerMinute: 60,
  dailyPerProject: 200_000,
  maxClients: 20_000,
  maxProjects: 1_000,
};

type Bucket = { tokens: number; updated: number };
export type LimitOutcome =
  | "dropped_process_limit"
  | "dropped_project_limit"
  | "dropped_client_limit"
  | "dropped_limit_capacity";

/** Single-process limits. Raw IPs and the daily random HMAC salt never leave this object. */
export class IngestionLimits {
  private global: Bucket;
  private clients = new Map<string, Bucket>();
  private projects = new Map<string, Bucket>();
  private salt = randomBytes(32);
  private day = "";
  private sweepAt = 0;
  private counts: Record<string, number> = {};

  constructor(
    private readonly limits = DEFAULT_LIMITS,
    now = Date.now(),
  ) {
    this.global = { tokens: limits.processPerSecond, updated: now };
  }

  count(outcome: string): void {
    this.counts[outcome] = (this.counts[outcome] ?? 0) + 1;
  }

  snapshot(): Readonly<Record<string, number>> {
    return { ...this.counts };
  }

  private take(bucket: Bucket, rate: number, capacity: number, now: number): boolean {
    bucket.tokens = Math.min(
      capacity,
      bucket.tokens + (Math.max(0, now - bucket.updated) * rate) / 1000,
    );
    bucket.updated = Math.max(now, bucket.updated);
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  /** Runs before reading a body or querying PostgreSQL, including malformed/unknown-key traffic. */
  admitProcess(now: number): LimitOutcome | null {
    return this.take(this.global, this.limits.processPerSecond, this.limits.processPerSecond, now)
      ? null
      : "dropped_process_limit";
  }

  admitProject(projectId: string, siteKey: string, ip: string, now: number): LimitOutcome | null {
    const day = new Date(now).toISOString().slice(0, 10);
    if (this.day !== day) {
      this.day = day;
      this.salt = randomBytes(32);
      this.clients.clear();
    }
    if (now >= this.sweepAt) {
      // Only fully refilled idle buckets may be removed; eviction cannot reset an active limit.
      for (const [key, value] of this.clients)
        if (now - value.updated >= 60_000) this.clients.delete(key);
      for (const [key, value] of this.projects)
        if (now - value.updated >= 60_000) this.projects.delete(key);
      this.sweepAt = now + 60_000;
    }
    let project = this.projects.get(projectId);
    if (!project) {
      if (this.projects.size >= this.limits.maxProjects) return "dropped_limit_capacity";
      project = { tokens: this.limits.projectPerSecond, updated: now };
      this.projects.set(projectId, project);
    }
    if (!this.take(project, this.limits.projectPerSecond, this.limits.projectPerSecond, now))
      return "dropped_project_limit";
    const key = createHmac("sha256", this.salt)
      .update(siteKey)
      .update("\0")
      .update(ip)
      .digest("hex");
    let client = this.clients.get(key);
    if (!client) {
      if (this.clients.size >= this.limits.maxClients) return "dropped_limit_capacity";
      client = { tokens: this.limits.clientPerMinute, updated: now };
      this.clients.set(key, client);
    }
    return this.take(client, this.limits.clientPerMinute / 60, this.limits.clientPerMinute, now)
      ? null
      : "dropped_client_limit";
  }

  get dailyCap(): number {
    return this.limits.dailyPerProject;
  }
}

/** A private proxy token is required before trusting CF-Connecting-IP. Never trust XFF. */
export function ingestionClient(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (env.INGEST_PROXY_MODE !== "cloudflare") {
    // Local/CI default: conservative shared bucket; ignores all caller-supplied IP headers.
    return env.INGEST_PROXY_MODE === "local" || env.NODE_ENV !== "production" || env.CI === "true"
      ? "local"
      : null;
  }
  const expected = env.INGEST_PROXY_TOKEN ?? "";
  const actual = request.headers.get("x-om-proxy-token") ?? "";
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (b.length < 32 || a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  return isIP(ip) ? ip : null;
}

const globalLimits = globalThis as typeof globalThis & {
  __originmetricIngestionLimits?: IngestionLimits;
};
export const ingestionLimits = (globalLimits.__originmetricIngestionLimits ??=
  new IngestionLimits());

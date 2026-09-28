/**
 * Minimal P1a workspace/project creation (used by `ops create-project`). No users, members or
 * ownership yet (P3).
 */
import { and, eq, isNull } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { projects, workspaces } from "@/server/db/schema";
import { normalizeCurrency } from "@/server/money/currency";
import { normalizeDomainPattern } from "@/server/attribution/source";
import type { Clock } from "@/server/time/clock";
import { randomBase62 } from "./api-keys";

export const SITE_KEY_LENGTH = 22;

export class ProjectInputError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "ProjectInputError";
  }
}

/** Public, non-secret project site key: `pk_` + 22 random base62 chars (~131 bits). */
export function generateSiteKey(): string {
  return `pk_${randomBase62(SITE_KEY_LENGTH)}`;
}

/** Valid IANA timezone name (e.g. `Europe/Istanbul`, `UTC`). Offsets like `+03:00` are rejected. */
export function isValidTimezone(tz: string): boolean {
  if (!/^(UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a list of domain patterns: `example.com` / `*.example.com`, lowercase, punycode,
 * no scheme/port/path, deduplicated and sorted. Throws ProjectInputError on invalid input.
 */
export function normalizeDomainList(values: readonly string[], field: string): string[] {
  const out = new Set<string>();
  for (const value of values) {
    const wildcard = value.trim().startsWith("*.");
    const host = normalizeDomainPattern(value);
    if (host === null || !host.includes(".")) {
      throw new ProjectInputError(field, `invalid domain: ${JSON.stringify(value)}`);
    }
    out.add(wildcard ? `*.${host}` : host);
  }
  return [...out].sort();
}

export interface CreateProjectInput {
  name: string;
  allowedDomains: readonly string[];
  timezone: string;
  primaryCurrency: string;
  excludedReferrers?: readonly string[];
  /** Existing workspace; when absent a new workspace is created. */
  workspaceId?: string;
  workspaceName?: string;
}

export interface CreatedProject {
  workspaceId: string;
  projectId: string;
  name: string;
  siteKey: string;
  allowedDomains: string[];
  timezone: string;
  primaryCurrency: string;
  excludedReferrers: string[];
}

export function validateProjectInput(input: CreateProjectInput) {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 200) {
    throw new ProjectInputError("name", "name must be 1-200 characters");
  }
  if (input.allowedDomains.length === 0) {
    throw new ProjectInputError("allowed_domains", "at least one domain is required");
  }
  const allowedDomains = normalizeDomainList(input.allowedDomains, "allowed_domains");
  const excludedReferrers = normalizeDomainList(
    input.excludedReferrers ?? [],
    "excluded_referrers",
  );
  if (!isValidTimezone(input.timezone)) {
    throw new ProjectInputError("timezone", "timezone must be a valid IANA timezone name");
  }
  const primaryCurrency = normalizeCurrency(input.primaryCurrency);
  if (primaryCurrency === null) {
    throw new ProjectInputError("primary_currency", "unsupported ISO 4217 currency");
  }
  return { name, allowedDomains, excludedReferrers, timezone: input.timezone, primaryCurrency };
}

export async function createProject(
  db: Executor,
  input: CreateProjectInput,
  clock: Clock,
): Promise<CreatedProject> {
  const valid = validateProjectInput(input);
  const now = clock.now();
  return db.transaction(async (tx) => {
    let workspaceId = input.workspaceId;
    if (workspaceId === undefined) {
      const [ws] = await tx
        .insert(workspaces)
        .values({ name: input.workspaceName?.trim() || valid.name, createdAt: now })
        .returning({ id: workspaces.id });
      if (!ws) throw new Error("workspace insert failed");
      workspaceId = ws.id;
    }
    const siteKey = generateSiteKey();
    const [project] = await tx
      .insert(projects)
      .values({ workspaceId, siteKey, createdAt: now, updatedAt: now, ...valid })
      .returning({ id: projects.id });
    if (!project) throw new Error("project insert failed");
    return { workspaceId, projectId: project.id, siteKey, ...valid };
  });
}

export async function findActiveProject(db: Executor, projectId: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)));
  return row ?? null;
}

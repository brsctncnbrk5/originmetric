import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Executor } from "@/server/db/client";
import { apiKeys, customerAttribution, customers, projects } from "@/server/db/schema";
import { isInternalRequestAuthorized } from "@/server/internal/auth";
import { createApiKey } from "@/server/tenancy/api-keys";
import { validateProjectInput, type CreateProjectInput } from "@/server/tenancy/projects";
import type { Clock } from "@/server/time/clock";
import { getDbHandle } from "./connection";

const authorizedProject: unique symbol = Symbol("authorizedProject");
export interface AuthorizedProjectContext {
  readonly [authorizedProject]: true;
}

// No exported constructor, caller-supplied project ID, database, or mutable grant.
const grants = new WeakMap<AuthorizedProjectContext, { db: Executor; projectId: string }>();

export class ProjectNotFound extends Error {
  readonly status = 404;
  constructor() {
    super("Not found");
    this.name = "ProjectNotFound";
  }
}

/** Check access before even constructing the pool; the page never receives a raw client. */
export async function internalProjectData(authorization: string | null, projectId: string) {
  if (
    !isInternalRequestAuthorized(authorization) ||
    !z.string().uuid().safeParse(projectId).success
  ) {
    throw new ProjectNotFound();
  }
  return forProject(await authorizeInternalProject(getDbHandle().db, authorization, projectId));
}

/** Existing operator-token access only. Dashboard membership authorization awaits U1. */
export async function authorizeInternalProject(
  db: Executor,
  authorization: string | null,
  projectId: string,
): Promise<AuthorizedProjectContext> {
  if (
    !isInternalRequestAuthorized(authorization) ||
    !z.string().uuid().safeParse(projectId).success
  ) {
    throw new ProjectNotFound();
  }
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)));
  if (!project) throw new ProjectNotFound();
  const context: AuthorizedProjectContext = Object.freeze({ [authorizedProject]: true as const });
  grants.set(context, { db, projectId });
  return context;
}

/** Queries close over a server-issued grant; no method accepts a project ID. */
export function forProject(context: AuthorizedProjectContext) {
  const grant = grants.get(context);
  if (!grant) throw new ProjectNotFound();
  const { db, projectId } = grant;
  const activeProject = and(eq(projects.id, projectId), isNull(projects.deletedAt));

  async function requireActive() {
    const [project] = await db.select().from(projects).where(activeProject);
    if (!project) throw new ProjectNotFound();
    return project;
  }

  return Object.freeze({
    project: requireActive,
    async customerRows() {
      await requireActive();
      return db
        .select({
          customer: customers.externalId,
          status: customerAttribution.status,
          source: customerAttribution.creditedSource,
        })
        .from(customers)
        .leftJoin(
          customerAttribution,
          and(
            eq(customerAttribution.projectId, customers.projectId),
            eq(customerAttribution.customerId, customers.id),
          ),
        )
        .where(and(eq(customers.projectId, projectId), isNull(customers.deletedAt)))
        .orderBy(asc(customers.createdAt))
        .limit(100);
    },
    async update(input: Omit<CreateProjectInput, "workspaceId" | "workspaceName">, clock: Clock) {
      const valid = validateProjectInput(input);
      const [project] = await db
        .update(projects)
        .set({ ...valid, updatedAt: clock.now() })
        .where(activeProject)
        .returning();
      if (!project) throw new ProjectNotFound();
      return project;
    },
    async delete(clock: Clock) {
      const [project] = await db
        .update(projects)
        .set({ deletedAt: clock.now(), updatedAt: clock.now() })
        .where(activeProject)
        .returning({ id: projects.id });
      if (!project) throw new ProjectNotFound();
    },
    async keys() {
      await requireActive();
      // Explicit projection: neither hash nor full secret can reach the UI.
      return db
        .select({
          id: apiKeys.id,
          prefix: apiKeys.prefix,
          name: apiKeys.name,
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
          revokedAt: apiKeys.revokedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.projectId, projectId))
        .orderBy(asc(apiKeys.createdAt));
    },
    async createKey(name: string | null, clock: Clock) {
      if (name !== null && (name.length < 1 || name.length > 100))
        throw new Error("Invalid key name");
      await requireActive();
      return createApiKey(db, { projectId, name }, clock);
    },
    async revokeKey(keyId: string, clock: Clock) {
      await requireActive();
      if (!z.string().uuid().safeParse(keyId).success) throw new ProjectNotFound();
      const [key] = await db
        .update(apiKeys)
        .set({ revokedAt: clock.now() })
        .where(and(eq(apiKeys.projectId, projectId), eq(apiKeys.id, keyId)))
        .returning({ id: apiKeys.id });
      if (!key) throw new ProjectNotFound();
    },
    async rotateKey(keyId: string, clock: Clock) {
      if (!z.string().uuid().safeParse(keyId).success) throw new ProjectNotFound();
      return db.transaction(async (tx) => {
        const [project] = await tx
          .select({ id: projects.id })
          .from(projects)
          .where(activeProject)
          .for("update");
        if (!project) throw new ProjectNotFound();
        const [old] = await tx
          .select({ name: apiKeys.name })
          .from(apiKeys)
          .where(
            and(eq(apiKeys.projectId, projectId), eq(apiKeys.id, keyId), isNull(apiKeys.revokedAt)),
          )
          .for("update");
        if (!old) throw new ProjectNotFound();
        const replacement = await createApiKey(tx, { projectId, name: old.name }, clock);
        await tx
          .update(apiKeys)
          .set({ revokedAt: clock.now() })
          .where(and(eq(apiKeys.projectId, projectId), eq(apiKeys.id, keyId)));
        return replacement;
      });
    },
  });
}

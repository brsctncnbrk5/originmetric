import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Database, Executor } from "@/server/db/client";
import {
  apiKeys,
  customerAttribution,
  customerVisitors,
  events,
  revenueEvents,
  sessions,
  customers,
  projects,
  workspaceMembers,
} from "@/server/db/schema";
import { isInternalRequestAuthorized } from "@/server/internal/auth";
import { identify, type IdentifyInput } from "@/server/identity/identify";
import { recordRevenueEvent } from "@/server/revenue/service";
import type { RevenueInput } from "@/server/revenue/validation";
import {
  findProjectBySiteKey,
  recordBrowserEvent,
  type IngestionProject,
} from "@/server/ingestion/service";
import type { BrowserEventInput } from "@/server/ingestion/validation";
import { authenticateApiKey } from "@/server/tenancy/api-keys";
import { createApiKey } from "@/server/tenancy/api-keys";
import { validateProjectInput, type CreateProjectInput } from "@/server/tenancy/projects";
import type { Clock } from "@/server/time/clock";
import { getDbHandle } from "./connection";

const authorizedProject: unique symbol = Symbol("authorizedProject");
export interface AuthorizedProjectContext {
  readonly [authorizedProject]: true;
}

// No exported constructor, caller-supplied project ID, database, or mutable grant.
const grants = new WeakMap<
  AuthorizedProjectContext,
  {
    db: Executor;
    projectId: string;
    userId?: string;
    ingress?: { db: Database; kind: "server" | "browser"; site?: IngestionProject };
  }
>();

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

/** Accept only the user identity resolved from a validated server session. */
export async function authorizeProject(
  db: Executor,
  userId: string,
  projectId: string,
): Promise<AuthorizedProjectContext> {
  if (!z.string().uuid().safeParse(projectId).success) throw new ProjectNotFound();
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, projects.workspaceId))
    .where(
      and(
        eq(projects.id, projectId),
        isNull(projects.deletedAt),
        eq(workspaceMembers.userId, userId),
      ),
    );
  if (!row) throw new ProjectNotFound();
  const context: AuthorizedProjectContext = Object.freeze({ [authorizedProject]: true as const });
  grants.set(context, { db, projectId, userId });
  return context;
}

/** Resolve ingress identities inside the data boundary; input cannot choose a project. */
export async function authorizeServerKey(db: Database, authorization: string | null, clock: Clock) {
  const key = await authenticateApiKey(db, authorization, clock);
  if (!key) return null;
  const context: AuthorizedProjectContext = Object.freeze({ [authorizedProject]: true as const });
  grants.set(context, { db, projectId: key.projectId, ingress: { db, kind: "server" } });
  return { context, projectId: key.projectId, prefix: key.prefix };
}
export async function authorizeSiteKey(db: Database, siteKey: string) {
  const project = await findProjectBySiteKey(db, siteKey);
  if (!project) return null;
  const context: AuthorizedProjectContext = Object.freeze({ [authorizedProject]: true as const });
  grants.set(context, {
    db,
    projectId: project.id,
    ingress: { db, kind: "browser", site: project },
  });
  return { context, project };
}

/** Queries close over a server-issued grant; no method accepts a project ID. */
export function forProject(context: AuthorizedProjectContext) {
  const grant = grants.get(context);
  if (!grant) throw new ProjectNotFound();
  const { db, projectId, userId, ingress } = grant;
  const activeProject = and(eq(projects.id, projectId), isNull(projects.deletedAt));

  async function requireActive() {
    if (ingress) throw new ProjectNotFound();
    if (userId) await authorizeProject(db, userId, projectId);
    const [project] = await db.select().from(projects).where(activeProject);
    if (!project) throw new ProjectNotFound();
    return project;
  }

  return Object.freeze({
    async identify(input: IdentifyInput, clock: Clock) {
      if (ingress?.kind !== "server") throw new ProjectNotFound();
      return identify(ingress.db, projectId, input, clock);
    },
    async revenue(input: RevenueInput, clock: Clock) {
      if (ingress?.kind !== "server") throw new ProjectNotFound();
      return recordRevenueEvent(ingress.db, projectId, input, clock);
    },
    async browserEvent(input: BrowserEventInput, clock: Clock, dailyCap: number) {
      if (ingress?.kind !== "browser" || !ingress.site) throw new ProjectNotFound();
      return recordBrowserEvent(ingress.db, ingress.site, input, clock, dailyCap);
    },
    project: requireActive,
    async installationStatus() {
      await requireActive();
      // Latest retained tracker fact and latest TEST payment; never infer receipt from HTTP 202.
      const [tracker] = await db
        .select({ receivedAt: events.receivedAt })
        .from(events)
        .where(eq(events.projectId, projectId))
        .orderBy(desc(events.receivedAt))
        .limit(1);
      const [payment] = await db
        .select({
          eventId: revenueEvents.eventId,
          receivedAt: revenueEvents.receivedAt,
          amount: revenueEvents.amountMinor,
          currency: revenueEvents.currency,
          status: customerAttribution.status,
          source: customerAttribution.creditedSource,
          campaign: customerAttribution.creditedCampaign,
          sessionId: sessions.id,
          linkedVisitor: customerVisitors.visitorId,
        })
        .from(revenueEvents)
        .innerJoin(
          customers,
          and(
            eq(customers.projectId, revenueEvents.projectId),
            eq(customers.id, revenueEvents.customerId),
            isNull(customers.deletedAt),
          ),
        )
        .leftJoin(
          customerAttribution,
          and(
            eq(customerAttribution.projectId, revenueEvents.projectId),
            eq(customerAttribution.customerId, revenueEvents.customerId),
          ),
        )
        .leftJoin(
          sessions,
          and(
            eq(sessions.projectId, revenueEvents.projectId),
            eq(sessions.id, customerAttribution.creditedSessionId),
          ),
        )
        .leftJoin(
          customerVisitors,
          and(
            eq(customerVisitors.projectId, revenueEvents.projectId),
            eq(customerVisitors.customerId, revenueEvents.customerId),
            eq(customerVisitors.visitorId, sessions.visitorId),
          ),
        )
        .where(
          and(
            eq(revenueEvents.projectId, projectId),
            eq(revenueEvents.test, true),
            eq(revenueEvents.type, "payment"),
          ),
        )
        .orderBy(desc(revenueEvents.receivedAt), desc(revenueEvents.id))
        .limit(1);
      let reason = "no_test_payment";
      if (payment) {
        const [link] = await db
          .select({ visitorId: customerVisitors.visitorId })
          .from(customerVisitors)
          .innerJoin(
            revenueEvents,
            and(
              eq(revenueEvents.projectId, customerVisitors.projectId),
              eq(revenueEvents.customerId, customerVisitors.customerId),
            ),
          )
          .where(
            and(
              eq(customerVisitors.projectId, projectId),
              eq(revenueEvents.eventId, payment.eventId),
            ),
          )
          .limit(1);
        reason = !link
          ? "missing_visitor_link"
          : !payment.sessionId || !payment.linkedVisitor
            ? "no_eligible_session"
            : payment.status === "direct"
              ? "direct_visit"
              : payment.status === "attributed"
                ? "matched"
                : "no_eligible_session";
      }
      return {
        trackerReceivedAt: tracker?.receivedAt.toISOString() ?? null,
        revenueReceivedAt: payment?.receivedAt.toISOString() ?? null,
        sourceMatched: reason === "matched",
        reason,
        // No customer/visitor identifiers or secrets in the checklist.
        payment: payment
          ? {
              eventId: payment.eventId,
              amount: payment.amount.toString(),
              currency: payment.currency,
              source: payment.source,
              campaign: payment.campaign,
              status: payment.status,
            }
          : null,
      };
    },
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
      await requireActive();
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
      await requireActive();
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
      await requireActive();
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

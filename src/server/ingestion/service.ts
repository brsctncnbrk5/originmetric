import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { recomputeCustomerAttribution } from "@/server/attribution/materialize";
import { normalizeSource } from "@/server/attribution/source";
import type { Database, Executor } from "@/server/db/client";
import {
  customerVisitors,
  customers,
  events,
  projects,
  sessions,
  ingestionDaily,
} from "@/server/db/schema";
import type { Clock } from "@/server/time/clock";
import type { BrowserEventInput } from "./validation";

export interface IngestionProject {
  id: string;
  allowedDomains: string[];
  excludedReferrers: string[];
}

export type IngestOutcome =
  "accepted" | "duplicate" | "dropped_session_conflict" | "dropped_daily_limit";

class IngestControl extends Error {
  constructor(readonly outcome: Exclude<IngestOutcome, "accepted">) {
    super(outcome);
  }
}

export async function findProjectBySiteKey(
  db: Executor,
  siteKey: string,
): Promise<IngestionProject | null> {
  const [project] = await db
    .select({
      id: projects.id,
      allowedDomains: projects.allowedDomains,
      excludedReferrers: projects.excludedReferrers,
    })
    .from(projects)
    .where(and(eq(projects.siteKey, siteKey), isNull(projects.deletedAt)));
  return project ?? null;
}

async function recomputeLinkedCustomers(
  tx: Executor,
  projectId: string,
  visitorId: string,
  clock: Clock,
): Promise<void> {
  const rows = await tx
    .select({ customerId: customerVisitors.customerId })
    .from(customerVisitors)
    .where(
      and(eq(customerVisitors.projectId, projectId), eq(customerVisitors.visitorId, visitorId)),
    )
    .orderBy(asc(customerVisitors.customerId));

  const ids = [...new Set(rows.map((row) => row.customerId))];
  for (const customerId of ids) {
    const [locked] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.projectId, projectId), eq(customers.id, customerId)))
      .for("update");
    if (locked) {
      await recomputeCustomerAttribution(tx, { projectId, customerId }, clock);
    }
  }
}

export async function recordBrowserEvent(
  db: Database,
  project: IngestionProject,
  input: BrowserEventInput,
  clock: Clock,
  dailyCap = 200_000,
): Promise<IngestOutcome> {
  try {
    return await db.transaction(async (tx): Promise<IngestOutcome> => {
      const now = clock.now();
      const day = now.toISOString().slice(0, 10);
      // Atomic persisted budget. Duplicate/conflicting events roll this reservation back.
      const reserved = await tx
        .insert(ingestionDaily)
        .values({
          projectId: project.id,
          day,
          accepted: 1,
        })
        .onConflictDoUpdate({
          target: [ingestionDaily.projectId, ingestionDaily.day],
          set: { accepted: sql`${ingestionDaily.accepted} + 1` },
          setWhere: sql`${ingestionDaily.accepted} < ${dailyCap}`,
        })
        .returning({ accepted: ingestionDaily.accepted });
      if (!reserved[0]) throw new IngestControl("dropped_daily_limit");
      let [session] = await tx
        .select({
          visitorId: sessions.visitorId,
          lastSeenAt: sessions.lastSeenAt,
          pageviews: sessions.pageviews,
        })
        .from(sessions)
        .where(and(eq(sessions.projectId, project.id), eq(sessions.id, input.sessionId)))
        .for("update");

      let createdSession = false;
      if (!session) {
        const source = normalizeSource(
          {
            utmSource: input.utmSource,
            utmMedium: input.utmMedium,
            utmCampaign: input.utmCampaign,
            utmContent: input.utmContent,
            utmTerm: input.utmTerm,
            referrerHost: input.referrerHost,
            clickIds: {
              gclid: input.gclid,
              fbclid: input.fbclid,
              msclkid: input.msclkid,
            },
          },
          {
            projectDomains: project.allowedDomains,
            excludedReferrers: project.excludedReferrers,
          },
        );
        const inserted = await tx
          .insert(sessions)
          .values({
            projectId: project.id,
            id: input.sessionId,
            visitorId: input.visitorId,
            startedAt: now,
            lastSeenAt: now,
            pageviews: 1,
            source: source.source,
            medium: source.medium,
            campaign: source.campaign,
            content: source.content,
            term: source.term,
            referrerHost: source.referrerHost,
            landingPath: input.path,
          })
          .onConflictDoNothing({ target: [sessions.projectId, sessions.id] })
          .returning({
            visitorId: sessions.visitorId,
            lastSeenAt: sessions.lastSeenAt,
            pageviews: sessions.pageviews,
          });

        if (inserted[0]) {
          session = inserted[0];
          createdSession = true;
        } else {
          [session] = await tx
            .select({
              visitorId: sessions.visitorId,
              lastSeenAt: sessions.lastSeenAt,
              pageviews: sessions.pageviews,
            })
            .from(sessions)
            .where(and(eq(sessions.projectId, project.id), eq(sessions.id, input.sessionId)))
            .for("update");
        }
      }

      if (!session || session.visitorId !== input.visitorId) {
        throw new IngestControl("dropped_session_conflict");
      }

      const insertedEvent = await tx
        .insert(events)
        .values({
          projectId: project.id,
          eventId: input.eventId,
          visitorId: input.visitorId,
          sessionId: input.sessionId,
          receivedAt: now,
          path: input.path,
          referrerHost: input.referrerHost,
          utmSource: input.utmSource,
          utmMedium: input.utmMedium,
          utmCampaign: input.utmCampaign,
          utmContent: input.utmContent,
          utmTerm: input.utmTerm,
          screenClass: input.screenClass,
        })
        .onConflictDoNothing({ target: [events.projectId, events.eventId] })
        .returning({ id: events.id });

      if (!insertedEvent[0]) throw new IngestControl("duplicate");

      if (!createdSession) {
        // The row is already locked FOR UPDATE above, so calculating the next values in
        // application code is race-safe and avoids raw SQL parameter coercion surprises.
        const lastSeenAt = session.lastSeenAt > now ? session.lastSeenAt : now;
        await tx
          .update(sessions)
          .set({
            lastSeenAt,
            pageviews: session.pageviews + 1,
          })
          .where(and(eq(sessions.projectId, project.id), eq(sessions.id, input.sessionId)));
      } else {
        await recomputeLinkedCustomers(tx, project.id, input.visitorId, clock);
      }

      return "accepted";
    });
  } catch (error) {
    if (error instanceof IngestControl) return error.outcome;
    throw error;
  }
}

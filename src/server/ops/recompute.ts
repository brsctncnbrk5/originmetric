/**
 * `ops recompute`: rebuild customer_attribution from stored source facts (links, payments,
 * sessions). Deterministic and safe to re-run: each customer is recomputed in its own short
 * transaction under its row lock, the same lock the APIs take, so it never races a live write.
 */
import { and, asc, eq, gt, isNotNull } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { customers } from "@/server/db/schema";
import { recomputeCustomerAttribution } from "@/server/attribution/materialize";
import type { AttributionStatus } from "@/server/db/schema";
import type { Clock } from "@/server/time/clock";

export interface RecomputeSummary {
  customers: number;
  byStatus: Record<AttributionStatus, number>;
}

const PAGE = 500;

async function recomputeOne(db: Database, projectId: string, customerId: string, clock: Clock) {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.projectId, projectId), eq(customers.id, customerId)))
      .for("update");
    return recomputeCustomerAttribution(tx, { projectId, customerId }, clock);
  });
}

/** Recompute every customer of a project (keyset-paginated by id). */
export async function recomputeProject(
  db: Database,
  projectId: string,
  clock: Clock,
): Promise<RecomputeSummary> {
  const summary: RecomputeSummary = {
    customers: 0,
    byStatus: { attributed: 0, direct: 0, unattributed: 0 },
  };
  let after: string | null = null;
  for (;;) {
    const page: { id: string }[] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.projectId, projectId),
          after === null ? undefined : gt(customers.id, after),
        ),
      )
      .orderBy(asc(customers.id))
      .limit(PAGE);
    for (const { id } of page) {
      const result = await recomputeOne(db, projectId, id, clock);
      summary.customers++;
      summary.byStatus[result.status]++;
    }
    if (page.length < PAGE) return summary;
    after = page[page.length - 1]?.id ?? null;
  }
}

/** Recompute one customer identified by its external ID. Returns null if it does not exist. */
export async function recomputeCustomerByExternalId(
  db: Database,
  projectId: string,
  externalId: string,
  clock: Clock,
) {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.projectId, projectId),
        isNotNull(customers.externalId),
        eq(customers.externalId, externalId),
      ),
    );
  return row ? recomputeOne(db, projectId, row.id, clock) : null;
}

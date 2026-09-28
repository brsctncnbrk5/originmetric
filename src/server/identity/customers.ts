/**
 * Project-scoped customers and trusted visitor links (plan §4.4). Only secret-key server calls
 * reach these functions; there is no browser path.
 */
import { and, eq } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { customerVisitors, customers, type LinkMethod } from "@/server/db/schema";
import type { Clock } from "@/server/time/clock";

export interface LockedCustomer {
  id: string;
  created: boolean;
}

/**
 * Find or create the customer with this external ID inside the project, and lock its row
 * (`FOR UPDATE`) for the rest of the transaction. The lock serializes every fact change for
 * one customer (links, payments, refunds), so recomputation always sees committed facts and
 * concurrent refunds cannot both pass the remaining-balance check.
 */
export async function upsertAndLockCustomer(
  tx: Executor,
  projectId: string,
  externalId: string,
  clock: Clock,
): Promise<LockedCustomer> {
  const inserted = await tx
    .insert(customers)
    .values({ projectId, externalId, createdAt: clock.now() })
    .onConflictDoNothing({ target: [customers.projectId, customers.externalId] })
    .returning({ id: customers.id });
  const [row] = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.projectId, projectId), eq(customers.externalId, externalId)))
    .for("update");
  if (!row) throw new Error("customer upsert failed");
  return { id: row.id, created: inserted.length > 0 };
}

/** Insert a trusted link. Returns false when the link already existed (idempotent). */
export async function createTrustedLink(
  tx: Executor,
  link: { projectId: string; customerId: string; visitorId: string; method: LinkMethod },
  clock: Clock,
): Promise<boolean> {
  const inserted = await tx
    .insert(customerVisitors)
    .values({ ...link, linkedAt: clock.now() })
    .onConflictDoNothing({
      target: [customerVisitors.projectId, customerVisitors.customerId, customerVisitors.visitorId],
    })
    .returning({ visitorId: customerVisitors.visitorId });
  return inserted.length > 0;
}

/**
 * Revenue events (plan §7.1, §13.4): idempotent insert, refund rules, trusted `revenue_api`
 * link, synchronous attribution recompute. One transaction per request; a response is produced
 * only after it commits.
 */
import { and, eq, sum } from "drizzle-orm";
import type { Database, Executor } from "@/server/db/client";
import { revenueEvents } from "@/server/db/schema";
import {
  readCustomerAttribution,
  recomputeCustomerAttribution,
  toStoredAttribution,
  type StoredAttribution,
} from "@/server/attribution/materialize";
import { InvalidRequest } from "@/server/http/api";
import { createTrustedLink, upsertAndLockCustomer } from "@/server/identity/customers";
import type { Clock } from "@/server/time/clock";
import { payloadHash, type RevenueInput } from "./validation";

export type RevenueOutcome =
  | {
      kind: "created" | "duplicate";
      id: string;
      eventId: string;
      attribution: StoredAttribution;
    }
  | { kind: "conflict" };

/** Thrown inside the transaction to roll it back when another request owns the event_id. */
class EventIdTaken extends Error {}

interface ExistingEvent {
  id: string;
  customerId: string;
  payloadHash: string;
}

async function findByEventId(
  db: Executor,
  projectId: string,
  eventId: string,
): Promise<ExistingEvent | null> {
  const [row] = await db
    .select({
      id: revenueEvents.id,
      customerId: revenueEvents.customerId,
      payloadHash: revenueEvents.payloadHash,
    })
    .from(revenueEvents)
    .where(and(eq(revenueEvents.projectId, projectId), eq(revenueEvents.eventId, eventId)));
  return row ?? null;
}

async function resolveExisting(
  db: Executor,
  projectId: string,
  eventId: string,
  existing: ExistingEvent,
  hash: string,
): Promise<RevenueOutcome> {
  if (existing.payloadHash !== hash) return { kind: "conflict" };
  const attribution = await readCustomerAttribution(db, {
    projectId,
    customerId: existing.customerId,
  });
  return { kind: "duplicate", id: existing.id, eventId, attribution };
}

/**
 * Validate `refund_of` against the original payment and the refunds already recorded for it.
 * The caller holds the customer row lock; the original payment row is locked too, so two
 * concurrent partial refunds cannot both pass the remaining-balance check.
 */
async function resolveRefundOf(
  tx: Executor,
  projectId: string,
  customerId: string,
  input: RevenueInput,
): Promise<string | null> {
  if (input.refundOf === null) return null;
  const where = and(
    eq(revenueEvents.projectId, projectId),
    eq(revenueEvents.eventId, input.refundOf),
  );
  const [original] = await tx
    .select({
      id: revenueEvents.id,
      type: revenueEvents.type,
      customerId: revenueEvents.customerId,
      currency: revenueEvents.currency,
      amountMinor: revenueEvents.amountMinor,
    })
    .from(revenueEvents)
    .where(where);
  if (!original) {
    throw new InvalidRequest("refund_of does not match a payment in this project", "refund_of");
  }
  if (original.type !== "payment") {
    throw new InvalidRequest("refund_of must reference a payment, not a refund", "refund_of");
  }
  if (original.customerId !== customerId) {
    throw new InvalidRequest("refund_of references a payment of a different customer", "refund_of");
  }
  if (original.currency !== input.currency) {
    throw new InvalidRequest("refund currency must match the original payment", "currency");
  }
  // Same customer as the locked row, so lock order (customer → payment) is consistent.
  await tx.select({ id: revenueEvents.id }).from(revenueEvents).where(where).for("update");

  const [refunded] = await tx
    .select({ total: sum(revenueEvents.amountMinor) })
    .from(revenueEvents)
    .where(
      and(
        eq(revenueEvents.projectId, projectId),
        eq(revenueEvents.customerId, customerId),
        eq(revenueEvents.refundOfId, original.id),
      ),
    );
  const already = BigInt(refunded?.total ?? "0");
  if (already + input.amountMinor > original.amountMinor) {
    throw new InvalidRequest(
      "refund exceeds the remaining refundable amount of the original payment",
      "amount",
    );
  }
  return original.id;
}

export async function recordRevenueEvent(
  db: Database,
  projectId: string,
  input: RevenueInput,
  clock: Clock,
): Promise<RevenueOutcome> {
  const hash = payloadHash(input);

  // Fast path for retries: no writes at all.
  const known = await findByEventId(db, projectId, input.eventId);
  if (known) return resolveExisting(db, projectId, input.eventId, known, hash);

  try {
    return await db.transaction(async (tx): Promise<RevenueOutcome> => {
      const customer = await upsertAndLockCustomer(tx, projectId, input.customerId, clock);
      // Re-check under the customer lock: an identical request for the same customer may have
      // committed meanwhile, and it must be answered as a duplicate before any refund-balance
      // check (which would otherwise count the first request's own refund).
      if (await findByEventId(tx, projectId, input.eventId)) throw new EventIdTaken();
      const refundOfId = await resolveRefundOf(tx, projectId, customer.id, input);

      // The unique (project_id, event_id) constraint is the race-safe authority: a concurrent
      // insert of the same event_id makes this a no-op after the other transaction commits.
      const inserted = await tx
        .insert(revenueEvents)
        .values({
          projectId,
          eventId: input.eventId,
          type: input.type,
          customerId: customer.id,
          amountMinor: input.amountMinor,
          currency: input.currency,
          occurredAt: input.occurredAt,
          receivedAt: clock.now(),
          refundOfId,
          billingInterval: input.billingInterval,
          subscriptionId: input.subscriptionId,
          test: input.test,
          payloadHash: hash,
        })
        .onConflictDoNothing({ target: [revenueEvents.projectId, revenueEvents.eventId] })
        .returning({ id: revenueEvents.id });
      const row = inserted[0];
      if (!row) throw new EventIdTaken();

      const ref = { projectId, customerId: customer.id };
      const linked =
        input.visitorId !== null &&
        (await createTrustedLink(
          tx,
          { ...ref, visitorId: input.visitorId, method: "revenue_api" },
          clock,
        ));

      // Refunds never change acquisition; they only need a recompute when they bring a new
      // customer (initial unattributed row) or a new trusted link.
      const attribution =
        customer.created || linked || input.type === "payment"
          ? toStoredAttribution(await recomputeCustomerAttribution(tx, ref, clock))
          : await readCustomerAttribution(tx, ref);

      return { kind: "created", id: row.id, eventId: input.eventId, attribution };
    });
  } catch (err) {
    if (!(err instanceof EventIdTaken)) throw err;
    // Everything this request wrote (e.g. a new customer) was rolled back.
    const existing = await findByEventId(db, projectId, input.eventId);
    if (!existing) throw new Error("revenue event vanished after unique conflict");
    return resolveExisting(db, projectId, input.eventId, existing, hash);
  }
}

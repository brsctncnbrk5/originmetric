/**
 * Attribution materializer (plan §13.2): recompute one customer's `customer_attribution` row
 * from source facts inside the caller's transaction. Bounded to one project's customer, its
 * trusted visitors and their sessions inside the 90-day window before the acquisition moment.
 */
import { and, eq, gte, inArray, lte, min } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import {
  customerAttribution,
  customerVisitors,
  revenueEvents,
  sessions,
  type AttributionStatus,
} from "@/server/db/schema";
import type { Clock } from "@/server/time/clock";
import {
  DEFAULT_RULES,
  acquisitionMoment,
  attribute,
  lookbackStart,
  type AttributionResult,
  type AttributionRules,
  type CustomerFacts,
  type Touch,
} from "./engine";

export interface CustomerRef {
  projectId: string;
  customerId: string;
}

export interface StoredAttribution {
  status: AttributionStatus;
  source: string | null;
}

export async function loadCustomerFacts(db: Executor, ref: CustomerRef): Promise<CustomerFacts> {
  const [links] = await db
    .select({ first: min(customerVisitors.linkedAt) })
    .from(customerVisitors)
    .where(
      and(
        eq(customerVisitors.projectId, ref.projectId),
        eq(customerVisitors.customerId, ref.customerId),
      ),
    );
  const [payments] = await db
    .select({ first: min(revenueEvents.occurredAt) })
    .from(revenueEvents)
    .where(
      and(
        eq(revenueEvents.projectId, ref.projectId),
        eq(revenueEvents.customerId, ref.customerId),
        eq(revenueEvents.type, "payment"),
      ),
    );
  return { firstLinkedAt: toDate(links?.first), firstPaymentAt: toDate(payments?.first) };
}

/** Sessions of the customer's trusted visitors inside [acquiredAt − lookback, acquiredAt]. */
export async function loadEligibleTouches(
  db: Executor,
  ref: CustomerRef,
  acquiredAt: Date,
  rules: AttributionRules = DEFAULT_RULES,
): Promise<Touch[]> {
  const linkedVisitors = db
    .select({ visitorId: customerVisitors.visitorId })
    .from(customerVisitors)
    .where(
      and(
        eq(customerVisitors.projectId, ref.projectId),
        eq(customerVisitors.customerId, ref.customerId),
      ),
    );
  const rows = await db
    .select({
      sessionId: sessions.id,
      visitorId: sessions.visitorId,
      startedAt: sessions.startedAt,
      source: sessions.source,
      medium: sessions.medium,
      campaign: sessions.campaign,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.projectId, ref.projectId),
        inArray(sessions.visitorId, linkedVisitors),
        gte(sessions.startedAt, lookbackStart(acquiredAt, rules)),
        lte(sessions.startedAt, acquiredAt),
      ),
    );
  return rows;
}

/** Recompute and upsert one customer's attribution. Call inside the fact-changing transaction. */
export async function recomputeCustomerAttribution(
  db: Executor,
  ref: CustomerRef,
  clock: Clock,
  rules: AttributionRules = DEFAULT_RULES,
): Promise<AttributionResult> {
  const facts = await loadCustomerFacts(db, ref);
  const acquiredAt = acquisitionMoment(facts);
  const touches = acquiredAt ? await loadEligibleTouches(db, ref, acquiredAt, rules) : [];
  const result = attribute(touches, facts, rules);

  const values = {
    rulesVersion: result.rulesVersion,
    status: result.status,
    acquiredAt: result.acquiredAt,
    creditedSessionId: result.credited?.sessionId ?? null,
    creditedSource: result.credited?.source ?? null,
    creditedMedium: result.credited?.medium ?? null,
    creditedCampaign: result.credited?.campaign ?? null,
    firstTouchSessionId: result.firstTouch?.sessionId ?? null,
    firstTouchSource: result.firstTouch?.source ?? null,
    computedAt: clock.now(),
  };
  await db
    .insert(customerAttribution)
    .values({ projectId: ref.projectId, customerId: ref.customerId, ...values })
    .onConflictDoUpdate({
      target: [customerAttribution.projectId, customerAttribution.customerId],
      set: values,
    });
  return result;
}

export async function readCustomerAttribution(
  db: Executor,
  ref: CustomerRef,
): Promise<StoredAttribution> {
  const [row] = await db
    .select({ status: customerAttribution.status, source: customerAttribution.creditedSource })
    .from(customerAttribution)
    .where(
      and(
        eq(customerAttribution.projectId, ref.projectId),
        eq(customerAttribution.customerId, ref.customerId),
      ),
    );
  return row ?? { status: "unattributed", source: null };
}

export function toStoredAttribution(result: AttributionResult): StoredAttribution {
  return { status: result.status, source: result.credited?.source ?? null };
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value : new Date(value);
}

/**
 * Pure attribution engine (plan §3.2, locked by D-003 / U2). No I/O: the materializer loads
 * facts and persists the result.
 *
 * Model: customer-level last non-direct touch, 90-day lookback.
 * - Acquisition moment = min(first trusted link `linked_at`, first payment `occurred_at`).
 * - Eligible touch = session of a trusted-linked visitor that started at or before the
 *   acquisition moment and no earlier than `lookbackDays` before it (both bounds inclusive).
 * - Credit = latest eligible non-direct touch; `direct` if every eligible touch is direct;
 *   `unattributed` if there is no eligible touch (or no acquisition moment).
 * - Ordering is (startedAt, id) ascending, so equal start times resolve deterministically by
 *   session UUID: the greater id is "later".
 *
 * Because the acquisition moment is a min() over trusted facts, later payments (renewals),
 * refunds and later visits can never move it forward or pull in post-acquisition sessions. A
 * trusted link created after acquisition can only contribute sessions that started before the
 * already-established acquisition moment (P1a clarification of §3.2).
 */
import type { AttributionStatus } from "@/server/db/schema";
import { DIRECT } from "./source";

/** Bump when attribution or source-normalization rules change; then run `ops recompute`. */
export const ATTRIBUTION_RULES_VERSION = 1;
export const LOOKBACK_DAYS = 90;
const DAY_MS = 86_400_000;

export interface Touch {
  sessionId: string;
  visitorId: string;
  startedAt: Date;
  source: string;
  medium: string | null;
  campaign: string | null;
}

export interface CustomerFacts {
  /** Earliest trusted link `linked_at` for the customer, or null if never linked. */
  firstLinkedAt: Date | null;
  /** Earliest `payment` `occurred_at` for the customer, or null if no payment. */
  firstPaymentAt: Date | null;
}

export interface AttributionRules {
  version: number;
  lookbackDays: number;
}

export const DEFAULT_RULES: AttributionRules = {
  version: ATTRIBUTION_RULES_VERSION,
  lookbackDays: LOOKBACK_DAYS,
};

export interface AttributionResult {
  rulesVersion: number;
  status: AttributionStatus;
  acquiredAt: Date | null;
  credited: Touch | null;
  firstTouch: Touch | null;
  /** Number of eligible touches considered (for diagnostics/tests). */
  eligibleCount: number;
}

export function acquisitionMoment(facts: CustomerFacts): Date | null {
  const candidates = [facts.firstLinkedAt, facts.firstPaymentAt].filter(
    (d): d is Date => d !== null,
  );
  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}

/** Inclusive lower bound of the lookback window for an acquisition moment. */
export function lookbackStart(acquiredAt: Date, rules: AttributionRules = DEFAULT_RULES): Date {
  return new Date(acquiredAt.getTime() - rules.lookbackDays * DAY_MS);
}

export function isDirectTouch(touch: Pick<Touch, "source">): boolean {
  return touch.source === DIRECT;
}

export function compareTouches(a: Touch, b: Touch): number {
  const byTime = a.startedAt.getTime() - b.startedAt.getTime();
  if (byTime !== 0) return byTime;
  return a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0;
}

export function attribute(
  touches: readonly Touch[],
  facts: CustomerFacts,
  rules: AttributionRules = DEFAULT_RULES,
): AttributionResult {
  const acquiredAt = acquisitionMoment(facts);
  const base = { rulesVersion: rules.version, acquiredAt };
  if (acquiredAt === null) {
    return { ...base, status: "unattributed", credited: null, firstTouch: null, eligibleCount: 0 };
  }

  const from = lookbackStart(acquiredAt, rules).getTime();
  const to = acquiredAt.getTime();
  const eligible = touches
    .filter((t) => {
      const start = t.startedAt.getTime();
      return start >= from && start <= to;
    })
    .sort(compareTouches);

  const firstTouch = eligible[0] ?? null;
  if (firstTouch === null) {
    return { ...base, status: "unattributed", credited: null, firstTouch: null, eligibleCount: 0 };
  }

  let credited: Touch | null = null;
  for (let i = eligible.length - 1; i >= 0; i--) {
    const touch = eligible[i];
    if (touch && !isDirectTouch(touch)) {
      credited = touch;
      break;
    }
  }
  if (credited !== null) {
    return { ...base, status: "attributed", credited, firstTouch, eligibleCount: eligible.length };
  }
  // All eligible touches are direct: credit the latest one (source `direct`).
  const latest = eligible[eligible.length - 1] ?? firstTouch;
  return {
    ...base,
    status: "direct",
    credited: latest,
    firstTouch,
    eligibleCount: eligible.length,
  };
}

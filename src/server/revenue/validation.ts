/**
 * `POST /api/v1/revenue-events` body contract (plan §7.1) and its canonical, hashed form
 * (plan §13.4).
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  BILLING_INTERVALS,
  REVENUE_TYPES,
  type BillingInterval,
  type RevenueType,
} from "@/server/db/schema";
import { InvalidRequest, parseWith } from "@/server/http/api";
import { customerIdField, visitorIdField } from "@/server/identity/fields";
import { normalizeCurrency } from "@/server/money/currency";
import type { Clock } from "@/server/time/clock";
import { parseRfc3339 } from "@/server/time/rfc3339";

export const MAX_AMOUNT_MINOR = 1_000_000_000_000; // 10^12
export const MAX_FUTURE_SKEW_MS = 5 * 60_000;
export const EARLIEST_OCCURRED_AT = new Date("2000-01-01T00:00:00Z");

const EVENT_ID = /^[A-Za-z0-9_.:-]{1,128}$/;

const eventIdField = (name: string) =>
  z
    .string({ error: `${name} must be a string` })
    .regex(EVENT_ID, { error: `${name} must be 1-128 characters of [A-Za-z0-9_.:-]` });

export const revenueBodySchema = z.strictObject({
  event_id: eventIdField("event_id"),
  type: z.enum(REVENUE_TYPES, { error: "type must be 'payment' or 'refund'" }),
  customer_id: customerIdField,
  visitor_id: visitorIdField.nullable().optional(),
  amount: z
    .number({ error: "amount must be an integer number of minor units" })
    .int({ error: "amount must be an integer number of minor units" })
    .positive({ error: "amount must be positive" })
    .max(MAX_AMOUNT_MINOR, { error: `amount must be at most ${MAX_AMOUNT_MINOR}` }),
  currency: z
    .string({ error: "currency must be an ISO 4217 code" })
    .max(8, { error: "currency must be an ISO 4217 code" })
    .transform((value, ctx) => {
      const code = normalizeCurrency(value);
      if (code === null) {
        ctx.addIssue({ code: "custom", message: "unsupported ISO 4217 currency" });
        return z.NEVER;
      }
      return code;
    }),
  occurred_at: z
    .string({ error: "occurred_at must be an RFC 3339 timestamp with offset" })
    .max(64, { error: "occurred_at must be an RFC 3339 timestamp with offset" }),
  refund_of: eventIdField("refund_of").nullable().optional(),
  billing_interval: z
    .enum(BILLING_INTERVALS, { error: "billing_interval must be one_time, month or year" })
    .nullable()
    .optional(),
  subscription_id: z
    .string({ error: "subscription_id must be a string" })
    .regex(/^[\x21-\x7E]{1,128}$/, {
      error: "subscription_id must be 1-128 printable ASCII characters without whitespace",
    })
    .nullable()
    .optional(),
  test: z.boolean({ error: "test must be a boolean" }).optional(),
});

/** Fully normalized semantic payload. Optional fields are explicit (null / false). */
export interface RevenueInput {
  eventId: string;
  type: RevenueType;
  customerId: string;
  visitorId: string | null;
  amountMinor: bigint;
  currency: string;
  occurredAt: Date;
  refundOf: string | null;
  billingInterval: BillingInterval | null;
  subscriptionId: string | null;
  test: boolean;
}

/** Validate a parsed JSON body against the contract and the injected clock. Throws 422. */
export function parseRevenueBody(body: unknown, clock: Clock): RevenueInput {
  const b = parseWith(revenueBodySchema, body);
  const occurredAt = parseRfc3339(b.occurred_at);
  if (occurredAt === null) {
    throw new InvalidRequest(
      "occurred_at must be an RFC 3339 timestamp with offset",
      "occurred_at",
    );
  }
  if (occurredAt.getTime() < EARLIEST_OCCURRED_AT.getTime()) {
    throw new InvalidRequest("occurred_at must not be before 2000-01-01T00:00:00Z", "occurred_at");
  }
  if (occurredAt.getTime() > clock.now().getTime() + MAX_FUTURE_SKEW_MS) {
    throw new InvalidRequest(
      "occurred_at must not be more than 5 minutes in the future",
      "occurred_at",
    );
  }
  const refundOf = b.refund_of ?? null;
  if (refundOf !== null && b.type !== "refund") {
    throw new InvalidRequest("refund_of is only allowed on refunds", "refund_of");
  }
  return {
    eventId: b.event_id,
    type: b.type,
    customerId: b.customer_id,
    visitorId: b.visitor_id ?? null,
    amountMinor: BigInt(b.amount),
    currency: b.currency,
    occurredAt,
    refundOf,
    billingInterval: b.billing_interval ?? null,
    subscriptionId: b.subscription_id ?? null,
    test: b.test ?? false,
  };
}

/**
 * Canonical semantic payload: fixed key order, normalized values (uppercase currency, UTC ISO
 * timestamp at millisecond precision, lowercase visitor UUID, amount as a decimal string,
 * explicit null/false defaults). Raw JSON formatting never affects it.
 */
export function canonicalPayload(input: RevenueInput): string {
  return JSON.stringify([
    "om.revenue.v1",
    input.eventId,
    input.type,
    input.customerId,
    input.visitorId,
    input.amountMinor.toString(),
    input.currency,
    input.occurredAt.toISOString(),
    input.refundOf,
    input.billingInterval,
    input.subscriptionId,
    input.test,
  ]);
}

export function payloadHash(input: RevenueInput): string {
  return createHash("sha256").update(canonicalPayload(input), "utf8").digest("hex");
}

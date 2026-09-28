import { describe, expect, it } from "vitest";
import { InvalidRequest } from "@/server/http/api";
import {
  canonicalPayload,
  parseRevenueBody,
  payloadHash,
  type RevenueInput,
} from "@/server/revenue/validation";
import { createFakeClock } from "@/server/time/clock";
import { parseRfc3339 } from "@/server/time/rfc3339";

const NOW = "2026-10-01T12:00:00.000Z";
const clock = createFakeClock(NOW);

const base = {
  event_id: "inv_2026_000123",
  type: "payment",
  customer_id: "cust_123",
  visitor_id: null,
  amount: 2900,
  currency: "USD",
  occurred_at: "2026-10-01T11:34:56Z",
  refund_of: null,
  billing_interval: "month",
  subscription_id: "sub_789",
  test: false,
};

function fieldError(body: unknown): { field?: string; message: string } {
  try {
    parseRevenueBody(body, clock);
  } catch (err) {
    if (err instanceof InvalidRequest) return { field: err.field, message: err.message };
    throw err;
  }
  throw new Error("expected InvalidRequest");
}

describe("revenue body validation", () => {
  it("accepts the documented example", () => {
    const input = parseRevenueBody(base, clock);
    expect(input).toMatchObject({
      eventId: "inv_2026_000123",
      amountMinor: 2900n,
      currency: "USD",
    });
  });

  it.each([
    ["missing event_id", { event_id: undefined }, "event_id"],
    ["empty event_id", { event_id: "" }, "event_id"],
    ["event_id too long", { event_id: "a".repeat(129) }, "event_id"],
    ["event_id bad chars", { event_id: "inv 1" }, "event_id"],
    ["bad type", { type: "subscription_started" }, "type"],
    ["missing customer", { customer_id: undefined }, "customer_id"],
    ["email customer", { customer_id: "jane@example.com" }, "customer_id"],
    ["customer too long", { customer_id: "c".repeat(129) }, "customer_id"],
    ["customer whitespace", { customer_id: "cust 1" }, "customer_id"],
    ["bad visitor", { visitor_id: "not-a-uuid" }, "visitor_id"],
    ["float amount", { amount: 29.5 }, "amount"],
    ["string amount", { amount: "2900" }, "amount"],
    ["zero amount", { amount: 0 }, "amount"],
    ["negative amount", { amount: -1 }, "amount"],
    ["amount over 10^12", { amount: 1_000_000_000_001 }, "amount"],
    ["unsafe integer", { amount: 2 ** 53 }, "amount"],
    ["unknown currency", { currency: "XYZ" }, "currency"],
    ["numeric currency", { currency: 840 }, "currency"],
    ["no offset", { occurred_at: "2026-10-01T11:34:56" }, "occurred_at"],
    ["date only", { occurred_at: "2026-10-01" }, "occurred_at"],
    ["impossible date", { occurred_at: "2026-02-30T00:00:00Z" }, "occurred_at"],
    ["24:00", { occurred_at: "2026-10-01T24:00:00Z" }, "occurred_at"],
    ["refund_of on payment", { refund_of: "inv_0" }, "refund_of"],
    ["bad billing interval", { billing_interval: "week" }, "billing_interval"],
    ["bad test flag", { test: "false" }, "test"],
    ["unknown field", { ammount: 1 }, "ammount"],
  ])("%s → 422 on %s", (_name, patch, field) => {
    expect(fieldError({ ...base, ...patch }).field).toBe(field);
  });

  it("normalizes optional fields to explicit defaults", () => {
    const input = parseRevenueBody(
      {
        event_id: "e1",
        type: "payment",
        customer_id: "c1",
        amount: 1,
        currency: "usd",
        occurred_at: NOW,
      },
      clock,
    );
    expect(input).toMatchObject({
      visitorId: null,
      refundOf: null,
      billingInterval: null,
      subscriptionId: null,
      test: false,
      currency: "USD",
    });
  });
});

describe("time bounds (injected Clock)", () => {
  it("rejects more than 5 minutes in the future", () => {
    expect(fieldError({ ...base, occurred_at: "2026-10-01T12:05:00.001Z" }).field).toBe(
      "occurred_at",
    );
  });

  it("accepts exactly now + 5 minutes", () => {
    expect(
      parseRevenueBody(
        { ...base, occurred_at: "2026-10-01T12:05:00Z" },
        clock,
      ).occurredAt.toISOString(),
    ).toBe("2026-10-01T12:05:00.000Z");
  });

  it("follows the clock, not the wall time", () => {
    const later = createFakeClock("2030-01-01T00:00:00Z");
    expect(() =>
      parseRevenueBody({ ...base, occurred_at: "2029-12-31T23:59:00Z" }, later),
    ).not.toThrow();
    expect(fieldError({ ...base, occurred_at: "2029-12-31T23:59:00Z" }).field).toBe("occurred_at");
  });

  it("rejects before 2000-01-01T00:00:00Z and accepts exactly that instant", () => {
    expect(fieldError({ ...base, occurred_at: "1999-12-31T23:59:59Z" }).field).toBe("occurred_at");
    expect(fieldError({ ...base, occurred_at: "2000-01-01T00:30:00+01:00" }).field).toBe(
      "occurred_at",
    );
    expect(() =>
      parseRevenueBody({ ...base, occurred_at: "2000-01-01T00:00:00Z" }, clock),
    ).not.toThrow();
  });

  it.each([
    ["2026-10-01T15:34:56+03:00", "2026-10-01T12:34:56.000Z"],
    ["2026-10-01T07:04:56-05:30", "2026-10-01T12:34:56.000Z"],
    ["2026-10-01t12:34:56z", "2026-10-01T12:34:56.000Z"],
    ["2026-10-01T12:34:56.123456789Z", "2026-10-01T12:34:56.123Z"],
    ["2024-02-29T00:00:00Z", "2024-02-29T00:00:00.000Z"],
  ])("RFC 3339 %s → %s", (raw, iso) => {
    expect(parseRfc3339(raw)?.toISOString()).toBe(iso);
  });

  it.each([
    "2023-02-29T00:00:00Z",
    "2026-10-01T12:34:60Z",
    "2026-10-01T12:34:56+24:00",
    "2026-13-01T00:00:00Z",
    "0999-01-01T00:00:00Z",
  ])("rejects %s", (raw) => {
    expect(parseRfc3339(raw)).toBeNull();
  });
});

describe("canonical payload hash", () => {
  const input = parseRevenueBody(base, clock);

  it("ignores JSON formatting, key order, currency case and offset notation", () => {
    const variant = parseRevenueBody(
      {
        test: false,
        subscription_id: "sub_789",
        billing_interval: "month",
        refund_of: null,
        occurred_at: "2026-10-01T14:34:56+03:00",
        currency: "usd",
        amount: 2900,
        visitor_id: null,
        customer_id: "cust_123",
        type: "payment",
        event_id: "inv_2026_000123",
      },
      clock,
    );
    expect(payloadHash(variant)).toBe(payloadHash(input));
  });

  it("treats absent optional fields like their explicit defaults", () => {
    const explicit = parseRevenueBody(
      {
        ...base,
        visitor_id: null,
        refund_of: null,
        billing_interval: null,
        subscription_id: null,
        test: false,
      },
      clock,
    );
    const implicit = parseRevenueBody(
      {
        event_id: base.event_id,
        type: "payment",
        customer_id: "cust_123",
        amount: 2900,
        currency: "USD",
        occurred_at: base.occurred_at,
      },
      clock,
    );
    expect(payloadHash(implicit)).toBe(payloadHash(explicit));
  });

  it.each<[string, Partial<RevenueInput>]>([
    ["amount", { amountMinor: 2901n }],
    ["customer", { customerId: "cust_999" }],
    ["currency", { currency: "EUR" }],
    ["occurred_at", { occurredAt: new Date("2026-10-01T11:34:57Z") }],
    ["visitor", { visitorId: "0192f7a4-0000-7000-8000-000000000001" }],
    ["test flag", { test: true }],
    ["billing interval", { billingInterval: "year" }],
  ])("changes when %s changes", (_name, patch) => {
    expect(payloadHash({ ...input, ...patch })).not.toBe(payloadHash(input));
  });

  it("is a fixed-shape JSON array (no raw input)", () => {
    expect(canonicalPayload(input)).toBe(
      '["om.revenue.v1","inv_2026_000123","payment","cust_123",null,"2900","USD","2026-10-01T11:34:56.000Z",null,"month","sub_789",false]',
    );
  });
});

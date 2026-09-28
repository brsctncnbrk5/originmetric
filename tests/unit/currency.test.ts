import { describe, expect, it } from "vitest";
import {
  formatMinor,
  minorToDecimalString,
  minorUnitExponent,
  normalizeCurrency,
  sumByCurrency,
  supportedCurrencies,
} from "@/server/money/currency";

describe("ISO 4217 table", () => {
  it.each([
    ["USD", 2],
    ["TRY", 2],
    ["EUR", 2],
    ["JPY", 0],
    ["KRW", 0],
    ["CLP", 0],
    ["KWD", 3],
    ["BHD", 3],
    ["CLF", 4],
  ])("%s has exponent %i", (code, exponent) => {
    expect(minorUnitExponent(code)).toBe(exponent);
  });

  it.each([
    ["usd", "USD"],
    [" try ", "TRY"],
    ["Jpy", "JPY"],
  ])("normalizes %j → %s", (raw, code) => {
    expect(normalizeCurrency(raw)).toBe(code);
  });

  it.each(["XYZ", "US", "USDD", "", "XAU", "XXX", "XTS", "HRK", "€"])("rejects %j", (raw) => {
    expect(normalizeCurrency(raw)).toBeNull();
  });

  it("unknown codes throw for exponent lookups", () => {
    expect(() => minorUnitExponent("XYZ")).toThrow(RangeError);
  });

  it("is a deterministic in-repo list", () => {
    const list = supportedCurrencies();
    expect(list.length).toBeGreaterThan(150);
    expect(new Set(list).size).toBe(list.length);
    expect(list.every((c) => /^[A-Z]{3}$/.test(c))).toBe(true);
  });
});

describe("formatting (exact, no floats)", () => {
  it.each([
    [2900n, "USD", "29.00", "$29.00"],
    [123456n, "TRY", "1234.56", "TRY 1,234.56"],
    [5000n, "JPY", "5000", "¥5,000"],
    [1234n, "KWD", "1.234", "KWD 1.234"],
    [5n, "USD", "0.05", "$0.05"],
    [1_000_000_000_000n, "USD", "10000000000.00", "$10,000,000,000.00"],
  ])("%s %s → %s / %s", (minor, code, decimal, formatted) => {
    expect(minorToDecimalString(minor, code)).toBe(decimal);
    expect(formatMinor(minor, code).replace(/ /g, " ")).toBe(formatted);
  });

  it("handles amounts beyond Number precision exactly", () => {
    expect(minorToDecimalString(9_007_199_254_740_993n, "USD")).toBe("90071992547409.93");
  });
});

describe("mixed currencies are never aggregated together", () => {
  it("sums per currency only", () => {
    const totals = sumByCurrency([
      { amountMinor: 2900n, currency: "USD" },
      { amountMinor: 5000n, currency: "JPY" },
      { amountMinor: 100n, currency: "USD" },
      { amountMinor: 1234n, currency: "KWD" },
    ]);
    expect(Object.fromEntries(totals)).toEqual({ USD: 3000n, JPY: 5000n, KWD: 1234n });
  });
});

/**
 * In-repository ISO 4217 table (plan §10.1). Deterministic: no external currency service,
 * no FX, no cross-currency sums.
 *
 * Source: ISO 4217 "List One" (current currencies and funds), reviewed 2026-09.
 * Codes with no minor unit defined ("N.A.": precious metals XAU/XAG/XPT/XPD, bond units
 * XBA–XBD, XDR, XSU, XUA, test code XTS, no-currency XXX) are excluded: they are not
 * payment currencies. Withdrawn codes (e.g. HRK, SLL, ZWL; ANG replaced by XCG in 2025; BGN replaced by EUR in 2026) are excluded.
 */
const EXPONENT_0 = [
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "UYI",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
] as const;

const EXPONENT_3 = ["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"] as const;

const EXPONENT_4 = ["CLF", "UYW"] as const;

// prettier-ignore
const EXPONENT_2 = [
  "AED", "AFN", "ALL", "AMD", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD", "BDT",
  "BMD", "BND", "BOB", "BOV", "BRL", "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHE",
  "CHF", "CHW", "CNY", "COP", "COU", "CRC", "CUP", "CVE", "CZK", "DKK", "DOP", "DZD", "EGP",
  "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP", "GMD", "GTQ", "GYD", "HKD",
  "HNL", "HTG", "HUF", "IDR", "ILS", "INR", "IRR", "JMD", "KES", "KGS", "KHR", "KPW", "KYD",
  "KZT", "LAK", "LBP", "LKR", "LRD", "LSL", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP",
  "MRU", "MUR", "MVR", "MWK", "MXN", "MXV", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR",
  "NZD", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "QAR", "RON", "RSD", "RUB", "SAR", "SBD",
  "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SOS", "SRD", "SSP", "STN", "SVC", "SYP", "SZL",
  "THB", "TJS", "TMT", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "USD", "USN", "UYU", "UZS",
  "VED", "VES", "WST", "XCD", "XCG", "YER", "ZAR", "ZMW", "ZWG",
] as const;

const TABLE: ReadonlyMap<string, number> = new Map<string, number>([
  ...EXPONENT_0.map((c) => [c, 0] as const),
  ...EXPONENT_2.map((c) => [c, 2] as const),
  ...EXPONENT_3.map((c) => [c, 3] as const),
  ...EXPONENT_4.map((c) => [c, 4] as const),
]);

/** Normalize (trim + uppercase) and validate an ISO 4217 alpha-3 code. Returns null if unknown. */
export function normalizeCurrency(input: string): string | null {
  const code = input.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) && TABLE.has(code) ? code : null;
}

export function isSupportedCurrency(code: string): boolean {
  return TABLE.has(code);
}

/** Minor-unit exponent (USD 2, JPY 0, KWD 3). Throws for unknown codes. */
export function minorUnitExponent(code: string): number {
  const exponent = TABLE.get(code);
  if (exponent === undefined) throw new RangeError(`unsupported currency: ${code}`);
  return exponent;
}

export function supportedCurrencies(): string[] {
  return [...TABLE.keys()].sort();
}

/** Exact decimal string for an integer minor amount, e.g. (2900n, "USD") → "29.00". */
export function minorToDecimalString(amountMinor: bigint, code: string): string {
  const exponent = minorUnitExponent(code);
  const negative = amountMinor < 0n;
  const digits = (negative ? -amountMinor : amountMinor).toString().padStart(exponent + 1, "0");
  const whole = digits.slice(0, digits.length - exponent);
  const fraction = exponent > 0 ? `.${digits.slice(digits.length - exponent)}` : "";
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

/**
 * Format an integer minor amount for display with the table's exponent. The exact decimal
 * string is passed to Intl (no floating point on the money path).
 */
export function formatMinor(amountMinor: bigint, code: string, locale = "en-US"): string {
  const exponent = minorUnitExponent(code);
  const format = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  });
  // Intl.NumberFormat accepts exact decimal strings (ES2023 Intl.NumberFormat v3).
  return format.format(minorToDecimalString(amountMinor, code) as unknown as number);
}

export interface MoneyAmount {
  amountMinor: bigint;
  currency: string;
}

/** Sum amounts per currency. Never adds across currencies. */
export function sumByCurrency(amounts: Iterable<MoneyAmount>): Map<string, bigint> {
  const totals = new Map<string, bigint>();
  for (const { amountMinor, currency } of amounts) {
    totals.set(currency, (totals.get(currency) ?? 0n) + amountMinor);
  }
  return totals;
}

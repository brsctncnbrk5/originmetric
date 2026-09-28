/**
 * Source normalization (plan §3.2, versioned by ATTRIBUTION_RULES_VERSION). Pure: no I/O.
 *
 * Precedence:
 *   1. utm_source present → alias-mapped, cleaned UTM values.
 *   2. click ID (gclid / fbclid / msclkid) with no UTM → inferred paid source. The click-ID
 *      *value* is never an input here: callers pass presence flags only, so it cannot be stored.
 *   3. external referrer → known-host mapping, else the registrable domain.
 *   4. otherwise (no referrer, own domain, or excluded payment/auth host) → `direct`.
 */
import { parse } from "tldts";

export const DIRECT = "direct";
export const PAID_INFERRED = "paid (inferred)";
/** Cap for every normalized UTM value (matches the tracker's 200-char capture cap). */
export const MAX_VALUE_LENGTH = 200;
const MAX_HOST_LENGTH = 253;

/** Built-in self-referral exclusions: payment and auth hosts (plan §3.2). */
export const BUILTIN_EXCLUDED_REFERRERS: readonly string[] = [
  "checkout.paddle.com",
  "*.lemonsqueezy.com",
  "polar.sh",
  "checkout.stripe.com",
  "*.iyzipay.com",
  "*.paytr.com",
  "accounts.google.com",
];

/** utm_source aliases (after trimming and lowercasing). */
const SOURCE_ALIASES: Readonly<Record<string, string>> = {
  fb: "facebook",
  "facebook.com": "facebook",
  "m.facebook.com": "facebook",
  "l.facebook.com": "facebook",
  ig: "instagram",
  "instagram.com": "instagram",
  tw: "twitter",
  "twitter.com": "twitter",
  "t.co": "twitter",
  "x.com": "twitter",
  "google.com": "google",
  li: "linkedin",
  "linkedin.com": "linkedin",
  "lnkd.in": "linkedin",
  yt: "youtube",
  "youtube.com": "youtube",
  hn: "hacker news",
  "news.ycombinator.com": "hacker news",
  "reddit.com": "reddit",
  "bing.com": "bing",
};

/** Exact referrer hosts with a known name (checked before registrable-domain rules). */
const KNOWN_HOSTS: Readonly<Record<string, string>> = {
  "t.co": "twitter",
  "news.ycombinator.com": "hacker news",
  "lnkd.in": "linkedin",
  "youtu.be": "youtube",
};

/** Registrable domains with a known name. */
const KNOWN_DOMAINS: Readonly<Record<string, string>> = {
  "facebook.com": "facebook",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "linkedin.com": "linkedin",
  "reddit.com": "reddit",
  "youtube.com": "youtube",
  "instagram.com": "instagram",
  "bing.com": "bing",
  "duckduckgo.com": "duckduckgo",
};

/** Search engines keyed by the domain label without public suffix (google.com, google.co.uk …). */
const KNOWN_DOMAIN_LABELS: Readonly<Record<string, string>> = {
  google: "google",
  yahoo: "yahoo",
  yandex: "yandex",
};

export interface SourceInput {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  /** Referrer host (no path/query), as reported by the tracker. */
  referrerHost?: string | null;
  /** Presence flags only; click-ID values are never passed in. */
  clickIds?: { gclid?: boolean; fbclid?: boolean; msclkid?: boolean };
}

export interface SourceRules {
  /** Project allowed domains (`example.com` or `*.example.com`). */
  projectDomains: readonly string[];
  /** Project-specific exclusions, added to BUILTIN_EXCLUDED_REFERRERS. */
  excludedReferrers: readonly string[];
}

export interface NormalizedSource {
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  /** Cleaned referrer host (kept as a raw-ish fact even when the touch is direct). */
  referrerHost: string | null;
}

/**
 * Clean a free-text value: collapse whitespace, drop control/format characters, trim,
 * lowercase, cap length. Empty → null. Non-strings → null.
 */
export function cleanValue(value: unknown, max = MAX_VALUE_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .trim()
    .toLowerCase();
  if (cleaned.length === 0) return null;
  // Cap by code points so a surrogate pair is never split.
  const capped = Array.from(cleaned).slice(0, max).join("").trim();
  return capped.length > 0 ? capped : null;
}

/**
 * Normalize a hostname: lowercase, strip a port and trailing dot, convert IDN to punycode.
 * Returns null for anything that is not a plausible hostname.
 */
export function normalizeHost(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let host = value.trim().toLowerCase();
  if (host.length === 0 || host.length > MAX_HOST_LENGTH * 2) return null;
  if (/[\p{Cc}\s/?#@\\]/u.test(host)) return null;
  host = host.replace(/:\d{1,5}$/, "").replace(/\.$/, "");
  let ascii: string;
  try {
    ascii = new URL(`http://${host}/`).hostname;
  } catch {
    return null;
  }
  if (ascii !== host && !/^[\p{L}\p{N}.-]+$/u.test(host)) return null;
  if (ascii.length === 0 || ascii.length > MAX_HOST_LENGTH) return null;
  if (!/^[a-z0-9.-]+$/.test(ascii) || ascii.startsWith(".") || ascii.includes("..")) return null;
  return ascii;
}

/**
 * Normalize a domain pattern from project settings: `example.com` or `*.example.com`.
 * Returns the bare host (the wildcard is implied, see hostMatchesPattern), or null if invalid.
 */
export function normalizeDomainPattern(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  return normalizeHost(trimmed.startsWith("*.") ? trimmed.slice(2) : trimmed);
}

/**
 * Self-referral matching: a pattern matches its own host and every subdomain of it
 * (`example.com` and `*.example.com` both match `example.com` and `app.example.com`).
 * Treating subdomains of the founder's own domains as self is the safe choice: it can only
 * turn a would-be touch into `direct`, never credit the founder's own site.
 */
export function hostMatchesPattern(host: string, pattern: string): boolean {
  const base = normalizeDomainPattern(pattern);
  if (base === null) return false;
  return host === base || host.endsWith(`.${base}`);
}

export function isSelfOrExcludedHost(host: string, rules: SourceRules): boolean {
  const patterns = [
    ...rules.projectDomains,
    ...BUILTIN_EXCLUDED_REFERRERS,
    ...rules.excludedReferrers,
  ];
  return patterns.some((p) => hostMatchesPattern(host, p));
}

/** Map an external referrer host to a source name. */
export function sourceFromReferrerHost(host: string): string {
  const known = KNOWN_HOSTS[host];
  if (known) return known;
  const parsed = parse(host, { allowPrivateDomains: false });
  const domain = parsed.domain;
  if (!domain) return host; // IP address, localhost, bare suffix: keep the host itself.
  const byDomain = KNOWN_DOMAINS[domain];
  if (byDomain) return byDomain;
  const label = parsed.domainWithoutSuffix;
  if (label) {
    const byLabel = KNOWN_DOMAIN_LABELS[label];
    if (byLabel) return byLabel;
  }
  return domain;
}

export function aliasSource(source: string): string {
  return SOURCE_ALIASES[source] ?? source;
}

export function normalizeSource(input: SourceInput, rules: SourceRules): NormalizedSource {
  const referrerHost = normalizeHost(input.referrerHost);
  const utmSource = cleanValue(input.utmSource);

  if (utmSource !== null) {
    return {
      source: aliasSource(utmSource),
      medium: cleanValue(input.utmMedium),
      campaign: cleanValue(input.utmCampaign),
      content: cleanValue(input.utmContent),
      term: cleanValue(input.utmTerm),
      referrerHost,
    };
  }

  const clickSource = input.clickIds?.gclid
    ? "google"
    : input.clickIds?.fbclid
      ? "facebook"
      : input.clickIds?.msclkid
        ? "bing"
        : null;
  if (clickSource !== null) {
    return { ...empty(referrerHost), source: clickSource, medium: PAID_INFERRED };
  }

  if (referrerHost !== null && !isSelfOrExcludedHost(referrerHost, rules)) {
    return { ...empty(referrerHost), source: sourceFromReferrerHost(referrerHost) };
  }

  return empty(referrerHost);
}

function empty(referrerHost: string | null): NormalizedSource {
  return { source: DIRECT, medium: null, campaign: null, content: null, term: null, referrerHost };
}

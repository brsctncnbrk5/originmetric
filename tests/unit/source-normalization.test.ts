import { describe, expect, it } from "vitest";
import {
  BUILTIN_EXCLUDED_REFERRERS,
  DIRECT,
  MAX_VALUE_LENGTH,
  PAID_INFERRED,
  cleanValue,
  hostMatchesPattern,
  normalizeHost,
  normalizeSource,
  sourceFromReferrerHost,
  type SourceInput,
  type SourceRules,
} from "@/server/attribution/source";

const rules: SourceRules = { projectDomains: ["example.com"], excludedReferrers: [] };
const src = (input: SourceInput, r: SourceRules = rules) => normalizeSource(input, r);

describe("UTM first", () => {
  it.each([
    ["  Google ", "google"],
    ["GOOGLE", "google"],
    ["news\tletter", "news letter"],
    ["fb", "facebook"],
    ["Facebook.com", "facebook"],
    ["t.co", "twitter"],
    ["HN", "hacker news"],
    ["ProductHunt", "producthunt"],
  ])("utm_source %j → %j", (raw, expected) => {
    expect(src({ utmSource: raw }).source).toBe(expected);
  });

  it("keeps normalized medium/campaign/content/term", () => {
    expect(
      src({
        utmSource: "Google",
        utmMedium: " CPC ",
        utmCampaign: "Spring Sale",
        utmContent: "Hero",
        utmTerm: "Revenue  Attribution",
      }),
    ).toMatchObject({
      source: "google",
      medium: "cpc",
      campaign: "spring sale",
      content: "hero",
      term: "revenue attribution",
    });
  });

  it("UTM wins over an external referrer and over click IDs", () => {
    expect(
      src({ utmSource: "newsletter", referrerHost: "google.com", clickIds: { gclid: true } })
        .source,
    ).toBe("newsletter");
  });

  it("an empty / whitespace utm_source is treated as absent", () => {
    expect(src({ utmSource: "   ", referrerHost: "news.ycombinator.com" }).source).toBe(
      "hacker news",
    );
  });
});

describe("external referrer", () => {
  it.each([
    ["www.google.com", "google"],
    ["google.com", "google"],
    ["www.google.co.uk", "google"],
    ["google.com.tr", "google"],
    ["t.co", "twitter"],
    ["x.com", "twitter"],
    ["news.ycombinator.com", "hacker news"],
    ["l.facebook.com", "facebook"],
    ["www.linkedin.com", "linkedin"],
    ["old.reddit.com", "reddit"],
  ])("known mapping %s → %s", (host, expected) => {
    expect(src({ referrerHost: host }).source).toBe(expected);
  });

  it.each([
    ["blog.somesite.org", "somesite.org"],
    ["a.b.c.somesite.co.uk", "somesite.co.uk"],
    ["WWW.Example.ORG", "example.org"],
    ["sub.example.org:8443", "example.org"],
    ["user.github.io", "github.io"],
  ])("registrable-domain fallback %s → %s", (host, expected) => {
    expect(src({ referrerHost: host }).source).toBe(expected);
    expect(sourceFromReferrerHost(normalizeHost(host) ?? "")).toBe(expected);
  });

  it("IP-address referrers keep the host", () => {
    expect(src({ referrerHost: "203.0.113.9" }).source).toBe("203.0.113.9");
  });

  it("stores the cleaned referrer host", () => {
    expect(src({ referrerHost: " News.YCombinator.com. " }).referrerHost).toBe(
      "news.ycombinator.com",
    );
  });
});

describe("direct", () => {
  it("no UTM and no referrer → direct with empty fields", () => {
    expect(src({})).toEqual({
      source: DIRECT,
      medium: null,
      campaign: null,
      content: null,
      term: null,
      referrerHost: null,
    });
  });
});

describe("click IDs (inferred paid)", () => {
  it.each([
    [{ gclid: true }, "google"],
    [{ fbclid: true }, "facebook"],
    [{ msclkid: true }, "bing"],
  ])("%j → %s / paid (inferred)", (clickIds, expected) => {
    const r = src({ clickIds });
    expect(r.source).toBe(expected);
    expect(r.medium).toBe(PAID_INFERRED);
  });

  it("click IDs outrank a self-referral or external referrer", () => {
    expect(src({ referrerHost: "example.com", clickIds: { gclid: true } }).source).toBe("google");
    expect(src({ referrerHost: "news.ycombinator.com", clickIds: { fbclid: true } }).source).toBe(
      "facebook",
    );
  });

  it("the click-ID value is never part of the input or output", () => {
    const r = src({ clickIds: { gclid: true } });
    expect(JSON.stringify(r)).not.toMatch(/gclid|Cj0KCQ/);
  });
});

describe("self-referrals", () => {
  it.each([
    "example.com",
    "www.example.com",
    "app.example.com",
    "checkout.paddle.com",
    "store.lemonsqueezy.com",
    "polar.sh",
    "checkout.stripe.com",
    "sandbox-api.iyzipay.com",
    "www.paytr.com",
    "accounts.google.com",
  ])("%s → direct", (host) => {
    expect(src({ referrerHost: host }).source).toBe(DIRECT);
  });

  it("includes every built-in exclusion required by the plan", () => {
    expect(BUILTIN_EXCLUDED_REFERRERS).toEqual(
      expect.arrayContaining([
        "checkout.paddle.com",
        "*.lemonsqueezy.com",
        "polar.sh",
        "checkout.stripe.com",
        "*.iyzipay.com",
        "*.paytr.com",
        "accounts.google.com",
      ]),
    );
  });

  it("project-specific exclusions work (exact and wildcard)", () => {
    const custom: SourceRules = {
      projectDomains: ["example.com"],
      excludedReferrers: ["pay.mygateway.io", "*.auth0.com"],
    };
    expect(src({ referrerHost: "pay.mygateway.io" }, custom).source).toBe(DIRECT);
    expect(src({ referrerHost: "tenant.eu.auth0.com" }, custom).source).toBe(DIRECT);
    expect(src({ referrerHost: "mygateway.io" }, custom).source).toBe("mygateway.io");
    expect(src({ referrerHost: "pay.mygateway.io" }).source).toBe("mygateway.io");
  });

  it("a look-alike domain is not treated as self", () => {
    expect(src({ referrerHost: "notexample.com" }).source).toBe("notexample.com");
    expect(src({ referrerHost: "example.com.evil.net" }).source).toBe("evil.net");
    expect(hostMatchesPattern("badexample.com", "example.com")).toBe(false);
  });
});

describe("length caps and garbage input", () => {
  it(`caps UTM values at ${MAX_VALUE_LENGTH} characters`, () => {
    const r = src({ utmSource: "x".repeat(5000), utmCampaign: "c".repeat(300) });
    expect(r.source).toHaveLength(MAX_VALUE_LENGTH);
    expect(r.campaign).toHaveLength(MAX_VALUE_LENGTH);
  });

  it("caps by code point (never splits a surrogate pair)", () => {
    const v = cleanValue("😀".repeat(300));
    expect(Array.from(v ?? "")).toHaveLength(MAX_VALUE_LENGTH);
    expect(v).not.toMatch(/[\uD800-\uDBFF]$/);
  });

  it("strips control and format characters", () => {
    expect(src({ utmSource: "goo\u0000gle​‮" }).source).toBe("google");
    expect(src({ utmSource: "\u0007\u001b" }).source).toBe(DIRECT);
  });

  it.each([
    ["non-string utm", { utmSource: 42 as unknown as string }],
    ["object utm", { utmSource: {} as unknown as string }],
    ["host with path", { referrerHost: "evil.com/path" }],
    ["host with spaces", { referrerHost: "evil .com" }],
    ["host with userinfo", { referrerHost: "user@evil.com" }],
    ["host with control char", { referrerHost: "evil\u0000.com" }],
    ["absurdly long host", { referrerHost: `${"a".repeat(600)}.com` }],
    ["empty host", { referrerHost: "" }],
    ["dots only", { referrerHost: "..." }],
  ])("%s → direct, no throw", (_name, input) => {
    expect(() => src(input)).not.toThrow();
    expect(src(input).source).toBe(DIRECT);
  });

  it("IDN hosts are converted to punycode", () => {
    expect(normalizeHost("Bücher.de")).toBe("xn--bcher-kva.de");
  });
});

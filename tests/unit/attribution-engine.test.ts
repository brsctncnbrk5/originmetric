import { describe, expect, it } from "vitest";
import {
  ATTRIBUTION_RULES_VERSION,
  DEFAULT_RULES,
  LOOKBACK_DAYS,
  acquisitionMoment,
  attribute,
  type CustomerFacts,
  type Touch,
} from "@/server/attribution/engine";
import { normalizeSource } from "@/server/attribution/source";

const ACQ = new Date("2026-10-01T12:00:00Z");
const DAY = 86_400_000;
const at = (offsetDays: number) => new Date(ACQ.getTime() + offsetDays * DAY);

let n = 0;
function touch(offsetDays: number, source: string, extra: Partial<Touch> = {}): Touch {
  n++;
  return {
    sessionId: `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`,
    visitorId: "v1",
    startedAt: at(offsetDays),
    source,
    medium: null,
    campaign: null,
    ...extra,
  };
}

const linkedAtAcq: CustomerFacts = { firstLinkedAt: ACQ, firstPaymentAt: null };

interface Case {
  name: string;
  touches: Touch[];
  facts?: CustomerFacts;
  status: "attributed" | "direct" | "unattributed";
  credited: string | null;
  firstTouch?: string | null;
}

const google = touch(-10, "google", { medium: "cpc", campaign: "spring" });
const directAfterGoogle = touch(-2, "direct");
const campaignA = touch(-20, "newsletter", { campaign: "a" });
const campaignB = touch(-5, "twitter", { campaign: "b" });
const old = touch(-(LOOKBACK_DAYS + 1), "reddit");
const edge = touch(-LOOKBACK_DAYS, "producthunt");
const after = touch(+1, "bing");
const atAcq = touch(0, "hacker news");
const visitor2 = touch(-3, "linkedin", { visitorId: "v2" });
const visitor1 = touch(-8, "facebook", { visitorId: "v1" });

const selfReferral = normalizeSource(
  { referrerHost: "checkout.paddle.com" },
  { projectDomains: ["example.com"], excludedReferrers: [] },
);

const cases: Case[] = [
  {
    name: "UTM touch then direct return → UTM credited (direct never overwrites)",
    touches: [google, directAfterGoogle],
    status: "attributed",
    credited: "google",
    firstTouch: "google",
  },
  {
    name: "two campaigns → latest non-direct",
    touches: [campaignA, campaignB, touch(-1, "direct")],
    status: "attributed",
    credited: "twitter",
    firstTouch: "newsletter",
  },
  {
    name: "all direct → direct",
    touches: [touch(-9, "direct"), touch(-3, "direct")],
    status: "direct",
    credited: "direct",
    firstTouch: "direct",
  },
  { name: "no touches → unattributed", touches: [], status: "unattributed", credited: null },
  {
    name: "touch older than 90 days ignored",
    touches: [old],
    status: "unattributed",
    credited: null,
  },
  {
    name: "touch exactly 90 days before acquisition is eligible (inclusive)",
    touches: [old, edge],
    status: "attributed",
    credited: "producthunt",
  },
  {
    name: "touch after acquisition ignored",
    touches: [touch(-4, "direct"), after],
    status: "direct",
    credited: "direct",
  },
  {
    name: "touch exactly at acquisition is eligible (inclusive)",
    touches: [touch(-4, "google"), atAcq],
    status: "attributed",
    credited: "hacker news",
  },
  {
    name: "self-referral (payment host) normalizes to direct and never gets credit",
    touches: [touch(-6, "google"), touch(-1, selfReferral.source)],
    status: "attributed",
    credited: "google",
  },
  {
    name: "only a self-referral touch → direct",
    touches: [touch(-1, selfReferral.source)],
    status: "direct",
    credited: "direct",
  },
  {
    name: "multiple visitors are unioned (latest non-direct across visitors)",
    touches: [visitor1, visitor2],
    status: "attributed",
    credited: "linkedin",
    firstTouch: "facebook",
  },
  {
    name: "no acquisition moment (no link, no payment) → unattributed",
    touches: [touch(-1, "google")],
    facts: { firstLinkedAt: null, firstPaymentAt: null },
    status: "unattributed",
    credited: null,
  },
];

describe("attribute(): locked model, table-driven", () => {
  it.each(cases)("$name", (c) => {
    const result = attribute(c.touches, c.facts ?? linkedAtAcq);
    expect(result.status).toBe(c.status);
    expect(result.credited?.source ?? null).toBe(c.credited);
    if (c.firstTouch !== undefined) expect(result.firstTouch?.source ?? null).toBe(c.firstTouch);
    expect(result.rulesVersion).toBe(ATTRIBUTION_RULES_VERSION);
  });

  it("is pure: input order does not matter", () => {
    const touches = [campaignB, directAfterGoogle, campaignA, google];
    const a = attribute(touches, linkedAtAcq);
    const b = attribute([...touches].reverse(), linkedAtAcq);
    expect(a).toEqual(b);
    expect(touches[0]).toBe(campaignB); // not mutated
  });

  it("breaks timestamp ties deterministically by session UUID (greater id = later)", () => {
    const t = at(-3);
    const low = {
      ...touch(0, "alpha"),
      sessionId: "00000000-0000-4000-8000-00000000000a",
      startedAt: t,
    };
    const high = {
      ...touch(0, "beta"),
      sessionId: "00000000-0000-4000-8000-00000000000b",
      startedAt: t,
    };
    for (const order of [
      [low, high],
      [high, low],
    ]) {
      const result = attribute(order, linkedAtAcq);
      expect(result.credited?.source).toBe("beta");
      expect(result.firstTouch?.source).toBe("alpha");
    }
  });

  it("records rules_version and stores the first touch", () => {
    const result = attribute([campaignA, campaignB], linkedAtAcq, DEFAULT_RULES);
    expect(result.rulesVersion).toBe(1);
    expect(result.firstTouch?.sessionId).toBe(campaignA.sessionId);
    expect(result.credited?.sessionId).toBe(campaignB.sessionId);
    expect(result.eligibleCount).toBe(2);
  });

  it("credits the latest direct touch when all eligible touches are direct", () => {
    const d1 = touch(-9, "direct");
    const d2 = touch(-3, "direct");
    const result = attribute([d2, d1], linkedAtAcq);
    expect(result.credited?.sessionId).toBe(d2.sessionId);
    expect(result.firstTouch?.sessionId).toBe(d1.sessionId);
  });
});

describe("acquisition moment = min(first trusted link, first payment)", () => {
  it.each([
    { name: "link only", facts: { firstLinkedAt: at(0), firstPaymentAt: null }, expected: at(0) },
    {
      name: "payment only",
      facts: { firstLinkedAt: null, firstPaymentAt: at(-2) },
      expected: at(-2),
    },
    {
      name: "payment before link",
      facts: { firstLinkedAt: at(0), firstPaymentAt: at(-5) },
      expected: at(-5),
    },
    {
      name: "link before payment",
      facts: { firstLinkedAt: at(-7), firstPaymentAt: at(0) },
      expected: at(-7),
    },
    { name: "neither", facts: { firstLinkedAt: null, firstPaymentAt: null }, expected: null },
  ])("$name", ({ facts, expected }) => {
    expect(acquisitionMoment(facts)).toEqual(expected);
  });

  it("the earlier fact bounds eligibility: a session between payment and link is post-acquisition", () => {
    const between = touch(-3, "google");
    const result = attribute([between], { firstLinkedAt: at(0), firstPaymentAt: at(-5) });
    expect(result.acquiredAt).toEqual(at(-5));
    expect(result.status).toBe("unattributed");
  });
});

describe("late trusted link semantics (P1a clarification of §3.2)", () => {
  // Acquisition was established by the first link at ACQ. A second visitor is linked later.
  const facts: CustomerFacts = { firstLinkedAt: ACQ, firstPaymentAt: at(1) };

  it("late link revealing an earlier pre-acquisition session → credit recomputed", () => {
    const before = [touch(-4, "direct", { visitorId: "v1" })];
    expect(attribute(before, facts).status).toBe("direct");
    const revealed = touch(-6, "google", { visitorId: "v2" });
    const after = attribute([...before, revealed], facts);
    expect(after.status).toBe("attributed");
    expect(after.credited?.source).toBe("google");
    expect(after.acquiredAt).toEqual(ACQ);
  });

  it("late link with only post-acquisition sessions → credit unchanged", () => {
    const before = [touch(-4, "newsletter", { visitorId: "v1" })];
    const baseline = attribute(before, facts);
    const late = [touch(2, "google", { visitorId: "v2" }), touch(10, "bing", { visitorId: "v2" })];
    const after = attribute([...before, ...late], facts);
    expect(after.credited?.source).toBe(baseline.credited?.source);
    expect(after.status).toBe(baseline.status);
  });

  it("later visits after acquisition never change the acquisition source (renewal)", () => {
    const before = [touch(-4, "newsletter")];
    const renewalFacts: CustomerFacts = { firstLinkedAt: ACQ, firstPaymentAt: ACQ };
    const later = [touch(40, "google", { campaign: "winback" })];
    expect(attribute([...before, ...later], renewalFacts).credited?.source).toBe("newsletter");
  });
});

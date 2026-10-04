import { describe, expect, it } from "vitest";
import {
  MAX_UTM_LENGTH,
  SESSION_TIMEOUT_MS,
  campaignKey,
  capUtm,
  screenClass,
  shouldStartNewSession,
  type CampaignParts,
} from "../../tracker/src/core";

const emptyCampaign = (): CampaignParts => ({
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  referrerHost: null,
  gclid: false,
  fbclid: false,
  msclkid: false,
});

describe("tracker core", () => {
  it("caps UTM values by code point without splitting Unicode", () => {
    const value = "😀".repeat(MAX_UTM_LENGTH + 5);
    const capped = capUtm(value);
    expect(Array.from(capped ?? "")).toHaveLength(MAX_UTM_LENGTH);
    expect(capped?.endsWith("😀")).toBe(true);
  });

  it("builds campaign keys with UTM precedence over click IDs and referrers", () => {
    const parts = {
      ...emptyCampaign(),
      utmSource: "Google",
      utmCampaign: "Launch",
      referrerHost: "news.ycombinator.com",
      gclid: true,
    };
    expect(campaignKey(parts, true)).toBe("u:Google||Launch||");
  });

  it("uses click-ID hints when no UTM exists", () => {
    expect(campaignKey({ ...emptyCampaign(), gclid: true }, false)).toBe("c:g");
    expect(campaignKey({ ...emptyCampaign(), fbclid: true }, false)).toBe("c:f");
    expect(campaignKey({ ...emptyCampaign(), msclkid: true }, false)).toBe("c:m");
  });

  it("uses an external referrer only when it is actually external", () => {
    const parts = { ...emptyCampaign(), referrerHost: "news.ycombinator.com" };
    expect(campaignKey(parts, true)).toBe("r:news.ycombinator.com");
    expect(campaignKey(parts, false)).toBe("");
  });

  it("starts a session when none exists", () => {
    expect(shouldStartNewSession(null, 1_000, "")).toBe(true);
  });

  it("keeps a session at exactly 30 minutes and splits after 30 minutes", () => {
    const session = { id: "s", lastActivity: 1_000, campaignKey: "" };
    expect(shouldStartNewSession(session, 1_000 + SESSION_TIMEOUT_MS, "")).toBe(false);
    expect(shouldStartNewSession(session, 1_001 + SESSION_TIMEOUT_MS, "")).toBe(true);
  });

  it("starts a new session immediately when campaignKey changes", () => {
    const session = { id: "s", lastActivity: 1_000, campaignKey: "u:google||||" };
    expect(shouldStartNewSession(session, 2_000, "u:google||||")).toBe(false);
    expect(shouldStartNewSession(session, 2_000, "u:reddit||||")).toBe(true);
  });

  it("does not split an existing campaign session merely because the next page is direct", () => {
    const session = { id: "s", lastActivity: 1_000, campaignKey: "u:google||||" };
    expect(shouldStartNewSession(session, 2_000, "")).toBe(false);
  });

  it("classifies screen width using the locked thresholds", () => {
    expect(screenClass(390)).toBe("mobile");
    expect(screenClass(767)).toBe("mobile");
    expect(screenClass(768)).toBe("tablet");
    expect(screenClass(1023)).toBe("tablet");
    expect(screenClass(1024)).toBe("desktop");
  });
});

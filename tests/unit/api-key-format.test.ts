import { describe, expect, it } from "vitest";
import {
  KEY_SECRET_LENGTH,
  base62,
  generateApiKey,
  hashSecret,
  parseApiKey,
  parseBearer,
  randomBase62,
} from "@/server/tenancy/api-keys";
import { generateSiteKey, isValidTimezone, normalizeDomainList } from "@/server/tenancy/projects";

describe("server API key format", () => {
  it("is om_sk_<8-char prefix>_<43-char base62 secret> and stores only SHA-256(secret)", () => {
    const { key, prefix, secretHash } = generateApiKey();
    expect(key).toMatch(/^om_sk_[0-9A-Za-z]{8}_[0-9A-Za-z]{43}$/);
    const parsed = parseApiKey(key);
    expect(parsed?.prefix).toBe(prefix);
    expect(secretHash).toBe(hashSecret(parsed?.secret ?? ""));
    expect(secretHash).toMatch(/^[0-9a-f]{64}$/);
    expect(secretHash).not.toContain(parsed?.secret);
  });

  it("43 base62 digits hold 256 bits", () => {
    expect(base62(new Uint8Array(32).fill(0xff), KEY_SECRET_LENGTH)).toHaveLength(43);
    expect(base62(new Uint8Array(32), KEY_SECRET_LENGTH)).toBe("0".repeat(43));
    expect(62 ** 43).toBeGreaterThan(2 ** 256);
  });

  it("generates distinct keys", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateApiKey().key));
    expect(keys.size).toBe(200);
  });

  it("random base62 uses the whole alphabet", () => {
    const chars = new Set(randomBase62(5000));
    expect(chars.size).toBe(62);
  });

  it.each([
    null,
    "",
    "Bearer",
    "Basic abc",
    "Bearer om_sk_short_x",
    "Bearer om_pk_abcdefgh_" + "a".repeat(43),
    "Bearer om_sk_abcdefgh_" + "a".repeat(42),
    "Bearer om_sk_abcdefgh_" + "a".repeat(44),
    "Bearer om_sk_abcdefg!_" + "a".repeat(43),
    "bearer om_sk_abcdefgh_" + "a".repeat(43) + " extra",
  ])("rejects malformed header %j", (header) => {
    expect(parseBearer(header)).toBeNull();
  });
});

describe("project settings", () => {
  it("site keys are pk_ + 22 base62 chars", () => {
    expect(generateSiteKey()).toMatch(/^pk_[0-9A-Za-z]{22}$/);
  });

  it.each([
    ["Europe/Istanbul", true],
    ["America/New_York", true],
    ["UTC", true],
    ["Mars/Base", false],
    ["+03:00", false],
    ["", false],
  ])("timezone %j valid=%s", (tz, ok) => {
    expect(isValidTimezone(tz)).toBe(ok);
  });

  it("normalizes domains consistently", () => {
    expect(
      normalizeDomainList([" Example.COM ", "*.Example.com", "example.com.", "Bücher.de"], "d"),
    ).toEqual(["*.example.com", "example.com", "xn--bcher-kva.de"]);
    expect(() => normalizeDomainList(["https://example.com/path"], "d")).toThrow();
    expect(() => normalizeDomainList(["localhost"], "d")).toThrow();
  });
});

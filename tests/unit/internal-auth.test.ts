import { describe, expect, it } from "vitest";
import { isInternalRequestAuthorized } from "@/server/internal/auth";

describe("internal result page token", () => {
  it("is disabled when INTERNAL_TOKEN is unset", () => {
    expect(isInternalRequestAuthorized("Bearer anything", undefined)).toBe(false);
  });

  it("rejects missing and malformed authorization", () => {
    expect(isInternalRequestAuthorized(null, "secret")).toBe(false);
    expect(isInternalRequestAuthorized("Basic secret", "secret")).toBe(false);
    expect(isInternalRequestAuthorized("Bearer", "secret")).toBe(false);
  });

  it("rejects a wrong token and accepts the exact bearer token", () => {
    expect(isInternalRequestAuthorized("Bearer wrong", "secret")).toBe(false);
    expect(isInternalRequestAuthorized("Bearer secret", "secret")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { TRACKER_GZIP_BUDGET_BYTES, checkBudget, gzipSize } from "../../scripts/tracker-budget.mjs";

describe("tracker size gate", () => {
  it("uses the locked 2.5 KB gzip budget", () => {
    expect(TRACKER_GZIP_BUDGET_BYTES).toBe(2560);
  });

  it("passes at the budget and fails above it", () => {
    expect(checkBudget(2560).ok).toBe(true);
    expect(checkBudget(2561).ok).toBe(false);
  });

  it("measures gzip size", () => {
    expect(gzipSize("a".repeat(10_000))).toBeLessThan(100);
  });
});

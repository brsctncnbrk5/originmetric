import { describe, expect, it } from "vitest";
import { createFakeClock, systemClock } from "@/server/time/clock";

describe("Clock", () => {
  it("fake clock is deterministic and advances explicitly", () => {
    const clock = createFakeClock("2026-01-01T00:00:00.000Z");
    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
    clock.advance(90_000);
    expect(clock.now().toISOString()).toBe("2026-01-01T00:01:30.000Z");
    clock.set(new Date("2027-06-15T12:00:00.000Z"));
    expect(clock.now().toISOString()).toBe("2027-06-15T12:00:00.000Z");
  });

  it("fake clock returns copies that callers cannot mutate", () => {
    const clock = createFakeClock(0);
    clock.now().setTime(123);
    expect(clock.now().getTime()).toBe(0);
  });

  it("rejects an invalid start instant", () => {
    expect(() => createFakeClock("not a date")).toThrow(RangeError);
  });

  it("system clock returns the current time", () => {
    const before = Date.now();
    const now = systemClock.now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

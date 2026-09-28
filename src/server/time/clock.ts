/**
 * Injectable time source. Business logic takes a `Clock` instead of calling
 * `new Date()` / `Date.now()` directly, so time-dependent code is testable.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export interface FakeClock extends Clock {
  set(instant: Date): void;
  advance(ms: number): void;
}

/** Deterministic clock for tests. Returns a fresh Date copy on every call. */
export function createFakeClock(start: Date | string | number): FakeClock {
  let current = new Date(start).getTime();
  if (Number.isNaN(current)) {
    throw new RangeError("createFakeClock: invalid start instant");
  }
  return {
    now: () => new Date(current),
    set: (instant) => {
      current = instant.getTime();
    },
    advance: (ms) => {
      current += ms;
    },
  };
}

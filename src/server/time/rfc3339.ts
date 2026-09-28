/**
 * Strict RFC 3339 date-time parser (plan §7.1: `occurred_at` must carry an offset).
 * `Date.parse` is too lenient (it rolls 2026-02-30 over to March and accepts 24:00), so every
 * component is range-checked here. Leap seconds (`:60`) are rejected. Fractional seconds of
 * any length (1–9 digits) are accepted and truncated to milliseconds, the stored precision.
 */
const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(?:([Zz])|([+-])(\d{2}):(\d{2}))$/;

export function parseRfc3339(value: string): Date | null {
  const m = RFC3339.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const millis = m[7] ? Number(m[7].slice(0, 3).padEnd(3, "0")) : 0;
  // Years below 1000 are never valid business timestamps (and Date.UTC maps 0-99 to 19xx).
  if (year < 1000 || month < 1 || month > 12) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  let offsetMinutes = 0;
  if (!m[8]) {
    const offH = Number(m[10]);
    const offM = Number(m[11]);
    if (offH > 23 || offM > 59) return null;
    offsetMinutes = (m[9] === "-" ? -1 : 1) * (offH * 60 + offM);
  }
  const utc = Date.UTC(year, month - 1, day, hour, minute, second, millis);
  const date = new Date(utc - offsetMinutes * 60_000);
  return Number.isNaN(date.getTime()) ? null : date;
}

import { gzipSync } from "node:zlib";

/** Locked tracker budget (plan §5): 2.5 KB gzip. */
export const TRACKER_GZIP_BUDGET_BYTES = 2560;

export function gzipSize(source) {
  return gzipSync(Buffer.from(source), { level: 9 }).length;
}

export function checkBudget(size, budget = TRACKER_GZIP_BUDGET_BYTES) {
  return { size, budget, ok: size <= budget };
}

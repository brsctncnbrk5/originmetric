export declare const TRACKER_GZIP_BUDGET_BYTES: number;
export declare function gzipSize(source: string | Uint8Array): number;
export declare function checkBudget(
  size: number,
  budget?: number,
): { size: number; budget: number; ok: boolean };

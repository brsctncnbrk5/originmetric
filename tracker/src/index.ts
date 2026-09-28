// OriginMetric tracker: P0 build skeleton only.
// Inert on purpose: no storage, no cookies, no network, no tracking (those arrive in P1b).
interface OriginMetricGlobal {
  version: string;
}

declare global {
  interface Window {
    originmetric?: OriginMetricGlobal;
  }
}

if (typeof window !== "undefined" && !window.originmetric) {
  window.originmetric = { version: "0.0.0-p0" };
}

export {};

import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, IngestionLimits, ingestionClient } from "@/server/ingestion/limits";
import { BodyTooLarge, readBoundedBody } from "@/server/http/bounded-body";

const T = Date.parse("2026-10-02T12:00:00Z");

describe("ingestion admission", () => {
  it("caps even malformed traffic before DB work and refills with elapsed time", () => {
    const l = new IngestionLimits({ ...DEFAULT_LIMITS, processPerSecond: 2 }, T);
    expect(l.admitProcess(T)).toBeNull();
    expect(l.admitProcess(T)).toBeNull();
    expect(l.admitProcess(T)).toBe("dropped_process_limit");
    expect(l.admitProcess(T + 499)).toBe("dropped_process_limit");
    expect(l.admitProcess(T + 500)).toBeNull();
  });
  it("isolates client/site pairs, limits the project across IPs, expires idle state", () => {
    const l = new IngestionLimits(
      { ...DEFAULT_LIMITS, clientPerMinute: 1, projectPerSecond: 3 },
      T,
    );
    expect(l.admitProject("p", "s", "ip1", T)).toBeNull();
    expect(l.admitProject("p", "s", "ip1", T)).toBe("dropped_client_limit");
    expect(l.admitProject("p", "s", "ip2", T)).toBeNull();
    expect(l.admitProject("p", "s", "ip3", T)).toBe("dropped_project_limit");
    expect(l.admitProject("p2", "s2", "ip1", T)).toBeNull();
    expect(l.admitProject("p", "s", "ip1", T + 60_000)).toBeNull();
  });
  it("fails closed when the bounded client map fills instead of evicting active buckets", () => {
    const l = new IngestionLimits({ ...DEFAULT_LIMITS, maxClients: 1 }, T);
    expect(l.admitProject("p", "s", "a", T)).toBeNull();
    expect(l.admitProject("p", "s", "b", T)).toBe("dropped_limit_capacity");
    expect(l.admitProject("p", "s", "b", T + 60_000)).toBeNull();
  });
  it("rotates client state at UTC midnight", () => {
    const t = Date.parse("2026-10-02T23:59:59Z");
    const l = new IngestionLimits({ ...DEFAULT_LIMITS, clientPerMinute: 1 }, t);
    expect(l.admitProject("p", "s", "a", t)).toBeNull();
    expect(l.admitProject("p", "s", "a", t)).toBe("dropped_client_limit");
    expect(l.admitProject("p", "s", "a", t + 1000)).toBeNull();
  });
  it("ignores forged IP headers locally and refuses untrusted production callers", () => {
    const r = new Request("http://localhost", {
      headers: { "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" },
    });
    expect(ingestionClient(r, { NODE_ENV: "production" })).toBeNull();
    expect(ingestionClient(r, { INGEST_PROXY_MODE: "local" })).toBe("local");
    expect(
      ingestionClient(r, { INGEST_PROXY_MODE: "cloudflare", INGEST_PROXY_TOKEN: "x".repeat(64) }),
    ).toBeNull();
    const trusted = new Request("http://localhost", {
      headers: { "x-om-proxy-token": "x".repeat(64), "cf-connecting-ip": "2001:db8::1" },
    });
    expect(
      ingestionClient(trusted, {
        INGEST_PROXY_MODE: "cloudflare",
        INGEST_PROXY_TOKEN: "x".repeat(64),
      }),
    ).toBe("2001:db8::1");
  });
  it("requires the private token, validates CF IP and never falls back to XFF", () => {
    const env = {
      NODE_ENV: "production",
      INGEST_PROXY_MODE: "cloudflare",
      INGEST_PROXY_TOKEN: "a".repeat(64),
    };
    for (const cf of ["", "invalid", "198.51.100.1, 198.51.100.2"]) {
      const r = new Request("http://localhost", {
        headers: {
          "x-om-proxy-token": env.INGEST_PROXY_TOKEN,
          "cf-connecting-ip": cf,
          "x-forwarded-for": "198.51.100.99",
        },
      });
      expect(ingestionClient(r, env)).toBeNull();
    }
    for (const token of ["", "b".repeat(64), "a".repeat(63)]) {
      expect(
        ingestionClient(
          new Request("http://localhost", {
            headers: {
              "x-om-proxy-token": token,
              "cf-connecting-ip": "198.51.100.1",
            },
          }),
          env,
        ),
      ).toBeNull();
    }
    for (const ip of ["198.51.100.1", "2001:db8::1"]) {
      expect(
        ingestionClient(
          new Request("http://localhost", {
            headers: {
              "x-om-proxy-token": env.INGEST_PROXY_TOKEN,
              "cf-connecting-ip": ip,
              "x-forwarded-for": "198.51.100.99",
            },
          }),
          env,
        ),
      ).toBe(ip);
    }
  });
  it("stops unknown-length bodies at 8 KB and accepts the exact byte boundary", async () => {
    const r = new Request("http://localhost", { method: "POST", body: "x".repeat(8193) });
    await expect(readBoundedBody(r, 8192)).rejects.toBeInstanceOf(BodyTooLarge);
    const ok = new Request("http://localhost", { method: "POST", body: "x".repeat(8192) });
    expect((await readBoundedBody(ok, 8192)).length).toBe(8192);
  });
});

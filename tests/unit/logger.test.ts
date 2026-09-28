import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "@/server/logging/logger";

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { lines, stream };
}

describe("logger", () => {
  it("emits structured JSON", () => {
    const { lines, stream } = capture();
    createLogger({ destination: stream, level: "info" }).info(
      { route: "/x", status: 200 },
      "hello",
    );
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
    expect(entry).toMatchObject({ msg: "hello", route: "/x", status: 200, level: 30 });
    expect(typeof entry.time).toBe("string");
  });

  it("redacts sensitive fields at top level and one level deep", () => {
    const { lines, stream } = capture();
    const secrets = {
      password: "hunter2-pw",
      token: "tok_live_abc",
      apiKey: "om_sk_live_123",
      ip: "203.0.113.7",
      customer_id: "cust_987",
      visitor_id: "vis_654",
      body: { anything: "raw-body-content" },
    };
    const log = createLogger({ destination: stream, level: "info" });
    log.info({ ...secrets, req: { headers: undefined, ...secrets } }, "request");
    log.info({ headers: { authorization: "Bearer abc.def", cookie: "om_s=1" } }, "headers");
    const out = lines.join("\n");
    for (const value of [
      "hunter2-pw",
      "tok_live_abc",
      "om_sk_live_123",
      "203.0.113.7",
      "cust_987",
      "vis_654",
      "raw-body-content",
      "Bearer abc.def",
      "om_s=1",
    ]) {
      expect(out).not.toContain(value);
    }
    expect(out).toContain("[Redacted]");
  });
});

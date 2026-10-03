import assert from "node:assert/strict";
import { test } from "node:test";
import { observePublic } from "./observe-public.mjs";

const tracker = 'window.originmetric = function() {}; const version = "0.1.0";';
const healthy = () =>
  new Response('{"status":"ok"}', {
    headers: { "content-type": "application/json" },
  });
const script = () =>
  new Response(tracker, {
    headers: { "content-type": "application/javascript" },
  });

test("fixed public GETs, no redirects, credentials or secret output", async () => {
  const urls = [];
  const result = await observePublic(async (url, options) => {
    urls.push(url);
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(options.credentials, "omit");
    assert.equal(options.headers, undefined);
    return url.endsWith("health") ? healthy() : script();
  });
  assert.equal(result.passed, true);
  assert.deepEqual(urls, [
    "https://originmetric.app/api/health",
    "https://originmetric.app/js/v1/om.js",
  ]);
});

for (const [name, response] of [
  ["HTML challenge", () => new Response("<!doctype html>secret")],
  [
    "unhealthy JSON",
    () =>
      new Response('{"status":"unavailable"}', { headers: { "content-type": "application/json" } }),
  ],
  ["HTTP failure", () => new Response("secret", { status: 503 })],
  [
    "oversize body",
    () => new Response("secret".repeat(12000), { headers: { "content-type": "application/json" } }),
  ],
  [
    "network failure",
    () => {
      throw new Error("secret");
    },
  ],
]) {
  test(`reject ${name} and still check tracker`, async () => {
    let calls = 0;
    const result = await observePublic(async () => (++calls === 1 ? response() : script()));
    assert.equal(calls, 2);
    assert.equal(result.passed, false);
    assert.equal(result.results[1].passed, true);
    assert.equal(JSON.stringify(result).includes("secret"), false);
  });
}

test("reject tracker replaced by HTML or wrong version", async () => {
  for (const body of ["<html>originmetric 0.1.0</html>", "originmetric 0.0.0"]) {
    const result = await observePublic(async (url) =>
      url.endsWith("health")
        ? healthy()
        : new Response(body, {
            headers: { "content-type": "application/javascript" },
          }),
    );
    assert.equal(result.passed, false);
  }
});

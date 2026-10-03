// Public GET-only observation. No tokens, pings, event writes or provider configuration.
import { pathToFileURL } from "node:url";

const origin = "https://originmetric.app";
const checks = [
  ["/api/health", "health"],
  ["/js/v1/om.js", "tracker"],
];

export async function observePublic(fetchImpl = fetch) {
  const results = [];
  for (const [path, kind] of checks) {
    let status = null;
    let passed = false;
    try {
      const response = await fetchImpl(`${origin}${path}`, {
        method: "GET",
        redirect: "error",
        credentials: "omit",
        signal: AbortSignal.timeout(15000),
      });
      status = response.status;
      const mime = response.headers.get("content-type") ?? "";
      if (status !== 200 || !response.body) throw new Error("response");
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 65536) throw new Error("size");
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      const body = Buffer.concat(chunks).toString("utf8");
      passed =
        kind === "health"
          ? /^application\/json(?:;|$)/i.test(mime) && JSON.parse(body)?.status === "ok"
          : /^(?:application|text)\/javascript(?:;|$)/i.test(mime) &&
            body.includes("originmetric") &&
            body.includes("0.1.0") &&
            !/<(?:html|!doctype)/i.test(body);
    } catch {
      // Never log response bodies, headers or network exception details.
    }
    results.push({ path, status, passed });
  }
  return {
    observed_at: new Date().toISOString(),
    source: "public-https-observer",
    passed: results.every((result) => result.passed),
    results,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await observePublic();
  console.log(JSON.stringify(result));
  if (!result.passed) process.exitCode = 1;
}

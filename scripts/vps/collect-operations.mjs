// Local read-only observations only. No provider upload, notification or event ingestion.
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  chownSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
process.chdir(root);
const observedAt = new Date().toISOString();
let health = "unknown",
  tracker = "unknown",
  selfcheck = "unknown";
try {
  const result = JSON.parse(
    execFileSync(
      "docker",
      ["exec", "-i", "originmetric-app-1", "node", "--input-type=module", "-"],
      {
        input: `
const get = (path, headers = {}) => fetch('http://127.0.0.1:3000' + path, {headers, signal: AbortSignal.timeout(5000)});
const health = await get('/api/health');
const tracker = await get('/js/v1/om.js');
const metrics = await get('/api/internal/metrics', {authorization: 'Bearer ' + process.env.INTERNAL_TOKEN});
const data = metrics.ok ? (await metrics.json()).ingestion : null;
const keys = ['dropped_process_limit','dropped_project_limit','dropped_client_limit','dropped_daily_limit','dropped_limit_capacity','dropped_untrusted_proxy','dropped_internal'];
console.log(JSON.stringify({health: health.ok && (await health.json()).status === 'ok', tracker: tracker.ok, metrics: !!data && keys.every(key => (data[key] ?? 0) === 0)}));
`,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 20_000,
      },
    ),
  );
  health = result.health ? "pass" : "fail";
  tracker = result.tracker ? "pass" : "fail";
  const disk = Number(
    execFileSync("df", ["--output=pcent", root], { encoding: "utf8", stdio: "pipe" })
      .trim()
      .split(/\s+/)
      .at(-1)
      ?.replace("%", ""),
  );
  selfcheck = result.metrics && Number.isFinite(disk) && disk <= 80 ? "pass" : "fail";
} catch {
  /* no subprocess output, identifiers or credential values */
}
const checks = [
  { name: "health", status: health },
  { name: "tracker", status: tracker },
  { name: "selfcheck", status: selfcheck },
  // Local encryption or a CI restore is not real off-VPS/manual restore evidence.
  { name: "backup", status: "unknown" },
  { name: "restore", status: "unknown" },
].map((check) => ({ ...check, source: "vps", observedAt }));
const dir = resolve(root, ".runtime/operations");
mkdirSync(dir, { recursive: true, mode: 0o750 });
chmodSync(dir, 0o750);
chownSync(dir, 0, 1001); // Existing standalone app's group; read-only mount, no write access.
const path = resolve(dir, "snapshot.json");
let history = [];
if (existsSync(path)) {
  try {
    const old = JSON.parse(readFileSync(path, "utf8"));
    history = (old.history ?? [])
      .filter(
        (item) =>
          ["health", "tracker", "selfcheck", "backup", "restore"].includes(item.name) &&
          ["pass", "fail", "unknown"].includes(item.status) &&
          ["vps", "github"].includes(item.source) &&
          Number.isFinite(Date.parse(item.observedAt)),
      )
      .map(({ name, status, source, observedAt }) => ({ name, status, source, observedAt }));
  } catch {
    /* malformed history is not trusted */
  }
}
const temp = `${path}.tmp`;
writeFileSync(
  temp,
  JSON.stringify({ checks, history: [...checks, ...history].slice(0, 100) }, null, 2) + "\n",
  { mode: 0o640 },
);
chownSync(temp, 0, 1001);
renameSync(temp, path);
console.log(
  JSON.stringify({
    checks,
    historyRecords: Math.min(100, history.length + checks.length),
    externalUptime: "unknown",
  }),
);

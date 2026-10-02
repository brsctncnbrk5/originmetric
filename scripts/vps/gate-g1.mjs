// Verify the deployed image in disposable fixtures; never enable production ingestion.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "../..");
process.chdir(root);
assert.ok(process.argv.slice(2).every((arg) => arg === "--technical-only"));
const out = resolve(".runtime", `g1-${Date.now()}-${process.pid}`);
mkdirSync(out, { recursive: true, mode: 0o700 });
const prefix = `originmetric-g1-${process.pid}-${randomBytes(3).toString("hex")}`;
const names = { db: `${prefix}-db`, app: `${prefix}-app`, network: `${prefix}-net` };
const hex = () => randomBytes(32).toString("hex");
const env = {
  ...process.env,
  POSTGRES_PASSWORD: hex(),
  APP_DB_PASSWORD: hex(),
  INTERNAL_TOKEN: hex(),
  INGEST_PROXY_TOKEN: hex(),
  POSTGRES_DB: "originmetric",
  INGEST_PROXY_MODE: "cloudflare",
  LOG_LEVEL: "info",
};
env.DATABASE_URL = `postgres://originmetric:${env.APP_DB_PASSWORD}@db:5432/originmetric`;
const run = (command, args, options = {}) => {
  try {
    return execFileSync(command, args, { encoding: "utf8", env, stdio: "pipe", ...options }).trim();
  } catch (error) {
    let detail = String(error.stderr ?? "");
    for (const key of [
      "POSTGRES_PASSWORD",
      "APP_DB_PASSWORD",
      "INTERNAL_TOKEN",
      "INGEST_PROXY_TOKEN",
    ])
      detail = detail.replaceAll(env[key], "[redacted]");
    detail = detail.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[address]");
    writeFileSync(`${out}/subprocess-error.log`, detail, { mode: 0o600 });
    throw error;
  }
};
const docker = (...args) => run("docker", args);
const psql = (container, sql) =>
  docker("exec", container, "psql", "-U", "postgres", "-d", "originmetric", "-Atc", sql);
const facts = () =>
  run("docker", [
    "exec",
    "originmetric-db-1",
    "psql",
    "-U",
    "originmetric",
    "-d",
    "originmetric",
    "-Atc",
    "SELECT json_build_array((SELECT count(*) FROM events),(SELECT count(*) FROM sessions),(SELECT count(*) FROM customers),(SELECT count(*) FROM revenue_events),(SELECT count(*) FROM customer_visitors));",
  ]);
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const summary = {
  technical: "FAILED",
  overall: "PENDING",
  checks: {},
  productionFactsUnchanged: false,
};
let before;
let browser;
try {
  const config = readFileSync(".env.production", "utf8");
  assert.match(config, /^PUBLIC_G1_READY=['"]?no['"]?$/m);
  const domain = config.match(/^OM_DOMAIN=['"]?([a-z0-9.-]+)['"]?$/m)?.[1];
  assert.ok(domain);
  const tag = readFileSync(".runtime/current-tag", "utf8").trim();
  assert.match(tag, /^[a-f0-9]{40}$/);
  run("git", ["diff", "--exit-code", tag, "--", "src", "tracker", "drizzle"]);
  const image = docker("inspect", "--format", "{{.Image}}", "originmetric-app-1");
  assert.equal(image, docker("image", "inspect", "--format", "{{.Id}}", `originmetric:${tag}`));
  summary.image = image;
  summary.deployedSourceSha = tag;
  before = facts();
  // Dedicated fixture network; both published ports are restricted to loopback.
  docker("network", "create", names.network);
  docker(
    "run",
    "-d",
    "--name",
    names.db,
    "--network",
    names.network,
    "--network-alias",
    "db",
    "-p",
    "127.0.0.1::5432",
    "--tmpfs",
    "/var/lib/postgresql",
    "-e",
    "POSTGRES_PASSWORD",
    "-e",
    "POSTGRES_DB",
    "-e",
    "APP_DB_PASSWORD",
    "-v",
    `${root}/deploy/init-db.sh:/docker-entrypoint-initdb.d/10-originmetric.sh:ro`,
    "postgres:18.6-alpine",
    "postgres",
    "-c",
    "log_min_messages=fatal",
    "-c",
    "log_min_error_statement=panic",
  );
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      psql(names.db, "SELECT 1");
      ready = true;
      break;
    } catch {
      await wait(500);
    }
  }
  assert.ok(ready, "Fixture database readiness failed");
  docker(
    "run",
    "-d",
    "--name",
    names.app,
    "--network",
    names.network,
    "-p",
    "127.0.0.1::3000",
    ...[
      "DATABASE_URL",
      "INTERNAL_TOKEN",
      "INGEST_PROXY_TOKEN",
      "INGEST_PROXY_MODE",
      "LOG_LEVEL",
    ].flatMap((key) => ["-e", key]),
    image,
  );

  const binding = (container, port) => {
    const value = docker("port", container, `${port}/tcp`);
    assert.match(value, /^127\.0\.0\.1:\d+$/);
    return value.split(":")[1];
  };
  const base = `http://127.0.0.1:${binding(names.app, 3000)}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {
      /* startup */
    }
    await wait(500);
  }
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  docker("exec", names.app, "node", "dist/ops.mjs", "migrate");
  const deployedTracker = await fetch(`https://${domain}/js/v1/om.js`);
  assert.ok(deployedTracker.ok);
  const liveBytes = Buffer.from(await deployedTracker.arrayBuffer());
  const fixtureBytes = Buffer.from(await (await fetch(`${base}/js/v1/om.js`)).arrayBuffer());
  assert.equal(hash(liveBytes), hash(fixtureBytes));
  summary.trackerSha256 = hash(liveBytes);
  const project = docker(
    "exec",
    names.app,
    "node",
    "dist/ops.mjs",
    "create-project",
    "--name",
    "G1 isolated fixture",
    "--domain",
    "127.0.0.1",
    "--timezone",
    "UTC",
    "--currency",
    "USD",
  );
  const site = project.match(/site_key:\s+(pk_[A-Za-z0-9]+)/)?.[1];
  assert.ok(site);
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    (existsSync(chromium.executablePath()) ? chromium.executablePath() : "/usr/bin/google-chrome");
  assert.ok(existsSync(executablePath), "Configure an existing Chromium executable");
  browser = await chromium.launch({ executablePath });
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "x-om-proxy-token": env.INGEST_PROXY_TOKEN,
      "cf-connecting-ip": "198.51.100.1",
    },
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
  );
  const page = await context.newPage();
  let sent = 0;
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/v1/e") sent++;
  });
  const state = () =>
    page.evaluate(() => ({
      visitor: window.originmetric.getVisitorId(),
      cookies: document.cookie,
      keys: Object.keys(localStorage).filter((key) => key.startsWith("om_")),
    }));
  await page.goto(`${base}/fixtures/required?site=${site}`);
  await page.waitForFunction(
    () => window.fixtureReady && typeof window.originmetric === "function",
  );
  await page.waitForTimeout(250);
  assert.equal(sent, 0);
  assert.deepEqual(await state(), { visitor: null, cookies: "", keys: [] });
  const response = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/v1/e");
  await page.click("#consent-yes");
  assert.equal((await response).status(), 202);
  const visitor = (await state()).visitor;
  assert.ok(visitor);
  await page.click("#identify");
  assert.equal(psql(names.db, "SELECT count(*) FROM customers"), "0");
  assert.equal(psql(names.db, "SELECT count(*) FROM customer_visitors"), "0");
  assert.equal(psql(names.db, "SELECT count(*) FROM revenue_events"), "0");
  await page.click("#consent-no");
  assert.deepEqual(await state(), { visitor: null, cookies: "", keys: [] });
  const afterWithdrawal = sent;
  await page.evaluate(() => history.pushState({}, "", "/fixtures/required?utm_source=withdrawn"));
  await page.waitForTimeout(250);
  assert.equal(sent, afterWithdrawal);
  summary.checks.requiredConsentWithdrawal =
    "PASS: deployed tracker bytes and deployed image clone";
  summary.checks.browserTrustBoundary = "PASS: no customer/link/revenue created";
  await context.close();
  const gpc = await browser.newContext();
  await gpc.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, "globalPrivacyControl", {
      get: () => true,
      configurable: true,
    }),
  );
  await gpc.route("**/*", (route) =>
    new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
  );
  const gpcPage = await gpc.newPage();
  let gpcSent = 0;
  gpcPage.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/v1/e") gpcSent++;
  });
  await gpcPage.goto(`${base}/fixtures/gpc?site=${site}`);
  await gpcPage.waitForFunction(() => window.fixtureReady);
  await gpcPage.waitForTimeout(250);
  assert.equal(gpcSent, 0);
  assert.equal(await gpcPage.evaluate(() => window.originmetric.getVisitorId()), null);
  await gpc.close();
  summary.checks.gpc = "PASS: default blocks identifiers and sending";
  const dbPort = binding(names.db, 5432);
  const tests = [
    "tests/unit/tracker-core.test.ts",
    "tests/unit/ingestion-limits.test.ts",
    "tests/unit/logger.test.ts",
    "tests/db/ingestion.test.ts",
    "tests/db/ingestion-limits.test.ts",
    "tests/db/sensitive-logging.test.ts",
    "tests/db/identify-api.test.ts",
  ];
  const regression = run("npx", ["vitest", "run", ...tests], {
    env: {
      ...env,
      DATABASE_URL: `postgres://postgres:${env.POSTGRES_PASSWORD}@127.0.0.1:${dbPort}/originmetric`,
      // Handler regressions use synthetic requests; proxy-mode coverage is explicit in tests.
      INGEST_PROXY_MODE: "local",
      LOG_LEVEL: "silent",
    },
    timeout: 180_000,
  });
  writeFileSync(`${out}/regressions.log`, regression, { mode: 0o600 });
  summary.checks.validationOriginDedupFailure = "PASS: matching-source real-DB regressions";
  summary.checks.inAppLimitsDailyCap = "PASS: matching-source real-DB and unit regressions";
  summary.checks.logRedaction = "PASS: real handlers and fixture runtime logs";
  const captured = spawnSync("docker", ["logs", names.app], { encoding: "utf8", env });
  assert.equal(captured.status, 0);
  const logs = `${captured.stdout}${captured.stderr}`;
  for (const value of [
    env.POSTGRES_PASSWORD,
    env.APP_DB_PASSWORD,
    env.INTERNAL_TOKEN,
    env.INGEST_PROXY_TOKEN,
    visitor,
    "198.51.100.1",
  ])
    assert.ok(!logs.includes(value), "Fixture runtime leaked sensitive values");
  summary.regressionFiles = tests.length;
  summary.technical = "PASS";
  summary.pending = [
    "Actual-site consent/banner owner confirmation",
    "Independent saved Cloudflare rule inventory/counting-window review",
  ];
} catch (error) {
  // Suppress subprocess stderr/argv and assertions containing fixture IDs/secrets.
  summary.failureClass = error?.constructor?.name ?? "Error";
} finally {
  await browser?.close();
  for (const name of [names.app, names.db]) {
    try {
      docker("rm", "-f", name);
    } catch {
      /* only owned names */
    }
  }
  try {
    docker("network", "rm", names.network);
  } catch {
    /* only owned name */
  }
  try {
    const containers = docker("ps", "-a", "--filter", `name=${prefix}-`, "--format", "{{.Names}}");
    const networks = docker(
      "network",
      "ls",
      "--filter",
      `name=${names.network}`,
      "--format",
      "{{.Name}}",
    );
    summary.fixturesRemoved = containers === "" && networks === "";
  } catch {
    summary.fixturesRemoved = false;
  }
  if (!summary.fixturesRemoved) summary.technical = "FAILED";
  if (before !== undefined) {
    try {
      summary.productionFactsUnchanged = before === facts();
    } catch {
      summary.productionFactsUnchanged = false;
    }
  }
  if (!summary.productionFactsUnchanged) summary.technical = "FAILED";
  writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2) + "\n", { mode: 0o600 });
  writeFileSync(".runtime/g1-latest-path", out + "\n", { mode: 0o600 });
}
console.log(JSON.stringify(summary, null, 2));
process.exitCode =
  summary.technical !== "PASS" ? 1 : process.argv.includes("--technical-only") ? 0 : 2;

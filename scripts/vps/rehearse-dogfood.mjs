// Isolated chain acceptance: deployed-image clone and disposable DB, never public data routes.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

export async function rehearseDogfood({ browser, base, names, env, docker, psql, project, site }) {
  assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
  for (const name of [names.app, names.db, names.restore])
    assert.match(name, /^originmetric-g1-\d+-[a-f0-9]+-(app|db|restore)$/);
  assert.match(project, /^[0-9a-f-]{36}$/);
  const codes = {};
  const label = `p2_acceptance_${randomUUID().replaceAll("-", "")}`;
  const key = docker(
    "exec",
    names.app,
    "node",
    "dist/ops.mjs",
    "create-key",
    "--project",
    project,
    "--name",
    "P2 isolated rehearsal only",
  )
    .trim()
    .split("\n")
    .at(-1);
  assert.ok(key.startsWith("om_sk_"));
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "x-om-proxy-token": env.INGEST_PROXY_TOKEN,
      "cf-connecting-ip": "198.51.100.1",
    },
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
  );
  let visitor;
  try {
    const page = await context.newPage();
    let sends = 0;
    page.on("request", (req) => {
      if (new URL(req.url()).pathname === "/api/v1/e") sends++;
    });
    await page.goto(
      `${base}/fixtures/required?site=${site}&utm_source=p2-test&utm_medium=controlled&utm_campaign=${label}`,
    );
    await page.waitForFunction(() => window.fixtureReady);
    assert.equal(sends, 0);
    assert.equal(await page.evaluate(() => window.originmetric.getVisitorId()), null);
    const response = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/e");
    await page.click("#consent-yes");
    assert.equal((await response).status(), 202);
    visitor = await page.evaluate(() => window.originmetric.getVisitorId());
    assert.match(visitor, /^[0-9a-f-]{36}$/);
    const where = `project_id='${project}'`;
    for (
      let i = 0;
      i < 50 &&
      psql(names.db, `SELECT count(*) FROM sessions WHERE ${where} AND campaign='${label}'`) !==
        "1";
      i++
    )
      await new Promise((r) => setTimeout(r, 100));
    assert.equal(
      psql(
        names.db,
        `SELECT count(*) FROM sessions WHERE ${where} AND campaign='${label}' AND visitor_id='${visitor}' AND source='p2-test' AND medium='controlled'`,
      ),
      "1",
    );
    const auth = { authorization: `Bearer ${key}` };
    const post = async (name, path, data, expected) => {
      const res = await context.request.post(`${base}${path}`, { headers: auth, data });
      codes[name] = res.status();
      assert.equal(res.status(), expected, name);
      return res.json();
    };
    const identify = { customer_id: label, visitor_id: visitor };
    assert.equal((await post("identify", "/api/v1/identify", identify, 200)).status, "linked");
    assert.equal(
      (await post("identifyRetry", "/api/v1/identify", identify, 200)).status,
      "duplicate",
    );
    const payment = {
      event_id: `${label}_payment`,
      type: "payment",
      customer_id: label,
      visitor_id: null,
      amount: 2900,
      currency: "USD",
      test: true,
      occurred_at: new Date(Date.now() + 2000).toISOString(),
      subscription_id: `${label}_sub`,
      billing_interval: "month",
    };
    const revenue = async (name, data, expected) => {
      const body = await post(name, "/api/v1/revenue-events", data, expected);
      if (expected !== 409)
        assert.deepEqual(body.attribution, { source: "p2-test", status: "attributed" });
    };
    await revenue("payment", payment, 201);
    const acquisition = () =>
      psql(
        names.db,
        `SELECT jsonb_build_array(acquired_at,credited_session_id,credited_source,credited_medium,credited_campaign,first_touch_session_id,first_touch_source) FROM customer_attribution WHERE ${where}`,
      );
    const first = acquisition();
    await revenue("paymentRetry", payment, 200);
    await revenue("paymentConflict", { ...payment, amount: 2901 }, 409);
    assert.equal(psql(names.db, `SELECT count(*) FROM revenue_events WHERE ${where}`), "1");
    assert.equal(psql(names.db, `SELECT count(*) FROM customers WHERE ${where}`), "1");
    assert.equal(psql(names.db, `SELECT count(*) FROM customer_visitors WHERE ${where}`), "1");
    await revenue(
      "renewal",
      {
        ...payment,
        event_id: `${label}_renewal`,
        occurred_at: new Date(Date.now() + 3000).toISOString(),
      },
      201,
    );
    await revenue(
      "refund",
      {
        ...payment,
        event_id: `${label}_refund`,
        type: "refund",
        amount: 500,
        refund_of: payment.event_id,
        billing_interval: null,
        subscription_id: null,
        occurred_at: new Date(Date.now() + 4000).toISOString(),
      },
      201,
    );
    assert.equal(acquisition(), first, "Acquisition must survive retry/renewal/refund");
    const aggregate = `SELECT jsonb_build_object(
      'rows',count(*),'payments',count(*) FILTER(WHERE type='payment'),
      'refunds',count(*) FILTER(WHERE type='refund'),
      'payments_minor',sum(amount_minor) FILTER(WHERE type='payment'),
      'refunds_minor',sum(amount_minor) FILTER(WHERE type='refund'),
      'test_only',bool_and(test),'usd_only',bool_and(currency='USD'))
      FROM revenue_events WHERE ${where}`;
    assert.deepEqual(JSON.parse(psql(names.db, aggregate)), {
      rows: 3,
      payments: 2,
      refunds: 1,
      payments_minor: 5800,
      refunds_minor: 500,
      test_only: true,
      usd_only: true,
    });
    assert.equal(
      psql(
        names.db,
        `SELECT count(*) FROM customer_attribution a JOIN sessions s ON s.project_id=a.project_id AND s.id=a.credited_session_id JOIN customer_visitors l ON l.project_id=a.project_id AND l.customer_id=a.customer_id AND l.visitor_id=s.visitor_id WHERE a.${where} AND l.method='server_identify' AND s.campaign='${label}'`,
      ),
      "1",
    );
    assert.equal(
      psql(
        names.db,
        `SELECT count(*) FROM revenue_events r JOIN revenue_events p ON p.project_id=r.project_id AND p.id=r.refund_of_id WHERE r.${where} AND r.type='refund' AND p.event_id='${payment.event_id}'`,
      ),
      "1",
    );
    const internal = `${base}/internal/projects/${project}`;
    codes.internalMissing = (await context.request.get(internal)).status();
    codes.internalWrong = (
      await context.request.get(internal, { headers: { authorization: "Bearer invalid" } })
    ).status();
    assert.equal(codes.internalMissing, 404);
    assert.equal(codes.internalWrong, 404);
    const authorized = await context.request.get(internal, {
      headers: { authorization: `Bearer ${env.INTERNAL_TOKEN}` },
    });
    codes.internalAuthorized = authorized.status();
    assert.equal(authorized.status(), 200);
    const html = await authorized.text();
    assert.ok(html.includes("p2-test") && html.includes("attributed"));
    // Verify the actual rendered result row, not incidental words in page/scripts.
    const resultPage = await context.newPage();
    await resultPage.route("**/*", (route) => route.abort());
    await resultPage.setContent(html);
    const rows = resultPage.locator('[data-testid="internal-result"] tbody tr');
    assert.equal(await rows.count(), 1);
    assert.deepEqual(await rows.first().locator("td").allTextContents(), [
      label,
      "attributed",
      "p2-test",
    ]);
    await resultPage.close();
    assert.equal(
      psql(
        names.db,
        `SELECT coalesce(sum(CASE WHEN type='refund' THEN -amount_minor ELSE amount_minor END),0) FROM revenue_events WHERE ${where} AND test AND currency='USD'`,
      ),
      "5300",
    );
    await page.click("#consent-no");
    assert.equal(await page.evaluate(() => window.originmetric.getVisitorId()), null);
    const after = sends;
    await page.evaluate(() => history.pushState({}, "", "/fixtures/required?withdrawn"));
    await page.waitForTimeout(250);
    assert.equal(sends, after);

    // Plaintext fixture dump lives only in memory; no age key is generated or accessed.
    const semanticQuery = JSON.parse(
      execFileSync(
        "python3",
        [
          "-c",
          "import importlib.util,json,sys;sys.dont_write_bytecode=True;s=importlib.util.spec_from_file_location('r','scripts/vps/restore-phone.py');r=importlib.util.module_from_spec(s);s.loader.exec_module(r);a=json.load(sys.stdin);print(json.dumps(r.acceptance_metrics_query(a['project_id'],a['campaign'])))",
        ],
        { input: JSON.stringify({ project_id: project, campaign: label }), encoding: "utf8" },
      ),
    );
    const expectedMetrics = JSON.parse(psql(names.db, semanticQuery));
    const verifyMetrics = (metrics) =>
      spawnSync(
        "python3",
        [
          "-c",
          "import importlib.util,json,sys;sys.dont_write_bytecode=True;s=importlib.util.spec_from_file_location('r','scripts/vps/restore-phone.py');r=importlib.util.module_from_spec(s);s.loader.exec_module(r);a=json.load(sys.stdin);r.verify_acceptance_metrics(a['actual'],a['assertions'])",
        ],
        {
          input: JSON.stringify({
            actual: metrics,
            assertions: { project_id: project, campaign: label, expected_metrics: expectedMetrics },
          }),
          encoding: "utf8",
        },
      );
    assert.equal(
      verifyMetrics(expectedMetrics).status,
      0,
      "Private baseline assertions incomplete",
    );
    const tables = [
      "workspaces",
      "projects",
      "api_keys",
      "events",
      "sessions",
      "customers",
      "customer_visitors",
      "revenue_events",
      "customer_attribution",
      "ingestion_daily",
    ];
    const counts = (container) =>
      tables.map((t) => Number(psql(container, `SELECT count(*) FROM ${t}`)));
    const beforeCounts = counts(names.db);
    const latestSql = "SELECT max(received_at)::text FROM revenue_events";
    const latest = psql(names.db, latestSql);
    docker(
      "run",
      "-d",
      "--name",
      names.restore,
      "--network",
      "none",
      "--log-driver",
      "none",
      "--tmpfs",
      "/var/lib/postgresql:rw,size=268435456",
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "-e",
      "POSTGRES_DB=originmetric",
      "postgres:18.6-alpine",
      "postgres",
      "-c",
      "log_min_messages=panic",
      "-c",
      "log_min_error_statement=panic",
    );
    for (let i = 0; i < 60; i++) {
      try {
        docker("exec", names.restore, "pg_isready", "-h", "127.0.0.1", "-U", "postgres");
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    const dump = execFileSync(
      "docker",
      [
        "exec",
        names.db,
        "pg_dump",
        "-U",
        "postgres",
        "-d",
        "originmetric",
        "-Fc",
        "--no-owner",
        "--no-acl",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    try {
      const restored = spawnSync(
        "docker",
        [
          "exec",
          "-i",
          names.restore,
          "pg_restore",
          "-U",
          "postgres",
          "-d",
          "originmetric",
          "--no-owner",
          "--no-acl",
          "--exit-on-error",
        ],
        { input: dump, encoding: "utf8" },
      );
      assert.equal(restored.status, 0, "Fixture restore failed; diagnostics suppressed");
    } finally {
      dump.fill(0);
    }
    assert.deepEqual(counts(names.restore), beforeCounts);
    assert.equal(psql(names.restore, latestSql), latest);
    const restoredMetrics = JSON.parse(psql(names.restore, semanticQuery));
    assert.equal(verifyMetrics(restoredMetrics).status, 0, "Receiver semantic checks failed");
    for (const patch of [
      { source: "wrong" },
      { trusted_session_match: false },
      { refunds_minor: 501 },
      { latest_received_at: "2000-01-01 00:00:00+00" },
    ])
      assert.notEqual(
        verifyMetrics({ ...restoredMetrics, ...patch }).status,
        0,
        "Tampered restore must not pass semantic acceptance",
      );
    assert.equal(psql(names.restore, aggregate), psql(names.db, aggregate));
    assert.equal(
      psql(
        names.restore,
        `SELECT jsonb_build_array(acquired_at,credited_session_id,credited_source,credited_medium,credited_campaign,first_touch_session_id,first_touch_source) FROM customer_attribution WHERE ${where}`,
      ),
      first,
    );
    // Reuse the snapshot-schema and all-FK queries from the existing receiver.
    const queries = JSON.parse(
      execFileSync(
        "python3",
        [
          "-c",
          "import importlib.util,json,sys;sys.dont_write_bytecode=True;s=importlib.util.spec_from_file_location('r','scripts/vps/restore-phone.py');r=importlib.util.module_from_spec(s);s.loader.exec_module(r);print(json.dumps({'catalog':r.CATALOG,'fk':r.FK_QUERY}))",
        ],
        { encoding: "utf8" },
      ),
    );
    assert.equal(psql(names.restore, queries.catalog), psql(names.db, queries.catalog));
    const migrations =
      "SELECT jsonb_agg(jsonb_build_array(hash,created_at) ORDER BY created_at) FROM drizzle.__drizzle_migrations";
    assert.equal(psql(names.restore, migrations), psql(names.db, migrations));
    const keys = JSON.parse(psql(names.restore, queries.fk));
    assert.equal(keys.length, 14);
    const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
    for (const fk of keys) {
      assert.equal(fk.match, "s");
      const nonnull = fk.child_cols.map((c) => `c.${quote(c)} IS NOT NULL`).join(" AND ");
      const joins = fk.child_cols
        .map((c, i) => `c.${quote(c)}=p.${quote(fk.parent_cols[i])}`)
        .join(" AND ");
      assert.equal(
        psql(
          names.restore,
          `SELECT count(*) FROM ${quote(fk.child_schema)}.${quote(fk.child)} c WHERE ${nonnull} AND NOT EXISTS (SELECT 1 FROM ${quote(fk.parent_schema)}.${quote(fk.parent)} p WHERE ${joins})`,
        ),
        "0",
      );
    }
    const logs = spawnSync("docker", ["logs", names.app], { encoding: "utf8" });
    assert.equal(logs.status, 0);
    for (const secret of [key, visitor, label, env.INTERNAL_TOKEN, env.INGEST_PROXY_TOKEN])
      assert.ok(
        !`${logs.stdout}${logs.stderr}`.includes(secret),
        "Fixture logs leaked private values",
      );
    return {
      kind: "ISOLATED_REHEARSAL_ONLY",
      isolatedChainAcceptance: "PASS",
      result: "PASS",
      httpCodes: codes,
      persistedSessionCampaignAndTrustedLink: true,
      retryConflictNoExtraFacts: true,
      payments: 2,
      refunds: 1,
      currency: "USD",
      paymentsMinor: 5800,
      refundsMinor: 500,
      netMinor: 5300,
      acquisitionUnchanged: true,
      testOnly: true,
      internalRenderedExactCustomerStatusSource: true,
      netMinorVerifiedBySql: true,
      withdrawalStopsSending: true,
      restoredTenTableCountsAndFreshnessMatch: true,
      restoredSchemaAndMigrationsMatch: true,
      restoredAttributionAndTotalsMatch: true,
      receiverSemanticChecksAndFourTamperControls: true,
      foreignKeysChecked: 14,
      orphanRows: 0,
      noSensitiveFixtureLogs: true,
      productionDataAcceptance: "NOT_PASSED",
      actualEncryptedBackupAndPhoneRestore: "NOT_RUN",
    };
  } finally {
    await context.close();
  }
}

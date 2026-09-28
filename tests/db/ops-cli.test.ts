import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiKeys, customerAttribution, projects, workspaces } from "@/server/db/schema";
import { runOps } from "@/server/ops/cli";
import { authenticateApiKey, hashSecret, parseApiKey } from "@/server/tenancy/api-keys";
import { createFakeClock } from "@/server/time/clock";
import type { TempDatabase } from "../helpers/db";
import {
  T0,
  callIdentify,
  callRevenue,
  createDomainDatabase,
  makeDeps,
  payment,
  seedSessions,
  uid,
} from "../helpers/domain";

let tmp: TempDatabase;
const clock = createFakeClock(T0);

async function ops(...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runOps(argv, {
    db: tmp.db,
    clock,
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

function field(output: string, name: string): string {
  const match = new RegExp(`^${name}:\\s+(\\S+)`, "m").exec(output);
  if (!match?.[1]) throw new Error(`missing ${name}`);
  return match[1];
}

beforeAll(async () => {
  tmp = await createDomainDatabase();
});

afterAll(async () => {
  await tmp?.destroy();
});

let projectId = "";

describe("ops create-project", () => {
  it("creates a workspace + project with a public site key and normalized settings", async () => {
    const r = await ops(
      "create-project",
      "--name",
      "Dev",
      "--domain",
      "Example.COM",
      "--domain",
      "*.example.com",
      "--timezone",
      "Europe/Istanbul",
      "--currency",
      "try",
      "--exclude-referrer",
      "Pay.Gateway.io",
    );
    expect(r.code).toBe(0);
    projectId = field(r.out, "project_id");
    const siteKey = field(r.out, "site_key");
    expect(siteKey).toMatch(/^pk_[0-9A-Za-z]{22}$/);
    const [row] = await tmp.db.select().from(projects).where(eq(projects.id, projectId));
    expect(row).toMatchObject({
      name: "Dev",
      siteKey,
      allowedDomains: ["*.example.com", "example.com"],
      excludedReferrers: ["pay.gateway.io"],
      timezone: "Europe/Istanbul",
      primaryCurrency: "TRY",
      deletedAt: null,
    });
    expect(
      await tmp.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, row?.workspaceId ?? "")),
    ).toHaveLength(1);
  });

  it.each([
    [
      ["--name", "X", "--domain", "example.com", "--timezone", "Mars/Base", "--currency", "USD"],
      "timezone",
    ],
    [
      ["--name", "X", "--domain", "example.com", "--timezone", "UTC", "--currency", "XYZ"],
      "primary_currency",
    ],
    [
      ["--name", "X", "--domain", "http://x.com/a", "--timezone", "UTC", "--currency", "USD"],
      "allowed_domains",
    ],
    [["--name", "X", "--timezone", "UTC", "--currency", "USD"], "allowed_domains"],
  ])("rejects invalid input %j", async (args, fieldName) => {
    const r = await ops("create-project", ...args);
    expect(r.code).toBe(1);
    expect(r.err).toContain(fieldName);
  });

  it("usage errors exit 2", async () => {
    expect((await ops("create-project", "--bogus")).code).toBe(2);
    expect((await ops("nope")).code).toBe(2);
    expect((await ops()).code).toBe(2);
  });
});

describe("ops create-key", () => {
  it("prints the full key once and stores only prefix + hash", async () => {
    const r = await ops("create-key", "--project", projectId, "--name", "local dev");
    expect(r.code).toBe(0);
    const key = r.out.split("\n").at(-1) ?? "";
    const parsed = parseApiKey(key);
    expect(parsed).not.toBeNull();
    expect(r.out.split(key).length - 1).toBe(1);
    const [row] = await tmp.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.prefix, parsed?.prefix ?? ""));
    expect(row).toMatchObject({
      projectId,
      name: "local dev",
      secretHash: hashSecret(parsed?.secret ?? ""),
    });
    expect(JSON.stringify(row)).not.toContain(parsed?.secret);
    expect((await authenticateApiKey(tmp.db, `Bearer ${key}`, clock))?.projectId).toBe(projectId);
  });

  it("unknown project → exit 1; bad UUID → exit 2", async () => {
    expect((await ops("create-key", "--project", uid(999))).code).toBe(1);
    expect((await ops("create-key", "--project", "abc")).code).toBe(2);
  });
});

describe("ops recompute", () => {
  it("rebuilds attribution deterministically from stored facts", async () => {
    const keyOut = await ops("create-key", "--project", projectId);
    const key = keyOut.out.split("\n").at(-1) ?? "";
    const deps = makeDeps(tmp.db, clock);
    const v = uid(1, "b");
    await callIdentify(deps, key, { customer_id: "r1", visitor_id: v });
    await callRevenue(
      deps,
      key,
      payment({ event_id: "r_pay", customer_id: "r2", currency: "TRY" }),
    );
    // A session that arrived after the link (P1b ingestion would trigger the recompute itself).
    await seedSessions(tmp.db, projectId, [
      { id: uid(2, "b"), visitorId: v, startedAt: "2026-09-30T00:00:00Z", source: "google" },
    ]);

    const before = await tmp.db
      .select()
      .from(customerAttribution)
      .where(eq(customerAttribution.projectId, projectId));
    expect(before.map((r) => r.status).sort()).toEqual(["unattributed", "unattributed"]);

    const r = await ops("recompute", "--project", projectId, "--all");
    expect(r).toMatchObject({
      code: 0,
      out: "recomputed 2 customer(s): attributed=1 direct=0 unattributed=1",
    });
    const first = await tmp.db
      .select()
      .from(customerAttribution)
      .where(eq(customerAttribution.projectId, projectId));

    // Idempotent: a second run yields identical rows.
    await ops("recompute", "--project", projectId, "--all");
    const second = await tmp.db
      .select()
      .from(customerAttribution)
      .where(eq(customerAttribution.projectId, projectId));
    expect(second).toEqual(first);

    const one = await ops("recompute", "--project", projectId, "--customer", "r1");
    expect(one).toMatchObject({
      code: 0,
      out: "recomputed 1 customer: status=attributed source=google",
    });
  });

  it("requires exactly one of --all / --customer; unknown customer → exit 1", async () => {
    expect((await ops("recompute", "--project", projectId)).code).toBe(2);
    expect((await ops("recompute", "--project", projectId, "--all", "--customer", "x")).code).toBe(
      2,
    );
    expect((await ops("recompute", "--project", projectId, "--customer", "missing")).code).toBe(1);
  });
});

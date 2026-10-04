import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTempDatabase, type TempDatabase } from "../helpers/db";
import { applyMigrations } from "@/server/db/migrate";
import { createAuth } from "@/server/data/auth";
import { account, user, workspaceMembers, workspaces } from "@/server/db/schema";
import {
  authorizeProject,
  authorizeServerKey,
  authorizeSiteKey,
  forProject,
} from "@/server/data/project";
import { createMemberProject, listMemberProjects } from "@/server/data/account";
import { recoverPassword } from "@/server/data/recovery";
import { systemClock } from "@/server/time/clock";
import type { AuthEmail } from "@/server/auth/email";
let tmp: TempDatabase;
let auth: ReturnType<typeof createAuth>;
const emails: AuthEmail[] = [];
const baseURL = "https://auth.example.test";
const password = randomBytes(24).toString("hex");
const secret = randomBytes(32).toString("hex");
let cookieA = "",
  cookieB = "",
  userA = "",
  userB = "",
  projectA = "",
  projectB = "",
  keyB = "";
async function request(path: string, body?: unknown, cookie = "") {
  return auth.handler(
    new Request(`${baseURL}/api/auth/${path}`, {
      method: body ? "POST" : "GET",
      headers: { origin: baseURL, "Content-Type": "application/json", cookie },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}
function cookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
}
const config = {
  name: "A project",
  allowedDomains: ["a.example.com"],
  timezone: "UTC",
  primaryCurrency: "USD",
};
beforeAll(async () => {
  tmp = await createTempDatabase();
  await applyMigrations(tmp.db);
  auth = createAuth(tmp.db, {
    secret,
    baseURL,
    rateLimit: false,
    emailSender: {
      send: async (message) => {
        emails.push(message);
      },
    },
  });
  for (const label of ["a", "b"]) {
    const response = await request("sign-up/email", {
      name: label,
      email: `${label}@example.com`,
      password,
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    if (label === "a") {
      cookieA = cookie(response);
      userA = data.user.id;
    } else {
      cookieB = cookie(response);
      userB = data.user.id;
    }
  }
  projectA = (await createMemberProject(tmp.db, userA, config)).projectId;
  projectB = (await createMemberProject(tmp.db, userB, { ...config, name: "B project" })).projectId;
  keyB = (
    await forProject(await authorizeProject(tmp.db, userB, projectB)).createKey("B", systemClock)
  ).id;
});
afterAll(async () => {
  await tmp?.destroy();
});
describe("P3 authentication and tenant attacks", () => {
  it("atomically creates distinct owner workspaces and scrypt credentials at signup", async () => {
    const members = await tmp.db.select().from(workspaceMembers);
    expect(members).toHaveLength(2);
    expect(new Set(members.map((m) => m.workspaceId)).size).toBe(2);
    expect(await tmp.db.select().from(workspaces)).toHaveLength(2);
    const accounts = await tmp.db.select().from(account);
    expect(accounts.every((a) => a.password && a.password !== password)).toBe(true);
    const flags = (await request("sign-in/email", { email: "a@example.com", password })).headers
      .getSetCookie()
      .join(";");
    expect(flags).toMatch(/HttpOnly/i);
    expect(flags).toMatch(/Secure/i);
    expect(flags).toMatch(/SameSite=Lax/i);
  });
  it("list and create ignore caller workspace assignments", async () => {
    expect(await listMemberProjects(tmp.db, userA)).toEqual([{ id: projectA, name: "A project" }]);
    const [foreign] = await tmp.db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userB));
    const created = await createMemberProject(tmp.db, userA, {
      ...config,
      workspaceId: foreign!.workspaceId,
    });
    expect(created.workspaceId).not.toBe(foreign!.workspaceId);
    await forProject(await authorizeProject(tmp.db, userA, created.projectId)).delete(systemClock);
    await expect(createMemberProject(tmp.db, "unknown", config)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("foreign, malformed, missing and non-member projects have identical 404", async () => {
    for (const id of [projectB, "bad", "00000000-0000-4000-8000-000000000000"])
      await expect(authorizeProject(tmp.db, userA, id)).rejects.toMatchObject({
        status: 404,
        message: "Not found",
      });
    await expect(authorizeProject(tmp.db, "unknown", projectA)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("every key mutation rejects a foreign key without touching B", async () => {
    const data = forProject(await authorizeProject(tmp.db, userA, projectA));
    for (const action of ["rotateKey", "revokeKey"] as const)
      await expect(data[action](keyB, systemClock)).rejects.toMatchObject({ status: 404 });
    expect(await data.keys()).toEqual([]);
    expect(
      (await forProject(await authorizeProject(tmp.db, userB, projectB)).keys())[0]?.revokedAt,
    ).toBeNull();
  });
  it("revoked membership invalidates already issued grants for reads and all mutations", async () => {
    const grant = forProject(await authorizeProject(tmp.db, userA, projectA));
    const [member] = await tmp.db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userA));
    await tmp.db.delete(workspaceMembers).where(eq(workspaceMembers.userId, userA));
    const attacks = [
      () => grant.project(),
      () => grant.customerRows(),
      () => grant.keys(),
      () => grant.update(config, systemClock),
      () => grant.delete(systemClock),
      () => grant.createKey("test", systemClock),
      () => grant.rotateKey(keyB, systemClock),
      () => grant.revokeKey(keyB, systemClock),
    ];
    for (const attack of attacks) await expect(attack()).rejects.toMatchObject({ status: 404 });
    await tmp.db.insert(workspaceMembers).values(member!);
  });
  it("rejects forged cookies and hostile origins", async () => {
    expect(
      await auth.api.getSession({
        headers: new Headers({ cookie: "better-auth.session_token=forged" }),
      }),
    ).toBeNull();
    const response = await auth.handler(
      new Request(`${baseURL}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          cookie: cookieB,
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
    );
    expect(response.status).toBe(403);
    expect(await auth.api.getSession({ headers: new Headers({ cookie: cookieB }) })).not.toBeNull();
  });
  it("provider-independent verification tokens verify email and reject tampering", async () => {
    const sent = await request(
      "send-verification-email",
      { email: "a@example.com", callbackURL: "/dashboard" },
      cookieA,
    );
    expect(sent.status).toBe(200);
    const message = emails.find((m) => m.kind === "verification")!;
    expect(message.to).toBe("a@example.com");
    const url = new URL(message.url);
    const token = url.searchParams.get("token")!;
    const verified = await request(`verify-email?token=${encodeURIComponent(token)}`);
    expect(verified.status).toBe(200);
    expect((await tmp.db.select().from(user).where(eq(user.id, userA)))[0]?.emailVerified).toBe(
      true,
    );
    expect(
      (await request(`verify-email?token=${encodeURIComponent(token + "x")}`)).status,
    ).not.toBe(200);
  });
  it("reset token is one-use, changes password and revokes old sessions", async () => {
    expect(
      (await request("request-password-reset", { email: "b@example.com", redirectTo: "/sign-in" }))
        .status,
    ).toBe(200);
    const message = emails.find((m) => m.kind === "password-reset")!;
    const token = new URL(message.url).pathname.split("/").at(-1)!;
    const next = randomBytes(24).toString("hex");
    expect(
      (await request("reset-password", { token: token + "x", newPassword: next })).status,
    ).not.toBe(200);
    expect((await request("reset-password", { token, newPassword: next })).status).toBe(200);
    expect((await request("reset-password", { token, newPassword: password })).status).not.toBe(
      200,
    );
    expect(await auth.api.getSession({ headers: new Headers({ cookie: cookieB }) })).toBeNull();
    expect((await request("sign-in/email", { email: "b@example.com", password })).status).toBe(401);
    expect(
      (await request("sign-in/email", { email: "b@example.com", password: next })).status,
    ).toBe(200);
  });
  it("logout and other-session revocation invalidate database sessions immediately", async () => {
    const first = await request("sign-in/email", { email: "a@example.com", password });
    const second = await request("sign-in/email", { email: "a@example.com", password });
    const firstCookie = cookie(first),
      secondCookie = cookie(second);
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie: firstCookie }) }),
    ).not.toBeNull();
    expect((await request("revoke-other-sessions", {}, secondCookie)).status).toBe(200);
    expect(await auth.api.getSession({ headers: new Headers({ cookie: firstCookie }) })).toBeNull();
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie: secondCookie }) }),
    ).not.toBeNull();
    expect((await request("sign-out", {}, secondCookie)).status).toBe(200);
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie: secondCookie }) }),
    ).toBeNull();
  });
  it("expired reset tokens are rejected and unknown accounts do not receive mail", async () => {
    const before = emails.length;
    expect((await request("request-password-reset", { email: "unknown@example.com" })).status).toBe(
      200,
    );
    expect(emails).toHaveLength(before);
    await request("request-password-reset", { email: "a@example.com" });
    const message = emails.at(-1)!;
    const token = new URL(message.url).pathname.split("/").at(-1)!;
    await tmp.sql`UPDATE auth_verification SET expires_at=now()-interval '1 minute' WHERE identifier=${`reset-password:${token}`}`;
    expect((await request("reset-password", { token, newPassword: password })).status).not.toBe(
      200,
    );
  });
  it("ingress grants cannot read dashboards or cross server/browser capabilities", async () => {
    const data = forProject(await authorizeProject(tmp.db, userA, projectA));
    const key = await data.createKey("server-boundary", systemClock);
    const server = await authorizeServerKey(tmp.db, `Bearer ${key.key}`, systemClock);
    const project = await data.project();
    const browser = await authorizeSiteKey(tmp.db, project.siteKey);
    expect(server?.projectId).toBe(projectA);
    expect(browser?.project.id).toBe(projectA);
    for (const context of [server!.context, browser!.context]) {
      const scoped = forProject(context);
      await expect(scoped.project()).rejects.toMatchObject({ status: 404 });
      await expect(scoped.keys()).rejects.toMatchObject({ status: 404 });
      await expect(scoped.createKey("forbidden", systemClock)).rejects.toMatchObject({
        status: 404,
      });
      expect(() => forProject({ ...context })).toThrow("Not found");
    }
    await expect(
      forProject(browser!.context).identify(
        { customer_id: "foreign", visitor_id: null },
        systemClock,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(await authorizeServerKey(tmp.db, project.siteKey, systemClock)).toBeNull();
    expect(await authorizeSiteKey(tmp.db, key.key)).toBeNull();
    await data.revokeKey(key.id, systemClock);
    expect(await authorizeServerKey(tmp.db, `Bearer ${key.key}`, systemClock)).toBeNull();
  });
  it("Better Auth's built-in rate limiter remains enabled", async () => {
    const limited = createAuth(tmp.db, { secret, baseURL });
    const statuses = [];
    for (let i = 0; i < 12; i++) {
      const response = await limited.handler(
        new Request(`${baseURL}/api/auth/sign-in/email`, {
          method: "POST",
          headers: {
            origin: baseURL,
            "Content-Type": "application/json",
            "x-originmetric-auth-client": "fd00::1234",
          },
          body: JSON.stringify({ email: "missing@example.com", password }),
        }),
      );
      statuses.push(response.status);
      if (response.status === 429) break;
    }
    expect(statuses).toContain(429);
  });
  it("administrator recovery revokes sessions and outstanding reset tokens", async () => {
    await request("request-password-reset", { email: "a@example.com", redirectTo: "/sign-in" });
    const message = emails.filter((m) => m.kind === "password-reset").at(-1)!;
    const token = new URL(message.url).pathname.split("/").at(-1)!;
    await recoverPassword(tmp.db, "a@example.com", randomBytes(24).toString("hex"));
    expect(await auth.api.getSession({ headers: new Headers({ cookie: cookieA }) })).toBeNull();
    expect((await request("reset-password", { token, newPassword: password })).status).not.toBe(
      200,
    );
  });
});

import { describe, expect, it } from "vitest";
import { allowAuthAttempt, handleAuthRequest } from "@/server/auth/handler";
import { deliverAuthEmail } from "@/server/auth/email";
describe("auth delivery and ingress boundaries", () => {
  it("does not claim mail delivery when unconfigured or provider fails", async () => {
    await expect(
      deliverAuthEmail(undefined, {
        kind: "verification",
        to: "a@example.com",
        url: "https://example.com",
      }),
    ).rejects.toThrow("not configured");
    await expect(
      deliverAuthEmail(
        {
          send: async () => {
            throw new Error("Provider unavailable");
          },
        },
        { kind: "password-reset", to: "a@example.com", url: "https://example.com" },
      ),
    ).rejects.toThrow("Provider unavailable");
  });
  it("limits sign-in/reset attempts by hash and expires windows", () => {
    for (let i = 0; i < 10; i++) expect(allowAuthAttempt("fixture-ip", 1000)).toBe(true);
    expect(allowAuthAttempt("fixture-ip", 1001)).toBe(false);
    expect(allowAuthAttempt("fixture-ip", 62000)).toBe(true);
  });
  it("requires same origin and returns 503 before any unconfigured email request", async () => {
    const prior = process.env.BETTER_AUTH_URL;
    process.env.BETTER_AUTH_URL = "https://example.com";
    let called = false;
    const handler = async () => {
      called = true;
      return Response.json({ ok: true });
    };
    try {
      for (const path of ["request-password-reset", "send-verification-email"]) {
        const response = await handleAuthRequest(
          new Request(`https://example.com/api/auth/${path}`, {
            method: "POST",
            headers: { origin: "https://example.com" },
          }),
          handler,
        );
        expect(response.status).toBe(503);
        expect(await response.json()).toHaveProperty(
          "message",
          expect.stringContaining("not configured"),
        );
      }
      expect(
        (
          await handleAuthRequest(
            new Request("https://example.com/api/auth/sign-out", { method: "POST" }),
            handler,
          )
        ).status,
      ).toBe(403);
      expect(called).toBe(false);
    } finally {
      if (prior === undefined) delete process.env.BETTER_AUTH_URL;
      else process.env.BETTER_AUTH_URL = prior;
    }
  });
});

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { deliverAuthEmail, type AuthEmailSender } from "@/server/auth/email";
import { getDbHandle } from "./connection";

export function createAuth(
  db: Database,
  options: { secret: string; baseURL: string; emailSender?: AuthEmailSender; rateLimit?: boolean },
) {
  if (options.secret.length < 32)
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
  return betterAuth({
    appName: "OriginMetric",
    secret: options.secret,
    baseURL: options.baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) =>
        deliverAuthEmail(options.emailSender, { kind: "password-reset", to: user.email, url }),
    },
    emailVerification: {
      sendOnSignUp: false,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) =>
        deliverAuthEmail(options.emailSender, { kind: "verification", to: user.email, url }),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      useSecureCookies: options.baseURL.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      ipAddress: { ipAddressHeaders: ["x-originmetric-auth-client"], ipv6Subnet: 128 },
    },
    databaseHooks: {
      session: { create: { before: async (data) => ({ data: { ...data, ipAddress: null } }) } },
    },
    rateLimit: { enabled: options.rateLimit ?? true, window: 60, max: 30 },
    logger: { disabled: true },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || !baseURL) throw new Error("Authentication is not configured");
  // No provider is configured yet. Injection above allows testing real token flows safely.
  return (instance ??= createAuth(getDbHandle().db, { secret, baseURL }));
}

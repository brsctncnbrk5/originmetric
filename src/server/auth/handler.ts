import { createHmac, randomBytes } from "node:crypto";
const salt = randomBytes(32);
const attempts = new Map<string, { count: number; until: number }>();
/** Hash only a trusted ingress IP; raw addresses are neither retained nor logged. */
export function allowAuthAttempt(ip: string, now = Date.now()) {
  const key = createHmac("sha256", salt).update(ip).digest("hex");
  for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
  if (attempts.size >= 10000 && !attempts.has(key)) return false;
  const entry = attempts.get(key) ?? { count: 0, until: now + 60000 };
  entry.count++;
  attempts.set(key, entry);
  return entry.count <= 10;
}
export async function handleAuthRequest(
  request: Request,
  handler: (r: Request) => Promise<Response>,
  emailAvailable = false,
) {
  const path = new URL(request.url).pathname;
  if (request.method === "POST") {
    // Direct clients cannot opt out by omitting Origin; the UI always sends it.
    const expected = process.env.BETTER_AUTH_URL;
    if (!expected || request.headers.get("origin") !== new URL(expected).origin)
      return Response.json({ message: "Invalid origin" }, { status: 403 });
    const ip =
      process.env.INGEST_PROXY_MODE === "cloudflare"
        ? (request.headers.get("cf-connecting-ip") ?? "unknown")
        : "local";
    if (
      /\/(sign-in\/email|sign-up\/email|request-password-reset|reset-password|send-verification-email)$/.test(
        path,
      ) &&
      !allowAuthAttempt(ip)
    )
      return Response.json({ message: "Too many attempts. Try again later." }, { status: 429 });
    if (!emailAvailable && /\/(request-password-reset|send-verification-email)$/.test(path)) {
      return Response.json(
        { message: "Email delivery is not configured. Contact the administrator." },
        { status: 503 },
      );
    }
  }
  // Better Auth's limiter uses an opaque IPv6-shaped identifier, never the raw IP.
  // Ignore any caller-supplied version of this internal header.
  const ingress =
    process.env.INGEST_PROXY_MODE === "cloudflare"
      ? (request.headers.get("cf-connecting-ip") ?? "unknown")
      : "local";
  const digest = createHmac("sha256", salt).update(ingress).digest("hex").slice(0, 32);
  const headers = new Headers(request.headers);
  headers.set("x-originmetric-auth-client", digest.match(/.{4}/g)!.join(":"));
  const response = await handler(new Request(request, { headers }));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

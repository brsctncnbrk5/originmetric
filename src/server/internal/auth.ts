import { timingSafeEqual } from "node:crypto";

export function isInternalRequestAuthorized(
  authorization: string | null,
  token: string | undefined = process.env.INTERNAL_TOKEN,
): boolean {
  if (!token || !authorization?.startsWith("Bearer ")) return false;
  const presented = authorization.slice("Bearer ".length);
  const a = Buffer.from(presented);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

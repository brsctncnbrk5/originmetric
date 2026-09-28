/**
 * Project-scoped server API keys (plan §7.3).
 *
 * Format: `om_sk_<prefix>_<secret>`
 *   prefix: 8 base62 chars (public; shown in UI/logs, unique lookup key)
 *   secret: 32 CSPRNG bytes (256 bits) as a fixed-width 43-char base62 string
 * Stored: prefix + lowercase hex SHA-256(secret). The full key is shown once and never stored
 * or logged. A slow hash is unnecessary: the secret has 256 bits of entropy.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { API_KEY_SCOPE, apiKeys, projects } from "@/server/db/schema";
import type { Clock } from "@/server/time/clock";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const KEY_PREFIX_LENGTH = 8;
export const KEY_SECRET_BYTES = 32;
/** ceil(256 / log2(62)) = 43 base62 digits hold any 32-byte value. */
export const KEY_SECRET_LENGTH = 43;
const KEY_PATTERN = new RegExp(
  `^om_sk_([0-9A-Za-z]{${KEY_PREFIX_LENGTH}})_([0-9A-Za-z]{${KEY_SECRET_LENGTH}})$`,
);
/** `last_used_at` is written at most once per this interval per key. */
export const LAST_USED_RESOLUTION_MS = 60_000;

/** Encode bytes as a fixed-width base62 string (big-endian, left-padded with "0"). */
export function base62(bytes: Uint8Array, width: number): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    out = BASE62[Number(n % 62n)] + out;
    n /= 62n;
  }
  if (out.length > width) throw new RangeError("base62: value exceeds width");
  return out.padStart(width, "0");
}

/** Uniformly random base62 string (rejection sampling: no modulo bias). */
export function randomBase62(length: number): string {
  let out = "";
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < 248 && out.length < length) out += BASE62[b % 62];
    }
  }
  return out;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export interface ParsedKey {
  prefix: string;
  secret: string;
}

export function parseApiKey(key: string): ParsedKey | null {
  const match = KEY_PATTERN.exec(key);
  if (!match?.[1] || !match[2]) return null;
  return { prefix: match[1], secret: match[2] };
}

/** Extract the key from an `Authorization: Bearer …` header value. */
export function parseBearer(header: string | null): ParsedKey | null {
  if (!header) return null;
  const match = /^Bearer ([^\s]+)$/.exec(header.trim());
  return match?.[1] ? parseApiKey(match[1]) : null;
}

export function generateApiKey(): { key: string; prefix: string; secretHash: string } {
  const prefix = randomBase62(KEY_PREFIX_LENGTH);
  const secret = base62(randomBytes(KEY_SECRET_BYTES), KEY_SECRET_LENGTH);
  return { key: `om_sk_${prefix}_${secret}`, prefix, secretHash: hashSecret(secret) };
}

export interface CreatedApiKey {
  id: string;
  projectId: string;
  prefix: string;
  name: string | null;
  /** The full key. Returned exactly once; never persisted or logged. */
  key: string;
}

export async function createApiKey(
  db: Executor,
  input: { projectId: string; name?: string | null },
  clock: Clock,
): Promise<CreatedApiKey> {
  // Prefix collisions (47.6 bits) are practically impossible; retry a few times anyway.
  for (let attempt = 0; attempt < 5; attempt++) {
    const generated = generateApiKey();
    const rows = await db
      .insert(apiKeys)
      .values({
        projectId: input.projectId,
        name: input.name ?? null,
        prefix: generated.prefix,
        secretHash: generated.secretHash,
        createdAt: clock.now(),
      })
      .onConflictDoNothing({ target: apiKeys.prefix })
      .returning({ id: apiKeys.id });
    const row = rows[0];
    if (row) {
      return {
        id: row.id,
        projectId: input.projectId,
        prefix: generated.prefix,
        name: input.name ?? null,
        key: generated.key,
      };
    }
  }
  throw new Error("could not allocate a unique API key prefix");
}

export async function revokeApiKey(db: Executor, keyId: string, clock: Clock): Promise<void> {
  await db
    .update(apiKeys)
    .set({ revokedAt: clock.now() })
    .where(and(eq(apiKeys.id, keyId), isNull(apiKeys.revokedAt)));
}

/** Result of authenticating a key. The project comes only from here, never from the request. */
export interface AuthenticatedKey {
  keyId: string;
  projectId: string;
  prefix: string;
  scope: typeof API_KEY_SCOPE;
}

// Compared against when the prefix is unknown, so every failure path does the same work.
const DUMMY_HASH = Buffer.alloc(32);

/**
 * Verify an `Authorization` header. Every failure (missing, malformed, unknown prefix, wrong
 * secret, revoked key, deleted project) returns null, and the caller answers one uniform 401.
 */
export async function authenticateApiKey(
  db: Executor,
  authorization: string | null,
  clock: Clock,
): Promise<AuthenticatedKey | null> {
  const parsed = parseBearer(authorization);
  const presented = Buffer.from(hashSecret(parsed?.secret ?? ""), "hex");
  if (!parsed) {
    timingSafeEqual(presented, DUMMY_HASH);
    return null;
  }

  const [row] = await db
    .select({
      id: apiKeys.id,
      projectId: apiKeys.projectId,
      secretHash: apiKeys.secretHash,
      revokedAt: apiKeys.revokedAt,
      projectDeletedAt: projects.deletedAt,
    })
    .from(apiKeys)
    .innerJoin(projects, eq(projects.id, apiKeys.projectId))
    .where(eq(apiKeys.prefix, parsed.prefix));

  const stored = row ? Buffer.from(row.secretHash, "hex") : DUMMY_HASH;
  const matches = timingSafeEqual(presented, stored.length === 32 ? stored : DUMMY_HASH);
  if (!row || !matches || row.revokedAt !== null || row.projectDeletedAt !== null) return null;

  await touchLastUsed(db, row.id, clock);
  return { keyId: row.id, projectId: row.projectId, prefix: parsed.prefix, scope: API_KEY_SCOPE };
}

/** Update `last_used_at` at most once per LAST_USED_RESOLUTION_MS (one conditional UPDATE). */
export async function touchLastUsed(db: Executor, keyId: string, clock: Clock): Promise<void> {
  const now = clock.now();
  const threshold = new Date(now.getTime() - LAST_USED_RESOLUTION_MS);
  await db
    .update(apiKeys)
    .set({ lastUsedAt: now })
    .where(
      and(eq(apiKeys.id, keyId), or(isNull(apiKeys.lastUsedAt), lt(apiKeys.lastUsedAt, threshold))),
    );
}

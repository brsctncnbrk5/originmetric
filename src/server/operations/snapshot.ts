import { readFile } from "node:fs/promises";
import { z } from "zod";

const check = z
  .object({
    name: z.enum(["health", "tracker", "selfcheck", "backup", "restore"]),
    status: z.enum(["pass", "fail", "unknown"]),
    source: z.enum(["vps", "github"]),
    observedAt: z.string().datetime(),
  })
  .strict();
const snapshot = z
  .object({
    checks: z.array(check).max(5),
    history: z.array(check).max(100),
  })
  .strict();

export async function readOperations(path = process.env.OM_OPERATIONS_FILE, now = Date.now()) {
  try {
    if (!path) return null;
    const raw = await readFile(path, "utf8");
    if (Buffer.byteLength(raw) > 64_000) return null;
    const parsed = snapshot.parse(JSON.parse(raw));
    const maxAge = {
      health: 15 * 60_000,
      tracker: 15 * 60_000,
      selfcheck: 15 * 60_000,
      backup: 25 * 60 * 60_000,
      restore: Infinity,
    };
    const annotate = (value: z.infer<typeof check>) => ({
      ...value,
      stale:
        Date.parse(value.observedAt) > now ||
        now - Date.parse(value.observedAt) > maxAge[value.name],
    });
    return { checks: parsed.checks.map(annotate), history: parsed.history.map(annotate) };
  } catch {
    return null;
  }
}

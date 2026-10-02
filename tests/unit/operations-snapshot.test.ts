import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { readOperations } from "@/server/operations/snapshot";

test("unknown, malformed, future and stale evidence never becomes a current PASS", async () => {
  const dir = await mkdtemp(join(tmpdir(), "om-operations-"));
  const path = join(dir, "snapshot.json");
  const now = Date.parse("2026-10-02T12:00:00Z");
  const check = {
    name: "health",
    status: "pass",
    source: "github",
    observedAt: "2026-10-02T11:59:00Z",
  };
  try {
    expect(await readOperations(path, now)).toBeNull();
    await writeFile(path, JSON.stringify({ checks: [check], history: [] }));
    expect((await readOperations(path, now))?.checks[0]?.stale).toBe(false);
    expect((await readOperations(path, now + 16 * 60_000))?.checks[0]?.stale).toBe(true);
    expect((await readOperations(path, now - 2 * 60_000))?.checks[0]?.stale).toBe(true);
    await writeFile(
      path,
      JSON.stringify({ checks: [{ ...check, token: "must-not-render" }], history: [] }),
    );
    expect(await readOperations(path, now)).toBeNull();
    await writeFile(path, "bad-json");
    expect(await readOperations(path, now)).toBeNull();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// Process entry point for the ops CLI (bundled by scripts/build-ops.mjs into dist/ops.mjs).
import { existsSync } from "node:fs";
import { createDb } from "@/server/db/client";
import { errorFacts } from "@/server/logging/logger";
import { systemClock } from "@/server/time/clock";
import { runOps } from "./cli";

if (existsSync(".env")) process.loadEnvFile(".env");

const handle = createDb(undefined, { max: 2 });
let code = 1;
try {
  code = await runOps(process.argv.slice(2), {
    db: handle.db,
    clock: systemClock,
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  });
} catch (err) {
  // Class and SQLSTATE only: PostgreSQL error details can contain input values.
  const facts = errorFacts(err);
  process.stderr.write(
    `ops: failed (${facts.error_class}${facts.sqlstate ? ` ${facts.sqlstate}` : ""})\n`,
  );
} finally {
  await handle.close();
}
process.exit(code);

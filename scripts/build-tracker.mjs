// Builds the browser tracker (IIFE, ES2017) and enforces the gzip size budget.
// Exits non-zero on build failure or budget overrun.
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { checkBudget, gzipSize } from "./tracker-budget.mjs";

const outfile = "tracker/dist/om.js";

await build({
  entryPoints: ["tracker/src/index.ts"],
  outfile,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2017",
  minify: true,
  legalComments: "none",
  logLevel: "warning",
});

const result = checkBudget(gzipSize(readFileSync(outfile)));
console.log(`tracker: ${outfile} gzip ${result.size} B / budget ${result.budget} B`);
if (!result.ok) {
  console.error("tracker: gzip size budget exceeded");
  process.exit(1);
}

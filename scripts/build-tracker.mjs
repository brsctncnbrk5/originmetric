// Builds the browser tracker (IIFE, ES2017), publishes the local Next.js asset,
// and enforces the locked gzip size budget.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { build } from "esbuild";
import { checkBudget, gzipSize } from "./tracker-budget.mjs";

const outfile = "tracker/dist/om.js";
const publicFile = "public/js/v1/om.js";

mkdirSync("tracker/dist", { recursive: true });
mkdirSync("public/js/v1", { recursive: true });

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

copyFileSync(outfile, publicFile);
console.log(`tracker: published ${publicFile}`);

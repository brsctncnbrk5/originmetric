// Bundles the ops CLI (src/server/ops/main.ts) into dist/ops.mjs for Node 22.
// Dependencies stay external (resolved from node_modules at run time); `@/` aliases are
// resolved from tsconfig.json. Used by `npm run ops` locally and by the app image later.
import { build } from "esbuild";

await build({
  entryPoints: ["src/server/ops/main.ts"],
  outfile: "dist/ops.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  tsconfig: "tsconfig.json",
  logLevel: "warning",
});

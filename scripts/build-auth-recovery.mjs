import { build } from "esbuild";
await build({
  entryPoints: ["src/server/ops/recover-password.ts"],
  outfile: "dist/recover-password.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  tsconfig: "tsconfig.json",
});

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/data/**", "src/server/ops/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "(^@/server/db/(client|instance)$|(^|/)db/(client|instance)$|^\\./client$)",
              allowTypeImports: true,
              message:
                "Raw DB clients belong in src/server/data or src/server/ops; use the scoped data layer.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "(^@/server/db/|(^|/)db/|^drizzle-orm($|/)|^postgres$)",
              message: "App routes and UI must query through src/server/data.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "tracker/dist/**",
    "public/js/**",
    "dist/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

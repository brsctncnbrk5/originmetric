import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();
async function restricted(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.filter((m) => m.ruleId === "no-restricted-imports");
}

describe("CI tenant raw-client import guard", () => {
  it("blocks aliases, relative imports and reexports outside data/ops", async () => {
    for (const code of [
      'import { createDb } from "@/server/db/client"; void createDb;',
      'import { createDb } from "../db/client"; void createDb;',
      'export { createDb } from "@/server/db/client";',
    ])
      expect(await restricted(code, "src/server/tenancy/guard-probe.ts")).toHaveLength(1);
  });
  it("allows erased types and designated raw-client boundaries", async () => {
    expect(
      await restricted(
        'import type { Database } from "@/server/db/client"; export type T = Database;',
        "src/server/tenancy/guard-probe.ts",
      ),
    ).toHaveLength(0);
    for (const path of ["src/server/data/guard-probe.ts", "src/server/ops/guard-probe.ts"]) {
      expect(await restricted('export { createDb } from "@/server/db/client";', path)).toHaveLength(
        0,
      );
    }
  });
  it("blocks raw client/schema/query libraries in app code but allows the data layer", async () => {
    for (const source of [
      "@/server/db/client",
      "../../../server/db/schema",
      "drizzle-orm",
      "drizzle-orm/postgres-js",
      "postgres",
    ]) {
      expect(
        await restricted(
          `import * as raw from "${source}"; void raw;`,
          "src/app/projects/guard-probe.ts",
        ),
      ).toHaveLength(1);
    }
    expect(
      await restricted(
        'export { forProject } from "@/server/data/project";',
        "src/app/projects/guard-probe.ts",
      ),
    ).toHaveLength(0);
  });
});

import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Load local .env when present (Node built-in; CI sets env vars directly).
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});

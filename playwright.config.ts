import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
// Optional override for environments with a pre-installed Chromium of a different revision.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const internalToken = process.env.INTERNAL_TOKEN ?? "originmetric-e2e-internal";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
  ],
  webServer: {
    // Serves the production build; `npm run test:e2e` builds first.
    command: "node .next/standalone/server.js",
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      INTERNAL_TOKEN: internalToken,
      INGEST_PROXY_MODE: "local",
      // Isolated browser fixture only; production must use its registered public key.
      OM_DOGFOOD_SITE_KEY: "pk_DogfoodBrowserTest0001",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
  },
});

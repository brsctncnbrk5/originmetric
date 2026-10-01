import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import { expect, test, type Page } from "@playwright/test";
import { createDb, type DbHandle } from "../../src/server/db/client";
import { customers, customerVisitors, sessions } from "../../src/server/db/schema";
import { createProject } from "../../src/server/tenancy/projects";
import { systemClock } from "../../src/server/time/clock";

if (existsSync(".env")) process.loadEnvFile(".env");

let handle: DbHandle;

test.beforeAll(() => {
  handle = createDb(undefined, { max: 3 });
});

test.afterAll(async () => {
  await handle?.close();
});

async function fixtureProject(label: string) {
  return createProject(
    handle.db,
    {
      name: `P1b ${label} ${randomUUID().slice(0, 8)}`,
      allowedDomains: ["127.0.0.1"],
      timezone: "UTC",
      primaryCurrency: "USD",
    },
    systemClock,
  );
}

const isIngestion = (url: string) => new URL(url).pathname === "/api/v1/e";

async function omState(page: Page) {
  return page.evaluate(() => {
    const om = (
      window as Window & {
        originmetric?: { getVisitorId(): string | null };
      }
    ).originmetric;
    return {
      visitorId: om?.getVisitorId() ?? null,
      cookie: document.cookie,
      localKeys: Object.keys(localStorage).filter((key) => key.startsWith("om_")).sort(),
    };
  });
}

test("required consent has zero state/network before consent and withdrawal clears state", async ({
  page,
}) => {
  const project = await fixtureProject("required");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (isIngestion(request.url())) requests.push(request.url());
  });

  await page.goto(
    `/fixtures/required?site=${project.siteKey}&utm_source=Google&utm_campaign=Launch`,
  );
  await expect(page.locator("#fixture")).toHaveAttribute("data-mode", "required");
  await page.waitForTimeout(250);

  expect(requests).toHaveLength(0);
  expect(await omState(page)).toEqual({ visitorId: null, cookie: "", localKeys: [] });

  const firstEvent = page.waitForRequest((request) => isIngestion(request.url()));
  await page.click("#consent-yes");
  await firstEvent;

  const enabled = await omState(page);
  expect(enabled.visitorId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(enabled.cookie.includes("om_vid=") || enabled.localKeys.includes("om_vid")).toBe(true);

  await page.click("#consent-no");
  await expect
    .poll(async () => omState(page))
    .toEqual({ visitorId: null, cookie: "", localKeys: [] });

  const before = requests.length;
  await page.evaluate(() => {
    history.pushState({}, "", "/fixtures/required?utm_source=reddit");
  });
  await page.waitForTimeout(250);
  expect(requests).toHaveLength(before);
});

test("GPC blocks auto mode while data-gpc=ignore opts out", async ({ page }) => {
  const project = await fixtureProject("gpc");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (isIngestion(request.url())) requests.push(request.url());
  });
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "globalPrivacyControl", {
      configurable: true,
      get: () => true,
    });
  });

  await page.goto(`/fixtures/gpc?site=${project.siteKey}`);
  await page.waitForTimeout(250);
  expect(requests).toHaveLength(0);
  expect(await omState(page)).toEqual({ visitorId: null, cookie: "", localKeys: [] });

  const allowed = page.waitForRequest((request) => isIngestion(request.url()));
  await page.goto(`/fixtures/gpc?site=${project.siteKey}&gpc=ignore`);
  await allowed;
  expect((await omState(page)).visitorId).not.toBeNull();
});

test("storage-disabled browser remains functional and sends no event", async ({ page }) => {
  const project = await fixtureProject("storage");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (isIngestion(request.url())) requests.push(request.url());
  });
  await page.addInitScript(() => {
    try {
      Object.defineProperty(Document.prototype, "cookie", {
        configurable: true,
        get: () => "",
        set: () => {
          throw new DOMException("cookies disabled");
        },
      });
    } catch {
      try {
        Object.defineProperty(document, "cookie", {
          configurable: true,
          get: () => "",
          set: () => {
            throw new DOMException("cookies disabled");
          },
        });
      } catch {
        // Best-effort cookie block; localStorage is blocked below as well.
      }
    }
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value: () => {
          throw new DOMException("storage disabled");
        },
      });
    }
  });

  await page.goto(`/fixtures/storage?site=${project.siteKey}`);
  await page.waitForTimeout(250);
  expect(requests).toHaveLength(0);
  await page.click("#work");
  await expect(page.locator("#work-count")).toHaveText("1");
});

test("blocked ingestion endpoint never breaks the host page", async ({ page }) => {
  const project = await fixtureProject("blocked");
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/api/v1/e", (route) => route.abort("failed"));

  await page.goto(`/fixtures/blocked?site=${project.siteKey}`);
  await page.waitForTimeout(250);
  await page.click("#work");
  await expect(page.locator("#work-count")).toHaveText("1");
  expect(pageErrors).toEqual([]);
});

test("strict CSP fixture loads tracker without inline scripts", async ({ page }) => {
  const project = await fixtureProject("csp");
  const event = page.waitForRequest((request) => isIngestion(request.url()));
  const response = await page.goto(`/fixtures/csp?site=${project.siteKey}&utm_source=google`);
  expect(response?.headers()["content-security-policy"]).toContain("script-src 'self'");
  await event;
  await page.click("#work");
  await expect(page.locator("#work-count")).toHaveText("1");
});

test("browser identify cannot create customers or trusted links", async ({ page }) => {
  const project = await fixtureProject("identify");
  const event = page.waitForRequest((request) => isIngestion(request.url()));
  await page.goto(`/fixtures/basic?site=${project.siteKey}&utm_source=google`);
  await event;
  await page.click("#identify");
  await page.waitForTimeout(100);

  const projectCustomers = await handle.db
    .select()
    .from(customers)
    .where(eq(customers.projectId, project.projectId));
  const links = await handle.db
    .select()
    .from(customerVisitors)
    .where(eq(customerVisitors.projectId, project.projectId));
  expect(projectCustomers).toHaveLength(0);
  expect(links).toHaveLength(0);
});

test("SPA navigation keeps a direct continuation in-session and splits on a new campaign", async ({
  page,
}) => {
  const project = await fixtureProject("spa");

  const first = page.waitForRequest((request) => isIngestion(request.url()));
  await page.goto(`/fixtures/basic?site=${project.siteKey}&utm_source=google&utm_campaign=launch`);
  await first;

  await expect
    .poll(async () => {
      const rows = await handle.db
        .select({ source: sessions.source, pageviews: sessions.pageviews })
        .from(sessions)
        .where(eq(sessions.projectId, project.projectId));
      return rows;
    })
    .toEqual([{ source: "google", pageviews: 1 }]);

  const second = page.waitForRequest((request) => isIngestion(request.url()));
  await page.evaluate(() => history.pushState({}, "", "/pricing"));
  await second;

  await expect
    .poll(async () => {
      const rows = await handle.db
        .select({ source: sessions.source, pageviews: sessions.pageviews })
        .from(sessions)
        .where(eq(sessions.projectId, project.projectId));
      return rows;
    })
    .toEqual([{ source: "google", pageviews: 2 }]);

  const third = page.waitForRequest((request) => isIngestion(request.url()));
  await page.evaluate(() => history.pushState({}, "", "/pricing?utm_source=reddit"));
  await third;

  await expect
    .poll(async () => {
      const rows = await handle.db
        .select({ source: sessions.source, pageviews: sessions.pageviews })
        .from(sessions)
        .where(eq(sessions.projectId, project.projectId));
      return rows.sort((a, b) => a.source.localeCompare(b.source));
    })
    .toEqual([
      { source: "google", pageviews: 2 },
      { source: "reddit", pageviews: 1 },
    ]);
});

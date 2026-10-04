import { expect, test, type Page } from "@playwright/test";

async function state(page: Page) {
  return page.evaluate(() => ({
    visitor:
      (
        window as Window & { originmetric?: { getVisitorId(): string | null } }
      ).originmetric?.getVisitorId() ?? null,
    cookies: document.cookie,
    keys: Object.keys(localStorage).filter((key) => key.startsWith("om_")),
  }));
}

// Browser integration proof only: requests are dropped without a database, like the closed gate.
test("chosen dogfood page requires consent, denies and withdraws with the gate closed", async ({
  page,
}) => {
  let sent = 0;
  await page.route("**/api/v1/e", async (route) => {
    sent++;
    await route.fulfill({ status: 202, body: "" });
  });
  await page.goto("/dogfood");
  await expect(page.locator("#consent-allow")).toBeEnabled();
  await page.waitForTimeout(200);
  expect(sent).toBe(0);
  expect(await state(page)).toEqual({ visitor: null, cookies: "", keys: [] });
  await page.click("#consent-deny");
  await expect(page.getByRole("status")).toHaveText("Reddedildi");
  expect(sent).toBe(0);
  await page.click("#consent-allow");
  await expect.poll(() => sent).toBe(1);
  expect((await state(page)).visitor).not.toBeNull();
  await page.click("#consent-withdraw");
  expect(await state(page)).toEqual({ visitor: null, cookies: "", keys: [] });
  await page.evaluate(() => history.pushState({}, "", "/dogfood?withdrawn=1"));
  await page.waitForTimeout(200);
  expect(sent).toBe(1);
  await page.reload();
  await expect(page.locator("#consent-allow")).toBeEnabled();
  expect(await state(page)).toEqual({ visitor: null, cookies: "", keys: [] });
  expect(sent).toBe(1);
});

test("dogfood banner honours GPC even if allow is clicked", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, "globalPrivacyControl", { get: () => true }),
  );
  let sent = 0;
  await page.route("**/api/v1/e", async (route) => {
    sent++;
    await route.abort();
  });
  await page.goto("/dogfood");
  await expect(page.locator("#consent-allow")).toBeEnabled();
  await page.click("#consent-allow");
  await page.waitForTimeout(200);
  expect(sent).toBe(0);
  expect(await state(page)).toEqual({ visitor: null, cookies: "", keys: [] });
});

test("operations screen uses existing internal auth and never invents monitoring data", async ({
  page,
}) => {
  await page.goto("/internal/operations");
  await expect(page.getByRole("heading", { name: "Operations", exact: true })).toHaveCount(0);
  await page.setExtraHTTPHeaders({
    authorization: `Bearer ${process.env.INTERNAL_TOKEN ?? "originmetric-e2e-internal"}`,
  });
  await page.goto("/internal/operations");
  await expect(page.getByRole("heading", { name: "Operations", exact: true })).toBeVisible();
  await expect(page.getByText("Monitoring evidence unavailable.")).toBeVisible();
});

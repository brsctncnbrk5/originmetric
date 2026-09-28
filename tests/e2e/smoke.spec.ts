import { expect, test } from "@playwright/test";

test("app starts and Chromium renders the smoke page", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "OriginMetric" })).toBeVisible();
  await expect(page.getByTestId("smoke")).toHaveText("Development foundation is running.");
});

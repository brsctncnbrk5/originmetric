import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
test("two accounts: auth UI, project/key lifecycle, every foreign mutation, session logout and no simulated email", async ({
  browser,
  baseURL,
}) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const page = await a.newPage();
  const password = randomBytes(24).toString("hex");
  const suffix = randomBytes(6).toString("hex");
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Account A");
  await page.getByLabel("Email", { exact: true }).fill(`a-${suffix}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();
  await page.getByLabel("Project name").fill("A website");
  await page.getByLabel("Allowed domains (comma separated)").fill("a.example.com");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A website" })).toBeVisible();
  const idA = page.url().split("/").at(-1)!;
  await page.getByLabel("Key name").fill("Integration");
  await page.getByRole("button", { name: "Create key", exact: true }).click();
  await expect(page.getByText("Copy this key now:")).toBeVisible();
  const api = await a.request.get(`/api/account/projects/${idA}`);
  const details = await api.json();
  expect(details.keys[0]).not.toHaveProperty("secretHash");
  expect(details.keys[0]).not.toHaveProperty("key");
  const keyA = details.keys[0].id;
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(page.getByText("Copy this key now:")).toHaveCount(0);
  await page.getByRole("button", { name: "Rotate", exact: true }).click();
  await expect(page.getByText("Copy this key now:")).toBeVisible();
  await page.getByRole("button", { name: "Revoke", exact: true }).click();
  await expect(page.getByRole("button", { name: "Revoke", exact: true })).toHaveCount(0);
  const signup = await b.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL! },
    data: { name: "Account B", email: `b-${suffix}@example.com`, password },
  });
  expect(signup.status()).toBe(200);
  const createB = await b.request.post("/api/account/projects", {
    headers: { origin: baseURL! },
    data: {
      name: "B website",
      allowedDomains: ["b.example.com"],
      timezone: "UTC",
      primaryCurrency: "USD",
    },
  });
  expect(createB.status()).toBe(201);
  const idB = (await createB.json()).projectId;
  expect((await a.request.get(`/api/account/projects/${idB}`)).status()).toBe(404);
  expect((await b.request.get(`/api/account/projects/${idA}`)).status()).toBe(404);
  const config = {
    name: "Attacker",
    allowedDomains: ["evil.example.com"],
    timezone: "UTC",
    primaryCurrency: "USD",
  };
  for (const body of [
    { action: "update", config },
    { action: "delete" },
    { action: "create-key", name: "evil" },
    { action: "rotate-key", keyId: keyA },
    { action: "revoke-key", keyId: keyA },
  ]) {
    expect(
      (
        await b.request.post(`/api/account/projects/${idA}`, {
          headers: { origin: baseURL! },
          data: body,
        })
      ).status(),
    ).toBe(404);
  }
  for (const action of ["rotate-key", "revoke-key"])
    expect(
      (
        await b.request.post(`/api/account/projects/${idB}`, {
          headers: { origin: baseURL! },
          data: { action, keyId: keyA },
        })
      ).status(),
    ).toBe(404);
  expect(
    (
      await a.request.post(`/api/account/projects/${idA}`, {
        headers: { origin: "https://evil.example" },
        data: { action: "delete" },
      })
    ).status(),
  ).toBe(403);
  await page.goto(`/dashboard/projects/${idB}`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText("Email delivery is not configured");
  const reset = await a.request.post("/api/auth/request-password-reset", {
    headers: { origin: baseURL! },
    data: { email: `a-${suffix}@example.com` },
  });
  expect(reset.status()).toBe(503);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect((await a.request.get(`/api/account/projects/${idA}`)).status()).toBe(404);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Email", { exact: true }).fill(`a-${suffix}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();
  await page.getByRole("button", { name: "Manage sessions", exact: true }).click();
  await expect(page.getByText("Session 1:", { exact: false })).toBeVisible();
  await page.goto(`/dashboard/projects/${idA}`);
  await page.getByLabel("Project name").fill("A renamed");
  await page.getByLabel("Timezone").fill("Europe/Berlin");
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A renamed", exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete project", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your projects", exact: true })).toBeVisible();
  expect((await a.request.get(`/api/account/projects/${idA}`)).status()).toBe(404);
  await a.close();
  await b.close();
});

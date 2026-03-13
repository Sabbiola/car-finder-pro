import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("carfinder.backendMode", "fastapi");
    localStorage.setItem("carfinder.apiBaseUrl", "http://127.0.0.1:8000");
  });
});

test("stream happy path renders progress and merged results", async ({ page }) => {
  await page.goto("/risultati?brand=BMW&model=320d&sources=autoscout24,subito");

  await expect(page.getByText("BMW 320d Stub AutoScout24")).toBeVisible();
  await expect(page.getByText("BMW 320d Stub Subito")).toBeVisible();
  await expect(page.getByText(/autoscout24: completed/i)).toBeVisible();
  await expect(page.getByText(/subito: completed/i)).toBeVisible();
});

test("partial provider failure is shown without losing successful results", async ({ page }) => {
  await page.goto("/risultati?brand=fail-subito&model=320d&sources=autoscout24,subito");

  await expect(page.getByText("BMW 320d Stub AutoScout24")).toBeVisible();
  await expect(page.getByText(/Errori provider:/)).toBeVisible();
});

test("sort order remains stable after streamed results", async ({ page }) => {
  await page.goto("/risultati?brand=BMW&model=320d&sources=autoscout24,subito&sort=price-desc");

  const streamCards = page.locator("h3", { hasText: "Stub" });
  await expect(streamCards).toHaveCount(2);

  const firstTitle = await streamCards.first().textContent();
  const secondTitle = await streamCards.nth(1).textContent();
  expect(firstTitle).toContain("Subito");
  expect(secondTitle).toContain("AutoScout24");
});

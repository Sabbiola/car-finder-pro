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

test("legacy fallback path still works when only non-core sources are selected", async ({ page }) => {
  let scrapeInvoked = false;
  let restInvoked = false;

  await page.route("**/functions/v1/scrape-listings", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
      });
      return;
    }
    scrapeInvoked = true;
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify({ success: true, count: 1, source: "legacy" }),
    });
  });

  await page.route("**/rest/v1/car_listings*", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
      });
      return;
    }
    restInvoked = true;
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify([
        {
          id: "legacy-1",
          title: "BMW 320d Legacy Listing",
          brand: "BMW",
          model: "320d",
          trim: null,
          year: 2020,
          price: 19900,
          km: 80000,
          fuel: "Diesel",
          transmission: "Manuale",
          power: null,
          color: null,
          doors: 4,
          body_type: "Berlina",
          source: "automobile",
          source_url: "https://legacy.example.com/1",
          image_url: "https://images.example.com/legacy.jpg",
          location: "Milano",
          is_new: false,
          is_best_deal: false,
          price_rating: "good",
          scraped_at: "2026-03-12T10:00:00Z",
          extra_data: {},
        },
      ]),
    });
  });

  await page.goto("/risultati?brand=BMW&model=320d&sources=automobile");

  await expect(page.getByText("BMW 320d Legacy Listing")).toBeVisible();
  expect(scrapeInvoked).toBe(true);
  expect(restInvoked).toBe(true);
});

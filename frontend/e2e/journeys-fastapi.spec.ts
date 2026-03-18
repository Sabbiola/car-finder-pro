import { expect, test } from "@playwright/test";

const FASTAPI_BASE_URL = "http://127.0.0.1:8000";
const AUTOSCOUT_STUB_ID = "11111111-1111-4111-8111-111111111111";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("carfinder.backendMode", "fastapi");
    localStorage.setItem("carfinder.apiBaseUrl", "http://127.0.0.1:8000");
  });
});

test("search and detail journeys call backend APIs in fastapi mode", async ({ page }) => {
  const unexpectedLegacyCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/functions/v1/")) {
      unexpectedLegacyCalls.push(request.url());
    }
  });

  const streamResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${FASTAPI_BASE_URL}/api/search/stream` &&
      response.request().method() === "POST",
  );

  await page.goto("/risultati?brand=BMW&model=320d&sources=autoscout24,subito");
  const streamResponse = await streamResponsePromise;
  expect(streamResponse.ok()).toBeTruthy();

  await expect(page.getByText("BMW 320d Stub AutoScout24")).toBeVisible();
  await expect(page.getByText("BMW 320d Stub Subito")).toBeVisible();

  const detailResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/listings/${AUTOSCOUT_STUB_ID}`) &&
      response.request().method() === "GET",
  );

  await page.getByText("BMW 320d Stub AutoScout24").first().click();
  const detailResponse = await detailResponsePromise;
  expect(detailResponse.ok()).toBeTruthy();

  await expect(page).toHaveURL(new RegExp(`/auto/${AUTOSCOUT_STUB_ID}`));
  await expect(
    page.getByRole("heading", { level: 1, name: /BMW 320d Stub AutoScout24/i }),
  ).toBeVisible();

  expect(unexpectedLegacyCalls).toEqual([]);
});

test("compare journey works end-to-end via backend listings batch", async ({ page }) => {
  await page.goto("/risultati?brand=BMW&model=320d&sources=autoscout24,subito");
  await expect(page.getByText("BMW 320d Stub AutoScout24")).toBeVisible();
  await expect(page.getByText("BMW 320d Stub Subito")).toBeVisible();

  const compareButtons = page.locator('button[title="Aggiungi al confronto"]');
  await expect(compareButtons).toHaveCount(2);
  await compareButtons.first().click();
  await compareButtons.first().click();

  const batchResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${FASTAPI_BASE_URL}/api/listings/batch` &&
      response.request().method() === "POST",
  );

  await page.getByRole("button", { name: /Confronta 2 auto/i }).click();
  const batchResponse = await batchResponsePromise;
  expect(batchResponse.ok()).toBeTruthy();

  await expect(page).toHaveURL(/\/confronta\?ids=/);
  await expect(page.getByRole("heading", { name: "Confronto auto" })).toBeVisible();
  const comparisonTable = page.getByRole("table");
  await expect(comparisonTable).toContainText("BMW 320d Stub AutoScout24");
  await expect(comparisonTable).toContainText("BMW 320d Stub Subito");
});

test("favorites journey works in fastapi mode for anonymous users", async ({ page }) => {
  await page.goto("/risultati?brand=BMW&model=320d&sources=autoscout24,subito");
  await expect(page.getByText("BMW 320d Stub AutoScout24")).toBeVisible();

  const addFavoriteButton = page.getByRole("button", { name: "Aggiungi ai preferiti" }).first();
  await addFavoriteButton.click();
  await expect(page.getByRole("button", { name: "Rimuovi dai preferiti" }).first()).toBeVisible();

  const batchResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${FASTAPI_BASE_URL}/api/listings/batch` &&
      response.request().method() === "POST",
  );

  await page.getByRole("button", { name: "Preferiti", exact: true }).click();
  const batchResponse = await batchResponsePromise;
  expect(batchResponse.ok()).toBeTruthy();

  await expect(page).toHaveURL("/preferiti");
  await expect(page.getByRole("heading", { name: "Preferiti" })).toBeVisible();
  await expect(page.getByText("BMW 320d Stub AutoScout24")).toBeVisible();
});

test("saved searches and unauthenticated auth path remain stable", async ({ page }) => {
  await page.goto("/risultati?brand=BMW&model=320d&sources=autoscout24,subito");
  await expect(page.getByRole("button", { name: /^Salva$/ })).toBeVisible();
  await page.getByRole("button", { name: /^Salva$/ }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#search-name").fill("BMW 320d test");
  await page.getByRole("dialog").getByRole("button", { name: /^Salva$/ }).click();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ricerche salvate" })).toBeVisible();
  await page.getByRole("button", { name: "BMW 320d test" }).click();
  await expect(page).toHaveURL(/\/risultati\?/);

  await page.goto("/profilo");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Accedi" })).toBeVisible();
});

test("alerts can be created and deactivated from detail page in fastapi mode", async ({ page }) => {
  const detailResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/listings/${AUTOSCOUT_STUB_ID}`) &&
      response.request().method() === "GET",
  );
  await page.goto(
    `/auto/${AUTOSCOUT_STUB_ID}?source_url=${encodeURIComponent("https://stub.autoscout24.local/listing-1")}`,
  );
  const detailResponse = await detailResponsePromise;
  expect(detailResponse.ok()).toBeTruthy();

  await expect(page.getByRole("button", { name: "Imposta alert prezzo" })).toBeVisible();
  await page.getByRole("button", { name: "Imposta alert prezzo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#alert-target-price").fill("23000");

  const createAlertResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${FASTAPI_BASE_URL}/api/alerts` &&
      response.request().method() === "POST",
  );
  await page.getByRole("dialog").getByRole("button", { name: "Attiva alert" }).click();
  const createAlertResponse = await createAlertResponsePromise;
  expect(createAlertResponse.ok()).toBeTruthy();

  await expect(page.getByRole("button", { name: "Rimuovi alert prezzo" })).toBeVisible();

  const deactivateAlertResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/alerts/") &&
      response.url().includes("/deactivate") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Rimuovi alert prezzo" }).click();
  const deactivateAlertResponse = await deactivateAlertResponsePromise;
  expect(deactivateAlertResponse.ok()).toBeTruthy();

  await expect(page.getByRole("button", { name: "Imposta alert prezzo" })).toBeVisible();
});

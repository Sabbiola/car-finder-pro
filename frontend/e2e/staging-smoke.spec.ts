import { expect, test, type Page } from "@playwright/test";

const DEFAULT_SEARCH_PATH = "/risultati?brand=BMW&model=320d&sources=autoscout24,subito";
const STAGING_SEARCH_PATH = process.env.PLAYWRIGHT_STAGING_SEARCH_PATH?.trim() || DEFAULT_SEARCH_PATH;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function gotoSearchAndWaitStream(page: Page): Promise<void> {
  const streamResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/search/stream") &&
      response.request().method() === "POST",
  );

  await page.goto(STAGING_SEARCH_PATH);
  const streamResponse = await streamResponsePromise;
  expect(streamResponse.ok()).toBeTruthy();
}

function captureLegacyCalls(page: Page): string[] {
  const unexpectedLegacyCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/functions/v1/")) {
      unexpectedLegacyCalls.push(request.url());
    }
  });
  return unexpectedLegacyCalls;
}

test("staging smoke covers search/stream/compare/favorites/saved-searches/auth", async ({ page }) => {
  const unexpectedLegacyCalls = captureLegacyCalls(page);

  await gotoSearchAndWaitStream(page);
  await expect(page.getByText("Override runtime browser attivo")).toHaveCount(0);

  const compareButtons = page.locator('button[title="Aggiungi al confronto"]');
  await expect
    .poll(async () => compareButtons.count(), { timeout: 90_000 })
    .toBeGreaterThanOrEqual(2);

  await compareButtons.first().click();
  await compareButtons.nth(1).click();

  const openCompareButton = page.getByRole("button", { name: /Confronta\s+\d+\s+auto/i });
  await expect(openCompareButton).toBeVisible();

  const compareBatchResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/listings/batch") &&
      response.request().method() === "POST",
  );
  await openCompareButton.click();
  const compareBatchResponse = await compareBatchResponsePromise;
  expect(compareBatchResponse.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/confronta\?ids=/);
  await expect(page.getByRole("heading", { name: "Confronto auto" })).toBeVisible();

  await gotoSearchAndWaitStream(page);
  const addFavoriteButton = page.getByRole("button", { name: "Aggiungi ai preferiti" }).first();
  await addFavoriteButton.click();
  await expect(page.getByRole("button", { name: "Rimuovi dai preferiti" }).first()).toBeVisible();

  const favoritesBatchResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/listings/batch") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Preferiti" }).click();
  const favoritesBatchResponse = await favoritesBatchResponsePromise;
  expect(favoritesBatchResponse.ok()).toBeTruthy();
  await expect(page).toHaveURL("/preferiti");
  await expect(page.getByRole("heading", { name: "Preferiti" })).toBeVisible();

  await gotoSearchAndWaitStream(page);
  const saveName = `staging-smoke-${Date.now()}`;
  const saveButtons = page.getByRole("button", { name: /^Salva$/ });
  await expect(saveButtons.last()).toBeVisible();
  await saveButtons.last().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#search-name").fill(saveName);
  await page.getByRole("dialog").getByRole("button", { name: /^Salva$/ }).click();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ricerche salvate" })).toBeVisible();
  await page.getByRole("button", { name: saveName }).click();
  await expect(page).toHaveURL(/\/risultati\?/);

  await page.goto("/profilo");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Accedi" })).toBeVisible();

  expect(unexpectedLegacyCalls).toEqual([]);
});

test("staging smoke covers detail and alerts flows", async ({ page }) => {
  const unexpectedLegacyCalls = captureLegacyCalls(page);

  await gotoSearchAndWaitStream(page);
  const resultTitle = page.locator("h3").first();
  await expect(resultTitle).toBeVisible();

  const detailResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/listings/") &&
      response.request().method() === "GET",
  );
  await resultTitle.click();
  const detailResponse = await detailResponsePromise;
  expect(detailResponse.ok()).toBeTruthy();

  await expect(page).toHaveURL(/\/auto\/[^/?#]+/);
  const listingId = page.url().match(/\/auto\/([^/?#]+)/)?.[1];
  if (!listingId || !UUID_REGEX.test(listingId)) {
    throw new Error(
      "Staging smoke alerts flow requires a UUID listing id. Adjust PLAYWRIGHT_STAGING_SEARCH_PATH.",
    );
  }

  const setAlertButton = page.getByRole("button", { name: "Imposta alert prezzo" });
  const removeAlertButton = page.getByRole("button", { name: "Rimuovi alert prezzo" });
  await expect(setAlertButton.or(removeAlertButton)).toBeVisible();

  if ((await removeAlertButton.count()) > 0) {
    const deactivateResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/alerts/") &&
        response.url().includes("/deactivate") &&
        response.request().method() === "POST",
    );
    await removeAlertButton.first().click();
    const deactivateResponse = await deactivateResponsePromise;
    expect(deactivateResponse.ok()).toBeTruthy();
    await expect(setAlertButton).toBeVisible();
  }

  await setAlertButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#alert-target-price").fill("10000");

  const createAlertResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/alerts") &&
      response.request().method() === "POST",
  );
  await page.getByRole("dialog").getByRole("button", { name: "Attiva alert" }).click();
  const createAlertResponse = await createAlertResponsePromise;
  expect(createAlertResponse.ok()).toBeTruthy();
  await expect(removeAlertButton).toBeVisible();

  const deactivateResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/alerts/") &&
      response.url().includes("/deactivate") &&
      response.request().method() === "POST",
  );
  await removeAlertButton.first().click();
  const deactivateResponse = await deactivateResponsePromise;
  expect(deactivateResponse.ok()).toBeTruthy();
  await expect(setAlertButton).toBeVisible();

  expect(unexpectedLegacyCalls).toEqual([]);
});

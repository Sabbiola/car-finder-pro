import { defineConfig, devices } from "@playwright/test";

const FRONTEND_BASE_URL = process.env.PLAYWRIGHT_STAGING_FRONTEND_URL?.trim();

if (!FRONTEND_BASE_URL) {
  throw new Error(
    "PLAYWRIGHT_STAGING_FRONTEND_URL is required for the staging smoke lane (set repository secret PLAYWRIGHT_STAGING_FRONTEND_URL for CI).",
  );
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/staging-smoke.spec.ts"],
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never" }],
        ["junit", { outputFile: "test-results/staging-smoke-junit.xml" }],
      ]
    : "list",
  use: {
    baseURL: FRONTEND_BASE_URL.replace(/\/+$/, ""),
    outputDir: "test-results/staging-smoke",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-staging-smoke",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

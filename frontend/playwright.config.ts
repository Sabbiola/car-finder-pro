import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const FRONTEND_PORT = 4173;
const BACKEND_PORT = 8000;
const CONFIG_DIR = dirname(fileURLToPath(import.meta.url));
const BACKEND_PYTHON_CANDIDATES = [
  resolve(CONFIG_DIR, "../backend/.venv/Scripts/python.exe"),
  resolve(CONFIG_DIR, "../backend/.venv/bin/python"),
];
const backendPythonExecutable =
  BACKEND_PYTHON_CANDIDATES.find((candidate) => existsSync(candidate)) ?? "python";
const backendPythonCommand =
  backendPythonExecutable === "python" ? backendPythonExecutable : `"${backendPythonExecutable}"`;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/staging-smoke.spec.ts"],
  timeout: 45_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `${backendPythonCommand} -m uvicorn app.main:app --host 127.0.0.1 --port ${BACKEND_PORT}`,
      cwd: "../backend",
      env: {
        TEST_STUB_MODE: "true",
        LOG_LEVEL: "info",
        CORS_ORIGINS: `["http://127.0.0.1:${FRONTEND_PORT}"]`,
      },
      url: `http://127.0.0.1:${BACKEND_PORT}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${FRONTEND_PORT}`,
      cwd: ".",
      env: {
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
        VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
        VITE_BACKEND_MODE: "fastapi",
        VITE_API_BASE_URL: `http://127.0.0.1:${BACKEND_PORT}`,
      },
      url: `http://127.0.0.1:${FRONTEND_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

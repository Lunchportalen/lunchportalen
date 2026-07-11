import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Load local env for the TEST RUNNER process (webServer/Next loads it on its own).
// Without this, E2E_* credentials in .env.local are invisible to test.skip-guards
// and every authenticated scenario silently skips.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

// Generic test-user fallback: reuse employee credentials when E2E_TEST_USER_* is unset.
if (!process.env.E2E_TEST_USER_EMAIL && process.env.E2E_EMPLOYEE_EMAIL) {
  process.env.E2E_TEST_USER_EMAIL = process.env.E2E_EMPLOYEE_EMAIL;
  process.env.E2E_TEST_USER_PASSWORD = process.env.E2E_EMPLOYEE_PASSWORD ?? "";
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const externalServer =
  process.env.LP_E2E_EXTERNAL_SERVER === "1" ||
  process.env.LP_E2E_EXTERNAL_SERVER === "true" ||
  process.env.LP_E2E_EXTERNAL_SERVER === "yes" ||
  process.env.LP_E2E_EXTERNAL_SERVER === "on";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/*.e2e.ts", "**/*@(spec|test).?(c|m)[jt]s?(x)"],
  timeout: 30_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  webServer: externalServer
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
      },
    },
  ],
});
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

import { isStagingRuntimeBaseUrl, stagingBypassHeaders } from "./e2e/helpers/staging-edge-bypass";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://staging.app.lunchportalen.no";
const stagingHeaders = stagingBypassHeaders(baseURL);

if (!isStagingRuntimeBaseUrl(baseURL)) {
  throw new Error(`playwright.staging-runtime.config.ts requires staging base URL, got ${baseURL}`);
}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/staging-global-setup.ts",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    extraHTTPHeaders: stagingHeaders,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
    { name: "tablet", use: { ...devices["iPad (gen 7)"] } },
  ],
});

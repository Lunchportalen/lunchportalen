import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const externalServer =
  process.env.LP_E2E_EXTERNAL_SERVER === "1" ||
  process.env.LP_E2E_EXTERNAL_SERVER === "true" ||
  process.env.LP_E2E_EXTERNAL_SERVER === "yes" ||
  process.env.LP_E2E_EXTERNAL_SERVER === "on";

/** STEG 0 — /week visual regression only (Docker-rendered baselines). */
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/week-visual-regression.e2e.ts"],
  timeout: 60_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
    },
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-week-visual-report" }]],
  snapshotPathTemplate:
    "{testDir}/{testFileDir}/{testFileName}-snapshots/{projectName}/{arg}{ext}",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "nb-NO",
    timezoneId: "Europe/Oslo",
    colorScheme: "light",
    deviceScaleFactor: 1,
  },
  webServer: externalServer
    ? undefined
    : {
        command: "npm run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: "week-visual-desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "week-visual-mobile",
      use: {
        ...devices["Pixel 5"],
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});

import { defineConfig, devices } from "@playwright/test";

import {
  hasWeekVisualEmployeeCreds,
  WEEK_VISUAL_AUTH_STATE_PATH,
} from "./e2e/helpers/week-visual-auth";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const useEmployeeSession = hasWeekVisualEmployeeCreds();

const externalServer =
  process.env.LP_E2E_EXTERNAL_SERVER === "1" ||
  process.env.LP_E2E_EXTERNAL_SERVER === "true" ||
  process.env.LP_E2E_EXTERNAL_SERVER === "yes" ||
  process.env.LP_E2E_EXTERNAL_SERVER === "on";

/** STEG 0 — /week visual regression only (Docker-rendered baselines). */
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/week-visual-regression.e2e.ts"],
  globalSetup: useEmployeeSession
    ? "./e2e/global-setup/week-visual-auth.setup.ts"
    : undefined,
  timeout: 60_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      maxDiffPixels: 500,
      threshold: 0.2,
      animations: "disabled",
    },
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-week-visual-report" }]],
  snapshotPathTemplate:
    "{testDir}/{testFileDir}/{testFileName}-snapshots/{projectName}/{arg}{ext}",
  use: {
    baseURL,
    ...(useEmployeeSession
      ? { storageState: WEEK_VISUAL_AUTH_STATE_PATH }
      : {}),
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

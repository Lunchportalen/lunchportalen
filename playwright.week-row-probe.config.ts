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

/** STEG 5.3 — row radius computed-style probe only. */
export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "**/week-row-radius-probe.e2e.ts",
    "**/week-slot-probe.e2e.ts",
    "**/week-chip-probe.e2e.ts",
    "**/week-motion-probe.e2e.ts",
    "**/week-state-probe.e2e.ts",
    "**/week-collapse-probe.e2e.ts",
    "**/week-icon-probe.e2e.ts",
    "**/week-icon-eyes-on.e2e.ts",
  ],
  globalSetup: useEmployeeSession
    ? "./e2e/global-setup/week-visual-auth.setup.ts"
    : undefined,
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    ...(useEmployeeSession
      ? { storageState: WEEK_VISUAL_AUTH_STATE_PATH }
      : {}),
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
  ],
});

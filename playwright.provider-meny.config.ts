import { defineConfig } from "@playwright/test";

import {
  hasProviderMenyVisualKitchenCreds,
  PROVIDER_MENY_VISUAL_AUTH_STATE_PATH,
} from "./e2e/helpers/provider-meny-visual-auth";

if (
  process.argv.includes("--update-snapshots") &&
  process.platform !== "linux"
) {
  throw new Error(
    "Provider meny visual baselines are Linux-only. Use scripts/e2e/provider-meny-visual-docker.sh or CI workflow_dispatch on noble.",
  );
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const useKitchenSession = hasProviderMenyVisualKitchenCreds();

const externalServer =
  process.env.LP_E2E_EXTERNAL_SERVER === "1" ||
  process.env.LP_E2E_EXTERNAL_SERVER === "true" ||
  process.env.LP_E2E_EXTERNAL_SERVER === "yes" ||
  process.env.LP_E2E_EXTERNAL_SERVER === "on";

/** /leverandor/meny visual regression — live React route, seeded GET /api/provider/menu-days mock. */
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/provider-meny-visual-regression.e2e.ts"],
  globalSetup: useKitchenSession
    ? "./e2e/global-setup/provider-meny-visual-auth.setup.ts"
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
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-provider-meny-visual-report" }],
  ],
  snapshotPathTemplate:
    "{testDir}/{testFileDir}/{testFileName}-snapshots/{projectName}/{arg}{ext}",
  use: {
    baseURL,
    ...(useKitchenSession ? { storageState: PROVIDER_MENY_VISUAL_AUTH_STATE_PATH } : {}),
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
      name: "provider-meny-desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});

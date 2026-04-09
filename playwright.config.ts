// playwright.config.ts — E2E + visual regression for Lunchportalen (AGENTS.md compliant)
// Phase 1: Playwright foundation — desktop chromium, mobile viewport, baseURL, failure artifacts, stable output paths
import { defineConfig, devices } from "@playwright/test";

/** Optional dedicated port for Playwright-spawned dev (use with LP_PLAYWRIGHT_WEBSERVER_LOCAL_CMS=1 when :3000 is already taken). */
const playwrightDevPort = process.env.LP_PLAYWRIGHT_DEV_PORT?.trim();

/** When set, Playwright spawns `npm run dev` with LP_CMS_RUNTIME_MODE=local_provider and does not reuse an existing server (avoids stale remote_backend instances blocking canonical login). */
const forceLocalCmsWebServer = process.env.LP_PLAYWRIGHT_WEBSERVER_LOCAL_CMS === "1";

/** U98B — use already-running server (e.g. PORT=3055); disables Playwright webServer. */
const externalServer = process.env.LP_E2E_EXTERNAL_SERVER === "1";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  (forceLocalCmsWebServer && playwrightDevPort
    ? `http://localhost:${playwrightDevPort}`
    : "http://localhost:3000");

const webServerCommand =
  forceLocalCmsWebServer && playwrightDevPort
    ? `cross-env PORT=${playwrightDevPort} LP_CMS_RUNTIME_MODE=local_provider npm run dev`
    : forceLocalCmsWebServer
      ? `cross-env LP_CMS_RUNTIME_MODE=local_provider npm run dev`
      : "npm run dev";

export default defineConfig({
  testDir: "e2e",
  // Allow both *.e2e.ts and *.spec.ts Playwright suites in e2e/
  testMatch: /.*\.(e2e|spec)\.ts$/,
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["html", { open: "on-failure", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  timeout: 30_000,
  expect: { timeout: 10_000 },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 14"], viewport: { width: 390, height: 844 } } },
  ],
  webServer:
    process.env.CI || externalServer
      ? undefined
      : {
          command: webServerCommand,
          url: baseURL,
          reuseExistingServer: forceLocalCmsWebServer ? false : true,
          timeout: forceLocalCmsWebServer ? 120_000 : 60_000,
          env: {
            ...process.env,
            ...(forceLocalCmsWebServer && !playwrightDevPort ? { LP_CMS_RUNTIME_MODE: "local_provider" } : {}),
          },
        },
});

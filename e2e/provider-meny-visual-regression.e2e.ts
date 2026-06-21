// e2e/provider-meny-visual-regression.e2e.ts — Live /leverandor/meny visual regression (seeded API mock)
import { test, expect } from "@playwright/test";

import { hasProviderMenyVisualKitchenCreds } from "./helpers/provider-meny-visual-auth";
import {
  installProviderMenyVisualMocks,
  installProviderMenyVisualOsloClock,
  navigateToProviderMeny,
  PROVIDER_MENU_VISUAL_OSLO_DATE,
  PROVIDER_MENY_VISUAL_SCREENSHOT_OPTS,
  providerMenyEditorRootLocator,
  selectProviderMenyTier,
  waitForProviderMenyVisualReady,
} from "./helpers/provider-meny-visual";

const hasKitchenCreds = hasProviderMenyVisualKitchenCreds();

test.describe("Provider meny visual regression @provider-meny-visual", () => {
  test.skip(!hasKitchenCreds, "E2E_TEST_USER_* required (provider kitchen membership)");

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installProviderMenyVisualOsloClock(page, PROVIDER_MENU_VISUAL_OSLO_DATE);
    await installProviderMenyVisualMocks(page);
  });

  test("Enterprise — full tier workspace", async ({ page }, testInfo) => {
    await navigateToProviderMeny(page);
    await selectProviderMenyTier(page, "Enterprise");
    await waitForProviderMenyVisualReady(page);

    await expect(page.locator(".ds-admin-sidebar")).toBeVisible();
    await expect(page.locator(".ds-admin-sidebar__item.is-active", { hasText: "Meny" })).toBeVisible();
    await expect(page.locator(".lp-editor-priceline")).toBeVisible();
    await expect(page.locator(".lp-editor-status-strip")).toBeVisible();
    await expect(page.locator(".lp-editor-prem").first()).toBeVisible();
    await expect(page.getByText("Enterprise-upgrade").first()).toBeVisible();
    // Fixture stub (not live Sanity): Tue override+locked day from buildProviderMenyVisualMenuDaysResponse()
    await expect(page.getByText("Kyllinggryte")).toBeVisible();
    await expect(page.getByText(/14 porsjoner/)).toBeVisible();

    await expect(providerMenyEditorRootLocator(page)).toHaveScreenshot(
      `provider-meny-enterprise-${testInfo.project.name}.png`,
      PROVIDER_MENY_VISUAL_SCREENSHOT_OPTS,
    );
  });

  test("Basis — premium hidden", async ({ page }, testInfo) => {
    await navigateToProviderMeny(page);
    await selectProviderMenyTier(page, "Basis");
    await waitForProviderMenyVisualReady(page);

    await expect(page.locator(".lp-editor-prem")).toHaveCount(0);
    await expect(page.getByText("Enterprise-upgrade")).toHaveCount(0);

    await expect(providerMenyEditorRootLocator(page)).toHaveScreenshot(
      `provider-meny-basis-${testInfo.project.name}.png`,
      PROVIDER_MENY_VISUAL_SCREENSHOT_OPTS,
    );
  });
});

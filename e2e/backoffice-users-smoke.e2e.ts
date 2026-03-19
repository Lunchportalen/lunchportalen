// e2e/backoffice-users-smoke.e2e.ts — Backoffice Users: load + safe empty/error state (no crash).
// Proves page survives normal data, empty list, or API error without fatal render.

import { test, expect } from "@playwright/test";
import {
  getCredentialsForRole,
  loginViaForm,
  waitForPostLoginNavigation,
  type E2ERole,
} from "./helpers/auth";
import { waitForMainContent } from "./helpers/ready";

const hasSuperadminCreds =
  !!process.env.E2E_SUPERADMIN_EMAIL && !!process.env.E2E_SUPERADMIN_PASSWORD;

async function assertNoCrashText(page: import("@playwright/test").Page) {
  const html = await page.content();
  const crashPatterns = [/application error/i, /something went wrong/i, /unhandled runtime error/i];
  for (const pattern of crashPatterns) {
    expect(html).not.toMatch(pattern);
  }
}

test.describe("Backoffice Users smoke (superadmin)", () => {
  test.skip(!hasSuperadminCreds, "Users smoke requires E2E_SUPERADMIN_EMAIL/E2E_SUPERADMIN_PASSWORD");

  test("loads safely and shows either list, empty state, or error state (no crash)", async ({ page }) => {
    const creds = getCredentialsForRole("superadmin" as E2ERole);
    if (!creds) throw new Error("Missing E2E_SUPERADMIN_* credentials");

    await loginViaForm(page, creds.email, creds.password, "/backoffice/users");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/users/);
    await waitForMainContent(page);

    await assertNoCrashText(page);

    const heading = page.getByRole("heading", { name: /brukere/i });
    await expect(heading).toBeVisible({ timeout: 10_000 });

    const main = page.getByRole("main");
    await expect(main).toBeVisible();

    // Wait for data to settle (loading → list / empty / error)
    await expect(
      main.getByText(/viser \d+ av \d+ brukere|ingen brukere funnet|ingen brukere matcher|laster brukere/i)
    ).toBeVisible({ timeout: 12_000 });

    // Safe terminal state: table with rows, or empty copy, or error box
    const hasTableRows = (await main.locator("table tbody tr").count()) > 0;
    const hasEmpty = await main.getByText(/ingen brukere funnet|ingen brukere matcher/i).isVisible();
    const hasError = await main.locator("[class*='red-50']").filter({ hasText: /.+/ }).first().isVisible();
    expect(hasTableRows || hasEmpty || hasError).toBe(true);
  });
});

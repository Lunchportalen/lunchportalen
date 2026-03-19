// e2e/auth-role.e2e.ts — Login + role landing (runs when E2E_TEST_USER_EMAIL + E2E_TEST_USER_PASSWORD are set)
import { test, expect } from "@playwright/test";
import { getE2ETestUser, loginViaForm, waitForPostLoginNavigation } from "./helpers/auth";

const hasTestUser = !!getE2ETestUser();

test.describe("Auth role landing (authenticated)", () => {
  test.skip(!hasTestUser, "E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD must be set");

  test("login and land on expected surface without loop", async ({ page }) => {
    const creds = getE2ETestUser()!;
    await loginViaForm(page, creds.email, creds.password);
    await waitForPostLoginNavigation(page);

    expect(page.url()).not.toMatch(/\/login/);
    await expect(page).not.toHaveURL(/\/login$/);
    await expect(page.getByRole("main")).toBeVisible({ timeout: 15_000 });
  });

  test("post-login redirect to /week when next=week", async ({ page }) => {
    const creds = getE2ETestUser()!;
    await loginViaForm(page, creds.email, creds.password, "/week");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/week/);
  });
});

// e2e/shells.e2e.ts — Critical app surfaces render (unauthenticated → login; optional auth → shell content)
import { test, expect } from "@playwright/test";
import { getE2ETestUser, loginViaForm, waitForPostLoginNavigation } from "./helpers/auth";
import { waitForMainContent } from "./helpers/ready";

test.describe("Shells — unauthenticated", () => {
  test("week redirects to login", async ({ page }) => {
    await page.goto("/week");
    await expect(page).toHaveURL(/\/login/);
  });

  test("orders redirects to login", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin redirects to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("superadmin redirects to login", async ({ page }) => {
    await page.goto("/superadmin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("backoffice redirects to login", async ({ page }) => {
    await page.goto("/backoffice/content");
    await expect(page).toHaveURL(/\/login/);
  });

  test("driver redirects to login", async ({ page }) => {
    await page.goto("/driver");
    await expect(page).toHaveURL(/\/login/);
  });

  test("kitchen redirects to login", async ({ page }) => {
    await page.goto("/kitchen");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Shells — public and login", () => {
  test("public front page renders main and hero", async ({ page }) => {
    await page.goto("/");
    await waitForMainContent(page);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("login page shows form and no loop", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /logg inn/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /logg inn/i })).toBeVisible();
  });
});

const hasTestUser = !!getE2ETestUser();

test.describe("Shells — authenticated (when E2E test user set)", () => {
  test.skip(!hasTestUser);

  test("week page shell renders after login", async ({ page }) => {
    const creds = getE2ETestUser()!;
    await loginViaForm(page, creds.email, creds.password, "/week");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/week/);
    await waitForMainContent(page);
    await expect(page.getByRole("main")).toBeVisible({ timeout: 15_000 });
  });

  test("admin shell reachable after login (company_admin)", async ({ page }) => {
    const creds = getE2ETestUser()!;
    await loginViaForm(page, creds.email, creds.password, "/admin");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/admin/);
    await waitForMainContent(page);
    await expect(page.getByRole("main")).toBeVisible({ timeout: 15_000 });
  });
});

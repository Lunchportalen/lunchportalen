// e2e/mobile-invariants.e2e.ts — Mobile layout laws (Phase 5, AGENTS.md S1)
// Browser-level checks: no horizontal overflow, primary nav/CTA visible, no catastrophic layout break.
// Viewport: 390×844 (iPhone-class).
// If a route is intentionally desktop-first and fails here, fix the layout or document in docs/E2E.md; do not relax assertions.
import { test, expect } from "@playwright/test";
import { getCredentialsForRole, loginViaForm, waitForPostLoginNavigation } from "./helpers/auth";
import {
  waitForMainContent,
  assertLoginPageReady,
  assertNoHorizontalOverflow,
  assertInViewport,
} from "./helpers/ready";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
test.use({ viewport: MOBILE_VIEWPORT });

const hasEmployeeCreds = !!getCredentialsForRole("employee");
const hasAdminCreds = !!getCredentialsForRole("company_admin");
const hasSuperadminCreds = !!getCredentialsForRole("superadmin");

test.describe("Mobile invariants — public", () => {
  test("/ — no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await waitForMainContent(page);
    await assertNoHorizontalOverflow(page);
  });

  test("/ — primary landmark visible and in viewport", async ({ page }) => {
    await page.goto("/");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    await assertInViewport(page, main);
  });

  test("/login — no horizontal overflow", async ({ page }) => {
    await page.goto("/login");
    await assertLoginPageReady(page);
    await assertNoHorizontalOverflow(page);
  });

  test("/login — primary CTA (Logg inn) visible and touch-safe", async ({ page }) => {
    await page.goto("/login");
    const btn = page.getByRole("button", { name: /logg inn/i });
    await expect(btn).toBeVisible();
    await assertInViewport(page, btn);
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("Mobile invariants — /week", () => {
  test("/week unauthenticated → login: no horizontal overflow", async ({ page }) => {
    await page.goto("/week");
    await expect(page).toHaveURL(/\/login/);
    await assertLoginPageReady(page);
    await assertNoHorizontalOverflow(page);
  });

  test("/week authenticated: no horizontal overflow", async ({ page }) => {
    test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* or E2E_TEST_USER_* required");
    const creds = getCredentialsForRole("employee")!;
    await loginViaForm(page, creds.email, creds.password, "/week");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/week/);
    await waitForMainContent(page);
    await assertNoHorizontalOverflow(page);
  });

  test("/week authenticated: primary content visible in viewport", async ({ page }) => {
    test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* or E2E_TEST_USER_* required");
    const creds = getCredentialsForRole("employee")!;
    await loginViaForm(page, creds.email, creds.password, "/week");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/week/);
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    await assertInViewport(page, main);
  });
});

test.describe("Mobile invariants — /admin", () => {
  test("/admin unauthenticated → login: no horizontal overflow", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
    await assertLoginPageReady(page);
    await assertNoHorizontalOverflow(page);
  });

  test("/admin authenticated: no horizontal overflow", async ({ page }) => {
    test.skip(!hasAdminCreds, "E2E_ADMIN_* or E2E_TEST_USER_* required");
    const creds = getCredentialsForRole("company_admin")!;
    await loginViaForm(page, creds.email, creds.password, "/admin");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/admin/);
    await waitForMainContent(page);
    await assertNoHorizontalOverflow(page);
  });

  test("/admin authenticated: main content visible in viewport", async ({ page }) => {
    test.skip(!hasAdminCreds, "E2E_ADMIN_* or E2E_TEST_USER_* required");
    const creds = getCredentialsForRole("company_admin")!;
    await loginViaForm(page, creds.email, creds.password, "/admin");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/admin/);
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    await assertInViewport(page, main);
  });
});

test.describe("Mobile invariants — /backoffice", () => {
  test("/backoffice unauthenticated → login: no horizontal overflow", async ({ page }) => {
    await page.goto("/backoffice/content");
    await expect(page).toHaveURL(/\/login/);
    await assertLoginPageReady(page);
    await assertNoHorizontalOverflow(page);
  });

  test("/backoffice/content authenticated: no horizontal overflow", async ({ page }) => {
    test.skip(!hasSuperadminCreds, "E2E_SUPERADMIN_* or E2E_TEST_USER_* required");
    const creds = getCredentialsForRole("superadmin")!;
    await loginViaForm(page, creds.email, creds.password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/content/);
    await page.getByRole("heading", { name: /content/i }).waitFor({ state: "visible", timeout: 15_000 });
    await assertNoHorizontalOverflow(page);
  });

  test("/backoffice/content authenticated: content heading visible in viewport", async ({ page }) => {
    test.skip(!hasSuperadminCreds, "E2E_SUPERADMIN_* or E2E_TEST_USER_* required");
    const creds = getCredentialsForRole("superadmin")!;
    await loginViaForm(page, creds.email, creds.password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/content/);
    const heading = page.getByRole("heading", { name: /content/i });
    await expect(heading).toBeVisible();
    await assertInViewport(page, heading);
  });
});

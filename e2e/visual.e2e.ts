// e2e/visual.e2e.ts — Visual regression for stable, high-value surfaces (Phase 4)
import { test, expect } from "@playwright/test";
import {
  getCredentialsForRole,
  loginViaForm,
  waitForPostLoginNavigation,
} from "./helpers/auth";
import {
  waitForMainContent,
  assertLoginPageReady,
  waitForFontsReady,
} from "./helpers/ready";

const hasEmployeeCreds = !!getCredentialsForRole("employee");
const hasAdminCreds = !!getCredentialsForRole("company_admin");
const hasSuperadminCreds = !!getCredentialsForRole("superadmin");

async function settleLayout(page: import("@playwright/test").Page) {
  await waitForFontsReady(page);
}

test.describe("Visual regression — public", () => {
  test("public home", async ({ page }) => {
    await page.goto("/");
    await waitForMainContent(page);
    await settleLayout(page);
    await expect(page).toHaveScreenshot("public-home.png", {
      fullPage: false,
      maxDiffPixels: 300,
    });
  });

  test("login page", async ({ page }) => {
    await page.goto("/login");
    await assertLoginPageReady(page);
    await settleLayout(page);
    await expect(page).toHaveScreenshot("login.png", {
      fullPage: false,
      maxDiffPixels: 100,
    });
  });
});

test.describe("Visual regression — redirect to login", () => {
  test("week redirect shows login", async ({ page }) => {
    await page.goto("/week");
    await expect(page).toHaveURL(/\/login/);
    await assertLoginPageReady(page);
    await settleLayout(page);
    await expect(page).toHaveScreenshot("week-redirect-login.png", {
      fullPage: false,
      maxDiffPixels: 100,
    });
  });
});

test.describe("Visual regression — employee week (masked)", () => {
  test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* or E2E_TEST_USER_* required");

  test("week shell as employee", async ({ page }) => {
    const creds = getCredentialsForRole("employee")!;
    await loginViaForm(page, creds.email, creds.password, "/week");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/week/);
    await waitForMainContent(page);
    await settleLayout(page);
    await expect(page).toHaveScreenshot("employee-week.png", {
      fullPage: false,
      maxDiffPixels: 200,
      mask: [page.getByRole("main")],
    });
  });
});

test.describe("Visual regression — admin landing (masked)", () => {
  test.skip(!hasAdminCreds, "E2E_ADMIN_* or E2E_TEST_USER_* required");

  test("admin shell", async ({ page }) => {
    const creds = getCredentialsForRole("company_admin")!;
    await loginViaForm(page, creds.email, creds.password, "/admin");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/admin/);
    await waitForMainContent(page);
    await settleLayout(page);
    await expect(page).toHaveScreenshot("admin-landing.png", {
      fullPage: false,
      maxDiffPixels: 200,
      mask: [page.getByRole("main")],
    });
  });
});

test.describe("Visual regression — superadmin/system (masked)", () => {
  test.skip(!hasSuperadminCreds, "E2E_SUPERADMIN_* or E2E_TEST_USER_* required");

  test("superadmin system shell", async ({ page }) => {
    const creds = getCredentialsForRole("superadmin")!;
    await loginViaForm(page, creds.email, creds.password, "/superadmin/system");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/superadmin\/system/);
    await page.getByRole("heading", { name: /systemstatus/i }).waitFor({ state: "visible", timeout: 15_000 });
    await settleLayout(page);
    const systemCard = page.getByRole("heading", { name: /systemstatus/i }).locator("../..");
    await expect(page).toHaveScreenshot("superadmin-system.png", {
      fullPage: false,
      maxDiffPixels: 200,
      mask: [systemCard],
    });
  });
});

test.describe("Visual regression — backoffice content landing", () => {
  test.skip(!hasSuperadminCreds, "Backoffice requires superadmin creds");

  test("backoffice content shell", async ({ page }) => {
    const creds = getCredentialsForRole("superadmin")!;
    await loginViaForm(page, creds.email, creds.password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/content/);
    await page.getByRole("heading", { name: /content/i }).waitFor({ state: "visible", timeout: 15_000 });
    await settleLayout(page);
    await expect(page).toHaveScreenshot("backoffice-content.png", {
      fullPage: false,
      maxDiffPixels: 200,
    });
  });
});

test.describe("Visual regression — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile — login", async ({ page }) => {
    await page.goto("/login");
    await assertLoginPageReady(page);
    await settleLayout(page);
    await expect(page).toHaveScreenshot("mobile-login.png", {
      fullPage: false,
      maxDiffPixels: 100,
    });
  });

  test("mobile — week redirect to login", async ({ page }) => {
    await page.goto("/week");
    await expect(page).toHaveURL(/\/login/);
    await assertLoginPageReady(page);
    await settleLayout(page);
    await expect(page).toHaveScreenshot("mobile-week-redirect-login.png", {
      fullPage: false,
      maxDiffPixels: 100,
    });
  });

  test("mobile — employee week shell (masked)", async ({ page }) => {
    test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* or E2E_TEST_USER_* required");
    const creds = getCredentialsForRole("employee")!;
    await loginViaForm(page, creds.email, creds.password, "/week");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/week/);
    await waitForMainContent(page);
    await settleLayout(page);
    await expect(page).toHaveScreenshot("mobile-employee-week.png", {
      fullPage: false,
      maxDiffPixels: 200,
      mask: [page.getByRole("main")],
    });
  });
});

// e2e/core-flows.e2e.ts — Core E2E flows for auth + role surfaces (Phase 3)
import { test, expect } from "@playwright/test";
import {
  getCredentialsForRole,
  loginViaForm,
  waitForPostLoginNavigation,
  type E2ERole,
} from "./helpers/auth";
import { assertProtectedShellReady, waitForMainContent } from "./helpers/ready";

const hasEmployeeCreds = !!process.env.E2E_EMPLOYEE_EMAIL && !!process.env.E2E_EMPLOYEE_PASSWORD;
const hasAdminCreds = !!process.env.E2E_ADMIN_EMAIL && !!process.env.E2E_ADMIN_PASSWORD;
const hasSuperadminCreds = !!process.env.E2E_SUPERADMIN_EMAIL && !!process.env.E2E_SUPERADMIN_PASSWORD;

function requireRoleCreds(role: E2ERole) {
  const creds = getCredentialsForRole(role);
  if (!creds) {
    throw new Error(`Missing credentials for role ${role}. See docs/E2E.md for env setup.`);
  }
  return creds;
}

// 2. LOGIN + POST-LOGIN
test.describe("Login + post-login (role landing)", () => {
  test.describe("employee", () => {
    test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_EMAIL/E2E_EMPLOYEE_PASSWORD must be set");

    test("login as employee → lands on /week", async ({ page }) => {
      const { email, password } = requireRoleCreds("employee");
      await loginViaForm(page, email, password, "/week");
      await waitForPostLoginNavigation(page);
      await expect(page).toHaveURL(/\/week/);
      await assertProtectedShellReady(page);
    });
  });

  test.describe("admin (company_admin)", () => {
    test.skip(!hasAdminCreds, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD must be set");

    test("login as admin → lands on /admin", async ({ page }) => {
      const { email, password } = requireRoleCreds("company_admin");
      await loginViaForm(page, email, password, "/admin");
      await waitForPostLoginNavigation(page);
      await expect(page).toHaveURL(/\/admin/);
      await assertProtectedShellReady(page);
    });
  });

  test.describe("superadmin", () => {
    test.skip(!hasSuperadminCreds, "E2E_SUPERADMIN_EMAIL/E2E_SUPERADMIN_PASSWORD must be set");

    test("login as superadmin → lands on /superadmin", async ({ page }) => {
      const { email, password } = requireRoleCreds("superadmin");
      await loginViaForm(page, email, password, "/superadmin");
      await waitForPostLoginNavigation(page);
      await expect(page).toHaveURL(/\/superadmin/);
      await assertProtectedShellReady(page);
    });
  });
});

// 3. EMPLOYEE CORE
test.describe("Employee core (week + orders)", () => {
  test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_EMAIL/E2E_EMPLOYEE_PASSWORD must be set");

  test("week page loads as authenticated employee", async ({ page }) => {
    const { email, password } = requireRoleCreds("employee");
    await loginViaForm(page, email, password, "/week");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/week/);
    await assertProtectedShellReady(page);
  });

  test("orders page loads as authenticated employee", async ({ page }) => {
    const { email, password } = requireRoleCreds("employee");
    await loginViaForm(page, email, password, "/orders");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/orders/);
    await waitForMainContent(page);
    await expect(page.getByRole("heading", { name: /bestillinger/i })).toBeVisible();
  });
});

// 4. ADMIN CORE
test.describe("Admin core surfaces", () => {
  test.skip(!hasAdminCreds, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD must be set");

  test("admin dashboard loads", async ({ page }) => {
    const { email, password } = requireRoleCreds("company_admin");
    await loginViaForm(page, email, password, "/admin");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/admin/);
    await assertProtectedShellReady(page);
    await expect(page.getByRole("heading", { name: /oversikt|dashboard/i })).toBeVisible();
  });

  test("admin orders page loads", async ({ page }) => {
    const { email, password } = requireRoleCreds("company_admin");
    await loginViaForm(page, email, password, "/admin/orders");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/admin\/orders/);
    await waitForMainContent(page);
    await expect(page.getByRole("heading", { name: /admin.*ordrer|admin – ordrer/i })).toBeVisible();
  });
});

// 5. SUPERADMIN CORE
test.describe("Superadmin core surfaces", () => {
  test.skip(!hasSuperadminCreds, "E2E_SUPERADMIN_EMAIL/E2E_SUPERADMIN_PASSWORD must be set");

  test("superadmin root loads", async ({ page }) => {
    const { email, password } = requireRoleCreds("superadmin");
    await loginViaForm(page, email, password, "/superadmin");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/superadmin/);
    await assertProtectedShellReady(page);
  });

  test("superadmin/system loads", async ({ page }) => {
    const { email, password } = requireRoleCreds("superadmin");
    await loginViaForm(page, email, password, "/superadmin/system");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/superadmin\/system/);
    await waitForMainContent(page);
    await expect(page.getByRole("heading", { name: /systemstatus/i })).toBeVisible();
  });
});

// 6. BACKOFFICE CORE
test.describe("Backoffice core surfaces", () => {
  test.skip(!hasSuperadminCreds, "Backoffice requires superadmin; set E2E_SUPERADMIN_*");

  test("backoffice content shell loads after auth", async ({ page }) => {
    const { email, password } = requireRoleCreds("superadmin");
    await loginViaForm(page, email, password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/content/);
    await waitForMainContent(page);
    await expect(page.getByRole("heading", { name: /content/i })).toBeVisible();
  });
});


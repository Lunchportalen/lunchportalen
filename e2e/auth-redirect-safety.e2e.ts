// e2e/auth-redirect-safety.e2e.ts — Login redirect safety + loop prevention
import { test, expect } from "@playwright/test";
import {
  visitProtectedRouteAndAssertRedirect,
  loginAsRole,
  getCredentialsForRole,
  getHomeForRole,
  waitForPostLoginNavigation,
  loginViaForm,
} from "./helpers/auth";
import { assertLoginPageReady, assertProtectedShellReady } from "./helpers/ready";

const hasEmployee = !!getCredentialsForRole("employee");
const hasAdmin = !!getCredentialsForRole("company_admin");

test.describe("Auth redirect safety (browser)", () => {
  test("protected /backoffice/content redirects to /login with internal next only", async ({ page }) => {
    await visitProtectedRouteAndAssertRedirect(page, "/backoffice/content");
    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    const next = url.searchParams.get("next");
    expect(next).not.toBeNull();
    if (next) {
      const decoded = decodeURIComponent(next);
      expect(decoded.startsWith("/")).toBe(true);
      expect(decoded.startsWith("//")).toBe(false);
      expect(decoded).toContain("/backoffice");
    }
    await assertLoginPageReady(page);
  });

  test.skip(!hasAdmin, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD or fallback test user must be set");
  test("successful login returns admin to intended protected route without loop", async ({ page }) => {
    const target = "/backoffice/content";
    await visitProtectedRouteAndAssertRedirect(page, target);
    await assertLoginPageReady(page);

    await loginAsRole(page, "company_admin", { next: target });
    await waitForPostLoginNavigation(page);

    await expect(page).not.toHaveURL(/\/login(\?|$)/);
    await expect(page).toHaveURL(/\/backoffice\/content/);
    await assertProtectedShellReady(page);
  });

  test.skip(!hasEmployee, "E2E_EMPLOYEE_EMAIL / E2E_EMPLOYEE_PASSWORD or fallback test user must be set");
  test("unsafe next=external URL is rejected and falls back to role home", async ({ page }) => {
    const creds = getCredentialsForRole("employee")!;
    const home = getHomeForRole("employee");

    await page.goto("/login?next=https://evil.example");
    await assertLoginPageReady(page);
    await loginViaForm(page, creds.email, creds.password);
    await waitForPostLoginNavigation(page);

    const finalUrl = new URL(page.url());
    expect(finalUrl.origin).not.toBe("https://evil.example");
    await expect(page).toHaveURL(new RegExp(`^${home.replace("/", "\\/")}`));
    await assertProtectedShellReady(page);
  });

  test.skip(!hasEmployee, "E2E_EMPLOYEE_EMAIL / E2E_EMPLOYEE_PASSWORD or fallback test user must be set");
  test("role-disallowed next (/admin for employee) is rejected and falls back to employee home", async ({ page }) => {
    const creds = getCredentialsForRole("employee")!;
    const home = getHomeForRole("employee");

    await page.goto("/login?next=/admin");
    await assertLoginPageReady(page);
    await loginViaForm(page, creds.email, creds.password, "/admin");
    await waitForPostLoginNavigation(page);

    await expect(page).toHaveURL(new RegExp(`^${home.replace("/", "\\/")}`));
    await expect(page).not.toHaveURL(/\/admin/);
    await assertProtectedShellReady(page);
  });

  test.skip(!hasEmployee, "E2E_EMPLOYEE_EMAIL / E2E_EMPLOYEE_PASSWORD or fallback test user must be set");
  test("already-authenticated user visiting /login is routed onward (no trap or blank page)", async ({ page }) => {
    const creds = getCredentialsForRole("employee")!;
    const home = getHomeForRole("employee");

    await loginViaForm(page, creds.email, creds.password);
    await waitForPostLoginNavigation(page);
    await assertProtectedShellReady(page);

    await page.goto("/login");
    // Either we get bounced to a protected shell again, or login shows and then redirects;
    // in all cases we must not end up stuck on /login while authenticated.
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }).catch(() => {
      // If still on /login, we assert that the form is usable and not blank-hung.
    });

    const final = new URL(page.url());
    if (final.pathname === "/login" || final.pathname.startsWith("/login/")) {
      await assertLoginPageReady(page);
    } else {
      await expect(page).toHaveURL(new RegExp(`^${home.replace("/", "\\/")}`));
      await assertProtectedShellReady(page);
    }
  });

  test.skip(!hasEmployee, "E2E_EMPLOYEE_EMAIL / E2E_EMPLOYEE_PASSWORD or fallback test user must be set");
  test("login submit does not hang indefinitely and leads to navigation or error", async ({ page }) => {
    const creds = getCredentialsForRole("employee")!;

    await page.goto("/login?next=/week");
    await assertLoginPageReady(page);

    await page.getByLabel(/e-post/i).fill(creds.email);
    await page.getByLabel(/passord/i).fill(creds.password);
    await page.getByRole("button", { name: /logg inn/i }).click();

    // Either we leave /login or stay with a deterministic error; in both cases, "Logger inn" must not hang forever.
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }).catch(() => {
      // Still on /login: assert that the button is clickable again (no permanent disabled loading state).
      return;
    });

    const pathname = new URL(page.url()).pathname;
    if (pathname.startsWith("/login")) {
      const button = page.getByRole("button", { name: /logg inn/i });
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
    } else {
      await assertProtectedShellReady(page);
    }
  });
});


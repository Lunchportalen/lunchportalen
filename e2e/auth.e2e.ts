// e2e/auth.e2e.ts — Auth and redirect correctness
import { test, expect } from "@playwright/test";
import { visitProtectedRouteAndAssertRedirect } from "./helpers/auth";
import { assertLoginPageReady } from "./helpers/ready";

test.describe("Auth and redirect", () => {
  test("unauthenticated /week redirects to /login?next=/week", async ({ page }) => {
    await visitProtectedRouteAndAssertRedirect(page, "/week");
  });

  test("unauthenticated /admin redirects to /login?next=/admin", async ({ page }) => {
    await visitProtectedRouteAndAssertRedirect(page, "/admin");
  });

  test("unauthenticated /superadmin redirects to /login?next=/superadmin", async ({ page }) => {
    await visitProtectedRouteAndAssertRedirect(page, "/superadmin");
  });

  test("unauthenticated /backoffice/content redirects to login with correct next", async ({ page }) => {
    await visitProtectedRouteAndAssertRedirect(page, "/backoffice/content");
  });

  test("login page renders and has no redirect loop", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await assertLoginPageReady(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page with next param preserves next in URL", async ({ page }) => {
    await page.goto("/login?next=/week", { waitUntil: "domcontentloaded" });
    await assertLoginPageReady(page);

    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe("/week");
  });

  test("direct navigation to /login does not redirect to /login again", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await assertLoginPageReady(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test("public front page is accessible without auth", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("public /status is accessible", async ({ page }) => {
    await page.goto("/status", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/status/);
  });

  test("invalid credentials: submit sends request, stays on login, no redirect", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await assertLoginPageReady(page);

    await page.getByLabel(/e-post/i).fill("invalid@example.com");
    await page.getByLabel(/passord/i).fill("wrongpassword");
    await page.getByRole("button", { name: /logg inn/i }).click();

    await expect(page).toHaveURL(/\/login/);
    await assertLoginPageReady(page);
  });
});
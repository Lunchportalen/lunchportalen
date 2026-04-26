// e2e/helpers/auth.ts — Auth & route test helpers. No business logic changes.
import { expect, type Page } from "@playwright/test";

import { CANONICAL_REMOTE_BACKEND_HARNESS_PASSWORD } from "@/lib/auth/canonicalDevCredentials";
import { getLocalCmsRuntimeLoginCredentials } from "@/lib/localRuntime/runtime";
import { REMOTE_BACKEND_HARNESS_EMAIL } from "@/lib/system/emails";

export type E2ERole =
  | "employee"
  | "company_admin"
  | "superadmin"
  | "kitchen"
  | "driver";

const ROLE_HOME: Record<E2ERole, string> = {
  employee: "/week",
  company_admin: "/admin",
  superadmin: "/superadmin",
  kitchen: "/kitchen",
  driver: "/driver",
};

const HARNESS_FLAG_VALUES = new Set(["1", "true", "on", "yes"]);

export function getE2ETestUser(): { email: string; password: string } | null {
  const email = process.env.E2E_TEST_USER_EMAIL?.trim();
  const password = process.env.E2E_TEST_USER_PASSWORD ?? "";

  if (!email || !password) return null;
  return { email, password };
}

export function getCredentialsForRole(
  role: E2ERole,
): { email: string; password: string } | null {
  const roleEnvMap: Record<E2ERole, { email: string; password: string }> = {
    employee: {
      email: process.env.E2E_EMPLOYEE_EMAIL?.trim() ?? "",
      password: process.env.E2E_EMPLOYEE_PASSWORD ?? "",
    },
    company_admin: {
      email: process.env.E2E_ADMIN_EMAIL?.trim() ?? "",
      password: process.env.E2E_ADMIN_PASSWORD ?? "",
    },
    superadmin: {
      email: process.env.E2E_SUPERADMIN_EMAIL?.trim() ?? "",
      password: process.env.E2E_SUPERADMIN_PASSWORD ?? "",
    },
    kitchen: {
      email: process.env.E2E_KITCHEN_EMAIL?.trim() ?? "",
      password: process.env.E2E_KITCHEN_PASSWORD ?? "",
    },
    driver: {
      email: process.env.E2E_DRIVER_EMAIL?.trim() ?? "",
      password: process.env.E2E_DRIVER_PASSWORD ?? "",
    },
  };

  const creds = roleEnvMap[role];
  if (creds.email && creds.password) return creds;

  return getE2ETestUser();
}

export function resolveBackofficeSuperadminCredentialsForE2E(): {
  email: string;
  password: string;
  source:
  | "e2e_env"
  | "canonical_local_provider"
  | "canonical_remote_backend_harness";
} | null {
  const fromEnv = getCredentialsForRole("superadmin");

  if (fromEnv) {
    return { ...fromEnv, source: "e2e_env" };
  }

  const modeRaw = String(process.env.LP_CMS_RUNTIME_MODE ?? "")
    .trim()
    .toLowerCase();

  const effectiveMode = modeRaw || "remote_backend";

  const harnessRaw = String(process.env.LP_REMOTE_BACKEND_AUTH_HARNESS ?? "")
    .trim()
    .toLowerCase();

  if (
    effectiveMode === "remote_backend" &&
    HARNESS_FLAG_VALUES.has(harnessRaw)
  ) {
    return {
      email: REMOTE_BACKEND_HARNESS_EMAIL,
      password: CANONICAL_REMOTE_BACKEND_HARNESS_PASSWORD,
      source: "canonical_remote_backend_harness",
    };
  }

  const local = getLocalCmsRuntimeLoginCredentials();

  if (local) {
    return { ...local, source: "canonical_local_provider" };
  }

  return null;
}

export function hasBackofficeSuperadminCredentialsForE2E(): boolean {
  return resolveBackofficeSuperadminCredentialsForE2E() !== null;
}

export function getHomeForRole(role: E2ERole): string {
  return ROLE_HOME[role];
}

export async function visitProtectedRouteAndAssertRedirect(
  page: Page,
  path: string,
  options?: { timeout?: number },
): Promise<void> {
  const timeout = options?.timeout ?? 15_000;

  await page.goto(path, { waitUntil: "commit", timeout });

  await page.waitForURL(
    (url) => url.pathname === "/login" || url.pathname.startsWith("/login/"),
    { timeout },
  );

  const url = new URL(page.url());
  const nextParam = url.searchParams.get("next");

  const expectedPath = path.startsWith("/") ? path : `/${path}`;
  const expectedPathname = expectedPath.split("?")[0];

  if (nextParam != null) {
    const decoded = decodeURIComponent(nextParam);

    if (decoded === expectedPath || decoded.startsWith(expectedPathname)) {
      return;
    }
  }

  throw new Error(
    `Expected redirect to /login?next=... (next ~ ${expectedPathname}). Got: ${url.pathname
    }${url.search}`,
  );
}

export async function loginViaForm(
  page: Page,
  email: string,
  password: string,
  next?: string,
): Promise<void> {
  const path = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  await page.goto(path, { waitUntil: "domcontentloaded" });

  const emailInput = page.locator("#login-email");
  const passwordInput = page.locator("#login-password");
  const submitButton = page.getByRole("button", { name: /^logg inn$/i });

  await emailInput.waitFor({ state: "visible", timeout: 15_000 });
  await passwordInput.waitFor({ state: "visible", timeout: 15_000 });

  await expect(emailInput).toBeEditable({ timeout: 15_000 });
  await expect(passwordInput).toBeEditable({ timeout: 15_000 });

  await emailInput.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");
  await emailInput.pressSequentially(email, { delay: 5 });

  await passwordInput.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");
  await passwordInput.pressSequentially(password, { delay: 5 });

  const actualEmail = await emailInput.inputValue();
  const actualPassword = await passwordInput.inputValue();

  if (actualEmail !== email || actualPassword !== password) {
    throw new Error(
      `Login form values not persisted. email="${actualEmail}", passwordLength=${actualPassword.length}`,
    );
  }

  await Promise.all([
    page
      .waitForURL((url) => !url.pathname.startsWith("/login"), {
        timeout: 15_000,
      })
      .catch(() => null),
    submitButton.click(),
  ]);
}

export async function loginAsRole(
  page: Page,
  role: E2ERole,
  options?: { next?: string },
): Promise<void> {
  const creds = getCredentialsForRole(role);

  if (!creds) {
    throw new Error(
      `No credentials for role "${role}". Set E2E_${role === "company_admin" ? "ADMIN" : role.toUpperCase()
      }_EMAIL/PASSWORD or E2E_TEST_USER_EMAIL/PASSWORD.`,
    );
  }

  const next = options?.next ?? getHomeForRole(role);
  await loginViaForm(page, creds.email, creds.password, next);
}

export async function loginViaApi(
  page: Page,
  email: string,
  password: string,
  baseURL?: string,
): Promise<void> {
  const origin =
    baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

  await page.goto(origin, { waitUntil: "domcontentloaded" });

  await page.evaluate(
    async ({ origin, email, password }) => {
      const response = await fetch(`${origin}/api/auth/login-debug`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`login-debug failed: ${response.status} ${text}`);
      }
    },
    { origin, email, password },
  );
}

export async function waitForPostLoginNavigation(
  page: Page,
  options?: { timeout?: number },
): Promise<void> {
  const timeout = options?.timeout ?? 15_000;

  await expect
    .poll(
      () => {
        const url = new URL(page.url());
        return url.pathname;
      },
      { timeout },
    )
    .not.toMatch(/^\/login/);
}
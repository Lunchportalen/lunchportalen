// e2e/helpers/auth.ts — Auth & route test helpers (Phase 2). No business logic changes.
import { Page } from "@playwright/test";

import { CANONICAL_REMOTE_BACKEND_HARNESS_PASSWORD } from "@/lib/auth/canonicalDevCredentials";
import { getLocalCmsRuntimeLoginCredentials } from "@/lib/localRuntime/runtime";
import { REMOTE_BACKEND_HARNESS_EMAIL } from "@/lib/system/emails";

/** Roles supported for role-aware login. Uses same semantics as lib/auth/roleHome. */
export type E2ERole = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

const ROLE_HOME: Record<E2ERole, string> = {
  employee: "/week",
  company_admin: "/admin",
  superadmin: "/superadmin",
  kitchen: "/kitchen",
  driver: "/driver",
};

/**
 * Get E2E test user credentials from env (single fallback user).
 * In CI, set E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD for authenticated flows.
 */
export function getE2ETestUser(): { email: string; password: string } | null {
  const email = process.env.E2E_TEST_USER_EMAIL?.trim();
  const password = process.env.E2E_TEST_USER_PASSWORD ?? "";
  if (!email || !password) return null;
  return { email, password };
}

/**
 * Get credentials for a specific role when role-specific env vars are set.
 * Env: E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD,
 *      E2E_SUPERADMIN_EMAIL, E2E_SUPERADMIN_PASSWORD, and optionally E2E_KITCHEN_*, E2E_DRIVER_*.
 * Falls back to E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD if role-specific vars are missing.
 * Use for local-only multi-role setup; see docs/E2E.md.
 */
export function getCredentialsForRole(role: E2ERole): { email: string; password: string } | null {
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

const HARNESS_FLAG_VALUES = new Set(["1", "true", "on", "yes"]);

/**
 * When E2E_* env is unset, use the same canonical credentials the app documents on /login
 * (local_provider: lib/localRuntime/runtime.ts + lib/auth/localRuntimeAuth.ts) and
 * remote_backend harness (lib/auth/remoteBackendAuthHarness.ts + lib/system/emails.ts).
 * Requires matching LP_CMS_RUNTIME_MODE / LP_REMOTE_BACKEND_AUTH_HARNESS in the Playwright process
 * (and dev server) — same as production login form, no bypass.
 */
export function resolveBackofficeSuperadminCredentialsForE2E(): {
  email: string;
  password: string;
  source: "e2e_env" | "canonical_local_provider" | "canonical_remote_backend_harness";
} | null {
  const fromEnv = getCredentialsForRole("superadmin");
  if (fromEnv) {
    return { ...fromEnv, source: "e2e_env" };
  }

  const modeRaw = String(process.env.LP_CMS_RUNTIME_MODE ?? "").trim().toLowerCase();
  const effectiveMode = modeRaw || "remote_backend";
  const harnessRaw = String(process.env.LP_REMOTE_BACKEND_AUTH_HARNESS ?? "").trim().toLowerCase();

  /** Before local_provider canonical: remote_backend + harness must resolve here (never shadowed by local when mode is remote — local is null then). */
  if (effectiveMode === "remote_backend" && HARNESS_FLAG_VALUES.has(harnessRaw)) {
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

/** Home path for role (matches lib/auth/roleHome). */
export function getHomeForRole(role: E2ERole): string {
  return ROLE_HOME[role];
}

/**
 * Visit a protected route unauthenticated and assert redirect to /login with correct next param.
 * Middleware redirects to /login?next=<pathname + search>, so we assert pathname and decoded next.
 */
export async function visitProtectedRouteAndAssertRedirect(
  page: Page,
  path: string,
  options?: { timeout?: number }
): Promise<void> {
  const timeout = options?.timeout ?? 15_000;
  await page.goto(path, { waitUntil: "commit", timeout });
  await page.waitForURL((url) => url.pathname === "/login" || url.pathname.startsWith("/login/"), { timeout });
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
    `Expected redirect to /login?next=... (next ~ ${expectedPathname}). Got: ${url.pathname}${url.search ? `?${url.search}` : ""}`
  );
}

/**
 * Log in via the login form (UI). Deterministic: fill, submit, no arbitrary waits.
 * @param next - Optional path for post-login redirect (e.g. "/week", "/admin")
 */
export async function loginViaForm(
  page: Page,
  email: string,
  password: string,
  next?: string
): Promise<void> {
  const path = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  await page.goto(path);
  await page.getByLabel(/e-post/i).fill(email);
  await page.getByLabel(/passord/i).fill(password);
  await page.getByRole("button", { name: /logg inn/i }).click();
}

/**
 * Role-aware login: resolve credentials for the role (env or fallback), then login via UI.
 * Use when you have role-specific or single test user configured. Skips nothing; call only when creds exist.
 */
export async function loginAsRole(
  page: Page,
  role: E2ERole,
  options?: { next?: string }
): Promise<void> {
  const creds = getCredentialsForRole(role);
  if (!creds) {
    throw new Error(
      `No credentials for role "${role}". Set E2E_${role === "company_admin" ? "ADMIN" : role.toUpperCase()}_EMAIL/PASSWORD or E2E_TEST_USER_EMAIL/PASSWORD.`
    );
  }
  const next = options?.next ?? getHomeForRole(role);
  await loginViaForm(page, creds.email, creds.password, next);
}

/**
 * Programmatic login via POST /api/auth/login-debug (same semantics as signInWithPassword + Set-Cookie).
 * Use when you want session without UI; cookies are set in the same browser context.
 * Requires same-origin (e.g. baseURL localhost). Prefer UI login when testing full flow.
 */
export async function loginViaApi(
  page: Page,
  email: string,
  password: string,
  baseURL?: string
): Promise<void> {
  const origin = baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    async ({ origin, email, password }) => {
      const r = await fetch(`${origin}/api/auth/login-debug`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`login-debug failed: ${r.status} ${text}`);
      }
    },
    { origin, email, password }
  );
}

/**
 * Wait for the app to have left the login page (navigation after submit).
 * Does not assert final URL; use expect(page).toHaveURL(...) in the test.
 */
export async function waitForPostLoginNavigation(
  page: Page,
  options?: { timeout?: number },
): Promise<void> {
  const timeout = options?.timeout ?? 15_000;
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout });
}

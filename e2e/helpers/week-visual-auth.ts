// e2e/helpers/week-visual-auth.ts — Shared week-visual auth session (STEG 0)
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { chromium } from "@playwright/test";

import {
  getCredentialsForRole,
  loginViaForm,
  waitForPostLoginNavigation,
} from "./auth";

export const WEEK_VISUAL_AUTH_STATE_PATH =
  "test-results/week-visual-employee-state.json";

export const WEEK_VISUAL_LOGIN_MAX_ATTEMPTS = 3;

export function hasWeekVisualEmployeeCreds(): boolean {
  return getCredentialsForRole("employee") !== null;
}

export async function createWeekVisualEmployeeStorageState(
  baseURL: string,
): Promise<void> {
  const creds = getCredentialsForRole("employee");
  if (!creds) {
    throw new Error(
      "E2E_EMPLOYEE_EMAIL/PASSWORD required for week visual global setup.",
    );
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= WEEK_VISUAL_LOGIN_MAX_ATTEMPTS; attempt++) {
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();

      await loginViaForm(page, creds.email, creds.password, "/week");
      await waitForPostLoginNavigation(page, { timeout: 30_000 });

      const pathname = new URL(page.url()).pathname;
      if (!pathname.startsWith("/week")) {
        throw new Error(
          `Week visual login attempt ${attempt}: expected /week, got ${pathname}`,
        );
      }

      await mkdir(dirname(WEEK_VISUAL_AUTH_STATE_PATH), { recursive: true });
      await context.storageState({ path: WEEK_VISUAL_AUTH_STATE_PATH });
      await browser.close();
      return;
    } catch (error) {
      lastError = error;
      await browser.close().catch(() => undefined);
      if (attempt < WEEK_VISUAL_LOGIN_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  throw lastError;
}

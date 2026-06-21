// e2e/helpers/provider-meny-visual-auth.ts — Provider kitchen session for /leverandor/meny visual gate
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { chromium } from "@playwright/test";

import { getE2ETestUser, loginViaForm, waitForPostLoginNavigation } from "./auth";

export const PROVIDER_MENY_VISUAL_AUTH_STATE_PATH =
  "test-results/provider-meny-visual-kitchen-state.json";

export const PROVIDER_MENY_VISUAL_LOGIN_MAX_ATTEMPTS = 3;

export function getProviderMenyVisualCredentials(): { email: string; password: string } | null {
  const providerKitchenEmail = process.env.E2E_PROVIDER_KITCHEN_EMAIL?.trim() ?? "";
  const providerKitchenPassword = process.env.E2E_PROVIDER_KITCHEN_PASSWORD ?? "";
  if (providerKitchenEmail && providerKitchenPassword) {
    return { email: providerKitchenEmail, password: providerKitchenPassword };
  }

  const fromTestUser = getE2ETestUser();
  if (fromTestUser) return fromTestUser;

  const smokeEmail =
    process.env.PLAYWRIGHT_TEST_EMAIL?.trim() || "kitchen-a@smoke.lunchportalen.no";
  const smokePassword =
    process.env.PLAYWRIGHT_TEST_PASSWORD ||
    process.env.STAGING_TEST_PASSWORD ||
    "";
  if (smokeEmail && smokePassword) {
    return { email: smokeEmail, password: smokePassword };
  }

  return null;
}

export function hasProviderMenyVisualKitchenCreds(): boolean {
  return getProviderMenyVisualCredentials() !== null;
}

export async function createProviderMenyVisualKitchenStorageState(
  baseURL: string,
): Promise<void> {
  const creds = getProviderMenyVisualCredentials();
  if (!creds) {
    throw new Error(
      "E2E_TEST_USER_* or E2E_PROVIDER_KITCHEN_* or PLAYWRIGHT_TEST_* required for provider meny visual global setup.",
    );
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= PROVIDER_MENY_VISUAL_LOGIN_MAX_ATTEMPTS; attempt++) {
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();

      await loginViaForm(page, creds.email, creds.password);
      await waitForPostLoginNavigation(page, { timeout: 30_000 });
      await page.goto("/leverandor/meny", { waitUntil: "domcontentloaded" });

      const pathname = new URL(page.url()).pathname;
      if (!pathname.startsWith("/leverandor/meny")) {
        throw new Error(
          `Provider meny visual login attempt ${attempt}: expected /leverandor/meny, got ${pathname}`,
        );
      }

      await mkdir(dirname(PROVIDER_MENY_VISUAL_AUTH_STATE_PATH), { recursive: true });
      await context.storageState({ path: PROVIDER_MENY_VISUAL_AUTH_STATE_PATH });
      await browser.close();
      return;
    } catch (error) {
      lastError = error;
      await browser.close().catch(() => undefined);
      if (attempt < PROVIDER_MENY_VISUAL_LOGIN_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  throw lastError;
}

// e2e/cms-preview-route-smoke.e2e.ts — Backoffice preview route: /backoffice/preview/[id] loads and shows draft banner.
// Proves preview route uses same pipeline as public without crash. Does not assert full render truth.

import { test, expect } from "@playwright/test";
import {
  getCredentialsForRole,
  loginViaForm,
  waitForPostLoginNavigation,
  type E2ERole,
} from "./helpers/auth";

const hasSuperadminCreds =
  !!process.env.E2E_SUPERADMIN_EMAIL && !!process.env.E2E_SUPERADMIN_PASSWORD;

function requireSuperadmin() {
  const creds = getCredentialsForRole("superadmin" as E2ERole);
  if (!creds) {
    throw new Error(
      "Missing superadmin credentials. Set E2E_SUPERADMIN_EMAIL/PASSWORD or E2E_TEST_USER_EMAIL/PASSWORD."
    );
  }
  return creds;
}

test.describe("CMS preview route smoke (superadmin)", () => {
  test.skip(!hasSuperadminCreds, "Preview route smoke requires E2E_SUPERADMIN_* or E2E_TEST_USER_*");

  test("backoffice preview route loads and shows draft banner (no crash)", async ({ page, baseURL }) => {
    const { email, password } = requireSuperadmin();
    await loginViaForm(page, email, password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/content/);

    const createRes = await page.request.post(`${baseURL}/api/backoffice/content/pages`, {
      data: { title: "E2E Preview Route Smoke" },
      headers: { "Content-Type": "application/json" },
    });
    const createPayload = (await createRes.json()) as {
      ok?: boolean;
      data?: { page?: { id: string } };
      error?: string;
    };
    if (!createRes.ok() || !createPayload?.ok || !createPayload?.data?.page?.id) {
      throw new Error(`Create page failed: ${createRes.status()} ${JSON.stringify(createPayload)}`);
    }
    const pageId = createPayload.data!.page!.id;

    await page.goto(`${baseURL}/backoffice/preview/${pageId}`, { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(new RegExp(`/backoffice/preview/${pageId}`));
    await expect(
      page.getByText(/forhåndsvisning av kladd|ikke publisert innhold|forhåndsvisning \(kladd\)/i)
    ).toBeVisible({ timeout: 15_000 });
  });
});

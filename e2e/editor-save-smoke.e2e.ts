// e2e/editor-save-smoke.e2e.ts — Minimal E2E proof: editor title edit → Lagre → Sist lagret → GET returns saved title.
// Proves save chain without depending on AI or page builder. Requires superadmin creds + Supabase.

import { test, expect } from "@playwright/test";
import {
  getCredentialsForRole,
  loginViaForm,
  waitForPostLoginNavigation,
  type E2ERole,
} from "./helpers/auth";
import { waitForMainContent } from "./helpers/ready";

const hasSuperadminCreds =
  !!(process.env.E2E_SUPERADMIN_EMAIL && process.env.E2E_SUPERADMIN_PASSWORD) ||
  !!(process.env.E2E_TEST_USER_EMAIL && process.env.E2E_TEST_USER_PASSWORD);

function requireSuperadmin() {
  const creds = getCredentialsForRole("superadmin" as E2ERole);
  if (!creds) {
    throw new Error(
      "Missing superadmin credentials. Set E2E_SUPERADMIN_EMAIL/PASSWORD or E2E_TEST_USER_EMAIL/PASSWORD."
    );
  }
  return creds;
}

test.describe("Editor save smoke — title edit → Lagre → persisted", () => {
  test.skip(!hasSuperadminCreds, "Superadmin credentials required for backoffice editor");

  test("edit page title, Lagre, then GET returns saved title (no crash, truthful success)", async ({
    page,
    baseURL,
  }) => {
    const { email, password } = requireSuperadmin();
    await loginViaForm(page, email, password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/content/);

    const createRes = await page.request.post(`${baseURL}/api/backoffice/content/pages`, {
      data: { title: "E2E Editor Save Smoke" },
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

    const uniqueTitle = `E2E-Save-${Date.now()}`;
    await page.goto(`${baseURL}/backoffice/content/${pageId}`);
    await waitForMainContent(page, { timeout: 15_000 });
    await expect(page.getByRole("main")).toBeVisible({ timeout: 15_000 });

    const titleInput = page.getByLabel(/sidetittel/i).or(page.getByPlaceholder(/sidetittel/i)).first();
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    await titleInput.fill(uniqueTitle);

    const saveBtn = page.getByRole("button", { name: /^Lagre$/ });
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();
    await expect(page.getByText(/Sist lagret/)).toBeVisible({ timeout: 15_000 });

    const getRes = await page.request.get(`${baseURL}/api/backoffice/content/pages/${pageId}`);
    const getPayload = (await getRes.json()) as {
      ok?: boolean;
      data?: { page?: { title?: string } };
    };
    expect(getRes.ok()).toBe(true);
    expect(getPayload?.ok).toBe(true);
    expect(getPayload?.data?.page?.title).toBe(uniqueTitle);
  });
});

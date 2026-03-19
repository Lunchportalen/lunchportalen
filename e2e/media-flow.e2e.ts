// e2e/media-flow.e2e.ts — Backoffice Media ↔ editor integration flow
import { test, expect } from "@playwright/test";
import { getCredentialsForRole, loginViaForm, waitForPostLoginNavigation } from "./helpers/auth";
import { waitForMainContent } from "./helpers/ready";
import * as path from "node:path";

const hasSuperadminCreds = !!process.env.E2E_SUPERADMIN_EMAIL && !!process.env.E2E_SUPERADMIN_PASSWORD;

test.describe("Backoffice media ↔ editor flow", () => {
  test.skip(!hasSuperadminCreds, "Media/editor flow requires E2E_SUPERADMIN_EMAIL/E2E_SUPERADMIN_PASSWORD");

  test("upload image in Media and use it via Media Picker in editor, persisting after reload", async ({ page }) => {
    const creds = getCredentialsForRole("superadmin");
    if (!creds) {
      throw new Error("Missing E2E_SUPERADMIN_* credentials");
    }

    const fixturePath = path.resolve("e2e/fixtures/media-sample.png");
    const uniqueTag = `e2e-${Date.now()}`;

    // 1) Login as superadmin into backoffice
    await loginViaForm(page, creds.email, creds.password, "/backoffice/media");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/media/);
    await waitForMainContent(page);

    // 2) Upload a real image file from Media UI
    await expect(page.getByRole("heading", { name: /mediearkiv/i })).toBeVisible();
    await page.getByLabel(/fil \*/i).setInputFiles(fixturePath);
    await page.getByLabel(/alt-tekst/i).fill(`E2E Alt ${uniqueTag}`);
    await page.getByLabel(/bildetekst/i).fill(`E2E Caption ${uniqueTag}`);
    await page.getByLabel(/tags/i).fill(uniqueTag);

    await page.getByRole("button", { name: /last opp bilde/i }).click();

    // Wait for upload to complete (button no longer shows "Laster opp…")
    await expect(page.getByRole("button", { name: /last opp bilde/i })).toBeEnabled();

    // 3) Verify the uploaded asset appears in the Media list/grid
    // Use the tag or caption as a stable signal in the grid
    await expect(page.getByText(uniqueTag, { exact: false })).toBeVisible({
      timeout: 15_000,
    });

    // 4) Navigate to a safe editor page under /backoffice/content
    await page.goto("/backoffice/content");
    await expect(page).toHaveURL(/\/backoffice\/content/);
    await waitForMainContent(page);

    // For this baseline workspace, open a hero/image-capable block if present.
    // Use a generic "Velg bilde" / "Legg til bilde" trigger which opens the Media Picker.
    const imageTrigger = page.getByRole("button", { name: /bilde|legg til bilde|velg bilde/i }).first();
    await imageTrigger.click();

    // 5) Media Picker should open and show items
    const pickerHeading = page.getByRole("heading", { name: /mediearkiv|velg et eksisterende bilde/i });
    await expect(pickerHeading).toBeVisible();

    // 6) Select the uploaded asset inside the picker
    const pickerItem = page.getByText(uniqueTag, { exact: false }).first();
    await pickerItem.click();

    // 7) Verify the block receives the asset reference (thumbnail or alt text visible in editor)
    // After selection, we expect the editor to show our alt text or caption near an image field.
    await expect(page.getByText(`E2E Alt ${uniqueTag}`, { exact: false })).toBeVisible();

    // 8) Save via the normal editor save flow (e.g. "Lagre" button)
    const saveButton = page.getByRole("button", { name: /lagre/i }).first();
    await saveButton.click();

    // Wait for save to settle: save button becomes enabled again or a "lagret" text appears.
    await expect(saveButton).toBeEnabled({ timeout: 20_000 });

    // 9) Reload the page and verify the binding persists
    await page.reload();
    await expect(page).toHaveURL(/\/backoffice\/content/);
    await waitForMainContent(page);

    // Alt text or caption for the selected image should still be visible in the editor UI.
    await expect(page.getByText(`E2E Alt ${uniqueTag}`, { exact: false })).toBeVisible();
  });
});


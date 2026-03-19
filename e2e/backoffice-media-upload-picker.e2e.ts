// e2e/backoffice-media-upload-picker.e2e.ts
// Proves media flow: upload → library → picker → block field update (UI integrity).
// Test cases A–F; no fake success path; real fixture and real editor surface.
import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  getCredentialsForRole,
  loginViaForm,
  waitForPostLoginNavigation,
} from "./helpers/auth";
import { waitForMainContent } from "./helpers/ready";

const hasSuperadminCreds =
  !!process.env.E2E_SUPERADMIN_EMAIL && !!process.env.E2E_SUPERADMIN_PASSWORD;

/** Real small image fixture (repo-committed). */
const MEDIA_FIXTURE_PATH = path.join(
  process.cwd(),
  "e2e",
  "fixtures",
  "media-sample.png"
);

async function assertNoCrashText(page: import("@playwright/test").Page) {
  const html = await page.content();
  const crashPatterns = [
    /application error/i,
    /something went wrong/i,
    /unhandled runtime error/i,
  ];
  for (const pattern of crashPatterns) {
    expect(html).not.toMatch(pattern);
  }
}

test.describe("Backoffice media upload → library → picker → block (superadmin)", () => {
  test.skip(
    !hasSuperadminCreds,
    "Media upload-picker test requires E2E_SUPERADMIN_EMAIL/E2E_SUPERADMIN_PASSWORD"
  );

  test("full media flow: upload, library, picker, block field update", async ({
    page,
  }) => {
    const creds = getCredentialsForRole("superadmin");
    if (!creds) throw new Error("Missing E2E_SUPERADMIN_* credentials");

    const uniqueAlt = `E2E media ${Date.now()}`;
    const main = page.getByRole("main");

    // ——— TEST CASE A — Media page loads ———
    await loginViaForm(page, creds.email, creds.password, "/backoffice/media");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/media/);
    await waitForMainContent(page);
    await assertNoCrashText(page);

    await expect(
      page.getByRole("heading", { name: /mediearkiv/i })
    ).toBeVisible();
    await expect(main).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Last opp bildefil" })
    ).toBeVisible();

    const uploadSection = page
      .getByRole("heading", { name: "Last opp bildefil" })
      .locator("..");
    const fileInput = uploadSection.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();

    const libraryArea = main.getByText(/viser \d+ av \d+ elementer/i).or(
      main.getByText("Ingen bilder i mediearkivet.", { exact: false })
    );
    await expect(libraryArea).toBeVisible({ timeout: 15_000 });

    // ——— TEST CASE B — Real file upload ———
    await fileInput.setInputFiles(MEDIA_FIXTURE_PATH);
    await uploadSection
      .getByPlaceholder("Beskrivelse for tilgjengelighet")
      .fill(uniqueAlt);
    await uploadSection
      .getByRole("button", { name: /last opp bilde/i })
      .click();

    const uploadError = uploadSection.getByText(/feil|kunne ikke/i);
    await expect(uploadError).not.toBeVisible({ timeout: 10_000 });

    // ——— TEST CASE C — Media library listing ———
    const uploadedCard = main.locator("article").filter({ hasText: uniqueAlt });
    await expect(uploadedCard).toBeVisible({ timeout: 15_000 });
    const thumb = uploadedCard.locator('img[alt], [role="img"]').first();
    await expect(thumb).toBeVisible();

    // ——— TEST CASE D — Picker integration (Hjem/Forside, Hero or Image block) ———
    await page.goto(new URL("/backoffice/content", page.url()).toString());
    await waitForMainContent(page);

    const tree = page.getByRole("tree", { name: /innhold/i });
    await expect(tree).toBeVisible();
    const hjemNode = tree.getByRole("treeitem", { name: "Hjem" }).first();
    await hjemNode.click();
    await expect(page).toHaveURL(/\/backoffice\/content\/[0-9a-f-]{36}/i);
    await waitForMainContent(page);
    await expect(main).toContainText(/forside|innhold|redigere|velg en side/i);

    // TEST CASE F — Use known media-capable field: "Fra mediearkiv" (Hero/Image block)
    const fraMediearkiv = page.getByRole("button", { name: "Fra mediearkiv" });
    await expect(fraMediearkiv.first()).toBeVisible({ timeout: 15_000 });
    await fraMediearkiv.first().click();

    const picker = page.getByRole("dialog", {
      name: /velg bilde fra mediearkiv/i,
    });
    await expect(picker).toBeVisible();
    await expect(
      picker.getByText("Velg et eksisterende bilde fra mediearkivet.")
    ).toBeVisible();

    const pickerItem = picker.getByRole("button").filter({ hasText: uniqueAlt });
    await expect(pickerItem).toBeVisible({ timeout: 10_000 });
    await pickerItem.click();
    await expect(picker).not.toBeVisible();

    // ——— TEST CASE E — Block field update ———
    const imageUrlInput = main
      .getByPlaceholder(/https:\/\/\.\.\. eller .*bilde/i)
      .first();
    await expect(imageUrlInput).toHaveValue(/.+\//, { timeout: 10_000 });

    await assertNoCrashText(page);
  });
});

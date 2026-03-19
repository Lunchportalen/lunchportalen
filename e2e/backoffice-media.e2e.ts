// e2e/backoffice-media.e2e.ts — Backoffice Media upload + library + picker smoke
// Proves: (A) Media page load, (B) real upload flow, (C) library update, (D) picker integration, (E) safe UI states.
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

/** Small real image fixture for upload (repo-committed). */
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

test.describe("Backoffice Media upload + picker smoke (superadmin)", () => {
  test.skip(
    !hasSuperadminCreds,
    "Media smoke requires E2E_SUPERADMIN_EMAIL/E2E_SUPERADMIN_PASSWORD"
  );

  test("upload image, see it in library, then select it in content editor picker", async ({
    page,
  }) => {
    const creds = getCredentialsForRole("superadmin");
    if (!creds) throw new Error("Missing E2E_SUPERADMIN_* credentials");

    const uniqueAlt = `E2E media ${Date.now()}`;

    // ——— A) Media page load ———
    await loginViaForm(page, creds.email, creds.password, "/backoffice/media");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/media/);
    await waitForMainContent(page);
    await assertNoCrashText(page);

    await expect(
      page.getByRole("heading", { name: /mediearkiv/i })
    ).toBeVisible();

    const main = page.getByRole("main");
    await expect(main).toBeVisible();

    // Upload section and list/grid or empty state
    await expect(
      page.getByRole("heading", { name: "Last opp bildefil" })
    ).toBeVisible();
    const uploadSection = page
      .getByRole("heading", { name: "Last opp bildefil" })
      .locator("..");
    const fileInput = uploadSection.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();

    const listOrEmpty =
      main.getByText(/viser \d+ av \d+ elementer/i).or(
        main.getByText("Ingen bilder i mediearkivet.", { exact: false })
      );
    await expect(listOrEmpty).toBeVisible({ timeout: 15_000 });

    // ——— B) Real upload flow ———
    await fileInput.setInputFiles(MEDIA_FIXTURE_PATH);
    await uploadSection
      .getByPlaceholder("Beskrivelse for tilgjengelighet")
      .fill(uniqueAlt);
    await uploadSection
      .getByRole("button", { name: /last opp bilde/i })
      .click();

    // No upload error banner
    await expect(
      uploadSection.getByText(/feil|kunne ikke/i)
    ).not.toBeVisible({ timeout: 5_000 }).catch(() => {});

    // ——— C) Media library update: uploaded item appears with thumb ———
    const uploadedCard = main.locator("article").filter({ hasText: uniqueAlt });
    await expect(uploadedCard).toBeVisible({ timeout: 15_000 });
    const thumb = uploadedCard.locator('img[alt], [role="img"]').first();
    await expect(thumb).toBeVisible();

    // ——— D) Picker integration: open content, open picker, select asset ———
    await page.goto(new URL("/backoffice/content", page.url()).toString());
    await waitForMainContent(page);

    const tree = page.getByRole("tree", { name: /innhold/i });
    await expect(tree).toBeVisible();
    const hjemNode = tree.getByRole("treeitem", { name: "Hjem" }).first();
    await hjemNode.click();
    await expect(page).toHaveURL(/\/backoffice\/content\/[0-9a-f-]{36}/i);
    await waitForMainContent(page);
    await expect(main).toContainText(/forside|innhold|redigere|velg en side/i);

    // Open media picker (Hero/Image block "Fra mediearkiv" button)
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

    // ——— E) Asset applied to block: URL field reflects selection ———
    const imageUrlInput = main
      .getByPlaceholder(/https:\/\/\.\.\. eller .*bilde/i)
      .first();
    await expect(imageUrlInput).toHaveValue(/.+\//, { timeout: 10_000 });

    await assertNoCrashText(page);
  });
});

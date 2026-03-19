// e2e/backoffice-releases.e2e.ts — Backoffice Releases smoke (load, empty-safe, create, detail)
import { test, expect } from "@playwright/test";
import {
  getCredentialsForRole,
  loginViaForm,
  waitForPostLoginNavigation,
} from "./helpers/auth";
import { waitForMainContent } from "./helpers/ready";

const hasSuperadminCreds =
  !!process.env.E2E_SUPERADMIN_EMAIL && !!process.env.E2E_SUPERADMIN_PASSWORD;

async function assertNoCrashText(page: import("@playwright/test").Page) {
  const html = await page.content();
  const crashPatterns = [
    /application error/i,
    /something went wrong/i,
    /unhandled runtime error/i,
    /internal server error/i,
  ];
  for (const pattern of crashPatterns) {
    expect(html).not.toMatch(pattern);
  }
}

test.describe("Backoffice Releases smoke (superadmin)", () => {
  test.skip(
    !hasSuperadminCreds,
    "Releases smoke requires E2E_SUPERADMIN_EMAIL/E2E_SUPERADMIN_PASSWORD",
  );

  test("loads safely, creates release, and opens detail panel", async ({ page }) => {
    const creds = getCredentialsForRole("superadmin");
    if (!creds) throw new Error("Missing E2E_SUPERADMIN_* credentials");

    // A) Auth + open /backoffice/releases
    await loginViaForm(page, creds.email, creds.password, "/backoffice/releases");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/releases/);
    await waitForMainContent(page);
    await assertNoCrashText(page);

    // Heading + shell should be present
    await expect(
      page.getByRole("heading", { name: /releases/i }),
    ).toBeVisible();

    const main = page.getByRole("main");
    await expect(main).toBeVisible();

    // Locate the two main sections by headings
    const listSectionHeading = page.getByRole("heading", {
      name: "Release-liste",
    });
    await expect(listSectionHeading).toBeVisible();
    const listSection = listSectionHeading.locator("..");

    const detailSectionHeading = page.getByRole("heading", {
      name: "Detalj",
    });
    await expect(detailSectionHeading).toBeVisible();
    const detailSection = detailSectionHeading.locator("..");

    // B) Empty-safe behavior: either "Ingen releases." or at least one row button
    const emptyState = listSection.getByText("Ingen releases.", { exact: true });
    const emptyCount = await emptyState.count();
    if (emptyCount > 0) {
      await expect(emptyState).toBeVisible();
      // Detail panel should show safe prompt when nothing is selected
      await expect(
        detailSection.getByText("Velg en release.", { exact: true }),
      ).toBeVisible();
    } else {
      const firstRowButton = listSection.getByRole("button").first();
      await expect(firstRowButton).toBeVisible();
    }

    // C) Create a new release with a unique name
    const uniqueName = `E2E Release ${Date.now()}`;

    await page
      .getByPlaceholder("Navn på ny release")
      .fill(uniqueName);
    await page
      .getByRole("button", { name: /opprett release/i })
      .click();

    // Wait for list to refresh and new release to appear
    const newRow = listSection.getByRole("button", { name: new RegExp(uniqueName, "i") });
    await expect(newRow).toBeVisible({ timeout: 15_000 });

    // D) Detail panel: selecting created release shows safe metadata
    // handleCreate selects the new release id automatically; detail effect will load it.
    // While detail loads, "Laster…" may appear; then real detail content.
    await expect(detailSection.getByText(/laster…/i)).not.toBeVisible({ timeout: 15_000 }).catch(() => {
      // If "Laster…" never appears, we still proceed to check for stable detail content.
    });

    await expect(
      detailSection.getByText(uniqueName, { exact: false }),
    ).toBeVisible({ timeout: 15_000 });

    // Status label should be rendered next to the name (Kladd / Planlagt / Fullført)
    await expect(
      detailSection.getByText(/Kladd|Planlagt|Fullført/i),
    ).toBeVisible();

    // Detail should show a variants summary line (even if 0)
    await expect(
      detailSection.getByText(/Varianter \(/i),
    ).toBeVisible();

    // E) List remains usable after creation (row is still clickable)
    await newRow.click();
    await expect(
      detailSection.getByText(uniqueName, { exact: false }),
    ).toBeVisible();

    // No error fallback text
    await expect(
      main.getByText(/kunne ikke laste release/i),
    ).toHaveCount(0);
    await assertNoCrashText(page);
  });
});


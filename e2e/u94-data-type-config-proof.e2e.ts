/**
 * U94 — Data Type-driven block library, limits, create label, property binding (local_provider).
 *
 * Server:
 *   $env:PORT='3044'; $env:LP_CMS_RUNTIME_MODE='local_provider'; npm run dev
 *
 * Playwright:
 *   $env:CI='1'; $env:PLAYWRIGHT_BASE_URL='http://localhost:3044'; $env:LP_CMS_RUNTIME_MODE='local_provider'; npx playwright test e2e/u94-data-type-config-proof.e2e.ts --project=chromium
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import {
  loginViaForm,
  resolveBackofficeSuperadminCredentialsForE2E,
  waitForPostLoginNavigation,
} from "./helpers/auth";
import {
  assertProtectedShellReady,
  dismissContentWorkspaceOnboardingIfPresent,
  dismissEditorCoachmarkIfPresent,
  waitForFontsReady,
  waitForMainContent,
} from "./helpers/ready";
import { cmsPageDetailQueryString } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.preview";

const PAGE_COMPACT = "00000000-0000-4000-8000-00000000c004";
const PAGE_MICRO = "00000000-0000-4000-8000-00000000c005";
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "u94-data-type-config-proof");

test.describe.configure({ mode: "serial" });

async function shot(locator: import("@playwright/test").Locator, file: string) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible({ timeout: 25_000 });
  await waitForFontsReady(locator.page());
  await locator.screenshot({ path: path.join(ARTIFACT_DIR, file), animations: "disabled" });
}

async function openLibrary(page: import("@playwright/test").Page) {
  const insertBtn = page.locator("[data-lp-insert-end]").first();
  await expect(insertBtn).toBeVisible({ timeout: 25_000 });
  await insertBtn.scrollIntoViewIfNeeded();
  await insertBtn.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByRole("heading", { name: "Block library" })).toBeVisible({ timeout: 15_000 });
  return dialog;
}

test("U94 data type config proof — compact allowlist + groups; micro max cap", async ({ page, baseURL }) => {
  test.setTimeout(300_000);
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await page.setViewportSize({ width: 2200, height: 1200 });

  const creds = resolveBackofficeSuperadminCredentialsForE2E();
  test.skip(!creds, "No superadmin credentials (E2E_* or canonical local_provider)");

  const origin = baseURL ?? "http://localhost:3044";
  await loginViaForm(page, creds.email, creds.password, "/backoffice/content");
  await waitForPostLoginNavigation(page, { timeout: 90_000 });
  await expect(page).toHaveURL(/\/backoffice\/content/);
  await assertProtectedShellReady(page);

  const triPane = page.locator('[data-lp-content-workspace-shell="tri-pane"]');

  const readDocType = (id: string) =>
    page.evaluate(
      async ({ pageId, qs }) => {
        const r = await fetch(`/api/backoffice/content/pages/${encodeURIComponent(pageId)}?${qs}`, {
          credentials: "include",
          headers: { accept: "application/json" },
        });
        const j = await r.json();
        if (
          !j ||
          typeof j !== "object" ||
          !("ok" in j) ||
          j.ok !== true ||
          !("data" in j) ||
          !j.data ||
          typeof j.data !== "object" ||
          !("page" in j.data) ||
          !j.data.page ||
          typeof j.data.page !== "object" ||
          !("body" in j.data.page) ||
          !j.data.page.body ||
          typeof j.data.page.body !== "object"
        ) {
          return { ok: false, documentType: null };
        }
        const b = j.data.page.body;
        const documentType = typeof b.documentType === "string" ? b.documentType : null;
        return { ok: true, documentType };
      },
      { pageId: id, qs: cmsPageDetailQueryString() },
    );

  const compactEnvelope = await readDocType(PAGE_COMPACT);
  const microEnvelope = await readDocType(PAGE_MICRO);
  test.skip(
    !compactEnvelope.ok ||
      compactEnvelope.documentType !== "compact_page" ||
      !microEnvelope.ok ||
      microEnvelope.documentType !== "micro_landing",
    `U94 krever local_provider + oppdatert seed (compact_page + micro_landing). Kompakt: ${JSON.stringify(compactEnvelope)}. Micro: ${JSON.stringify(microEnvelope)}.`,
  );

  /* ——— Compact page ——— */
  await page.goto(`${origin}/backoffice/content/${PAGE_COMPACT}`);
  await waitForMainContent(page, { timeout: 40_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);

  await expect(triPane).toBeVisible({ timeout: 40_000 });
  await expect(page.locator("#lp-editor-block-compact-hero")).toBeVisible({ timeout: 25_000 });

  await expect(page.locator("[data-lp-canvas-block-property-binding]")).toBeVisible({ timeout: 25_000 });
  await expect(page.locator("[data-lp-block-editor-data-type-canvas]")).toHaveText("compact_page_blocks");
  await shot(triPane, "01-full-canvas-inspector.png");

  const compactInsert = page.locator("[data-lp-insert-end]").first();
  await expect(compactInsert).toContainText("Legg til kompakt blokk");
  await shot(page.locator("[data-lp-canvas-block-property-binding]"), "06-proof-property-binding-data-type.png");

  const dialogCompact = await openLibrary(page);
  await expect(dialogCompact.locator("[data-lp-block-editor-data-type]")).toHaveText("compact_page_blocks");
  await expect(dialogCompact.locator("[data-lp-block-library-allowed-count]")).toHaveText("5");
  await shot(dialogCompact, "02-block-library-full.png");
  await shot(dialogCompact, "04-proof-allowed-block-count.png");

  await expect(dialogCompact.locator('[data-lp-block-library-group-title="Kjerne"]')).toBeVisible({
    timeout: 10_000,
  });
  await expect(dialogCompact.locator('[data-lp-block-library-group-title="Seksjon"]')).toBeVisible();
  await expect(dialogCompact.locator('[data-lp-block-library-group-title="Handling"]')).toBeVisible();
  await shot(dialogCompact.locator("[data-lp-block-library-catalog]").first(), "03-block-library-groups.png");

  await expect(dialogCompact.locator('[data-lp-library-block-alias="pricing"]')).toHaveCount(0);

  const searchCompact = dialogCompact.getByRole("searchbox", { name: /search blocks/i }).first();
  await searchCompact.fill("pricing");
  await expect(dialogCompact.getByText("Ingen blokker matcher søket ditt.", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await page.keyboard.press("Escape");
  await expect(dialogCompact).toBeHidden({ timeout: 10_000 });

  /* Add one allowed block (image) */
  const dialogAdd = await openLibrary(page);
  await dialogAdd.getByRole("searchbox", { name: /search blocks/i }).first().fill("bilde");
  const imageCard = dialogAdd.locator('[data-lp-library-block-alias="image"]').first();
  await expect(imageCard).toBeVisible({ timeout: 15_000 });
  await imageCard.click();
  await expect(dialogAdd).toBeHidden({ timeout: 20_000 });
  await shot(triPane, "07-new-block-created-under-data-type.png");
  await shot(triPane, "08-full-canvas-after-creation.png");

  /* ——— Micro page (at max) ——— */
  await page.goto(`${origin}/backoffice/content/${PAGE_MICRO}`);
  await waitForMainContent(page, { timeout: 40_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);

  await expect(triPane).toBeVisible({ timeout: 40_000 });
  await expect(page.locator("[data-lp-block-editor-data-type-canvas]")).toHaveText("page_micro_blocks");
  const microInsert = page.locator("[data-lp-insert-end]").first();
  await expect(microInsert).toHaveAttribute("data-lp-block-list-at-max", "true");
  await expect(microInsert).toBeDisabled();
  await expect(microInsert).toContainText("Legg til blokk (maks 3)");

  await shot(triPane, "05-proof-create-label-and-limit.png");
});

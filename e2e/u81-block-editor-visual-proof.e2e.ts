/**
 * U81 — Nettleser-screenshots: Umbraco-lignende block editor (canvas + inspector + katalog).
 *
 * Kjør (anbefalt: lokal CMS + egen dev-instans):
 *   cross-env LP_CMS_RUNTIME_MODE=local_provider LP_PLAYWRIGHT_WEBSERVER_LOCAL_CMS=1 npx playwright test e2e/u81-block-editor-visual-proof.e2e.ts --project=chromium
 *
 * Artefakter: artifacts/u81-block-editor-visual/*.png (01 = midt-canvas, 02–08 = per frame, 09–10 = inspector, 11 = block library)
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { test, expect } from "@playwright/test";
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

const PAGE_ID = "00000000-0000-4000-8000-00000000c001";
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "u81-block-editor-visual");

test.describe.configure({ mode: "serial" });

async function shotLocator(locator: import("@playwright/test").Locator, file: string) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible({ timeout: 20_000 });
  await waitForFontsReady(locator.page());
  await locator.screenshot({ path: file, animations: "disabled" });
}

test.describe("U81 — block editor visual proof (browser)", () => {
  test.beforeEach(async ({ page }) => {
    /** Bred viewport: tri-pane midtkolonne kan kollapse mot ~120px når ytre shell er smal (grid math). */
    await page.setViewportSize({ width: 2200, height: 1200 });
  });

  test("c001 → canvas, per-frame blocks, inspector×2, block library", async ({ page, baseURL }) => {
    test.setTimeout(240_000);

    const resolved = resolveBackofficeSuperadminCredentialsForE2E();
    test.skip(!resolved, "No superadmin credentials (E2E_* eller local_provider canonical)");

    await mkdir(ARTIFACT_DIR, { recursive: true });

    const origin = baseURL ?? "http://localhost:3000";
    await loginViaForm(page, resolved.email, resolved.password, "/backoffice/content");
    await waitForPostLoginNavigation(page, { timeout: 90_000 });
    await expect(page).toHaveURL(/\/backoffice\/content/);
    await assertProtectedShellReady(page);

    await page.goto(`${origin}/backoffice/content/${PAGE_ID}`);
    await waitForMainContent(page, { timeout: 30_000 });
    await dismissContentWorkspaceOnboardingIfPresent(page);
    await dismissEditorCoachmarkIfPresent(page);

    const firstArticle = page.locator('article[id^="lp-editor-block-"]').first();
    await expect(firstArticle).toBeVisible({ timeout: 60_000 });
    await waitForFontsReady(page);

    /**
     * Alltid midt-canvas: tri-pane-roten kan gi degenererte screenshot-bredder; høyre/venstre
     * panel har egne `article`-noder som ellers matchet `article[data-lp-block-card]`.
     */
    const canvasRoot = page.locator("#lp-content-editor-canvas");
    await shotLocator(canvasRoot, path.join(ARTIFACT_DIR, "u81-01-full-editor-canvas.png"));

    /** Ytre form = canvas-frame-roten (U80C), ikke artikkel-kanten (unngår degenererte bbox ved layout). */
    const byFrame = (frame: string) => canvasRoot.locator(`[data-lp-canvas-frame="${frame}"]`).first();

    await shotLocator(byFrame("hero"), path.join(ARTIFACT_DIR, "u81-02-hero.png"));
    await shotLocator(byFrame("cards"), path.join(ARTIFACT_DIR, "u81-03-cards.png"));
    await shotLocator(byFrame("steps"), path.join(ARTIFACT_DIR, "u81-04-steps.png"));
    await shotLocator(byFrame("pricing"), path.join(ARTIFACT_DIR, "u81-05-pricing.png"));
    await shotLocator(byFrame("cta"), path.join(ARTIFACT_DIR, "u81-06-cta.png"));
    await shotLocator(byFrame("related"), path.join(ARTIFACT_DIR, "u81-07-related.png"));
    await shotLocator(byFrame("grid"), path.join(ARTIFACT_DIR, "u81-08-grid.png"));

    await expect(page.getByText("Editorstruktur", { exact: true })).toBeVisible({ timeout: 15_000 });
    const treeBtn1 = page.getByRole("button", { name: /^1\.\s/ }).first();
    await treeBtn1.click();

    /** Innhold-fanen er default; sticky top-bar kan blokkere klikk — bruk force ved behov. */
    const innholdTab = page
      .locator("aside")
      .filter({ has: page.getByRole("navigation", { name: "Høyre arbeidsflater" }) })
      .getByRole("button", { name: "Innhold", exact: true });
    await expect(innholdTab).toBeVisible({ timeout: 30_000 });
    await innholdTab.click({ force: true });

    const inspector = page.locator("[data-lp-inspector-block-root]");
    await expect(inspector).toBeVisible({ timeout: 15_000 });
    await shotLocator(inspector, path.join(ARTIFACT_DIR, "u81-09-inspector-block-1-hero.png"));

    const treeBtn4 = page.getByRole("button", { name: /^4\.\s/ }).first();
    await treeBtn4.click();
    await expect(inspector).toBeVisible({ timeout: 15_000 });
    await shotLocator(inspector, path.join(ARTIFACT_DIR, "u81-10-inspector-block-4-pricing.png"));

    const insertBtn = page.getByRole("button", { name: "Legg til innhold" }).first();
    await insertBtn.scrollIntoViewIfNeeded();
    await insertBtn.click();
    const library = page.getByRole("dialog");
    await expect(library).toBeVisible({ timeout: 15_000 });
    await expect(library.getByRole("heading", { name: "Block library" })).toBeVisible();
    await waitForFontsReady(page);
    await library.screenshot({ path: path.join(ARTIFACT_DIR, "u81-11-block-library.png"), animations: "disabled" });

    await page.keyboard.press("Escape");
    await expect(library).toBeHidden({ timeout: 10_000 });
  });
});

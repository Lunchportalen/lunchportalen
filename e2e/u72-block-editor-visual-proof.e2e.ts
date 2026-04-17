/**
 * U72 — Browser screenshots for block editor parity sign-off (canonical seed page c001).
 *
 * Run (canonical local CMS login + fresh dev server — avoids reused remote_backend on :3000):
 *   cross-env LP_CMS_RUNTIME_MODE=local_provider LP_PLAYWRIGHT_WEBSERVER_LOCAL_CMS=1 npx playwright test e2e/u72-block-editor-visual-proof.e2e.ts --project=chromium
 *
 * Dev-singleton allows only one `npm run dev` per workspace. Stop any existing dev server before forcing a fresh local_provider instance.
 *
 * If port 3000 is already in use by a non-Next process, bind a spare port:
 *   cross-env LP_CMS_RUNTIME_MODE=local_provider LP_PLAYWRIGHT_WEBSERVER_LOCAL_CMS=1 LP_PLAYWRIGHT_DEV_PORT=3010 npx playwright test e2e/u72-block-editor-visual-proof.e2e.ts --project=chromium
 *
 * Artifacts: artifacts/u72-block-editor-visual/*.png
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

const U72_PAGE_ID = "00000000-0000-4000-8000-00000000c001";
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "u72-block-editor-visual");

test.describe.configure({ mode: "serial" });

test.describe("U72 — block editor visual proof (c001)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
  });

  test("login → c001 → screenshots (idle, hover, selected, insert, inspector)", async ({ page, baseURL }) => {
    test.setTimeout(180_000);

    const resolved = resolveBackofficeSuperadminCredentialsForE2E();
    test.skip(!resolved, "No superadmin credentials (E2E_* or local_provider canonical)");

    await mkdir(ARTIFACT_DIR, { recursive: true });

    const origin = baseURL ?? "http://localhost:3000";
    await loginViaForm(page, resolved.email, resolved.password, "/backoffice/content");
    await waitForPostLoginNavigation(page, { timeout: 90_000 });
    await expect(page).toHaveURL(/\/backoffice\/content/);
    await assertProtectedShellReady(page);

    await page.goto(`${origin}/backoffice/content/${U72_PAGE_ID}`);
    await waitForMainContent(page, { timeout: 30_000 });
    await dismissContentWorkspaceOnboardingIfPresent(page);
    await dismissEditorCoachmarkIfPresent(page);

    const firstBlock = page.locator('article[id^="lp-editor-block-"]').first();
    await expect(firstBlock).toBeVisible({ timeout: 60_000 });
    const blockDomId = await firstBlock.getAttribute("id");
    const blockUuid = blockDomId?.replace(/^lp-editor-block-/, "") ?? "";
    expect(blockUuid.length).toBeGreaterThan(10);

    await waitForFontsReady(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "u72-01-canvas-idle.png") });

    const row = firstBlock.locator(".lp-motion-row").first();
    await row.hover();
    await waitForFontsReady(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "u72-02-block-row-hover.png") });

    await expect(page.getByText("Editorstruktur", { exact: true })).toBeVisible({ timeout: 15_000 });
    const treeSelect = page.getByRole("button", { name: /\d+\.\s/ }).first();
    await treeSelect.click();
    await expect(page.getByLabel("Aktiv blokk")).toBeVisible({ timeout: 10_000 });
    await waitForFontsReady(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "u72-03-block-selected-tree.png") });

    const insertBtn = page.getByRole("button", { name: "Legg til innhold" });
    await insertBtn.scrollIntoViewIfNeeded();
    await expect(insertBtn).toBeVisible({ timeout: 10_000 });
    await waitForFontsReady(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "u72-04-insert-affordance.png") });

    const innholdTab = page
      .locator("aside")
      .filter({ has: page.getByRole("navigation", { name: "Høyre arbeidsflater" }) })
      .getByRole("button", { name: "Innhold", exact: true });
    await expect(innholdTab).toBeVisible({ timeout: 30_000 });
    await innholdTab.click({ force: true });

    const inspectorRoot = page.locator("[data-lp-inspector-block-root]");
    await expect(inspectorRoot).toBeVisible({ timeout: 15_000 });
    await expect(inspectorRoot).toHaveAttribute("data-lp-inspector-block-id", blockUuid);
    await expect(page.getByText("Valgt blokk")).toBeVisible();
    await waitForFontsReady(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "u72-05-inspector-coupled.png") });
  });
});

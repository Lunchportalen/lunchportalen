/**
 * U85 — Runtime-bevis: blokkspesifikke property editors + dirty → lagre → reload.
 *
 * Kjør mot kjørende local_provider (én dev-instans per workspace):
 *   cross-env LP_CMS_RUNTIME_MODE=local_provider CI=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test e2e/u85-property-editor-runtime-proof.e2e.ts --project=chromium
 *
 * Artefakter: artifacts/u85-property-editor-proof/*.png
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
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "u85-property-editor-proof");

/** Tree ordinal → forventet `data-lp-property-editor-root` på overflaten (Steps = zigzag datatype). */
const BLOCKS: { ordinal: number; root: string; file: string }[] = [
  { ordinal: 1, root: "hero", file: "u85-02-hero-property-editor.png" },
  { ordinal: 2, root: "cards", file: "u85-03-cards-property-editor.png" },
  { ordinal: 3, root: "zigzag", file: "u85-04-steps-property-editor.png" },
  { ordinal: 4, root: "pricing", file: "u85-05-pricing-property-editor.png" },
  { ordinal: 5, root: "cta", file: "u85-06-cta-property-editor.png" },
  { ordinal: 6, root: "relatedLinks", file: "u85-07-relatedLinks-property-editor.png" },
  { ordinal: 7, root: "grid", file: "u85-08-grid-property-editor.png" },
];

test.describe.configure({ mode: "serial" });

async function openInspectorInnholdTab(page: import("@playwright/test").Page) {
  const innholdTab = page
    .locator("aside")
    .filter({ has: page.getByRole("navigation", { name: "Høyre arbeidsflater" }) })
    .getByRole("button", { name: "Innhold", exact: true });
  await expect(innholdTab).toBeVisible({ timeout: 30_000 });
  await innholdTab.click({ force: true });
}

async function selectBlockByTreeOrdinal(page: import("@playwright/test").Page, ordinal: number) {
  await expect(page.getByText("Editorstruktur", { exact: true })).toBeVisible({ timeout: 20_000 });
  const treeBtn = page.getByRole("button", { name: new RegExp(`^${ordinal}\\.\\s`) }).first();
  await treeBtn.click();
}

async function shotLocator(locator: import("@playwright/test").Locator, file: string) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible({ timeout: 25_000 });
  await waitForFontsReady(locator.page());
  await locator.screenshot({ path: file, animations: "disabled" });
}

function peSurface(page: import("@playwright/test").Page) {
  return page.locator("[data-lp-inspector-property-editor-surface]");
}

test.describe("U85 — property editor runtime + persistens", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 2200, height: 1200 });
  });

  test("tri-pane, per-blokk PE, bibliotek, hero+pricing dirty→lagre→reload", async ({ page, baseURL }) => {
    test.setTimeout(360_000);

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

    const triPane = page.locator('[data-lp-content-workspace-shell="tri-pane"]');
    await expect(triPane).toBeVisible({ timeout: 60_000 });
    await waitForFontsReady(page);
    await shotLocator(triPane, path.join(ARTIFACT_DIR, "u85-01-full-canvas-and-inspector.png"));

    for (const b of BLOCKS) {
      await selectBlockByTreeOrdinal(page, b.ordinal);
      await openInspectorInnholdTab(page);
      const root = peSurface(page).locator(`[data-lp-property-editor-root="${b.root}"]`);
      await expect(root).toBeVisible({ timeout: 20_000 });
      /** Feil PE skal ikke vises samtidig (én router-flate). */
      const wrongRoots = BLOCKS.filter((x) => x.root !== b.root).map((x) => x.root);
      for (const w of wrongRoots) {
        await expect(peSurface(page).locator(`[data-lp-property-editor-root="${w}"]`)).toHaveCount(0);
      }
      await shotLocator(root, path.join(ARTIFACT_DIR, b.file));
    }

    const insertBtn = page.getByRole("button", { name: "Legg til innhold" }).first();
    await insertBtn.scrollIntoViewIfNeeded();
    await insertBtn.click();
    const library = page.getByRole("dialog");
    await expect(library).toBeVisible({ timeout: 15_000 });
    await expect(library.getByRole("heading", { name: "Block library" })).toBeVisible();
    await waitForFontsReady(page);
    await library.screenshot({
      path: path.join(ARTIFACT_DIR, "u85-09-block-library.png"),
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await expect(library).toBeHidden({ timeout: 10_000 });

    // —— Persistens: hero (content + settings + struktur-seksjon) ——
    await selectBlockByTreeOrdinal(page, 1);
    await openInspectorInnholdTab(page);
    const heroRoot = peSurface(page).locator('[data-lp-property-editor-root="hero"]');
    await expect(heroRoot).toBeVisible();
    const heroMarker = `U85-H-${Date.now()}`;
    const titleInput = heroRoot.locator("label", { hasText: "Tittel" }).locator("input").first();
    await titleInput.fill(heroMarker);
    await heroRoot.locator("label", { hasText: "Bilde (ID / URL)" }).locator("input").first().fill("u85-hero-settings-proof");

    await expect(heroRoot.locator('[data-lp-property-section="content"]')).toHaveCount(1);
    await expect(heroRoot.locator('[data-lp-property-section="settings"]')).toHaveCount(1);
    await expect(heroRoot.locator('[data-lp-property-section="structure"]')).toHaveCount(1);

    await expect(page.locator("footer").getByText(/· ulagret/)).toBeVisible({ timeout: 15_000 });

    const saveBtn = page.locator("header").getByRole("button", { name: "Lagre", exact: true }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();
    await expect(page.locator("footer").getByText(/· ulagret/)).toBeHidden({ timeout: 120_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForMainContent(page, { timeout: 30_000 });
    await dismissContentWorkspaceOnboardingIfPresent(page);
    await dismissEditorCoachmarkIfPresent(page);
    await selectBlockByTreeOrdinal(page, 1);
    await openInspectorInnholdTab(page);
    const heroAfter = peSurface(page).locator('[data-lp-property-editor-root="hero"]');
    await expect(heroAfter).toBeVisible({ timeout: 30_000 });
    await expect(heroAfter.locator("label", { hasText: "Tittel" }).locator("input").first()).toHaveValue(heroMarker);
    await expect(heroAfter.locator("label", { hasText: "Bilde (ID / URL)" }).locator("input").first()).toHaveValue(
      "u85-hero-settings-proof",
    );

    // —— Persistens: pricing (content + settings + structure/plan) ——
    await selectBlockByTreeOrdinal(page, 4);
    await openInspectorInnholdTab(page);
    const pricingRoot = peSurface(page).locator('[data-lp-property-editor-root="pricing"]');
    await expect(pricingRoot).toBeVisible();
    const pricingMarker = `U85-P-${Date.now()}`;
    await pricingRoot.locator("label", { has: pricingRoot.getByText("Overskrift", { exact: true }) }).locator("input").first().fill(pricingMarker);
    const featuredBox = pricingRoot.getByRole("checkbox", { name: /Fremhev/i }).first();
    const wasChecked = await featuredBox.isChecked();
    await featuredBox.setChecked(!wasChecked);

    await expect(pricingRoot.locator('[data-lp-property-section="content"]')).toHaveCount(1);
    await expect(pricingRoot.locator('[data-lp-property-section="settings"]')).toHaveCount(1);
    await expect(pricingRoot.locator('[data-lp-property-section="structure"]')).toHaveCount(1);

    await expect(page.locator("footer").getByText(/· ulagret/)).toBeVisible({ timeout: 15_000 });
    const save2 = page.locator("header").getByRole("button", { name: "Lagre", exact: true }).first();
    await expect(save2).toBeEnabled();
    await save2.click();
    await expect(page.locator("footer").getByText(/· ulagret/)).toBeHidden({ timeout: 120_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForMainContent(page, { timeout: 30_000 });
    await dismissContentWorkspaceOnboardingIfPresent(page);
    await dismissEditorCoachmarkIfPresent(page);
    await selectBlockByTreeOrdinal(page, 4);
    await openInspectorInnholdTab(page);
    const pricingAfter = peSurface(page).locator('[data-lp-property-editor-root="pricing"]');
    await expect(pricingAfter).toBeVisible({ timeout: 30_000 });
    await expect(
      pricingAfter.locator("label", { has: pricingAfter.getByText("Overskrift", { exact: true }) }).locator("input").first(),
    ).toHaveValue(pricingMarker);
    await expect(pricingAfter.getByRole("checkbox", { name: /Fremhev/i }).first()).toBeChecked({ checked: !wasChecked });
  });
});

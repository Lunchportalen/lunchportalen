/**
 * U86 — Runtime-bevis: local_provider, blokkspesifikke property editors, dirty → lagre → reload.
 *
 * DEL 1: Boot selv (PORT + LP_CMS_RUNTIME_MODE), bekreft /api/health → local_provider.
 * Deretter (uten Playwright webServer):
 *   cross-env CI=1 LP_CMS_RUNTIME_MODE=local_provider PLAYWRIGHT_BASE_URL=http://localhost:3010 npx playwright test e2e/u86-property-editor-runtime-proof.e2e.ts --project=chromium
 *
 * Artefakter: artifacts/u86-property-editor-runtime-proof/*.png
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
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "u86-property-editor-runtime-proof");

/**
 * Tree ordinal → `data-lp-property-editor-root` (Steps = zigzag).
 * Seed-siden `00000000…c001` bruker `hero_full` som blokk 1 (ikke `hero`); grid før CTA/related.
 */
const BLOCKS: { ordinal: number; root: string; file: string }[] = [
  { ordinal: 1, root: "hero_full", file: "u86-02-hero-property-editor.png" },
  { ordinal: 2, root: "cards", file: "u86-03-cards-property-editor.png" },
  { ordinal: 3, root: "zigzag", file: "u86-04-steps-property-editor.png" },
  { ordinal: 4, root: "pricing", file: "u86-05-pricing-property-editor.png" },
  { ordinal: 5, root: "grid", file: "u86-08-grid-property-editor.png" },
  { ordinal: 6, root: "cta", file: "u86-06-cta-property-editor.png" },
  { ordinal: 7, root: "relatedLinks", file: "u86-07-relatedLinks-property-editor.png" },
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

test.describe("U86 — property editor runtime (local_provider) + persistens", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 2200, height: 1200 });
  });

  test("tri-pane, per-blokk PE, bibliotek, hero+pricing dirty→lagre→reload, proof screenshots", async ({
    page,
    baseURL,
  }) => {
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
    await shotLocator(triPane, path.join(ARTIFACT_DIR, "u86-01-full-canvas-inspector.png"));

    for (const b of BLOCKS) {
      await selectBlockByTreeOrdinal(page, b.ordinal);
      await openInspectorInnholdTab(page);
      const root = peSurface(page).locator(`[data-lp-property-editor-root="${b.root}"]`);
      await expect(root).toBeVisible({ timeout: 20_000 });
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
      path: path.join(ARTIFACT_DIR, "u86-11-block-library.png"),
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await expect(library).toBeHidden({ timeout: 10_000 });

    // —— Persistens A: hero_full (content + settings + structure) ——
    await selectBlockByTreeOrdinal(page, 1);
    await openInspectorInnholdTab(page);
    const heroRoot = peSurface(page).locator('[data-lp-property-editor-root="hero_full"]');
    await expect(heroRoot).toBeVisible();
    const heroMarker = `U86-H-${Date.now()}`;
    const titleInput = heroRoot.locator("label", { hasText: "Tittel" }).locator("input").first();
    await titleInput.fill(heroMarker);
    await heroRoot.locator("label", { hasText: "Bilde (ID / URL)" }).locator("input").first().fill("u86-hero-settings-proof");

    await expect(heroRoot.locator('[data-lp-property-section="content"]')).toHaveCount(1);
    await expect(heroRoot.locator('[data-lp-property-section="settings"]')).toHaveCount(1);
    await expect(heroRoot.locator('[data-lp-property-section="structure"]')).toHaveCount(1);

    await expect(page.locator("footer").getByText(/· ulagret/)).toBeVisible({ timeout: 15_000 });
    const saveBtn = page.locator("header").getByRole("button", { name: "Lagre", exact: true }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });

    await waitForFontsReady(page);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "u86-09-dirty-save-proof.png"),
      animations: "disabled",
    });

    await saveBtn.click();
    await expect(page.locator("footer").getByText(/· ulagret/)).toBeHidden({ timeout: 120_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForMainContent(page, { timeout: 30_000 });
    await dismissContentWorkspaceOnboardingIfPresent(page);
    await dismissEditorCoachmarkIfPresent(page);
    await selectBlockByTreeOrdinal(page, 1);
    await openInspectorInnholdTab(page);
    const heroAfter = peSurface(page).locator('[data-lp-property-editor-root="hero_full"]');
    await expect(heroAfter).toBeVisible({ timeout: 30_000 });
    await expect(heroAfter.locator("label", { hasText: "Tittel" }).locator("input").first()).toHaveValue(heroMarker);
    await expect(heroAfter.locator("label", { hasText: "Bilde (ID / URL)" }).locator("input").first()).toHaveValue(
      "u86-hero-settings-proof",
    );

    await waitForFontsReady(page);
    await shotLocator(heroAfter, path.join(ARTIFACT_DIR, "u86-10-reload-persist-proof.png"));

    // —— Persistens B: pricing (content + settings + structure) ——
    await selectBlockByTreeOrdinal(page, 4);
    await openInspectorInnholdTab(page);
    const pricingRoot = peSurface(page).locator('[data-lp-property-editor-root="pricing"]');
    await expect(pricingRoot).toBeVisible();
    const pricingMarker = `U86-P-${Date.now()}`;
    const pricingIngress = `U86-P-INGRESS-${Date.now()}`;
    await pricingRoot.getByRole("textbox", { name: "Overskrift", exact: true }).fill(pricingMarker);
    await pricingRoot.getByRole("textbox", { name: "Ingress", exact: true }).fill(pricingIngress);
    /** Seed kan ha tom planliste — da finnes ingen «Fremhev» før vi legger til minst én pakke. */
    const addPlanBtn = pricingRoot.getByRole("button", { name: /Legg til pakke/i });
    if (await addPlanBtn.isEnabled()) {
      await addPlanBtn.click();
    }
    await pricingRoot.getByRole("textbox", { name: /Pakkenavn/i }).first().fill("U86-PKG-NAME");
    const featuredBox = pricingRoot.locator('label:has-text("Fremhev")').locator('input[type="checkbox"]').first();
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
    await expect(pricingAfter.getByRole("textbox", { name: "Overskrift", exact: true })).toHaveValue(pricingMarker);
    await expect(pricingAfter.getByRole("textbox", { name: "Ingress", exact: true })).toHaveValue(pricingIngress);
    await expect(pricingAfter.getByRole("textbox", { name: /Pakkenavn/i }).first()).toHaveValue("U86-PKG-NAME");
    await expect(
      pricingAfter.locator('label:has-text("Fremhev")').locator('input[type="checkbox"]').first(),
    ).toBeChecked({ checked: !wasChecked });
  });
});

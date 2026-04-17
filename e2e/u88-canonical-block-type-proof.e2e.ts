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

const PAGE_ID = "00000000-0000-4000-8000-00000000c001";
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "u88-canonical-block-type-proof");

const KEY_BLOCKS: { ordinal: number; root: string; file: string }[] = [
  { ordinal: 1, root: "hero_full", file: "05-hero-property-editor.png" },
  { ordinal: 2, root: "cards", file: "06-cards-property-editor.png" },
  { ordinal: 4, root: "pricing", file: "07-pricing-property-editor.png" },
  { ordinal: 7, root: "relatedLinks", file: "08-relatedLinks-property-editor.png" },
];

test.describe.configure({ mode: "serial" });

async function shot(locator: import("@playwright/test").Locator, file: string) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible({ timeout: 25_000 });
  await waitForFontsReady(locator.page());
  await locator.screenshot({ path: path.join(ARTIFACT_DIR, file), animations: "disabled" });
}

async function openInnholdTab(page: import("@playwright/test").Page) {
  const tab = page
    .locator("aside")
    .filter({ has: page.getByRole("navigation", { name: "Høyre arbeidsflater" }) })
    .getByRole("button", { name: "Innhold", exact: true });
  await expect(tab).toBeVisible({ timeout: 25_000 });
  await tab.click({ force: true });
}

async function selectBlockByOrdinal(page: import("@playwright/test").Page, ordinal: number) {
  await expect(page.getByText("Editorstruktur", { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: new RegExp(`^${ordinal}\\.\\s`) }).first().click();
}

function peSurface(page: import("@playwright/test").Page) {
  return page.locator("[data-lp-inspector-property-editor-surface]");
}

async function openLibrary(page: import("@playwright/test").Page) {
  const insertBtn = page.getByRole("button", { name: "Legg til innhold" }).first();
  await insertBtn.scrollIntoViewIfNeeded();
  await insertBtn.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByRole("heading", { name: "Block library" })).toBeVisible({ timeout: 15_000 });
  return dialog;
}

async function closeLibrary(page: import("@playwright/test").Page, dialog: import("@playwright/test").Locator) {
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

async function librarySearch(dialog: import("@playwright/test").Locator, query: string) {
  const searchInput = dialog.getByRole("searchbox", { name: /search blocks/i }).first();
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
  await searchInput.fill(query);
}

async function addBlockFromLibrary(
  page: import("@playwright/test").Page,
  query: string,
  blockLabel: RegExp,
) {
  const dialog = await openLibrary(page);
  await librarySearch(dialog, query);
  await dialog.getByRole("button", { name: blockLabel }).first().click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

test("U88 canonical block type runtime proof", async ({ page, baseURL }) => {
  test.setTimeout(420_000);
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await page.setViewportSize({ width: 2200, height: 1200 });

  const creds = resolveBackofficeSuperadminCredentialsForE2E();
  test.skip(!creds, "No superadmin credentials (E2E_* or canonical local_provider)");

  const origin = baseURL ?? "http://localhost:3000";
  await loginViaForm(page, creds.email, creds.password, "/backoffice/content");
  await waitForPostLoginNavigation(page, { timeout: 90_000 });
  await expect(page).toHaveURL(/\/backoffice\/content/);
  await assertProtectedShellReady(page);

  await page.goto(`${origin}/backoffice/content/${PAGE_ID}`);
  await waitForMainContent(page, { timeout: 40_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);

  const triPane = page.locator('[data-lp-content-workspace-shell="tri-pane"]');
  await expect(triPane).toBeVisible({ timeout: 50_000 });
  await shot(triPane, "10-full-canvas-inspector.png");

  const canvasRoot = page.locator("#lp-content-editor-canvas");
  await shot(canvasRoot, "09-canvas-three-distinct-blocks.png");

  for (const b of KEY_BLOCKS) {
    await selectBlockByOrdinal(page, b.ordinal);
    await openInnholdTab(page);
    const root = peSurface(page).locator(`[data-lp-property-editor-root="${b.root}"]`);
    await expect(root).toBeVisible({ timeout: 20_000 });
    await shot(root, b.file);
  }

  const library = await openLibrary(page);
  await shot(library, "01-block-library-full.png");
  await librarySearch(library, "hero");
  await shot(library, "02-hero-family-library.png");
  await librarySearch(library, "grid");
  await shot(library, "03-cards-vs-grid-library.png");
  await librarySearch(library, "cta");
  await shot(library, "04-cta-vs-banner-library.png");
  await closeLibrary(page, library);

  // Runtime proof: add hero + hero_bleed and verify property editor routing by root alias.
  await addBlockFromLibrary(page, "hero (standard)", /Hero \(standard\)/i);
  await selectBlockByOrdinal(page, 8);
  await openInnholdTab(page);
  await expect(peSurface(page).locator('[data-lp-property-editor-root="hero"]')).toBeVisible({ timeout: 20_000 });

  await addBlockFromLibrary(page, "hero (kant til kant)", /Hero \(kant til kant\)/i);
  await selectBlockByOrdinal(page, 9);
  await openInnholdTab(page);
  await expect(peSurface(page).locator('[data-lp-property-editor-root="hero_bleed"]')).toBeVisible({ timeout: 20_000 });

  // Defaults/validation/save/reload proof A: hero_full (simple)
  await selectBlockByOrdinal(page, 1);
  await openInnholdTab(page);
  const heroRoot = peSurface(page).locator('[data-lp-property-editor-root="hero_full"]');
  await expect(heroRoot).toBeVisible({ timeout: 20_000 });
  await expect(heroRoot.getByText(/anbefales|CTA|tittel/i).first()).toBeVisible({ timeout: 20_000 });
  await shot(heroRoot, "11-defaults-proof.png");

  const heroMarker = `U88-H-${Date.now()}`;
  await heroRoot.locator("label", { hasText: "Tittel" }).locator("input").first().fill(heroMarker);
  await expect(page.locator("footer").getByText(/· ulagret/)).toBeVisible({ timeout: 15_000 });
  const saveHero = page.locator("header").getByRole("button", { name: "Lagre", exact: true }).first();
  await expect(saveHero).toBeEnabled();
  await saveHero.click();
  await expect(page.locator("footer").getByText(/· ulagret/)).toBeHidden({ timeout: 120_000 });

  // Defaults/validation/save/reload proof B: pricing (structure/items)
  await selectBlockByOrdinal(page, 4);
  await openInnholdTab(page);
  const pricingRoot = peSurface(page).locator('[data-lp-property-editor-root="pricing"]');
  await expect(pricingRoot).toBeVisible({ timeout: 20_000 });
  await expect(pricingRoot.getByText(/live priser|pakke|plan/i).first()).toBeVisible({ timeout: 20_000 });
  await shot(pricingRoot, "12-validation-proof.png");

  const pricingMarker = `U88-P-${Date.now()}`;
  await pricingRoot.getByRole("textbox", { name: "Overskrift", exact: true }).fill(pricingMarker);
  const addPlanBtn = pricingRoot.getByRole("button", { name: /Legg til pakke/i });
  if (await addPlanBtn.isVisible()) {
    await addPlanBtn.click();
  }
  await pricingRoot.getByRole("textbox", { name: /Pakkenavn/i }).first().fill("U88 PLAN");
  await expect(page.locator("footer").getByText(/· ulagret/)).toBeVisible({ timeout: 15_000 });
  const savePricing = page.locator("header").getByRole("button", { name: "Lagre", exact: true }).first();
  await expect(savePricing).toBeEnabled();
  await savePricing.click();
  await expect(page.locator("footer").getByText(/· ulagret/)).toBeHidden({ timeout: 120_000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForMainContent(page, { timeout: 40_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);

  await selectBlockByOrdinal(page, 1);
  await openInnholdTab(page);
  await expect(peSurface(page).locator('[data-lp-property-editor-root="hero_full"]')).toBeVisible({ timeout: 20_000 });
  await expect(
    peSurface(page).locator('[data-lp-property-editor-root="hero_full"]').locator("label", { hasText: "Tittel" }).locator("input").first(),
  ).toHaveValue(heroMarker);

  await selectBlockByOrdinal(page, 4);
  await openInnholdTab(page);
  const pricingAfter = peSurface(page).locator('[data-lp-property-editor-root="pricing"]');
  await expect(pricingAfter).toBeVisible({ timeout: 20_000 });
  await expect(pricingAfter.getByRole("textbox", { name: "Overskrift", exact: true })).toHaveValue(pricingMarker);
  await expect(pricingAfter.getByRole("textbox", { name: /Pakkenavn/i }).first()).toHaveValue("U88 PLAN");
});

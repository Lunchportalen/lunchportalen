/**
 * U90 — Sluttbevis: kanonisk block type definition styrer opprettelse av NYE blokker
 * (library → canvas → defaults → validation → dirty → lagre → reload → persist).
 *
 * Kjør mot kjørende local_provider (én dev-instans):
 *   cross-env CI=1 LP_CMS_RUNTIME_MODE=local_provider PLAYWRIGHT_BASE_URL=http://localhost:3010 npx playwright test e2e/u90-block-creation-contract-proof.e2e.ts --project=chromium
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";
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
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "u90-block-creation-contract-proof");

const SIMPLE_ALIAS = "cta" as const;
const STRUCTURE_ALIAS = "cards" as const;

test.describe.configure({ mode: "serial" });

async function shot(locator: import("@playwright/test").Locator, file: string) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible({ timeout: 25_000 });
  await waitForFontsReady(locator.page());
  await locator.screenshot({ path: path.join(ARTIFACT_DIR, file), animations: "disabled" });
}

function peSurface(page: import("@playwright/test").Page) {
  return page.locator("[data-lp-inspector-property-editor-surface]");
}

/** Én synlig rot per valgt blokk — ved flere like typer på siden er det siste innslaget som nettopp ble lagt til bakerst. */
function peRootForAlias(page: import("@playwright/test").Page, alias: string) {
  return peSurface(page).locator(`[data-lp-property-editor-root="${alias}"]`).last();
}

async function openInnholdTab(page: import("@playwright/test").Page) {
  const tab = page
    .locator("aside")
    .filter({ has: page.getByRole("navigation", { name: "Høyre arbeidsflater" }) })
    .getByRole("button", { name: "Innhold", exact: true });
  await expect(tab).toBeVisible({ timeout: 25_000 });
  await tab.scrollIntoViewIfNeeded();
  await tab.evaluate((el) => (el as HTMLButtonElement).click());
}

async function structureButtonCount(page: import("@playwright/test").Page) {
  const list = page.locator("button").filter({ hasText: /^\d+\.\s/ });
  await expect(list.first()).toBeVisible({ timeout: 25_000 });
  return list.count();
}

async function selectBlockByOrdinal(page: import("@playwright/test").Page, ordinal: number) {
  await expect(page.getByText("Editorstruktur", { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: new RegExp(`^${ordinal}\\.\\s`) }).first().click();
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

async function searchLibrary(dialog: import("@playwright/test").Locator, query: string) {
  const searchInput = dialog.getByRole("searchbox", { name: /search blocks/i }).first();
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
  await searchInput.fill(query);
}

async function closeLibrary(page: import("@playwright/test").Page, dialog: import("@playwright/test").Locator) {
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

async function readLibraryCard(
  dialog: import("@playwright/test").Locator,
  alias: string,
): Promise<{ title: string; description: string; whenToUse: string; differsFrom: string }> {
  const card = dialog.locator(`[data-lp-library-block-alias="${alias}"]`).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  const title = (await card.locator("[data-lp-library-title]").innerText()).trim();
  const description = (await card.locator("[data-lp-library-description]").innerText()).trim();
  const whenEl = card.locator("[data-lp-library-when-to-use]");
  const whenToUse = (await whenEl.count()) > 0 ? (await whenEl.innerText()).replace(/^Når:\s*/i, "").trim() : "";
  const diffEl = card.locator("[data-lp-library-differs-from]");
  const differsFrom = (await diffEl.count()) > 0 ? (await diffEl.innerText()).trim() : "";
  return { title, description, whenToUse, differsFrom };
}

async function addBlockFromLibraryByAlias(page: import("@playwright/test").Page, alias: string, search: string) {
  const dialog = await openLibrary(page);
  await searchLibrary(dialog, search);
  const card = dialog.locator(`[data-lp-library-block-alias="${alias}"]`).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
}

test("U90 block creation contract — new cta + cards from library", async ({ page, baseURL }) => {
  test.setTimeout(540_000);
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

  const initialCount = await structureButtonCount(page);

  const libraryFull = await openLibrary(page);
  await shot(libraryFull, "01-block-library-full.png");

  await searchLibrary(libraryFull, "cta");
  const ctaCard = libraryFull.locator(`[data-lp-library-block-alias="${SIMPLE_ALIAS}"]`).first();
  await expect(ctaCard).toBeVisible({ timeout: 15_000 });
  await shot(ctaCard, "02-simple-block-in-library-cta.png");
  const libraryCta = await readLibraryCard(libraryFull, SIMPLE_ALIAS);

  await searchLibrary(libraryFull, "kort-seksjon");
  const cardsCard = libraryFull.locator(`[data-lp-library-block-alias="${STRUCTURE_ALIAS}"]`).first();
  await expect(cardsCard).toBeVisible({ timeout: 15_000 });
  await shot(cardsCard, "03-structure-block-in-library-cards.png");
  const libraryCards = await readLibraryCard(libraryFull, STRUCTURE_ALIAS);

  await closeLibrary(page, libraryFull);

  await addBlockFromLibraryByAlias(page, SIMPLE_ALIAS, "cta");
  await addBlockFromLibraryByAlias(page, STRUCTURE_ALIAS, "kort");

  const afterCount = await structureButtonCount(page);
  expect(afterCount).toBe(initialCount + 2);

  /** La til cta først, deretter cards → nest siste ordinal = cta, siste = cards. */
  const ordinalSimple = afterCount - 1;
  const ordinalStructure = afterCount;
  expect(ordinalSimple).toBe(initialCount + 1);
  expect(ordinalStructure).toBe(initialCount + 2);

  await selectBlockByOrdinal(page, ordinalSimple);
  await openInnholdTab(page);
  const ctaRoot = peRootForAlias(page, SIMPLE_ALIAS);
  await expect(ctaRoot).toBeVisible({ timeout: 20_000 });
  await expect(ctaRoot).toHaveAttribute("data-lp-property-editor-component", "CtaPropertyEditor");
  const triPane = page.locator('[data-lp-content-workspace-shell="tri-pane"]');
  await shot(triPane, "04-new-simple-cta-canvas-inspector.png");

  await selectBlockByOrdinal(page, ordinalStructure);
  await openInnholdTab(page);
  const cardsRoot = peRootForAlias(page, STRUCTURE_ALIAS);
  await expect(cardsRoot).toBeVisible({ timeout: 20_000 });
  await expect(cardsRoot).toHaveAttribute("data-lp-property-editor-component", "CardsPropertyEditor");
  await shot(triPane, "05-new-structure-cards-canvas-inspector.png");

  await selectBlockByOrdinal(page, ordinalSimple);
  await openInnholdTab(page);
  await expect(ctaRoot).toBeVisible({ timeout: 15_000 });
  const ctaContentInputs = ctaRoot.locator('[data-lp-property-section="content"] input');
  await expect(ctaContentInputs.nth(1)).toHaveValue(/.+/, { timeout: 10_000 });
  await shot(ctaRoot, "06-defaults-proof-simple.png");

  await selectBlockByOrdinal(page, ordinalStructure);
  await openInnholdTab(page);
  await expect(cardsRoot).toBeVisible({ timeout: 15_000 });
  await expect(cardsRoot.locator('[data-lp-property-section="content"] input').first()).toHaveValue(/.+/, {
    timeout: 10_000,
  });
  await shot(cardsRoot, "07-defaults-proof-structure.png");

  await selectBlockByOrdinal(page, ordinalSimple);
  await openInnholdTab(page);
  await expect(ctaRoot).toBeVisible({ timeout: 15_000 });
  await expect(ctaRoot.locator("[data-lp-pe-validation-hints]")).toBeVisible({ timeout: 10_000 });
  await shot(ctaRoot, "08-validation-proof-simple.png");

  await selectBlockByOrdinal(page, ordinalStructure);
  await openInnholdTab(page);
  await expect(cardsRoot).toBeVisible({ timeout: 15_000 });
  await expect(cardsRoot.locator("[data-lp-pe-validation-hints]")).toBeVisible({ timeout: 10_000 });
  await shot(cardsRoot, "09-validation-proof-structure.png");

  const ctaMarker = `U90-CTA-${Date.now()}`;
  await selectBlockByOrdinal(page, ordinalSimple);
  await openInnholdTab(page);
  const ctaEdit = peRootForAlias(page, SIMPLE_ALIAS);
  await ctaEdit.locator('[data-lp-property-section="content"] input').nth(1).fill(ctaMarker);
  await ctaEdit.locator('[data-lp-property-section="settings"] input').first().fill("U90 primær");

  const cardsMarker = `U90-CARDS-${Date.now()}`;
  await selectBlockByOrdinal(page, ordinalStructure);
  await openInnholdTab(page);
  const cardsEdit = peRootForAlias(page, STRUCTURE_ALIAS);
  await cardsEdit.locator('[data-lp-property-section="content"] input').first().fill(cardsMarker);
  await cardsEdit.locator('[data-lp-property-section="settings"] select').selectOption("plain");
  await cardsEdit.locator('[data-lp-property-section="structure"] input').nth(1).fill("U90 kort-tittel");

  await expect(page.locator("footer").getByText(/· ulagret/)).toBeVisible({ timeout: 15_000 });
  await shot(triPane, "10-dirty-save-proof.png");

  const saveBtn = page.locator("header").getByRole("button", { name: "Lagre", exact: true }).first();
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();
  await expect(page.locator("footer").getByText(/· ulagret/)).toBeHidden({ timeout: 120_000 });

  await page.goto(`${origin}/backoffice/content/${PAGE_ID}`, { waitUntil: "domcontentloaded" });
  await waitForMainContent(page, { timeout: 40_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);

  await selectBlockByOrdinal(page, ordinalSimple);
  await openInnholdTab(page);
  await expect(peSurface(page).locator(`[data-lp-property-editor-root="${SIMPLE_ALIAS}"]`)).toBeVisible({
    timeout: 20_000,
  });
  const ctaPersist = peRootForAlias(page, SIMPLE_ALIAS);
  await expect(ctaPersist.locator('[data-lp-property-section="content"] input').nth(1)).toHaveValue(ctaMarker);
  await expect(ctaPersist.locator('[data-lp-property-section="settings"] input').first()).toHaveValue("U90 primær");

  await selectBlockByOrdinal(page, ordinalStructure);
  await openInnholdTab(page);
  const cardsAfter = peRootForAlias(page, STRUCTURE_ALIAS);
  await expect(cardsAfter).toBeVisible({ timeout: 20_000 });
  await expect(cardsAfter.locator('[data-lp-property-section="content"] input').first()).toHaveValue(cardsMarker);
  await expect(cardsAfter.locator('[data-lp-property-section="settings"] select')).toHaveValue("plain");
  await expect(cardsAfter.locator('[data-lp-property-section="structure"] input').nth(1)).toHaveValue("U90 kort-tittel");
  await shot(triPane, "11-reload-persist-proof.png");

  await shot(page.locator("#lp-content-editor-canvas"), "12-full-canvas-after-creation.png");

  const canonCta = getBlockTypeDefinition(SIMPLE_ALIAS);
  const canonCards = getBlockTypeDefinition(STRUCTURE_ALIAS);

  async function layerFlags(root: import("@playwright/test").Locator) {
    return {
      contentLayer: (await root.locator('[data-lp-property-section="content"]').count()) > 0,
      settingsLayer: (await root.locator('[data-lp-property-section="settings"]').count()) > 0,
      structureLayer: (await root.locator('[data-lp-property-section="structure"]').count()) > 0,
    };
  }

  await selectBlockByOrdinal(page, ordinalSimple);
  await openInnholdTab(page);
  const ctaR = peRootForAlias(page, SIMPLE_ALIAS);
  const ctaLayers = await layerFlags(ctaR);

  await selectBlockByOrdinal(page, ordinalStructure);
  await openInnholdTab(page);
  const cardsR = peRootForAlias(page, STRUCTURE_ALIAS);
  const cardsLayers = await layerFlags(cardsR);

  const report = {
    page: `/backoffice/content/${PAGE_ID}`,
    baseURL: origin,
    credentialSource: creds.source,
    email: creds.email,
    addedBlocks: [SIMPLE_ALIAS, STRUCTURE_ALIAS],
    initialBlockCount: initialCount,
    finalBlockCount: afterCount,
    newBlockOrdinals: { cta: ordinalSimple, cards: ordinalStructure },
    library: {
      cta: { ...libraryCta, canonTitle: canonCta?.title, canonWhenToUse: canonCta?.whenToUse },
      cards: { ...libraryCards, canonTitle: canonCards?.title, canonWhenToUse: canonCards?.whenToUse },
    },
    runtime: {
      cta: {
        alias: SIMPLE_ALIAS,
        propertyEditorComponent: "CtaPropertyEditor",
        ...ctaLayers,
        validationRuleCount: canonCta?.validationRules?.length ?? 0,
      },
      cards: {
        alias: STRUCTURE_ALIAS,
        propertyEditorComponent: "CardsPropertyEditor",
        ...cardsLayers,
        validationRuleCount: canonCards?.validationRules?.length ?? 0,
      },
    },
    markers: { ctaTitle: ctaMarker, cardsTitle: cardsMarker },
    screenshots: {
      blockLibraryFull: "01-block-library-full.png",
      simpleInLibrary: "02-simple-block-in-library-cta.png",
      structureInLibrary: "03-structure-block-in-library-cards.png",
      newSimpleCanvasInspector: "04-new-simple-cta-canvas-inspector.png",
      newStructureCanvasInspector: "05-new-structure-cards-canvas-inspector.png",
      defaultsSimple: "06-defaults-proof-simple.png",
      defaultsStructure: "07-defaults-proof-structure.png",
      validationSimple: "08-validation-proof-simple.png",
      validationStructure: "09-validation-proof-structure.png",
      dirtySave: "10-dirty-save-proof.png",
      reloadPersist: "11-reload-persist-proof.png",
      fullCanvasAfter: "12-full-canvas-after-creation.png",
    },
  };

  await writeFile(path.join(ARTIFACT_DIR, "u90-block-creation-contract-proof.json"), JSON.stringify(report, null, 2), "utf-8");
});

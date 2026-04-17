import { mkdir, writeFile } from "node:fs/promises";
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
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "u89-runtime-block-observation");

const KEY_BLOCKS = [
  { type: "hero", component: "HeroPropertyEditor", shot: "02-hero-property-editor.png", library: "hero" },
  { type: "hero_full", component: "HeroFullPropertyEditor", shot: "03-hero_full-property-editor.png", library: "hero_full" },
  { type: "hero_bleed", component: "HeroBleedPropertyEditor", shot: "04-hero_bleed-property-editor.png", library: "hero_bleed" },
  { type: "cards", component: "CardsPropertyEditor", shot: "05-cards-property-editor.png", library: "cards" },
  { type: "zigzag", component: "StepsPropertyEditor", shot: "06-steps-property-editor.png", library: "zigzag" },
  { type: "pricing", component: "PricingPropertyEditor", shot: "07-pricing-property-editor.png", library: "pricing" },
  { type: "grid", component: "GridPropertyEditor", shot: "08-grid-property-editor.png", library: "grid" },
  { type: "cta", component: "CtaPropertyEditor", shot: "09-cta-property-editor.png", library: "cta" },
  {
    type: "relatedLinks",
    component: "RelatedLinksPropertyEditor",
    shot: "10-relatedLinks-property-editor.png",
    library: "relatedLinks",
  },
] as const;

type KeyBlock = (typeof KEY_BLOCKS)[number];

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

async function openInnholdTab(page: import("@playwright/test").Page) {
  const tab = page
    .locator("aside")
    .filter({ has: page.getByRole("navigation", { name: "Høyre arbeidsflater" }) })
    .getByRole("button", { name: "Innhold", exact: true });
  await expect(tab).toBeVisible({ timeout: 25_000 });
  await tab.scrollIntoViewIfNeeded();
  await tab.evaluate((el) => (el as HTMLButtonElement).click());
}

async function structureButtons(page: import("@playwright/test").Page) {
  const list = page.locator("button").filter({ hasText: /\d+\.\s/ });
  await expect(list.first()).toBeVisible({ timeout: 25_000 });
  return list;
}

async function detectSelectedRoot(page: import("@playwright/test").Page) {
  const visibleRoot = peSurface(page).locator("[data-lp-property-editor-root]").first();
  await expect(visibleRoot).toBeVisible({ timeout: 20_000 });
  return await visibleRoot.getAttribute("data-lp-property-editor-root");
}

async function scanBlocksByOrdinal(page: import("@playwright/test").Page) {
  const map = new Map<string, number>();
  const buttons = await structureButtons(page);
  const count = await buttons.count();
  for (let i = 0; i < count; i += 1) {
    await buttons.nth(i).click();
    await openInnholdTab(page);
    const root = await detectSelectedRoot(page);
    if (!root) continue;
    if (!map.has(root)) map.set(root, i + 1);
  }
  return map;
}

async function selectBlockByType(page: import("@playwright/test").Page, type: string) {
  const buttons = await structureButtons(page);
  const count = await buttons.count();
  for (let i = 0; i < count; i += 1) {
    await buttons.nth(i).click();
    await openInnholdTab(page);
    const root = await detectSelectedRoot(page);
    if (root === type) return i + 1;
  }
  return null;
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

async function addBlockByAlias(page: import("@playwright/test").Page, alias: string) {
  const dialog = await openLibrary(page);
  await searchLibrary(dialog, alias);
  const card = dialog.locator(`[data-lp-library-block-alias="${alias}"]`).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
}

async function closeLibrary(page: import("@playwright/test").Page, dialog: import("@playwright/test").Locator) {
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

test("U89 direct runtime block observation", async ({ page, baseURL }) => {
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

  const triPane = page.locator('[data-lp-content-workspace-shell="tri-pane"]');
  await shot(triPane, "01-full-canvas-inspector.png");

  let scanned = await scanBlocksByOrdinal(page);
  const addedBlocks: string[] = [];
  for (const block of KEY_BLOCKS) {
    if (!scanned.has(block.type)) {
      await addBlockByAlias(page, block.library);
      addedBlocks.push(block.type);
      scanned = await scanBlocksByOrdinal(page);
    }
  }

  type RuntimeObservation = {
    alias: string;
    propertyEditorComponent: string | null;
    contentLayer: boolean;
    settingsLayer: boolean;
    structureLayer: boolean;
    directRuntimeProven: boolean;
  };
  const runtimeObservations: Record<string, RuntimeObservation> = {};

  for (const block of KEY_BLOCKS) {
    const selectedOrdinal = await selectBlockByType(page, block.type);
    expect(selectedOrdinal, `Missing runtime block ${block.type}`).not.toBeNull();

    const root = peSurface(page).locator(`[data-lp-property-editor-root="${block.type}"]`);
    await expect(root).toBeVisible({ timeout: 20_000 });
    await expect(root).toHaveAttribute("data-lp-property-editor-component", block.component);

    const wrongRoots = KEY_BLOCKS.filter((entry) => entry.type !== block.type).map((entry) => entry.type);
    for (const wrong of wrongRoots) {
      await expect(peSurface(page).locator(`[data-lp-property-editor-root="${wrong}"]`)).toHaveCount(0);
    }

    const contentLayer = (await root.locator('[data-lp-property-section="content"]').count()) > 0;
    const settingsLayer = (await root.locator('[data-lp-property-section="settings"]').count()) > 0;
    const structureLayer = (await root.locator('[data-lp-property-section="structure"]').count()) > 0;

    runtimeObservations[block.type] = {
      alias: block.type,
      propertyEditorComponent: await root.getAttribute("data-lp-property-editor-component"),
      contentLayer,
      settingsLayer,
      structureLayer,
      directRuntimeProven: true,
    };
    await shot(root, block.shot);
  }

  const library = await openLibrary(page);
  await searchLibrary(library, "hero");
  await shot(library, "11-hero-family-library.png");
  await searchLibrary(library, "cards grid");
  await shot(library, "12-cards-vs-grid-library.png");
  await searchLibrary(library, "cta banner");
  await shot(library, "13-cta-vs-banner-library.png");
  await searchLibrary(library, "relatedLinks");
  await shot(library, "13b-relatedLinks-library.png");
  await closeLibrary(page, library);

  // Defaults/validation/save/reload proof A (hero): content + settings.
  await selectBlockByType(page, "hero");
  const heroRoot = peSurface(page).locator('[data-lp-property-editor-root="hero"]');
  await expect(heroRoot.getByText(/Tittel|Undertittel|CTA/i).first()).toBeVisible({ timeout: 20_000 });
  await shot(heroRoot, "14-defaults-proof.png");

  const heroMarker = `U89-H-${Date.now()}`;
  await heroRoot.locator("label", { hasText: "Tittel" }).locator("input").first().fill(heroMarker);
  await heroRoot.locator("label", { hasText: "Bilde (ID / URL)" }).locator("input").first().fill("/brand/hero-u89.jpg");
  await expect(page.locator("footer").getByText(/· ulagret/)).toBeVisible({ timeout: 15_000 });

  // Defaults/validation/save/reload proof B (pricing): structure/item edits + hint.
  await selectBlockByType(page, "pricing");
  const pricingRoot = peSurface(page).locator('[data-lp-property-editor-root="pricing"]');
  await expect(pricingRoot).toBeVisible({ timeout: 20_000 });
  await expect(pricingRoot.getByText(/live priser|pakke|plan/i).first()).toBeVisible({ timeout: 20_000 });
  await shot(pricingRoot, "15-validation-proof.png");

  const pricingMarker = `U89-P-${Date.now()}`;
  await pricingRoot.getByRole("textbox", { name: "Overskrift", exact: true }).fill(pricingMarker);
  const addPlanBtn = pricingRoot.getByRole("button", { name: /Legg til pakke/i });
  if ((await addPlanBtn.count()) > 0 && (await addPlanBtn.isEnabled())) await addPlanBtn.click();
  await pricingRoot.getByRole("textbox", { name: /Pakkenavn/i }).first().fill("U89 PLAN");
  await expect(page.locator("footer").getByText(/· ulagret/)).toBeVisible({ timeout: 15_000 });

  const saveBtn = page.locator("header").getByRole("button", { name: "Lagre", exact: true }).first();
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();
  await expect(page.locator("footer").getByText(/· ulagret/)).toBeHidden({ timeout: 120_000 });

  await page.goto(`${origin}/backoffice/content/${PAGE_ID}`, { waitUntil: "domcontentloaded" });
  await waitForMainContent(page, { timeout: 40_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);

  await selectBlockByType(page, "hero");
  await expect(
    peSurface(page)
      .locator('[data-lp-property-editor-root="hero"]')
      .locator("label", { hasText: "Tittel" })
      .locator("input")
      .first(),
  ).toHaveValue(heroMarker);

  await selectBlockByType(page, "pricing");
  const pricingAfter = peSurface(page).locator('[data-lp-property-editor-root="pricing"]');
  await expect(pricingAfter.getByRole("textbox", { name: "Overskrift", exact: true })).toHaveValue(pricingMarker);
  await expect(pricingAfter.getByRole("textbox", { name: /Pakkenavn/i }).first()).toHaveValue("U89 PLAN");
  await shot(peSurface(page), "16-persist-proof.png");

  await writeFile(
    path.join(ARTIFACT_DIR, "u89-runtime-observations.json"),
    JSON.stringify(
      {
        page: `/backoffice/content/${PAGE_ID}`,
        baseURL: origin,
        addedBlocks,
        runtimeObservations,
      },
      null,
      2,
    ),
    "utf-8",
  );
});

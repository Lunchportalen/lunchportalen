/**
 * U92 — Bevis: lagrede blokker har ekte contentData/settingsData/structureData (ikke bare UI-grupper).
 *
 * Kjør med kjørende server på port 3043:
 *   cross-env PORT=3043 LP_CMS_RUNTIME_MODE=local_provider npm run dev
 *
 *   cross-env CI=1 PLAYWRIGHT_BASE_URL=http://localhost:3043 npx playwright test e2e/u92-block-entry-shape-proof.e2e.ts --project=chromium
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";
import { migrateLegacyFlatRowToEntryLayers } from "@/lib/cms/blocks/blockEntryContract";
import { parseBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
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
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "u92-block-entry-shape-proof");

const SIMPLE_ALIAS = "hero_bleed" as const;
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

type ApiPagePayload = {
  ok?: boolean;
  data?: {
    body?: unknown;
    page?: { body?: unknown };
  };
};

function blocksArrayFromVariantBody(body: unknown): unknown[] {
  /** Local runtime PATCH merges `{ ...envelope, blocks: savedList }` — prefer that over stale `blocksBody`. */
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const top = (body as Record<string, unknown>).blocks;
    if (Array.isArray(top)) return top;
  }
  const { blocksBody } = parseBodyEnvelope(body);
  if (blocksBody && typeof blocksBody === "object" && !Array.isArray(blocksBody)) {
    const bb = blocksBody as Record<string, unknown>;
    if (Array.isArray(bb.blocks)) return bb.blocks;
  }
  if (typeof blocksBody === "string" && blocksBody.trim() !== "") {
    try {
      const parsed = JSON.parse(blocksBody) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const inner = (parsed as Record<string, unknown>).blocks;
        if (Array.isArray(inner)) return inner;
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

async function fetchPersistedBlocks(page: import("@playwright/test").Page, pageId: string): Promise<unknown[]> {
  const raw = await page.evaluate(async (id) => {
    const r = await fetch(`/api/backoffice/content/pages/${id}?locale=nb&environment=preview`, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    const j = (await r.json()) as ApiPagePayload;
    return j;
  }, pageId);
  expect(raw?.ok).toBe(true);
  const body = raw?.data?.body ?? raw?.data?.page?.body;
  const blocks = blocksArrayFromVariantBody(body);
  expect(Array.isArray(blocks)).toBe(true);
  expect(blocks.length).toBeGreaterThanOrEqual(0);
  return blocks;
}

function assertEntryShape(block: Record<string, unknown>, alias: string) {
  expect(block.type).toBe(alias);
  expect(block).toHaveProperty("contentData");
  expect(block).toHaveProperty("settingsData");
  expect(typeof block.contentData).toBe("object");
  expect(block.contentData).not.toBeNull();
  expect(typeof block.settingsData).toBe("object");
  expect(block.settingsData).not.toBeNull();
  const flatTop = ["title", "subtitle", "ctaLabel", "buttonLabel", "items", "plans"].filter(
    (k) => k in block && k !== "type" && k !== "id",
  );
  expect(flatTop.length).toBe(0);
}

test("U92 persisted block entry shape — hero_bleed + cards + API body proof", async ({ page, baseURL }) => {
  test.setTimeout(540_000);
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await page.setViewportSize({ width: 2200, height: 1200 });

  const creds = resolveBackofficeSuperadminCredentialsForE2E();
  test.skip(!creds, "No superadmin credentials (E2E_* or canonical local_provider)");

  const origin = baseURL ?? "http://localhost:3043";
  await loginViaForm(page, creds.email, creds.password, "/backoffice/content");
  await waitForPostLoginNavigation(page, { timeout: 90_000 });
  await expect(page).toHaveURL(/\/backoffice\/content/);
  await assertProtectedShellReady(page);

  await page.goto(`${origin}/backoffice/content/${PAGE_ID}`);
  await waitForMainContent(page, { timeout: 40_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);

  const blocksBefore = await fetchPersistedBlocks(page, PAGE_ID);
  const legacySample = blocksBefore.find(
    (b) =>
      b &&
      typeof b === "object" &&
      String((b as Record<string, unknown>).type) === "hero" &&
      !("contentData" in (b as object)),
  ) as Record<string, unknown> | undefined;

  const initialCount = await structureButtonCount(page);

  const libraryFull = await openLibrary(page);
  await shot(libraryFull, "01-block-library-full.png");

  await searchLibrary(libraryFull, "kant");
  const bleedCard = libraryFull.locator(`[data-lp-library-block-alias="${SIMPLE_ALIAS}"]`).first();
  await expect(bleedCard).toBeVisible({ timeout: 15_000 });
  await shot(bleedCard, "02-simple-block-in-library-hero-bleed.png");
  const libraryBleed = await readLibraryCard(libraryFull, SIMPLE_ALIAS);

  await searchLibrary(libraryFull, "kort-seksjon");
  const cardsCard = libraryFull.locator(`[data-lp-library-block-alias="${STRUCTURE_ALIAS}"]`).first();
  await expect(cardsCard).toBeVisible({ timeout: 15_000 });
  await shot(cardsCard, "03-structure-block-in-library-cards.png");
  const libraryCards = await readLibraryCard(libraryFull, STRUCTURE_ALIAS);

  await searchLibrary(libraryFull, "kort");
  await shot(libraryFull, "02b-library-whenToUse-differsFrom-visible.png");

  await closeLibrary(page, libraryFull);

  await addBlockFromLibraryByAlias(page, SIMPLE_ALIAS, "kant");
  await addBlockFromLibraryByAlias(page, STRUCTURE_ALIAS, "kort");

  const afterCount = await structureButtonCount(page);
  expect(afterCount).toBe(initialCount + 2);

  const ordinalSimple = initialCount + 1;
  const ordinalStructure = initialCount + 2;

  await selectBlockByOrdinal(page, ordinalSimple);
  await openInnholdTab(page);
  const bleedRoot = peRootForAlias(page, SIMPLE_ALIAS);
  await expect(bleedRoot).toBeVisible({ timeout: 20_000 });
  await expect(bleedRoot).toHaveAttribute("data-lp-property-editor-component", "HeroBleedPropertyEditor");
  await expect(bleedRoot.locator("[data-lp-pe-canvas-coupling]")).toContainText("HeroCanvasFrame");
  const triPane = page.locator('[data-lp-content-workspace-shell="tri-pane"]');
  await shot(triPane, "04-new-simple-hero-bleed-canvas-inspector.png");
  const bleedCanvasView = page.locator('#lp-content-editor-canvas [data-lp-canvas-view="hero"]').last();
  await expect(bleedCanvasView).toBeVisible({ timeout: 15_000 });
  await shot(bleedCanvasView, "12-canvas-custom-view-proof-simple-hero-bleed.png");

  await selectBlockByOrdinal(page, ordinalStructure);
  await openInnholdTab(page);
  const cardsRoot = peRootForAlias(page, STRUCTURE_ALIAS);
  await expect(cardsRoot).toBeVisible({ timeout: 20_000 });
  await expect(cardsRoot).toHaveAttribute("data-lp-property-editor-component", "CardsPropertyEditor");
  await expect(cardsRoot.locator("[data-lp-pe-canvas-coupling]")).toContainText("CardsCanvasFrame");
  await shot(triPane, "05-new-structure-cards-canvas-inspector.png");
  const cardsCanvasView = page.locator('#lp-content-editor-canvas [data-lp-canvas-view="cards"]').last();
  await expect(cardsCanvasView).toBeVisible({ timeout: 15_000 });
  await shot(cardsCanvasView, "13-canvas-custom-view-proof-structure-cards.png");

  await selectBlockByOrdinal(page, ordinalSimple);
  await openInnholdTab(page);
  await expect(bleedRoot).toBeVisible({ timeout: 15_000 });
  /** hero_bleed defaults har tom tittel i definisjonen — bevis = synlige felt + standard layout */
  await expect(bleedRoot.locator('[data-lp-property-section="content"] input').first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(bleedRoot.locator('[data-lp-property-section="settings"] select')).toHaveValue("center");
  await shot(bleedRoot, "06-defaults-proof-simple-hero-bleed.png");

  await selectBlockByOrdinal(page, ordinalStructure);
  await openInnholdTab(page);
  await expect(cardsRoot).toBeVisible({ timeout: 15_000 });
  await expect(cardsRoot.locator('[data-lp-property-section="content"] input').first()).toHaveValue(/.+/, {
    timeout: 10_000,
  });
  await shot(cardsRoot, "07-defaults-proof-structure-cards.png");

  await selectBlockByOrdinal(page, ordinalSimple);
  await openInnholdTab(page);
  await expect(bleedRoot).toBeVisible({ timeout: 15_000 });
  await bleedRoot.locator('[data-lp-property-section="content"] input').first().fill("");
  await expect(page.getByText("Mangler hero-overskrift", { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  await shot(triPane, "08-validation-proof.png");
  await bleedRoot.locator('[data-lp-property-section="content"] input').first().fill("U92 hero bleed");

  await expect(bleedRoot.locator("[data-lp-pe-validation-hints]")).toBeVisible({ timeout: 10_000 });
  await shot(bleedRoot, "08b-validation-hints-from-canonical-rules.png");

  const bleedMarker = `U92-BLEED-${Date.now()}`;
  await selectBlockByOrdinal(page, ordinalSimple);
  await openInnholdTab(page);
  const bleedEdit = peRootForAlias(page, SIMPLE_ALIAS);
  await bleedEdit.locator('[data-lp-property-section="content"] input').first().fill(bleedMarker);
  await bleedEdit.locator('[data-lp-property-section="settings"] select').selectOption("left");

  const cardsMarker = `U92-CARDS-${Date.now()}`;
  await selectBlockByOrdinal(page, ordinalStructure);
  await openInnholdTab(page);
  const cardsEdit = peRootForAlias(page, STRUCTURE_ALIAS);
  await cardsEdit.locator('[data-lp-property-section="content"] input').first().fill(cardsMarker);
  await cardsEdit.locator('[data-lp-property-section="settings"] select').selectOption("plain");
  await cardsEdit.locator('[data-lp-property-section="structure"] input').nth(1).fill("U92 kort rad");

  await expect(page.locator("footer").getByText(/· ulagret/)).toBeVisible({ timeout: 15_000 });
  await shot(triPane, "09-dirty-save-proof.png");

  const saveBtn = page.locator("header").getByRole("button", { name: "Lagre", exact: true }).first();
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();
  await expect(page.locator("footer").getByText(/· ulagret/)).toBeHidden({ timeout: 120_000 });

  const blocksAfterSave = await fetchPersistedBlocks(page, PAGE_ID);
  const savedBleed = blocksAfterSave.find(
    (b) =>
      b &&
      typeof b === "object" &&
      (b as Record<string, unknown>).type === SIMPLE_ALIAS &&
      String(JSON.stringify(b)).includes(bleedMarker),
  ) as Record<string, unknown> | undefined;
  const savedCards = blocksAfterSave.find(
    (b) =>
      b &&
      typeof b === "object" &&
      (b as Record<string, unknown>).type === STRUCTURE_ALIAS &&
      String(JSON.stringify(b)).includes(cardsMarker),
  ) as Record<string, unknown> | undefined;

  expect(savedBleed).toBeTruthy();
  expect(savedCards).toBeTruthy();
  assertEntryShape(savedBleed!, SIMPLE_ALIAS);
  assertEntryShape(savedCards!, STRUCTURE_ALIAS);
  expect(savedCards!).toHaveProperty("structureData");
  const st = savedCards!.structureData as Record<string, unknown>;
  expect(Array.isArray(st.items)).toBe(true);

  await writeFile(
    path.join(ARTIFACT_DIR, "saved-json-shape-hero-bleed.json"),
    JSON.stringify(savedBleed, null, 2),
    "utf-8",
  );
  await writeFile(
    path.join(ARTIFACT_DIR, "saved-json-shape-cards.json"),
    JSON.stringify(savedCards, null, 2),
    "utf-8",
  );

  async function screenshotJsonDoc(obj: unknown, pngName: string) {
    const esc = JSON.stringify(obj, null, 2)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    await page.setContent(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>U92 persisted shape</title></head><body style="margin:0;padding:16px;font:13px ui-monospace,monospace;white-space:pre-wrap;background:#0f172a;color:#e2e8f0">${esc}</body></html>`,
    );
    await page.screenshot({ path: path.join(ARTIFACT_DIR, pngName), fullPage: true });
  }

  await screenshotJsonDoc(savedBleed, "14-saved-json-shape-proof-hero-bleed.png");
  await screenshotJsonDoc(savedCards, "15-saved-json-shape-proof-cards.png");

  await page.goto(`${origin}/backoffice/content/${PAGE_ID}`, { waitUntil: "domcontentloaded" });
  await waitForMainContent(page, { timeout: 40_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);

  await selectBlockByOrdinal(page, ordinalSimple);
  await openInnholdTab(page);
  await expect(peSurface(page).locator(`[data-lp-property-editor-root="${SIMPLE_ALIAS}"]`)).toBeVisible({
    timeout: 20_000,
  });
  const bleedPersist = peRootForAlias(page, SIMPLE_ALIAS);
  await expect(bleedPersist.locator('[data-lp-property-section="content"] input').first()).toHaveValue(bleedMarker);
  await expect(bleedPersist.locator('[data-lp-property-section="settings"] select')).toHaveValue("left");

  await selectBlockByOrdinal(page, ordinalStructure);
  await openInnholdTab(page);
  const cardsAfter = peRootForAlias(page, STRUCTURE_ALIAS);
  await expect(cardsAfter).toBeVisible({ timeout: 20_000 });
  await expect(cardsAfter.locator('[data-lp-property-section="content"] input').first()).toHaveValue(cardsMarker);
  await expect(cardsAfter.locator('[data-lp-property-section="settings"] select')).toHaveValue("plain");
  await expect(cardsAfter.locator('[data-lp-property-section="structure"] input').nth(1)).toHaveValue("U92 kort rad");
  await shot(triPane, "10-reload-persist-proof.png");

  await shot(page.locator("#lp-content-editor-canvas"), "11-full-canvas-after-creation.png");

  const canonBleed = getBlockTypeDefinition(SIMPLE_ALIAS);
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
  const bleedLayers = await layerFlags(peRootForAlias(page, SIMPLE_ALIAS));

  await selectBlockByOrdinal(page, ordinalStructure);
  await openInnholdTab(page);
  const cardsLayers = await layerFlags(peRootForAlias(page, STRUCTURE_ALIAS));

  const legacyRow = {
    type: "hero",
    title: "Flat legacy tittel",
    subtitle: "sub",
    imageId: "",
    ctaLabel: "x",
    ctaHref: "/y",
  };
  const migrated = migrateLegacyFlatRowToEntryLayers("hero", legacyRow);
  const normalized = normalizeBlock(legacyRow);

  const report = {
    page: `/backoffice/content/${PAGE_ID}`,
    baseURL: origin,
    credentialSource: creds.source,
    email: creds.email,
    addedBlocks: [SIMPLE_ALIAS, STRUCTURE_ALIAS],
    persistedApiProof: {
      hero_bleed: {
        contentData: savedBleed?.contentData,
        settingsData: savedBleed?.settingsData,
        topLevelKeysExcludingIdType: Object.keys(savedBleed ?? {}).filter((k) => k !== "id" && k !== "type"),
      },
      cards: {
        contentData: savedCards?.contentData,
        settingsData: savedCards?.settingsData,
        structureData: savedCards?.structureData,
        topLevelKeysExcludingIdType: Object.keys(savedCards ?? {}).filter((k) => k !== "id" && k !== "type"),
      },
    },
    legacyVsNew: {
      note:
        legacySample ?
          "Eksisterende blokk på siden manglet contentData (legacy flat) før denne økten."
        : "Ingen flat hero funnet i initial GET; eksempel under er deterministisk migrering fra samme kontrakt.",
      sampleLegacyInput: legacyRow,
      migrateLegacyFlatRowToEntryLayersOutput: migrated,
      normalizeBlockOutput: normalized,
      preExistingFlatHeroSample: legacySample ?? null,
    },
    library: {
      hero_bleed: { ...libraryBleed, canonTitle: canonBleed?.title },
      cards: { ...libraryCards, canonTitle: canonCards?.title },
    },
    runtime: {
      hero_bleed: {
        alias: SIMPLE_ALIAS,
        propertyEditorComponent: "HeroBleedPropertyEditor",
        canvasViewCoupling: "HeroCanvasFrame",
        ...bleedLayers,
      },
      cards: {
        alias: STRUCTURE_ALIAS,
        propertyEditorComponent: "CardsPropertyEditor",
        canvasViewCoupling: "CardsCanvasFrame",
        ...cardsLayers,
      },
    },
    markers: { bleedTitle: bleedMarker, cardsTitle: cardsMarker },
    screenshots: {
      blockLibraryFull: "01-block-library-full.png",
      simpleInLibrary: "02-simple-block-in-library-hero-bleed.png",
      libraryWhenToUseDiffersFrom: "02b-library-whenToUse-differsFrom-visible.png",
      structureInLibrary: "03-structure-block-in-library-cards.png",
      newSimpleCanvasInspector: "04-new-simple-hero-bleed-canvas-inspector.png",
      newStructureCanvasInspector: "05-new-structure-cards-canvas-inspector.png",
      defaultsSimple: "06-defaults-proof-simple-hero-bleed.png",
      defaultsStructure: "07-defaults-proof-structure-cards.png",
      validationRuntime: "08-validation-proof.png",
      validationHintsCanon: "08b-validation-hints-from-canonical-rules.png",
      dirtySave: "09-dirty-save-proof.png",
      reloadPersist: "10-reload-persist-proof.png",
      fullCanvasAfter: "11-full-canvas-after-creation.png",
      canvasViewSimple: "12-canvas-custom-view-proof-simple-hero-bleed.png",
      canvasViewStructure: "13-canvas-custom-view-proof-structure-cards.png",
      savedJsonShapeSimple: "14-saved-json-shape-proof-hero-bleed.png",
      savedJsonShapeStructure: "15-saved-json-shape-proof-cards.png",
      savedJsonBleedFile: "saved-json-shape-hero-bleed.json",
      savedJsonCardsFile: "saved-json-shape-cards.json",
    },
  };

  await writeFile(path.join(ARTIFACT_DIR, "u92-block-entry-shape-proof.json"), JSON.stringify(report, null, 2), "utf-8");
});

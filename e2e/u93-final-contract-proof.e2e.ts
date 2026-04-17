/**
 * U93 — Final contract proof: fresh local_provider boot, real persisted entry shape, real legacy migration (no synthetic JSON).
 *
 * Server (fresh boot):
 *   $env:PORT='3044'; $env:LP_CMS_RUNTIME_MODE='local_provider'; npm run dev
 *
 * Playwright:
 *   $env:CI='1'; $env:PLAYWRIGHT_BASE_URL='http://localhost:3044'; $env:LP_CMS_RUNTIME_MODE='local_provider'; npx playwright test e2e/u93-final-contract-proof.e2e.ts --project=chromium
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";
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
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "u93-final-contract-proof");

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
  return blocksArrayFromVariantBody(body);
}

/** Seed/marketing blocks: persisted BlockNode `{ id, type, data }` uten contentData. */
function findPersistedBlockNodeLegacy(blocks: unknown[]): Record<string, unknown> | null {
  for (const b of blocks) {
    if (!b || typeof b !== "object" || Array.isArray(b)) continue;
    const o = b as Record<string, unknown>;
    if (typeof o.type !== "string") continue;
    if ("contentData" in o) continue;
    if ("data" in o && o.data !== null && typeof o.data === "object" && !Array.isArray(o.data)) {
      return o as Record<string, unknown>;
    }
  }
  return null;
}

function findBlockById(blocks: unknown[], id: string): Record<string, unknown> | null {
  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    if (String(o.id ?? "") === id) return o as Record<string, unknown>;
  }
  return null;
}

function auditAllBlocks(blocks: unknown[]) {
  return blocks.map((b, index) => {
    if (!b || typeof b !== "object") {
      return { index, kind: "invalid" as const, raw: b };
    }
    const o = b as Record<string, unknown>;
    const type = typeof o.type === "string" ? o.type : null;
    const id = typeof o.id === "string" ? o.id : null;
    const keys = Object.keys(o).sort();
    const hasContentData = "contentData" in o;
    const hasSettingsData = "settingsData" in o;
    const hasData = "data" in o;
    const legacyNode = Boolean(type && hasData && !hasContentData);
    return {
      index,
      id,
      type,
      keys,
      hasContentData,
      hasSettingsData,
      hasData,
      legacyNode,
    };
  });
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

test("U93 final contract proof — fresh dataset, hero_bleed + cards, real legacy migration", async ({ page, baseURL }) => {
  test.setTimeout(540_000);
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await page.setViewportSize({ width: 2200, height: 1200 });

  const creds = resolveBackofficeSuperadminCredentialsForE2E();
  test.skip(!creds, "No superadmin credentials (E2E_* or canonical local_provider)");

  const origin = baseURL ?? "http://localhost:3044";
  await loginViaForm(page, creds.email, creds.password, "/backoffice/content");
  await waitForPostLoginNavigation(page, { timeout: 90_000 });
  await expect(page).toHaveURL(/\/backoffice\/content/);
  await assertProtectedShellReady(page);

  await page.goto(`${origin}/backoffice/content/${PAGE_ID}`);
  await waitForMainContent(page, { timeout: 40_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);

  const blocksBefore = await fetchPersistedBlocks(page, PAGE_ID);
  expect(blocksBefore.length).toBeGreaterThan(0);
  const auditBefore = auditAllBlocks(blocksBefore);
  const legacyBeforeSave = findPersistedBlockNodeLegacy(blocksBefore);
  expect(legacyBeforeSave).toBeTruthy();
  const legacyTargetId = String(legacyBeforeSave!.id ?? "");

  const initialCount = await structureButtonCount(page);

  const libraryFull = await openLibrary(page);
  await searchLibrary(libraryFull, "kant");
  await expect(libraryFull.locator(`[data-lp-library-block-alias="${SIMPLE_ALIAS}"]`).first()).toBeVisible({
    timeout: 15_000,
  });
  const libraryBleed = await readLibraryCard(libraryFull, SIMPLE_ALIAS);
  await searchLibrary(libraryFull, "kort-seksjon");
  await expect(libraryFull.locator(`[data-lp-library-block-alias="${STRUCTURE_ALIAS}"]`).first()).toBeVisible({
    timeout: 15_000,
  });
  const libraryCards = await readLibraryCard(libraryFull, STRUCTURE_ALIAS);
  await closeLibrary(page, libraryFull);

  await addBlockFromLibraryByAlias(page, SIMPLE_ALIAS, "kant");
  const triPane = page.locator('[data-lp-content-workspace-shell="tri-pane"]');
  await selectBlockByOrdinal(page, initialCount + 1);
  await openInnholdTab(page);
  await expect(peRootForAlias(page, SIMPLE_ALIAS)).toBeVisible({ timeout: 20_000 });
  await shot(triPane, "02-simple-block-created.png");

  await addBlockFromLibraryByAlias(page, STRUCTURE_ALIAS, "kort");
  const afterAddBoth = await structureButtonCount(page);
  expect(afterAddBoth).toBe(initialCount + 2);
  await selectBlockByOrdinal(page, afterAddBoth);
  await openInnholdTab(page);
  await expect(peRootForAlias(page, STRUCTURE_ALIAS)).toBeVisible({ timeout: 20_000 });
  await shot(triPane, "03-structure-block-created.png");

  await shot(triPane, "01-full-canvas-inspector.png");

  const ordinalSimple = initialCount + 1;
  const ordinalStructure = initialCount + 2;

  await selectBlockByOrdinal(page, ordinalSimple);
  await openInnholdTab(page);
  const bleedRoot = peRootForAlias(page, SIMPLE_ALIAS);
  await expect(bleedRoot).toBeVisible({ timeout: 20_000 });
  await expect(bleedRoot).toHaveAttribute("data-lp-property-editor-component", "HeroBleedPropertyEditor");
  await expect(bleedRoot.locator("[data-lp-pe-canvas-coupling]")).toContainText("HeroCanvasFrame");

  await selectBlockByOrdinal(page, ordinalStructure);
  await openInnholdTab(page);
  const cardsRoot = peRootForAlias(page, STRUCTURE_ALIAS);
  await expect(cardsRoot).toBeVisible({ timeout: 20_000 });
  await expect(cardsRoot).toHaveAttribute("data-lp-property-editor-component", "CardsPropertyEditor");
  await expect(cardsRoot.locator("[data-lp-pe-canvas-coupling]")).toContainText("CardsCanvasFrame");

  await selectBlockByOrdinal(page, ordinalSimple);
  await openInnholdTab(page);
  await expect(bleedRoot.locator('[data-lp-property-section="content"] input').first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(bleedRoot.locator('[data-lp-property-section="settings"] select')).toHaveValue("center");
  await shot(bleedRoot, "04-defaults-proof.png");

  await bleedRoot.locator('[data-lp-property-section="content"] input').first().fill("");
  await expect(page.getByText("Mangler hero-overskrift", { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  await shot(triPane, "05-validation-proof.png");
  await bleedRoot.locator('[data-lp-property-section="content"] input').first().fill("U93 hero bleed");

  const bleedMarker = `U93-BLEED-${Date.now()}`;
  await bleedRoot.locator('[data-lp-property-section="content"] input').first().fill(bleedMarker);
  await bleedRoot.locator('[data-lp-property-section="settings"] select').selectOption("left");

  const cardsMarker = `U93-CARDS-${Date.now()}`;
  await selectBlockByOrdinal(page, ordinalStructure);
  await openInnholdTab(page);
  const cardsEdit = peRootForAlias(page, STRUCTURE_ALIAS);
  await cardsEdit.locator('[data-lp-property-section="content"] input').first().fill(cardsMarker);
  await cardsEdit.locator('[data-lp-property-section="settings"] select').selectOption("plain");
  await cardsEdit.locator('[data-lp-property-section="structure"] input').nth(1).fill("U93 kort rad");

  await expect(page.locator("footer").getByText(/· ulagret/)).toBeVisible({ timeout: 15_000 });
  await shot(triPane, "06-dirty-save-proof.png");

  const saveBtn = page.locator("header").getByRole("button", { name: "Lagre", exact: true }).first();
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();
  await expect(page.locator("footer").getByText(/· ulagret/)).toBeHidden({ timeout: 120_000 });

  const blocksAfterSave = await fetchPersistedBlocks(page, PAGE_ID);
  const auditAfter = auditAllBlocks(blocksAfterSave);

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

  const migratedSameId = legacyTargetId ? findBlockById(blocksAfterSave, legacyTargetId) : null;
  expect(migratedSameId).toBeTruthy();
  expect(migratedSameId!).toHaveProperty("contentData");
  expect(migratedSameId!).toHaveProperty("settingsData");
  expect(migratedSameId!).not.toHaveProperty("data");

  await writeFile(
    path.join(ARTIFACT_DIR, "08-persisted-json-hero-bleed.json"),
    JSON.stringify(savedBleed, null, 2),
    "utf-8",
  );
  await writeFile(
    path.join(ARTIFACT_DIR, "09-persisted-json-cards.json"),
    JSON.stringify(savedCards, null, 2),
    "utf-8",
  );

  async function screenshotJsonDoc(obj: unknown, pngName: string) {
    const esc = JSON.stringify(obj, null, 2)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    await page.setContent(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>U93 persisted</title></head><body style="margin:0;padding:16px;font:13px ui-monospace,monospace;white-space:pre-wrap;background:#0f172a;color:#e2e8f0">${esc}</body></html>`,
    );
    await page.screenshot({ path: path.join(ARTIFACT_DIR, pngName), fullPage: true });
  }

  await screenshotJsonDoc(savedBleed, "08-persisted-json-hero-bleed.png");
  await screenshotJsonDoc(savedCards, "09-persisted-json-cards.png");

  const legacyProof = {
    alternative: "A_runtime_legacy_migrated_by_full_save" as const,
    legacyBlockId: legacyTargetId,
    persistedShapeBeforeSave: legacyBeforeSave,
    persistedShapeAfterSaveSameId: migratedSameId,
    interpretation:
      "Før lagring: kanonisk seed i preview-variant er BlockNode ({ type, data }) uten contentData. " +
      "Etter full variant-lagring fra editoren: samme blokk-id er skrevet tilbake med contentData/settingsData (entry-lag); `data` er borte. " +
      "Dette er runtime-persistens via samme PATCH/GET som editoren bruker — ikke syntetisk JSON.",
    datasetAuditBeforeSave: auditBefore,
    datasetAuditAfterSave: auditAfter,
  };
  await writeFile(
    path.join(ARTIFACT_DIR, "10-legacy-migration-runtime-proof.json"),
    JSON.stringify(legacyProof, null, 2),
    "utf-8",
  );

  await screenshotJsonDoc(legacyProof, "10-legacy-migration-runtime-proof.png");

  await page.goto(`${origin}/backoffice/content/${PAGE_ID}`, { waitUntil: "domcontentloaded" });
  await waitForMainContent(page, { timeout: 40_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);

  await selectBlockByOrdinal(page, ordinalSimple);
  await openInnholdTab(page);
  const bleedPersist = peRootForAlias(page, SIMPLE_ALIAS);
  await expect(bleedPersist.locator('[data-lp-property-section="content"] input').first()).toHaveValue(bleedMarker);
  await expect(bleedPersist.locator('[data-lp-property-section="settings"] select')).toHaveValue("left");

  await selectBlockByOrdinal(page, ordinalStructure);
  await openInnholdTab(page);
  const cardsAfter = peRootForAlias(page, STRUCTURE_ALIAS);
  await expect(cardsAfter.locator('[data-lp-property-section="content"] input').first()).toHaveValue(cardsMarker);
  await expect(cardsAfter.locator('[data-lp-property-section="structure"] input').nth(1)).toHaveValue("U93 kort rad");
  await shot(triPane, "07-reload-persist-proof.png");

  const canonBleed = getBlockTypeDefinition(SIMPLE_ALIAS);
  const canonCards = getBlockTypeDefinition(STRUCTURE_ALIAS);

  const report = {
    page: `/backoffice/content/${PAGE_ID}`,
    baseURL: origin,
    credentialSource: creds.source,
    email: creds.email,
    fieldsChanged: {
      hero_bleed: {
        contentTitle: bleedMarker,
        settingsLayout: "left",
      },
      cards: {
        contentTitle: cardsMarker,
        settingsPresentation: "plain",
        structureCardTitle: "U93 kort rad",
      },
    },
    addedBlocks: [SIMPLE_ALIAS, STRUCTURE_ALIAS],
    library: {
      hero_bleed: { ...libraryBleed, canonTitle: canonBleed?.title },
      cards: { ...libraryCards, canonTitle: canonCards?.title },
    },
    legacyVsNew: legacyProof,
    markers: { bleedTitle: bleedMarker, cardsTitle: cardsMarker },
    artifacts: {
      "01-full-canvas-inspector.png": "full canvas + inspector (tri-pane)",
      "02-simple-block-created.png": "ny hero_bleed etter innsetting",
      "03-structure-block-created.png": "ny cards etter innsetting",
      "04-defaults-proof.png": "defaults (hero_bleed property editor)",
      "05-validation-proof.png": "validation (tom tittel)",
      "06-dirty-save-proof.png": "dirty / før lagre",
      "07-reload-persist-proof.png": "reload + persisterte felt",
      "08-persisted-json-hero-bleed.json": "persisted entry shape enkel",
      "08-persisted-json-hero-bleed.png": "screenshot av JSON enkel",
      "09-persisted-json-cards.json": "persisted entry shape struktur",
      "09-persisted-json-cards.png": "screenshot av JSON struktur",
      "10-legacy-migration-runtime-proof.json": "runtime legacy → entry for samme blokk-id",
      "10-legacy-migration-runtime-proof.png": "screenshot av legacy-proof JSON",
      "u93-final-contract-proof.json": "full rapport",
    },
  };

  await writeFile(path.join(ARTIFACT_DIR, "u93-final-contract-proof.json"), JSON.stringify(report, null, 2), "utf-8");
});

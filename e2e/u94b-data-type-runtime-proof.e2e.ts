/**
 * U94B — Obligatorisk runtime-bevis: Data Type styrer library, grupper, allowlist, create-label, maxItems.
 * Krever fersk dev: PORT=3045, LP_CMS_RUNTIME_MODE=local_provider, /api/health 200.
 *
 * Ingen test.skip — feiler hvis seed/creds mangler.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { cmsPageDetailQueryString } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.preview";
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

const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "u94b-data-type-runtime-proof");
const SEED_COMPACT = "00000000-0000-4000-8000-00000000c004";
const SEED_MICRO = "00000000-0000-4000-8000-00000000c005";

test.describe.configure({ mode: "serial" });

async function shot(locator: import("@playwright/test").Locator, file: string) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible({ timeout: 30_000 });
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
  await expect(tab).toBeVisible({ timeout: 30_000 });
  await tab.scrollIntoViewIfNeeded();
  await tab.evaluate((el) => (el as HTMLButtonElement).click());
}

async function structureButtonCount(page: import("@playwright/test").Page) {
  const list = page.locator("button").filter({ hasText: /^\d+\.\s/ });
  await expect(list.first()).toBeVisible({ timeout: 30_000 });
  return list.count();
}

async function selectBlockByOrdinal(page: import("@playwright/test").Page, ordinal: number) {
  await expect(page.getByText("Editorstruktur", { exact: true })).toBeVisible({ timeout: 25_000 });
  await page.getByRole("button", { name: new RegExp(`^${ordinal}\\.\\s`) }).first().click();
}

async function openLibrary(page: import("@playwright/test").Page) {
  const insertBtn = page.locator("[data-lp-insert-end]").first();
  await expect(insertBtn).toBeVisible({ timeout: 30_000 });
  await insertBtn.scrollIntoViewIfNeeded();
  await insertBtn.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 25_000 });
  await expect(dialog.getByRole("heading", { name: "Block library" })).toBeVisible({ timeout: 20_000 });
  return dialog;
}

type ResolvedU94b = {
  compactPageId: string;
  microPageId: string;
};

async function resolveCompactAndMicroPageIds(
  api: import("@playwright/test").APIRequestContext,
  origin: string,
): Promise<ResolvedU94b> {
  const qs = cmsPageDetailQueryString();
  const tryDetail = async (id: string) => {
    const res = await api.get(`${origin}/api/backoffice/content/pages/${encodeURIComponent(id)}?${qs}`);
    const j = await res.json();
    if (!j || typeof j !== "object" || j.ok !== true) return null;
    const pageBody = j.data?.page?.body;
    if (!pageBody || typeof pageBody !== "object") return null;
    const documentType = typeof pageBody.documentType === "string" ? pageBody.documentType : null;
    return documentType;
  };

  let compactPageId: string | null = null;
  let microPageId: string | null = null;

  const a = await tryDetail(SEED_COMPACT);
  const b = await tryDetail(SEED_MICRO);
  if (a === "compact_page") compactPageId = SEED_COMPACT;
  if (b === "micro_landing") microPageId = SEED_MICRO;

  if (!compactPageId || !microPageId) {
    const listRes = await api.get(`${origin}/api/backoffice/content/pages?limit=200`);
    const listJ = await listRes.json();
    const items = Array.isArray(listJ?.items) ? listJ.items : [];
    for (const it of items as { id?: string }[]) {
      const id = typeof it?.id === "string" ? it.id : "";
      if (!id) continue;
      const dt = await tryDetail(id);
      if (dt === "compact_page" && !compactPageId) compactPageId = id;
      if (dt === "micro_landing" && !microPageId) microPageId = id;
      if (compactPageId && microPageId) break;
    }
  }

  expect(
    compactPageId,
    "Fant ingen side med envelope documentType compact_page (U94-seed / local_provider).",
  ).toBeTruthy();
  expect(
    microPageId,
    "Fant ingen side med envelope documentType micro_landing (U94-seed / local_provider).",
  ).toBeTruthy();

  return { compactPageId: compactPageId!, microPageId: microPageId! };
}

test("U94B runtime proof — compact_page_blocks + page_micro_blocks, screenshots, no skip", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(480_000);

  const creds = resolveBackofficeSuperadminCredentialsForE2E();
  expect(creds, "Superadmin-credentials for E2E (local_provider / E2E_* env)").toBeTruthy();

  await mkdir(ARTIFACT_DIR, { recursive: true });

  const origin = baseURL ?? "http://localhost:3045";
  expect(
    origin.includes("3045"),
    `PLAYWRIGHT_BASE_URL må inneholde port 3045 (fikk ${origin})`,
  ).toBe(true);

  await page.setViewportSize({ width: 2200, height: 1200 });
  await loginViaForm(page, creds!.email, creds!.password, "/backoffice/content");
  await waitForPostLoginNavigation(page, { timeout: 90_000 });
  await expect(page).toHaveURL(/\/backoffice\/content/);
  await assertProtectedShellReady(page);

  const { compactPageId, microPageId } = await resolveCompactAndMicroPageIds(page.request, origin);
  await writeFile(
    path.join(ARTIFACT_DIR, "resolved-page-ids.json"),
    JSON.stringify({ compactPageId, microPageId, origin }, null, 2),
    "utf-8",
  );

  const triPane = page.locator('[data-lp-content-workspace-shell="tri-pane"]');

  /* ——— Compact ——— */
  await page.goto(`${origin}/backoffice/content/${compactPageId}`);
  await waitForMainContent(page, { timeout: 60_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);

  await expect(triPane).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-lp-block-editor-data-type-canvas]")).toHaveText("compact_page_blocks");
  await shot(triPane, "01-compact-full-editor.png");

  const binding = page.locator("[data-lp-canvas-block-property-binding]");
  await expect(binding).toBeVisible({ timeout: 20_000 });
  await shot(binding, "06-compact-property-binding-proof.png");

  const compactInsert = page.locator("[data-lp-insert-end]").first();
  await expect(compactInsert).toHaveAttribute("data-lp-block-list-create-label", "Legg til kompakt blokk");
  await expect(compactInsert).toContainText("Legg til kompakt blokk");

  const dialogCompact = await openLibrary(page);
  await expect(dialogCompact.locator("[data-lp-block-editor-data-type]")).toHaveText("compact_page_blocks");
  await expect(dialogCompact.locator("[data-lp-library-create-label]")).toContainText("Legg til kompakt blokk");
  await shot(dialogCompact, "02-compact-library-full.png");

  await expect(dialogCompact.locator('[data-lp-library-group="Kjerne"]')).toBeVisible({ timeout: 15_000 });
  await expect(dialogCompact.locator('[data-lp-library-group="Seksjon"]')).toBeVisible();
  await expect(dialogCompact.locator('[data-lp-library-group="Handling"]')).toBeVisible();
  await shot(dialogCompact.locator("[data-lp-block-library-catalog]").first(), "03-compact-groups-visible.png");

  await expect(dialogCompact.locator('[data-lp-library-block-alias="pricing"]')).toHaveCount(0);
  const searchBox = dialogCompact.getByRole("searchbox", { name: /search blocks/i }).first();
  await searchBox.fill("pricing");
  await expect(dialogCompact.getByText("Ingen blokker matcher søket ditt.", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await shot(dialogCompact, "05-compact-disallowed-proof.png");

  await searchBox.fill("");
  await shot(dialogCompact, "11-create-label-proof.png");

  await searchBox.fill("bilde");
  const imageCard = dialogCompact.locator('[data-lp-library-block-alias="image"]').first();
  await expect(imageCard).toBeVisible({ timeout: 20_000 });
  await imageCard.click();
  await expect(dialogCompact).toBeHidden({ timeout: 25_000 });

  const n = await structureButtonCount(page);
  await selectBlockByOrdinal(page, n);
  await openInnholdTab(page);
  await expect(peRootForAlias(page, "image")).toBeVisible({ timeout: 25_000 });
  await shot(triPane, "04-compact-allowed-block-created.png");
  await shot(triPane, "12-full-canvas-after-creation.png");

  /* ——— Micro ——— */
  await page.goto(`${origin}/backoffice/content/${microPageId}`);
  await waitForMainContent(page, { timeout: 60_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);

  await expect(triPane).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-lp-block-editor-data-type-canvas]")).toHaveText("page_micro_blocks");
  await shot(triPane, "07-micro-full-editor.png");

  const microInsert = page.locator("[data-lp-insert-end]").first();
  await expect(microInsert).toHaveAttribute("data-lp-block-list-at-max", "true");
  await expect(microInsert).toBeDisabled();
  await expect(microInsert).toContainText("Legg til blokk (maks 3)");
  await expect(microInsert).toHaveAttribute("data-lp-block-list-create-label", "Legg til blokk (maks 3)");

  /* Nederste «legg til» er låst ved max; midt-innsett åpner bibliotek (onPick er fortsatt stoppet ved max). */
  const slotPlus = page.locator("[data-lp-insert-slot] button").first();
  await expect(slotPlus).toBeVisible({ timeout: 20_000 });
  await slotPlus.click();
  const dialogMicro = page.getByRole("dialog");
  await expect(dialogMicro).toBeVisible({ timeout: 25_000 });
  await expect(dialogMicro.getByRole("heading", { name: "Block library" })).toBeVisible({ timeout: 20_000 });
  await expect(dialogMicro.locator("[data-lp-block-editor-data-type]")).toHaveText("page_micro_blocks");
  await expect(dialogMicro.locator('[data-lp-library-block-alias="hero"]')).toBeVisible({ timeout: 15_000 });
  await expect(dialogMicro.locator('[data-lp-library-block-alias="richText"]')).toBeVisible();
  await expect(dialogMicro.locator('[data-lp-library-block-alias="cta"]')).toBeVisible();
  await expect(dialogMicro.locator('[data-lp-library-block-alias="pricing"]')).toHaveCount(0);
  await shot(dialogMicro, "08-micro-library-full.png");

  await dialogMicro.getByRole("searchbox", { name: /search blocks/i }).first().fill("grid");
  await expect(dialogMicro.getByText("Ingen blokker matcher søket ditt.", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await shot(dialogMicro, "09-micro-allowed-disallowed-proof.png");

  await page.keyboard.press("Escape");
  await expect(dialogMicro).toBeHidden({ timeout: 15_000 });

  await shot(microInsert, "10-micro-maxitems-proof.png");
});

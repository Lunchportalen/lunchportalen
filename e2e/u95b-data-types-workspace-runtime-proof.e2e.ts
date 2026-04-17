/**
 * U95B — Obligatorisk runtime-bevis: Data Types workspace → persisted override → content editor (browser + screenshots).
 *
 * Forutsetter FERSK dev allerede kjørende:
 *   PORT=3046 LP_CMS_RUNTIME_MODE=local_provider npm run dev
 *   /api/health → 200
 *
 * Kjør (etter login-creds i .env / E2E_*):
 *   cross-env CI=1 LP_CMS_RUNTIME_MODE=local_provider PLAYWRIGHT_BASE_URL=http://localhost:3046 npx playwright test e2e/u95b-data-types-workspace-runtime-proof.e2e.ts --project=chromium
 */
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

const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "u95b-data-types-workspace-runtime-proof");
const SEED_COMPACT = "00000000-0000-4000-8000-00000000c004";
const SEED_MICRO = "00000000-0000-4000-8000-00000000c005";

const LABEL_COMPACT = "U95B Kompakt add-knapp";
const GROUP_CORE_TITLE = "U95B Kjerne (runtime)";
const LABEL_MICRO = "U95B Micro add-knapp";

test.describe.configure({ mode: "serial" });

async function shotPage(page: import("@playwright/test").Page, file: string) {
  await waitForFontsReady(page);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, file), fullPage: true, animations: "disabled" });
}

async function shotLocator(locator: import("@playwright/test").Locator, file: string) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible({ timeout: 45_000 });
  await waitForFontsReady(locator.page());
  await locator.screenshot({ path: path.join(ARTIFACT_DIR, file), animations: "disabled" });
}

async function putJson(
  page: import("@playwright/test").Page,
  origin: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await page.request.put(`${origin}/api/backoffice/cms/block-editor-data-types`, {
    headers: { "content-type": "application/json", accept: "application/json" },
    data: body,
  });
  const j = await res.json().catch(() => null);
  expect(res.ok(), `PUT block-editor-data-types failed: ${res.status()} ${JSON.stringify(j)}`).toBeTruthy();
  return j;
}

async function getJson(page: import("@playwright/test").Page, origin: string): Promise<unknown> {
  const res = await page.request.get(`${origin}/api/backoffice/cms/block-editor-data-types`, {
    headers: { accept: "application/json" },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function openLibrary(page: import("@playwright/test").Page) {
  const insertBtn = page.locator("[data-lp-insert-end]").first();
  await expect(insertBtn).toBeVisible({ timeout: 45_000 });
  await insertBtn.scrollIntoViewIfNeeded();
  await insertBtn.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole("heading", { name: "Block library" })).toBeVisible({ timeout: 25_000 });
  return dialog;
}

async function htmlProofScreenshot(page: import("@playwright/test").Page, file: string, title: string, payload: unknown) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const body = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)}</title></head><body style="font-family:ui-monospace,monospace;font-size:12px;padding:16px;background:#fafafa"><h1 style="font-size:14px">${esc(title)}</h1><pre style="white-space:pre-wrap;word-break:break-word">${esc(JSON.stringify(payload, null, 2))}</pre></body></html>`;
  await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(body)}`, { waitUntil: "load" });
  await shotPage(page, file);
}

test("U95B — Data Types workspace runtime proof (3046, screenshots, persisted + merged)", async ({ page, baseURL }) => {
  test.setTimeout(600_000);

  const creds = resolveBackofficeSuperadminCredentialsForE2E();
  expect(creds, "Superadmin-credentials (E2E_SUPERADMIN_* eller canonical local_provider)").toBeTruthy();

  const origin = baseURL ?? "http://localhost:3046";
  expect(origin, `PLAYWRIGHT_BASE_URL må være satt (fikk ${origin})`).toMatch(/3046/);

  await mkdir(ARTIFACT_DIR, { recursive: true });

  await page.setViewportSize({ width: 2200, height: 1200 });
  await loginViaForm(page, creds!.email, creds!.password, "/login");
  await waitForPostLoginNavigation(page, { timeout: 120_000 });
  await assertProtectedShellReady(page);

  await putJson(page, origin, { alias: "compact_page_blocks", reset: true });
  await putJson(page, origin, { alias: "page_micro_blocks", reset: true });

  const initialApi = (await getJson(page, origin)) as {
    ok?: boolean;
    data?: { merged?: Record<string, unknown>; overrides?: { byAlias?: Record<string, unknown> } };
  };
  expect(initialApi?.ok).toBeTruthy();
  await writeFile(path.join(ARTIFACT_DIR, "proof-api-initial.json"), JSON.stringify(initialApi, null, 2), "utf-8");

  const triPane = page.locator('[data-lp-content-workspace-shell="tri-pane"]');

  /* —— Micro editor FØR admin-endringer (max 3, 3 blokker → at-max) —— */
  await page.goto(`${origin}/backoffice/content/${SEED_MICRO}`);
  await waitForMainContent(page, { timeout: 90_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);
  await expect(triPane).toBeVisible({ timeout: 90_000 });
  const microInsertBefore = page.locator("[data-lp-insert-end]").first();
  await expect(microInsertBefore).toHaveAttribute("data-lp-block-list-at-max", "true");
  await expect(microInsertBefore).toHaveAttribute("data-lp-block-list-create-label", "Legg til blokk (maks 3)");
  await shotPage(page, "10-micro-editor-foer-maxitems-at-max.png");

  /* —— 06: Compact editor FØR admin-endringer —— */
  await page.goto(`${origin}/backoffice/content/${SEED_COMPACT}`);
  await waitForMainContent(page, { timeout: 90_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);
  await expect(triPane).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("[data-lp-block-editor-data-type-canvas]")).toHaveText("compact_page_blocks");
  const insertBefore = page.locator("[data-lp-insert-end]").first();
  await expect(insertBefore).toHaveAttribute("data-lp-block-list-create-label", "Legg til kompakt blokk");
  await shotPage(page, "06-compact-editor-foer.png");

  /* —— 01–05: Settings workspace —— */
  await page.goto(`${origin}/backoffice/settings/block-editor-data-types`);
  await expect(page.getByRole("heading", { name: /Block Editor Data Types/i })).toBeVisible({ timeout: 60_000 });
  await shotPage(page, "01-data-types-workspace-overview.png");

  await page.goto(`${origin}/backoffice/settings/block-editor-data-types/compact_page_blocks`);
  await expect(page.locator("[data-lp-data-type-workspace='compact_page_blocks']")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-lp-data-type-dirty='false']")).toBeVisible();
  await shotPage(page, "02-compact-page-blocks-detail-workspace.png");

  await page.locator("[data-lp-data-type-create-label-input]").fill(LABEL_COMPACT);
  await page.locator("[data-lp-data-type-group-title='core']").fill(GROUP_CORE_TITLE);
  await expect(page.locator("[data-lp-data-type-dirty='true']")).toBeVisible();
  await shotPage(page, "04-dirty-state-data-type-workspace.png");

  await page.locator("[data-lp-data-type-save]").click();
  await expect(page.getByText(/Lagret og publisert til settings/i)).toBeVisible({ timeout: 45_000 });
  await expect(page.locator("[data-lp-data-type-dirty='false']")).toBeVisible({ timeout: 30_000 });
  await shotPage(page, "05-saved-state-data-type-workspace.png");

  await page.goto(`${origin}/backoffice/settings/block-editor-data-types/page_micro_blocks`);
  await expect(page.locator("[data-lp-data-type-workspace='page_micro_blocks']")).toBeVisible({ timeout: 60_000 });
  await shotPage(page, "03-page-micro-blocks-detail-workspace.png");

  await page.locator("[data-lp-data-type-create-label-input]").fill(LABEL_MICRO);
  await page.getByLabel("Maks items").fill("5");
  await expect(page.locator("[data-lp-data-type-dirty='true']")).toBeVisible();
  await page.locator("[data-lp-data-type-save]").click();
  await expect(page.getByText(/Lagret og publisert til settings/i)).toBeVisible({ timeout: 45_000 });

  const afterBothApi = (await getJson(page, origin)) as {
    ok?: boolean;
    data?: {
      merged?: Record<string, { createButtonLabel?: string; maxItems?: number; allowedBlockAliases?: string[] }>;
      overrides?: { byAlias?: Record<string, unknown> };
    };
  };
  expect(afterBothApi?.ok).toBeTruthy();
  await writeFile(path.join(ARTIFACT_DIR, "proof-api-after-compact-micro.json"), JSON.stringify(afterBothApi, null, 2), "utf-8");

  /* Fjern image fra compact allowlist (andre admin-endring på compact) */
  await page.goto(`${origin}/backoffice/settings/block-editor-data-types/compact_page_blocks`);
  await expect(page.locator("[data-lp-data-type-workspace='compact_page_blocks']")).toBeVisible({ timeout: 60_000 });
  const imageCb = page.locator("#allow-compact_page_blocks-image");
  await expect(imageCb).toBeVisible({ timeout: 20_000 });
  await imageCb.setChecked(false);
  await page.locator("[data-lp-data-type-save]").click();
  await expect(page.getByText(/Lagret og publisert til settings/i)).toBeVisible({ timeout: 45_000 });

  const finalApi = (await getJson(page, origin)) as {
    ok?: boolean;
    data?: {
      merged?: Record<
        string,
        { createButtonLabel?: string; allowedBlockAliases?: string[]; maxItems?: number }
      >;
      overrides?: { byAlias?: Record<string, unknown> };
    };
  };
  await writeFile(path.join(ARTIFACT_DIR, "proof-api-final.json"), JSON.stringify(finalApi, null, 2), "utf-8");

  const mergedCompact = finalApi?.data?.merged?.compact_page_blocks;
  expect(mergedCompact?.createButtonLabel).toBe(LABEL_COMPACT);
  expect(mergedCompact?.allowedBlockAliases?.includes("image")).toBe(false);

  const mergedMicro = finalApi?.data?.merged?.page_micro_blocks;
  expect(mergedMicro?.createButtonLabel).toBe(LABEL_MICRO);
  expect(mergedMicro?.maxItems).toBe(5);

  /* —— 07–09: Compact editor etter + library —— */
  await page.goto(`${origin}/backoffice/content/${SEED_COMPACT}`);
  await waitForMainContent(page, { timeout: 90_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);
  await expect(triPane).toBeVisible({ timeout: 90_000 });
  const insertAfter = page.locator("[data-lp-insert-end]").first();
  await expect(insertAfter).toHaveAttribute("data-lp-block-list-create-label", LABEL_COMPACT);
  await expect(insertAfter).toContainText(LABEL_COMPACT);
  await shotPage(page, "07-compact-editor-etter.png");

  const binding = page.locator("[data-lp-canvas-block-property-binding]");
  await expect(binding).toBeVisible({ timeout: 25_000 });
  await shotLocator(binding, "12-property-binding-proof.png");

  const dialogC = await openLibrary(page);
  await expect(dialogC.locator("[data-lp-library-create-label]")).toContainText(LABEL_COMPACT);
  await expect(dialogC.locator(`[data-lp-library-group="${GROUP_CORE_TITLE}"]`)).toBeVisible({ timeout: 20_000 });
  await shotLocator(dialogC, "08-compact-library-changed-label-group.png");

  await expect(dialogC.locator('[data-lp-library-block-alias="image"]')).toHaveCount(0);
  await shotLocator(dialogC, "09-compact-disallowed-block-proof.png");
  await page.keyboard.press("Escape");

  await shotPage(page, "17-full-canvas-after-config-change.png");

  /* —— Micro etter admin (maxItems 5 → ikke lenger at-max med 3 blokker) —— */
  await page.goto(`${origin}/backoffice/content/${SEED_MICRO}`);
  await waitForMainContent(page, { timeout: 90_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);
  await expect(triPane).toBeVisible({ timeout: 90_000 });
  const microInsert = page.locator("[data-lp-insert-end]").first();
  await expect(microInsert).toHaveAttribute("data-lp-block-list-create-label", LABEL_MICRO);
  await expect(microInsert).toHaveAttribute("data-lp-block-list-at-max", "false");
  await shotPage(page, "11-micro-editor-etter-maxitems-unlocked.png");
  await shotLocator(microInsert, "13-micro-maxitems-proof-insert-not-at-max.png");

  const dialogM = await openLibrary(page);
  await expect(dialogM.locator("[data-lp-library-create-label]")).toContainText(LABEL_MICRO);
  await shotLocator(dialogM, "15-merged-runtime-effect-library-micro.png");
  await page.keyboard.press("Escape");

  /* Persisted / baseline HTML screenshots (API JSON i browser) */
  const baselineCompact = (initialApi?.data?.merged as Record<string, unknown>)?.compact_page_blocks;
  const overrideCompact = finalApi?.data?.overrides?.byAlias?.compact_page_blocks;
  const mergedCompactProof = finalApi?.data?.merged?.compact_page_blocks;
  await htmlProofScreenshot(page, "14-persisted-override-proof-compact.png", "compact_page_blocks baseline / override / merged", {
    baselineFromInitialMerged: baselineCompact,
    persistedOverride: overrideCompact,
    mergedRuntime: mergedCompactProof,
  });

  await htmlProofScreenshot(page, "16-merged-runtime-effect-merged-vs-override-micro.png", "page_micro_blocks merged + override", {
    merged: finalApi?.data?.merged?.page_micro_blocks,
    override: finalApi?.data?.overrides?.byAlias?.page_micro_blocks,
  });

  /* Kombinert dirty/save i én rapport-fil (krav #4): allerede 04+05; dokumenter i manifest */
  await writeFile(
    path.join(ARTIFACT_DIR, "RUNTIME-PROOF-MANIFEST.json"),
    JSON.stringify(
      {
        baseURL: origin,
        compactPageId: SEED_COMPACT,
        microPageId: SEED_MICRO,
        adminChanges: {
          compact_page_blocks: {
            createButtonLabel: LABEL_COMPACT,
            groupCoreTitle: GROUP_CORE_TITLE,
            removedFromAllowlist: ["image"],
          },
          page_micro_blocks: {
            createButtonLabel: LABEL_MICRO,
            maxItems: 5,
          },
        },
        runtimeObservations: [
          "Compact insert button label matches LABEL_COMPACT after save",
          "Library shows renamed group heading GROUP_CORE_TITLE",
          "image block no longer listed in compact library",
          "Micro insert at-max false after maxItems 5 with 3 blocks on page",
          "Micro library create label matches LABEL_MICRO",
        ],
        screenshotFiles: [
          "01-data-types-workspace-overview.png",
          "02-compact-page-blocks-detail-workspace.png",
          "03-page-micro-blocks-detail-workspace.png",
          "04-dirty-state-data-type-workspace.png",
          "05-saved-state-data-type-workspace.png",
          "06-compact-editor-foer.png",
          "07-compact-editor-etter.png",
          "08-compact-library-changed-label-group.png",
          "09-compact-disallowed-block-proof.png",
          "10-micro-editor-foer-maxitems-at-max.png",
          "11-micro-editor-etter-maxitems-unlocked.png",
          "12-property-binding-proof.png",
          "13-micro-maxitems-proof-insert-not-at-max.png",
          "14-persisted-override-proof-compact.png",
          "15-merged-runtime-effect-library-micro.png",
          "16-merged-runtime-effect-merged-vs-override-micro.png",
          "17-full-canvas-after-config-change.png",
        ],
      },
      null,
      2,
    ),
    "utf-8",
  );
});

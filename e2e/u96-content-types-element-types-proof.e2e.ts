/**
 * U96 — Document Types + Element Types workspace + runtime editor (screenshots + persisted proof).
 *
 * Forutsetter dev på 3046 med local_provider (som U95B):
 *   PORT=3046 LP_CMS_RUNTIME_MODE=local_provider npm run dev
 *
 * Kjør:
 *   cross-env CI=1 LP_CMS_RUNTIME_MODE=local_provider PLAYWRIGHT_BASE_URL=http://localhost:3046 npx playwright test e2e/u96-content-types-element-types-proof.e2e.ts --project=chromium
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

const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "u96-content-types-element-types-proof");
const SEED_COMPACT = "00000000-0000-4000-8000-00000000c004";

const GROUP_TITLE = "U96 Innhold (document type)";
const BODY_TITLE = "U96 Blokkfelt (document type)";
const BODY_DESC = "U96 Property-beskrivelse fra document type workspace";
const LIB_LABEL_AFTER = "U96 Legg til (data type)";

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

async function putDocumentTypes(
  page: import("@playwright/test").Page,
  origin: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await page.request.put(`${origin}/api/backoffice/cms/document-type-definitions`, {
    headers: { "content-type": "application/json", accept: "application/json" },
    data: body,
  });
  const j = await res.json().catch(() => null);
  expect(res.ok(), `PUT document-type-definitions failed: ${res.status()} ${JSON.stringify(j)}`).toBeTruthy();
  return j;
}

async function putBlockEditorDataTypes(
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

test("U96 — content types + element types workspace + runtime proof", async ({ page, baseURL }) => {
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

  await putDocumentTypes(page, origin, { alias: "compact_page", reset: true });
  await putBlockEditorDataTypes(page, origin, { alias: "compact_page_blocks", reset: true });

  /* —— 1–4: Settings — document types —— */
  await page.goto(`${origin}/backoffice/settings/document-types`);
  await expect(page.locator("[data-lp-u96-document-types-overview]")).toBeVisible({ timeout: 60_000 });
  await shotPage(page, "01-document-types-workspace-overview.png");

  await page.goto(`${origin}/backoffice/settings/document-types/workspace/compact_page`);
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toBeVisible({ timeout: 60_000 });
  await shotPage(page, "02-selected-document-type-compact_page.png");

  await expect(page.locator("[data-lp-document-type-group-title='content']")).toBeVisible();
  await expect(page.locator("[data-lp-document-type-property-body-title]")).toBeVisible();
  await shotPage(page, "03-property-list-group-tab-proof.png");

  await expect(page.locator("[data-lp-document-type-property-body-data-type]")).toBeVisible();
  await shotPage(page, "04-property-data-type-binding-proof.png");

  /* —— 5–6: Element types —— */
  await page.goto(`${origin}/backoffice/settings/element-types`);
  await expect(page.locator("[data-lp-u96-element-types-overview]")).toBeVisible({ timeout: 60_000 });
  await shotPage(page, "05-element-types-overview.png");

  await page.goto(`${origin}/backoffice/settings/element-types/hero`);
  await expect(page.locator("[data-lp-element-type-detail='hero']")).toBeVisible({ timeout: 60_000 });
  await shotPage(page, "06-selected-element-type-hero.png");

  const triPane = page.locator('[data-lp-content-workspace-shell="tri-pane"]');

  /* —— 7: Content editor før document type-endring —— */
  await page.goto(`${origin}/backoffice/content/${SEED_COMPACT}`);
  await waitForMainContent(page, { timeout: 90_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);
  await expect(triPane).toBeVisible({ timeout: 90_000 });
  await shotPage(page, "07-content-editor-before-document-type-change.png");

  /* —— Document type workspace: endre gruppe + property —— */
  await page.goto(`${origin}/backoffice/settings/document-types/workspace/compact_page`);
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toBeVisible({ timeout: 60_000 });
  await page.locator("[data-lp-document-type-group-title='content']").fill(GROUP_TITLE);
  await page.locator("[data-lp-document-type-property-body-title]").fill(BODY_TITLE);
  await page.locator("[data-lp-document-type-property-body-description]").fill(BODY_DESC);
  await expect(page.locator("[data-lp-document-type-dirty='true']")).toBeVisible();
  await page.locator("[data-lp-document-type-save]").click();
  await expect(page.getByText(/Lagret og publisert til settings/i)).toBeVisible({ timeout: 45_000 });
  await expect(page.locator("[data-lp-document-type-dirty='false']")).toBeVisible({ timeout: 30_000 });

  /* —— 8–14: Content etter document type —— */
  await page.goto(`${origin}/backoffice/content/${SEED_COMPACT}`);
  await waitForMainContent(page, { timeout: 90_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);
  await expect(triPane).toBeVisible({ timeout: 90_000 });
  await shotPage(page, "08-content-editor-after-document-type-change.png");

  const header = page.locator("[data-lp-document-type-canvas-header]");
  await shotLocator(header, "11-proof-current-document-type-in-editor.png");

  await expect(page.locator("[data-lp-document-type-alias]")).toContainText("compact_page");
  await expect(page.locator("[data-lp-block-editor-data-type-canvas]")).toHaveText("compact_page_blocks");
  const bindingStrip = page.locator("[data-lp-canvas-block-property-binding]").first();
  await expect(bindingStrip).toBeVisible({ timeout: 25_000 });
  await shotLocator(bindingStrip, "12-proof-current-data-type-binding.png");

  await expect(page.locator("[data-lp-document-type-property-group]")).toContainText(GROUP_TITLE);
  await expect(page.locator("[data-lp-document-type-property-title]")).toContainText(BODY_TITLE);
  await expect(page.locator("[data-lp-document-type-property-description]")).toContainText(BODY_DESC);
  await shotLocator(page.locator("[data-lp-document-type-canvas-header]"), "13-proof-changed-property-labels.png");

  await shotPage(page, "14-full-canvas-after-document-type-change.png");

  /* —— 9: Block library før data type-endring (baseline create label) —— */
  const dialogBefore = await openLibrary(page);
  await expect(dialogBefore.locator("[data-lp-library-create-label]")).toContainText("Legg til kompakt blokk");
  await shotLocator(dialogBefore, "09-block-library-before-data-type-change.png");
  await page.keyboard.press("Escape");

  /* —— Data type: create label —— */
  await page.goto(`${origin}/backoffice/settings/block-editor-data-types/compact_page_blocks`);
  await expect(page.locator("[data-lp-data-type-workspace='compact_page_blocks']")).toBeVisible({ timeout: 60_000 });
  await page.locator("[data-lp-data-type-create-label-input]").fill(LIB_LABEL_AFTER);
  await page.locator("[data-lp-data-type-save]").click();
  await expect(page.getByText(/Lagret og publisert til settings/i)).toBeVisible({ timeout: 45_000 });

  /* —— 10: Block library etter data type-endring —— */
  await page.goto(`${origin}/backoffice/content/${SEED_COMPACT}`);
  await waitForMainContent(page, { timeout: 90_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);
  await expect(triPane).toBeVisible({ timeout: 90_000 });
  const insertAfterDt = page.locator("[data-lp-insert-end]").first();
  await expect(insertAfterDt).toHaveAttribute("data-lp-block-list-create-label", LIB_LABEL_AFTER);

  const dialogAfter = await openLibrary(page);
  await expect(dialogAfter.locator("[data-lp-library-create-label]")).toContainText(LIB_LABEL_AFTER);
  await shotLocator(dialogAfter, "10-block-library-after-data-type-change.png");
  await page.keyboard.press("Escape");

  await writeFile(
    path.join(ARTIFACT_DIR, "RUNTIME-PROOF-MANIFEST.json"),
    JSON.stringify(
      {
        baseURL: origin,
        compactPageId: SEED_COMPACT,
        adminChanges: {
          documentType_compact_page: {
            groupContentTitle: GROUP_TITLE,
            bodyPropertyTitle: BODY_TITLE,
            bodyPropertyDescription: BODY_DESC,
          },
          dataType_compact_page_blocks: {
            createButtonLabel: LIB_LABEL_AFTER,
          },
        },
        runtimeObservations: [
          "Canvas header group/title/description reflect merged document type after save",
          "data-lp-document-type-alias shows compact_page",
          "data-lp-block-editor-data-type-canvas shows compact_page_blocks",
          "Block library create label matches LIB_LABEL_AFTER after data type save",
        ],
        screenshotFiles: [
          "01-document-types-workspace-overview.png",
          "02-selected-document-type-compact_page.png",
          "03-property-list-group-tab-proof.png",
          "04-property-data-type-binding-proof.png",
          "05-element-types-overview.png",
          "06-selected-element-type-hero.png",
          "07-content-editor-before-document-type-change.png",
          "08-content-editor-after-document-type-change.png",
          "09-block-library-before-data-type-change.png",
          "10-block-library-after-data-type-change.png",
          "11-proof-current-document-type-in-editor.png",
          "12-proof-current-data-type-binding.png",
          "13-proof-changed-property-labels.png",
          "14-full-canvas-after-document-type-change.png",
        ],
      },
      null,
      2,
    ),
    "utf-8",
  );
});

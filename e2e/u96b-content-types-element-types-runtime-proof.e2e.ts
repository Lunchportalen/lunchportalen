/**
 * U96B — Runtime-bevis med screenshot-nummerering 01–16 som i kravlisten.
 *
 * Boot: cross-env PORT=3047 LP_CMS_RUNTIME_MODE=local_provider npm run dev
 * Kjør: cross-env PLAYWRIGHT_BASE_URL=http://localhost:3047 npx playwright test e2e/u96b-content-types-element-types-runtime-proof.e2e.ts --project=chromium
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

const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "u96b-content-types-element-types-runtime-proof");
const SEED_COMPACT = "00000000-0000-4000-8000-00000000c004";
const SEED_HOME = "00000000-0000-4000-8000-00000000c001";

const DOC_GROUP = "U96B Kompakt gruppe";
const DOC_TITLE = "U96B Body property tittel";
const DOC_DESC = "U96B Property beskrivelse (document type)";

const CTA_TITLE = "U96B CTA (element runtime)";
const CTA_DESC = "U96B CTA beskrivelse fra element workspace";
const CTA_HELP = "U96B Editor-hjelp synlig i library";

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

async function putDocumentTypes(page: import("@playwright/test").Page, origin: string, body: Record<string, unknown>) {
  const res = await page.request.put(`${origin}/api/backoffice/cms/document-type-definitions`, {
    headers: { "content-type": "application/json", accept: "application/json" },
    data: body,
  });
  const j = await res.json().catch(() => null);
  expect(res.ok(), `PUT document-type-definitions ${res.status()} ${JSON.stringify(j)}`).toBeTruthy();
}

async function putElementRuntime(page: import("@playwright/test").Page, origin: string, body: Record<string, unknown>) {
  const res = await page.request.put(`${origin}/api/backoffice/cms/element-type-runtime`, {
    headers: { "content-type": "application/json", accept: "application/json" },
    data: body,
  });
  const j = await res.json().catch(() => null);
  expect(res.ok(), `PUT element-type-runtime ${res.status()} ${JSON.stringify(j)}`).toBeTruthy();
}

async function openLibrary(page: import("@playwright/test").Page) {
  const insertBtn = page.locator("[data-lp-insert-end]").first();
  await expect(insertBtn).toBeVisible({ timeout: 45_000 });
  await insertBtn.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole("heading", { name: "Block library" })).toBeVisible({ timeout: 25_000 });
  return dialog;
}

async function prepContentEditor(page: import("@playwright/test").Page, origin: string, id: string) {
  await page.goto(`${origin}/backoffice/content/${id}`);
  await waitForMainContent(page, { timeout: 90_000 });
  await dismissContentWorkspaceOnboardingIfPresent(page);
  await dismissEditorCoachmarkIfPresent(page);
  await expect(page.locator('[data-lp-content-workspace-shell="tri-pane"]')).toBeVisible({ timeout: 90_000 });
}

test("U96B — runtime proof document + element types (3047)", async ({ page, baseURL }) => {
  test.setTimeout(600_000);

  const creds = resolveBackofficeSuperadminCredentialsForE2E();
  expect(creds).toBeTruthy();

  const origin = baseURL ?? "http://localhost:3047";
  expect(origin, `Forventer baseURL med 3047, fikk ${origin}`).toMatch(/3047/);

  await mkdir(ARTIFACT_DIR, { recursive: true });

  await page.setViewportSize({ width: 2200, height: 1200 });
  await loginViaForm(page, creds!.email, creds!.password, "/login");
  await waitForPostLoginNavigation(page, { timeout: 120_000 });
  await assertProtectedShellReady(page);

  await putDocumentTypes(page, origin, { alias: "compact_page", reset: true });
  await putDocumentTypes(page, origin, { alias: "micro_landing", reset: true });
  await putElementRuntime(page, origin, { alias: "cta", reset: true });

  /* 01 */
  await page.goto(`${origin}/backoffice/settings/document-types`);
  await expect(page.locator("[data-lp-u96-document-types-overview]")).toBeVisible({ timeout: 60_000 });
  await shotPage(page, "01-document-types-workspace-overview.png");

  /* 02 */
  await page.goto(`${origin}/backoffice/settings/document-types/workspace/compact_page`);
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toBeVisible({ timeout: 60_000 });
  await shotPage(page, "02-compact-page-document-type-workspace.png");

  /* 03 */
  await page.goto(`${origin}/backoffice/settings/document-types/workspace/micro_landing`);
  await expect(page.locator("[data-lp-document-type-workspace='micro_landing']")).toBeVisible({ timeout: 60_000 });
  await shotPage(page, "03-micro-landing-document-type-workspace.png");

  /* 05 først (før dokumenttype-endring), deretter 04 dirty/save */
  await prepContentEditor(page, origin, SEED_COMPACT);
  await shotPage(page, "05-content-editor-before-document-type-change.png");

  await page.goto(`${origin}/backoffice/settings/document-types/workspace/compact_page`);
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toBeVisible({ timeout: 60_000 });
  await page.locator("[data-lp-document-type-group-title='content']").fill(DOC_GROUP);
  await page.locator("[data-lp-document-type-property-body-title]").fill(DOC_TITLE);
  await page.locator("[data-lp-document-type-property-body-description]").fill(DOC_DESC);
  await expect(page.locator("[data-lp-document-type-dirty='true']")).toBeVisible();
  await shotPage(page, "04-document-type-workspace-dirty-save.png");
  await page.locator("[data-lp-document-type-save]").click();
  await expect(page.getByText(/Lagret og publisert til settings/i)).toBeVisible({ timeout: 45_000 });

  /* 06 + 12–14 + 16 */
  await prepContentEditor(page, origin, SEED_COMPACT);
  await expect(page.locator("[data-lp-property-title]")).toContainText(DOC_TITLE);
  await expect(page.locator("[data-lp-document-type-property-group]")).toContainText(DOC_GROUP);
  await expect(page.locator("[data-lp-property-description]")).toContainText(DOC_DESC);
  await expect(page.locator("[data-lp-document-type-alias]")).toContainText("compact_page");
  await shotPage(page, "06-content-editor-after-document-type-change.png");

  const header = page.locator("[data-lp-document-type-canvas-header]");
  await shotLocator(header, "12-document-type-binding-proof.png");
  const binding = page.locator("[data-lp-canvas-block-property-binding]").first();
  await expect(binding).toBeVisible({ timeout: 25_000 });
  await shotLocator(binding, "13-data-type-binding-proof.png");
  await shotLocator(header, "14-changed-property-label-proof.png");
  await shotPage(page, "16-full-canvas-after-config-change.png");

  /* 10: library før elementtype-endring (CTA fortsatt code-baseline etter reset) */
  await prepContentEditor(page, origin, SEED_HOME);
  const dialogBeforeEl = await openLibrary(page);
  await shotLocator(dialogBeforeEl, "10-block-library-before-element-type-change.png");
  await page.keyboard.press("Escape");

  /* 07–09 element workspace */
  await page.goto(`${origin}/backoffice/settings/element-types`);
  await expect(page.locator("[data-lp-u96-element-types-overview]")).toBeVisible({ timeout: 60_000 });
  await shotPage(page, "07-element-types-overview.png");

  await page.goto(`${origin}/backoffice/settings/element-types/workspace/cta`);
  await expect(page.locator("[data-lp-element-type-workspace='cta']")).toBeVisible({ timeout: 60_000 });
  await shotPage(page, "08-element-type-detail-workspace.png");

  await page.locator("[data-lp-element-type-title-input]").fill(CTA_TITLE);
  await page.locator("[data-lp-element-type-description-input]").fill(CTA_DESC);
  await page.locator("[data-lp-element-type-editor-help-input]").fill(CTA_HELP);
  await expect(page.locator("[data-lp-element-type-dirty='true']")).toBeVisible();
  await shotPage(page, "09-element-type-workspace-dirty-save.png");
  await page.locator("[data-lp-element-type-save]").click();
  await expect(page.getByText(/Lagret og publisert til settings/i)).toBeVisible({ timeout: 45_000 });

  /* 11 + 15 */
  await prepContentEditor(page, origin, SEED_HOME);
  const dialogAfterEl = await openLibrary(page);
  const ctaCard = dialogAfterEl.locator('[data-lp-library-block-alias="cta"]').first();
  await expect(ctaCard.locator("[data-lp-element-type-title]")).toContainText(CTA_TITLE);
  await expect(ctaCard.locator("[data-lp-library-description]")).toContainText(CTA_DESC);
  await expect(ctaCard.locator("[data-lp-element-type-editor-help]")).toContainText(CTA_HELP);
  await shotLocator(dialogAfterEl, "11-block-library-after-element-type-change.png");
  await shotLocator(ctaCard, "15-changed-element-type-label-proof.png");
  await page.keyboard.press("Escape");

  /* allowlist proof: pricing ikke på compact */
  await prepContentEditor(page, origin, SEED_COMPACT);
  const libCompact = await openLibrary(page);
  await expect(libCompact.locator('[data-lp-library-block-alias="pricing"]')).toHaveCount(0);
  await expect(libCompact.locator('[data-lp-library-block-alias="hero"]')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");

  await writeFile(
    path.join(ARTIFACT_DIR, "RUNTIME-PROOF-MANIFEST.json"),
    JSON.stringify(
      {
        baseURL: origin,
        documentTypeWorkspaceUrls: {
          overview: `${origin}/backoffice/settings/document-types`,
          compact_page: `${origin}/backoffice/settings/document-types/workspace/compact_page`,
          micro_landing: `${origin}/backoffice/settings/document-types/workspace/micro_landing`,
        },
        elementTypeWorkspaceUrls: {
          overview: `${origin}/backoffice/settings/element-types`,
          cta: `${origin}/backoffice/settings/element-types/workspace/cta`,
        },
        adminChanges: {
          documentType_compact_page: { group: DOC_GROUP, bodyTitle: DOC_TITLE, bodyDescription: DOC_DESC },
          elementType_cta: { title: CTA_TITLE, description: CTA_DESC, editorHelpText: CTA_HELP },
        },
        screenshots: [
          "01-document-types-workspace-overview.png",
          "02-compact-page-document-type-workspace.png",
          "03-micro-landing-document-type-workspace.png",
          "04-document-type-workspace-dirty-save.png",
          "05-content-editor-before-document-type-change.png",
          "06-content-editor-after-document-type-change.png",
          "07-element-types-overview.png",
          "08-element-type-detail-workspace.png",
          "09-element-type-workspace-dirty-save.png",
          "10-block-library-before-element-type-change.png",
          "11-block-library-after-element-type-change.png",
          "12-document-type-binding-proof.png",
          "13-data-type-binding-proof.png",
          "14-changed-property-label-proof.png",
          "15-changed-element-type-label-proof.png",
          "16-full-canvas-after-config-change.png",
        ],
      },
      null,
      2,
    ),
    "utf-8",
  );
});

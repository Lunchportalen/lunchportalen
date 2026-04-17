/**
 * U97I — Proof chain integrity lock (single run, one manifest, distinct PNGs).
 * Orkestreres av scripts/u97i-proof-chain-lock.mjs (PORT 3054, local_provider).
 */
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  loginViaForm,
  resolveBackofficeSuperadminCredentialsForE2E,
  waitForPostLoginNavigation,
} from "./helpers/auth";

const ARTIFACT_DIR = "artifacts/u97i-proof-chain-lock";
const RUN_MARK = process.env.U97I_RUN_MARK?.trim() || `u97i-${Date.now()}`;

async function shotPage(page: import("@playwright/test").Page, name: string, opts?: { fullPage?: boolean }) {
  const file = path.join(ARTIFACT_DIR, name);
  await page.screenshot({ path: file, fullPage: opts?.fullPage !== false });
}

async function shotLocator(loc: import("@playwright/test").Locator, name: string) {
  const file = path.join(ARTIFACT_DIR, name);
  await loc.scrollIntoViewIfNeeded();
  await loc.screenshot({ path: file });
}

async function dismissContentOnboardingIfPresent(page: import("@playwright/test").Page) {
  try {
    await page.getByRole("button", { name: "Hopp over" }).click({ timeout: 4000 });
  } catch {
    /* no overlay */
  }
}

/** Bellissima workspace may restore «Forhåndsvisning» — editor canvas (WorkspaceBody) only mounts for «Innhold». */
async function ensureContentWorkspaceInnholdView(page: import("@playwright/test").Page) {
  const nav = page.getByRole("navigation", { name: "Content workspace views" });
  await expect(nav).toBeVisible({ timeout: 120_000 });
  await nav.locator('[data-lp-workspace-view-tab="content"]').click({ timeout: 30_000 });
  await expect(page.locator("#lp-content-editor-canvas")).toBeAttached({ timeout: 180_000 });
  await expect(page.locator("#lp-content-editor-canvas [data-lp-document-type-canvas-header]")).toBeVisible({
    timeout: 180_000,
  });
}

function contentPageIdFromUrl(url: string): string {
  const pathLast = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
  return pathLast.split("?")[0] ?? "";
}

test("U97I proof chain lock — single run browser proof", async ({ page }) => {
  test.setTimeout(600_000);
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const creds = resolveBackofficeSuperadminCredentialsForE2E();
  if (!creds) throw new Error("Missing superadmin credentials for e2e");

  await page.setViewportSize({ width: 1920, height: 1080 });

  await loginViaForm(page, creds.email, creds.password, "/backoffice/settings/document-types");
  await waitForPostLoginNavigation(page, { timeout: 60_000 });

  await page.goto("/backoffice/settings/document-types");
  await expect(page.locator("[data-lp-u96-document-types-overview]")).toBeVisible();
  await shotPage(page, "01-document-types-overview.png");

  const compactWorkspaceHref = await page
    .locator("a[href*='/backoffice/settings/document-types/workspace/compact_page']")
    .first()
    .getAttribute("href");
  if (!compactWorkspaceHref) throw new Error("Could not resolve compact_page workspace link.");
  await page.goto(compactWorkspaceHref);
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toBeVisible({ timeout: 20_000 });
  await shotPage(page, "02-compact-page-document-type-workspace.png");

  const bodyTitleInput = page.locator("[data-lp-document-type-property-body-title]");
  const bodyDescInput = page.locator("[data-lp-document-type-property-body-description]");
  await expect(bodyTitleInput).toBeVisible();
  const currentTitle = await bodyTitleInput.inputValue();
  const nextTitle = `${currentTitle} · ${RUN_MARK}`;
  await bodyTitleInput.fill(nextTitle);
  const nextDesc = `U97I property-beskrivelse ${RUN_MARK}`;
  await bodyDescInput.fill(nextDesc);
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toHaveAttribute(
    "data-lp-document-type-dirty",
    "true",
  );
  await shotPage(page, "03-document-type-dirty-save-state.png");
  await page.locator("[data-lp-document-type-save]").click();
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toHaveAttribute(
    "data-lp-document-type-dirty",
    "false",
  );

  const homeRes = await page.request.get("/api/backoffice/content/home");
  const homeJson = (await homeRes.json()) as { data?: { page?: { id?: string } } };
  const homePageId = homeJson?.data?.page?.id ?? null;
  if (!homePageId) throw new Error("Could not resolve home page id.");

  await page.goto(`/backoffice/content/${homePageId}`);
  await page.waitForLoadState("networkidle");
  await dismissContentOnboardingIfPresent(page);
  await expect(page.getByText("Laster tre…")).toHaveCount(0, { timeout: 60_000 });

  const overlaysTreeNode = page.locator("[role='treeitem']").filter({ hasText: "App overlays" }).first();
  await expect(overlaysTreeNode).toBeVisible({ timeout: 60_000 });
  const parentNodeId = (await overlaysTreeNode.getAttribute("data-lp-content-tree-node-id")) ?? "";
  if (!parentNodeId) throw new Error("Missing parent node id (App overlays).");

  await overlaysTreeNode.locator("button[aria-label='Handlinger']").click();
  const overlaysMenu = page.locator("[role='menu']").last();
  await expect(overlaysMenu).toBeVisible();
  await overlaysMenu.getByRole("menuitem", { name: "Opprett under" }).click();
  await page.locator("[data-lp-create-child-dialog]").waitFor({ state: "visible", timeout: 30_000 });
  await page
    .locator("[data-lp-create-child-dialog] button[data-lp-create-child-option][data-lp-create-child-option-alias='compact_page']")
    .click();
  await expect(
    page.locator("[data-lp-create-child-dialog] button[data-lp-create-child-option][data-lp-create-child-option-alias='micro_landing']"),
  ).toHaveCount(0);
  await shotLocator(page.locator("[data-lp-create-child-dialog]"), "04-create-dialog-parent-to-compact-page.png");

  const slugUnique = `${RUN_MARK}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const compactTitle = `U97I Compact ${slugUnique}`;
  const compactCreateResp = page.waitForResponse(
    (res) =>
      res.url().includes("/api/backoffice/content/pages") &&
      res.request().method() === "POST",
    { timeout: 90_000 },
  );
  await page.locator("[data-lp-create-child-dialog] input[placeholder='Ny side']").fill(compactTitle);
  await page.locator("[data-lp-create-child-dialog] input[placeholder='ny-side']").fill(`u97i-compact-${slugUnique}`);
  await page.locator("[data-lp-create-child-dialog] button:has-text('Opprett')").click();
  const compactResp = await compactCreateResp;
  if (!compactResp.ok()) {
    throw new Error(`compact_page POST failed: ${compactResp.status()} ${(await compactResp.text()).slice(0, 500)}`);
  }
  const compactCreateJson = (await compactResp.json()) as { data?: { page?: { id?: string } } };
  const compactPageId = compactCreateJson?.data?.page?.id ?? "";
  if (!compactPageId) throw new Error("Missing created compact page id from POST response.");
  expect(compactPageId, "Created compact page must not reuse home id").not.toBe(homePageId);
  await page.waitForURL((url) => contentPageIdFromUrl(url.href) === compactPageId, { timeout: 60_000 });
  await dismissContentOnboardingIfPresent(page);
  await ensureContentWorkspaceInnholdView(page);
  await shotLocator(page.locator("[data-lp-content-tree]"), "05-compact-page-created-visible-in-tree.png");

  await shotLocator(page.locator("[data-lp-content-workspace-shell]").first(), "06-compact-page-editor.png");

  await page.locator("#content-tree-filter").fill(compactTitle);
  const compactTreeNode = page.locator("[role='treeitem']").filter({ hasText: compactTitle }).first();
  await expect(compactTreeNode).toBeVisible({ timeout: 30_000 });
  await compactTreeNode.locator("button[aria-label='Handlinger']").click();
  const compactMenu = page.locator("[role='menu']").last();
  await expect(compactMenu).toBeVisible();
  await compactMenu.getByRole("menuitem", { name: "Opprett under" }).click();
  await page.locator("[data-lp-create-child-dialog]").waitFor({ state: "visible", timeout: 30_000 });
  await expect(
    page.locator("[data-lp-create-child-dialog] button[data-lp-create-child-option][data-lp-create-child-option-alias='micro_landing']"),
  ).toBeVisible();
  await expect(
    page.locator("[data-lp-create-child-dialog] button[data-lp-create-child-option][data-lp-create-child-option-alias='compact_page']"),
  ).toHaveCount(0);
  await shotLocator(page.locator("[data-lp-create-child-dialog]"), "07-create-dialog-compact-page-to-micro-landing.png");

  const microSlugUnique = `${RUN_MARK}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const microTitle = `U97I Micro ${microSlugUnique}`;
  const microCreateResp = page.waitForResponse(
    (res) =>
      res.url().includes("/api/backoffice/content/pages") &&
      res.request().method() === "POST",
    { timeout: 90_000 },
  );
  await page.locator("[data-lp-create-child-dialog] input[placeholder='Ny side']").fill(microTitle);
  await page.locator("[data-lp-create-child-dialog] input[placeholder='ny-side']").fill(`u97i-micro-${microSlugUnique}`);
  await page.locator("[data-lp-create-child-dialog] button:has-text('Opprett')").click();
  const microResp = await microCreateResp;
  if (!microResp.ok()) {
    throw new Error(`micro_landing POST failed: ${microResp.status()} ${(await microResp.text()).slice(0, 500)}`);
  }
  const microCreateJson = (await microResp.json()) as { data?: { page?: { id?: string } } };
  const microPageId = microCreateJson?.data?.page?.id ?? "";
  if (!microPageId) throw new Error("Missing created micro_landing page id from POST response.");
  expect(microPageId, "Micro page must differ from compact").not.toBe(compactPageId);
  await page.waitForURL((url) => contentPageIdFromUrl(url.href) === microPageId, { timeout: 60_000 });
  await dismissContentOnboardingIfPresent(page);
  await ensureContentWorkspaceInnholdView(page);
  await shotPage(page, "08-micro-landing-created-visible-in-tree-editor.png", { fullPage: true });

  await page.goto("/backoffice/settings/document-types/workspace/compact_page");
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toBeVisible({ timeout: 20_000 });
  await shotLocator(page.locator("[data-lp-document-type-structure]"), "09-structure-allowed-disallowed-child-proof.png");

  await page.goto(`/backoffice/content/${compactPageId}`);
  await page.waitForLoadState("networkidle");
  await dismissContentOnboardingIfPresent(page);
  await ensureContentWorkspaceInnholdView(page);
  await expect(page.locator("[data-lp-document-type-alias]").first()).toHaveText("compact_page", { timeout: 30_000 });
  const compositionSection = page
    .locator("section.rounded-xl")
    .filter({ has: page.locator("[data-lp-block-editor-data-type-canvas]") })
    .first();
  await expect(compositionSection).toBeVisible({ timeout: 30_000 });
  await shotLocator(compositionSection, "10-document-type-composition-effect-proof.png");

  const canvasHeader = page.locator("#lp-content-editor-canvas [data-lp-document-type-canvas-header]").first();
  await expect(canvasHeader).toBeVisible({ timeout: 30_000 });
  const compactTemplateBinding = await canvasHeader
    .locator("[data-lp-template-binding-alias]")
    .getAttribute("data-lp-template-binding-alias");
  if (!compactTemplateBinding?.trim() || compactTemplateBinding.trim() === "—") {
    throw new Error(`Missing compact_page template binding alias from canvas (got: ${compactTemplateBinding ?? ""}).`);
  }

  await shotLocator(canvasHeader.locator("[data-lp-template-binding]"), "11-template-rendering-binding-proof.png");
  await shotLocator(canvasHeader.locator("[data-lp-document-type-alias]"), "12-current-document-type-binding-proof.png");

  await page.goto(`/backoffice/content/${microPageId}`);
  await page.waitForLoadState("networkidle");
  await dismissContentOnboardingIfPresent(page);
  await expect(page.locator("[data-lp-document-type-canvas-header] [data-lp-document-type-alias]").first()).toHaveText(
    "micro_landing",
    { timeout: 30_000 },
  );
  const microCanvas = page.locator("[data-lp-document-type-canvas-header]").first();
  const microTemplateBinding = await microCanvas.locator("[data-lp-template-binding-alias]").getAttribute("data-lp-template-binding-alias");
  if (!microTemplateBinding?.trim() || microTemplateBinding.trim() === "—") {
    throw new Error(`Missing micro_landing template binding alias from canvas (got: ${microTemplateBinding ?? ""}).`);
  }

  await page.goto(`/backoffice/content/${homePageId}`);
  await page.waitForLoadState("networkidle");
  await dismissContentOnboardingIfPresent(page);
  await ensureContentWorkspaceInnholdView(page);
  await expect(page.locator("[data-lp-content-tree]")).toBeVisible();
  await shotPage(page, "13-full-content-tree-editor-after-create-flow.png", { fullPage: true });

  const dtRes = await page.request.get("/api/backoffice/cms/document-type-definitions");
  const dtJson = (await dtRes.json()) as {
    data?: { merged?: Record<string, { properties?: Array<{ alias: string; title?: string; description?: string }> }> };
  };
  const bodyProp = dtJson?.data?.merged?.compact_page?.properties?.find((p) => p.alias === "body");
  const savedTitle = bodyProp?.title?.trim() ?? "";
  const savedDesc = bodyProp?.description?.trim() ?? "";
  if (!savedTitle.includes(RUN_MARK)) {
    throw new Error(`Expected persisted body title to include run mark; got: ${savedTitle}`);
  }
  if (!savedDesc.includes(RUN_MARK)) {
    throw new Error(`Expected persisted body description to include run mark; got: ${savedDesc}`);
  }

  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "runtime-proof.json"),
    JSON.stringify(
      {
        runMark: RUN_MARK,
        createdNodes: {
          parentNodeId,
          compactPageId,
          microLandingId: microPageId,
        },
        runtimeValues: {
          compactPageDocumentTypeAlias: "compact_page",
          microLandingDocumentTypeAlias: "micro_landing",
          compactPageTemplateAlias: compactTemplateBinding,
          microLandingTemplateAlias: microTemplateBinding,
          changedPropertyTitle: savedTitle,
          changedPropertyDescriptionOrGroup: savedDesc,
        },
        domCompactTemplateAlias: compactTemplateBinding,
        domMicroTemplateAlias: microTemplateBinding,
      },
      null,
      2,
    ),
    "utf8",
  );
});

import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  loginViaForm,
  resolveBackofficeSuperadminCredentialsForE2E,
  waitForPostLoginNavigation,
} from "./helpers/auth";

const ARTIFACT_DIR = "artifacts/u97g-content-structure-live-proof";

async function shot(page: import("@playwright/test").Page, name: string) {
  const file = path.join(ARTIFACT_DIR, name);
  await page.screenshot({ path: file, fullPage: true });
}

/** Content workspace onboarding overlay blocks tree/actions until dismissed. */
async function dismissContentOnboardingIfPresent(page: import("@playwright/test").Page) {
  try {
    await page.getByRole("button", { name: "Hopp over" }).click({ timeout: 4000 });
  } catch {
    /* no overlay */
  }
}

function contentPageIdFromUrl(url: string): string {
  const pathLast = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
  return pathLast.split("?")[0] ?? "";
}

test("U97E schema-aware create flow runtime proof", async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const creds = resolveBackofficeSuperadminCredentialsForE2E();
  if (!creds) throw new Error("Missing superadmin credentials for e2e");

  await page.setViewportSize({ width: 1536, height: 900 });

  await loginViaForm(page, creds.email, creds.password, "/backoffice/settings/document-types");
  await waitForPostLoginNavigation(page, { timeout: 60_000 });

  await page.goto("/backoffice/settings/document-types");
  await expect(page.locator("[data-lp-u96-document-types-overview]")).toBeVisible();
  await shot(page, "01-document-types-overview.png");

  const compactWorkspaceHref = await page
    .locator("a[href*='/backoffice/settings/document-types/workspace/compact_page']")
    .first()
    .getAttribute("href");
  if (!compactWorkspaceHref) throw new Error("Could not resolve compact_page workspace link.");
  await page.goto(compactWorkspaceHref);
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toBeVisible({ timeout: 20_000 });
  await shot(page, "02-compact-page-workspace.png");

  const bodyTitleInput = page.locator("[data-lp-document-type-property-body-title]");
  await expect(bodyTitleInput).toBeVisible();
  const currentTitle = await bodyTitleInput.inputValue();
  const nextTitle = `${currentTitle} U97E`;
  await bodyTitleInput.fill(nextTitle);
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toHaveAttribute("data-lp-document-type-dirty", "true");
  await shot(page, "03-document-type-dirty-save-state.png");
  await page.locator("[data-lp-document-type-save]").click();
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toHaveAttribute("data-lp-document-type-dirty", "false");

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
  await overlaysTreeNode.locator("button[aria-label='Handlinger']").click();
  const overlaysMenu = page.locator("[role='menu']").last();
  await expect(overlaysMenu).toBeVisible();
  await overlaysMenu.getByRole("menuitem", { name: "Opprett under" }).click();
  await page.locator("[data-lp-create-child-dialog]").waitFor({ state: "visible", timeout: 30_000 });
  await page
    .locator("[data-lp-create-child-dialog] button[data-lp-create-child-option][data-lp-create-child-option-alias='compact_page']")
    .click();
  await expect(
    page.locator("[data-lp-create-child-dialog] button[data-lp-create-child-option][data-lp-create-child-option-alias='compact_page']"),
  ).toBeVisible();
  await expect(
    page.locator("[data-lp-create-child-dialog] button[data-lp-create-child-option][data-lp-create-child-option-alias='micro_landing']"),
  ).toHaveCount(0);
  await shot(page, "04-create-dialog-parent-to-compact.png");

  const compactTitle = `U97E Compact ${Date.now()}`;
  await page.locator("[data-lp-create-child-dialog] input[placeholder='Ny side']").fill(compactTitle);
  await page.locator("[data-lp-create-child-dialog] input[placeholder='ny-side']").fill(`u97e-compact-${Date.now()}`);
  const compactCreateResp = page.waitForResponse(
    (res) =>
      res.url().includes("/api/backoffice/content/pages") &&
      res.request().method() === "POST" &&
      res.ok(),
    { timeout: 60_000 },
  );
  await page.locator("[data-lp-create-child-dialog] button:has-text('Opprett')").click();
  const compactCreateJson = (await (await compactCreateResp).json()) as { data?: { page?: { id?: string } } };
  const compactPageId = compactCreateJson?.data?.page?.id ?? "";
  if (!compactPageId) throw new Error("Missing created compact page id from POST response.");
  expect(compactPageId, "Created compact page must not reuse home id").not.toBe(homePageId);
  await page.waitForURL(
    (url) => contentPageIdFromUrl(url.href) === compactPageId,
    { timeout: 60_000 },
  );
  await dismissContentOnboardingIfPresent(page);
  await shot(page, "05-compact-created-in-tree.png");
  await shot(page, "06-compact-page-editor.png");

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
  await shot(page, "07-create-dialog-compact-to-micro.png");
  await shot(page, "09-structure-allowed-disallowed-child-proof.png");

  const microTitle = `U97E Micro ${Date.now()}`;
  await page.locator("[data-lp-create-child-dialog] input[placeholder='Ny side']").fill(microTitle);
  await page.locator("[data-lp-create-child-dialog] input[placeholder='ny-side']").fill(`u97e-micro-${Date.now()}`);
  const microCreateResp = page.waitForResponse(
    (res) =>
      res.url().includes("/api/backoffice/content/pages") &&
      res.request().method() === "POST" &&
      res.ok(),
    { timeout: 60_000 },
  );
  await page.locator("[data-lp-create-child-dialog] button:has-text('Opprett')").click();
  const microCreateJson = (await (await microCreateResp).json()) as { data?: { page?: { id?: string } } };
  const microPageId = microCreateJson?.data?.page?.id ?? "";
  if (!microPageId) throw new Error("Missing created micro_landing page id from POST response.");
  expect(microPageId, "Micro page must differ from compact").not.toBe(compactPageId);
  await page.waitForURL(
    (url) => contentPageIdFromUrl(url.href) === microPageId,
    { timeout: 60_000 },
  );
  await dismissContentOnboardingIfPresent(page);
  await shot(page, "08-micro-landing-created-in-tree-editor.png");

  await page.goto(`/backoffice/content/${compactPageId}`);
  await expect(page).toHaveURL(new RegExp(`/backoffice/content/${compactPageId}`));
  await page.waitForLoadState("networkidle");
  await dismissContentOnboardingIfPresent(page);
  await expect(page.locator("[data-lp-document-type-alias]").first()).toHaveText("compact_page", { timeout: 30_000 });
  await expect(page.getByText(/dokumenttype.*compact_page/)).toBeVisible();
  await expect(page.getByText(/U97E/).first()).toBeVisible();
  await shot(page, "10-document-type-effect-in-editor.png");
  const bindingAlias = page.locator("[data-lp-template-binding-alias]").first();
  await expect(bindingAlias).toHaveAttribute("data-lp-template-binding-alias", /\S+/);
  await shot(page, "11-template-rendering-binding-proof.png");
  await shot(page, "12-current-document-type-binding-proof.png");

  await page.goto("/backoffice/settings/document-types");
  const microWorkspaceHref = await page
    .locator("a[href*='/backoffice/settings/document-types/workspace/micro_landing']")
    .first()
    .getAttribute("href");
  if (!microWorkspaceHref) throw new Error("Could not resolve micro_landing workspace link.");
  await page.goto(microWorkspaceHref);
  await expect(page.locator("[data-lp-document-type-workspace='micro_landing']")).toBeVisible({ timeout: 20_000 });

  await page.goto(`/backoffice/content/${compactPageId}`);
  await page.waitForLoadState("networkidle");
  await dismissContentOnboardingIfPresent(page);
  await expect(page.locator("[data-lp-content-tree]")).toBeVisible();
  await shot(page, "13-full-content-tree-editor-after-change.png");

  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "node-ids.json"),
    JSON.stringify(
      { homePageId, compactPageId, microPageId, capturedAt: new Date().toISOString() },
      null,
      2,
    ),
    "utf8",
  );
});
